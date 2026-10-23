import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinarySdk } from "cloudinary";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { mediaPolicy } from "../src/config/media";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
loadEnv();

type EnvModule = typeof import("../src/config/env");
type CloudinaryModule = Pick<typeof import("../src/server/integrations/cloudinary"), "createUploadSignature" | "verifyCloudinaryAsset" | "deleteCloudinaryAsset" | "normalizeCloudinaryFolder">;

type Candidate = {
  objectNumber: number;
  assetId: string;
  sourceSha256: string;
  width: number;
  height: number;
  category: "Farm" | "Nature";
  altText: string;
  experienceSlug: string;
};

const candidates: readonly Candidate[] = [
  {
    objectNumber: 531,
    assetId: "00000000-0000-4531-8531-000000000001",
    sourceSha256: "6dba268433f1811db77dfca85b4c76954af785b26e8b4e04fe9bd05729164d7e",
    width: 1600,
    height: 1200,
    category: "Farm",
    altText: "Farm plot with a Marathi sign behind a wooden fence.",
    experienceSlug: "organic-farming",
  },
  {
    objectNumber: 534,
    assetId: "00000000-0000-4534-8534-000000000001",
    sourceSha256: "c3c67d6ce831647f73196943e21e97ddf176755e6cd3ee97a455f8f473fd7035",
    width: 1600,
    height: 1200,
    category: "Nature",
    altText: "Pink flowers and buds growing beside a farm building.",
    experienceSlug: "horticultural-farming",
  },
] as const;

const uploadResponseSchema = z.object({ public_id: z.string().min(1), resource_type: z.literal("image") }).passthrough();
const args = process.argv.slice(2);
const debug = args.includes("--debug");

function argument(name: string): string | undefined {
  const index = args.indexOf(name);
  const value = args.at(index + 1);
  return index >= 0 && value && !value.startsWith("--") ? value : undefined;
}

function requireArgument(name: string): string {
  const value = argument(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function extractPdfJpeg(pdf: Buffer, candidate: Candidate): Promise<Buffer> {
  const objectMarker = Buffer.from(`${candidate.objectNumber} 0 obj\n<<`, "latin1");
  const objectStart = pdf.indexOf(objectMarker);
  const streamMarker = Buffer.from(">>\nstream\n", "latin1");
  const streamStart = objectStart >= 0 ? pdf.indexOf(streamMarker, objectStart + objectMarker.length) : -1;
  if (objectStart < 0 || streamStart < 0) throw new Error(`PDF image object ${candidate.objectNumber} was not found.`);

  const dictionary = pdf.subarray(objectStart + objectMarker.length, streamStart).toString("latin1");
  const width = Number(/\/Width +(\d+)/.exec(dictionary)?.[1]);
  const height = Number(/\/Height +(\d+)/.exec(dictionary)?.[1]);
  const length = Number(/\/Length +(\d+)/.exec(dictionary)?.[1]);
  if (width !== candidate.width || height !== candidate.height || !Number.isSafeInteger(length) || length <= 0) {
    throw new Error(`PDF image object ${candidate.objectNumber} metadata changed; refusing to seed it.`);
  }

  const start = streamStart + streamMarker.length;
  const image = pdf.subarray(start, start + length);
  const hash = createHash("sha256").update(image).digest("hex");
  if (hash !== candidate.sourceSha256 || image.subarray(0, 3).toString("hex") !== "ffd8ff" || image.subarray(-2).toString("hex") !== "ffd9") {
    throw new Error(`PDF image object ${candidate.objectNumber} failed its source check; refusing to seed it.`);
  }
  return image;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function publicIdFromSignature(signed: ReturnType<CloudinaryModule["createUploadSignature"]>): string {
  const params = signed.signedParams as Record<string, unknown>;
  const publicId = String(params.public_id ?? "");
  const prefix = String(params.public_id_prefix ?? params.folder ?? "").replace(/^\/+|\/+$/g, "");
  return publicId.startsWith(`${prefix}/`) || !prefix ? publicId : `${prefix}/${publicId}`;
}

async function printCloudinaryDiagnostic({ env, cloudinary, signed, publicId, expectedFolder }: {
  env: EnvModule["env"];
  cloudinary: CloudinaryModule;
  signed: ReturnType<CloudinaryModule["createUploadSignature"]>;
  publicId: string;
  expectedFolder: string;
}) {
  if (!debug || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return;
  const params = signed.signedParams as Record<string, unknown>;
  const signedRaw = String(params.asset_folder ?? params.folder ?? "");
  const signedNormalized = cloudinary.normalizeCloudinaryFolder(signedRaw);
  const expectedNormalized = cloudinary.normalizeCloudinaryFolder(expectedFolder);
  cloudinarySdk.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
  let response: Record<string, unknown> | null = null;
  try {
    const remote = await cloudinarySdk.api.resource(publicId, { resource_type: "image", type: "upload" });
    if (remote && typeof remote === "object") response = remote as Record<string, unknown>;
  } catch {
    // A missing resource is expected before the first upload; do not print SDK errors.
  }
  const assetFolder = typeof response?.asset_folder === "string" ? response.asset_folder : undefined;
  const normalizedAssetFolder = cloudinary.normalizeCloudinaryFolder(assetFolder);
  const remotePublicId = typeof response?.public_id === "string" ? response.public_id : undefined;
  const dynamic = Boolean(assetFolder && normalizedAssetFolder && remotePublicId && !remotePublicId.startsWith(`${normalizedAssetFolder}/`));
  console.log(`[debug] Cloudinary folder diagnostic ${JSON.stringify({
    signedFolder: { raw: signedRaw, normalized: signedNormalized },
    expectedFolder: { raw: expectedFolder, normalized: expectedNormalized },
    response: response ? {
      asset_folder: response.asset_folder ?? null,
      folder: response.folder ?? null,
      public_id: response.public_id ?? null,
      display_name: response.display_name ?? null,
      resource_type: response.resource_type ?? null,
      type: response.type ?? null,
    } : null,
    detectedFolderMode: response ? (dynamic ? "dynamic" : "fixed") : "unavailable-no-asset",
  })}`);
}

async function uploadAndRecord({ db, cloudinary, env, staffId, pdf, candidate }: {
  db: PrismaClient;
  cloudinary: CloudinaryModule;
  env: EnvModule["env"];
  staffId: string;
  pdf: Buffer;
  candidate: Candidate;
}) {
  const image = await extractPdfJpeg(pdf, candidate);
  const webhookUrl = new URL("/api/webhooks/cloudinary", env.NEXT_PUBLIC_SITE_URL).toString();
  const signed = cloudinary.createUploadSignature({ purpose: "admin_image", userId: staffId, webhookUrl, assetId: candidate.assetId });
  const expectedPublicId = publicIdFromSignature(signed);

  let media = await db.media.findUnique({ where: { publicId: expectedPublicId } });
  let verification = await cloudinary.verifyCloudinaryAsset({ purpose: "admin_image", userId: staffId, publicId: expectedPublicId });
  if (!verification.valid) {
    await printCloudinaryDiagnostic({ env, cloudinary, signed, publicId: expectedPublicId, expectedFolder: mediaPolicy("admin_image").folder(staffId) });
    if (media) {
      const removed = await cloudinary.deleteCloudinaryAsset({ publicId: expectedPublicId, resourceType: "image", deliveryType: "upload" });
      if (!removed) throw new Error(`Existing Cloudinary asset failed verification and could not be removed: ${verification.reason}`);
    }
    const form = new FormData();
    const uploadBytes = new Uint8Array(image.byteLength);
    uploadBytes.set(image);
    form.append("file", new Blob([uploadBytes.buffer as ArrayBuffer], { type: "image/jpeg" }), `pdf-object-${candidate.objectNumber}.jpg`);
    form.append("api_key", signed.apiKey);
    form.append("signature", signed.signature);
    for (const [key, value] of Object.entries(signed.signedParams)) form.append(key, String(value));
    const response = await fetch(signed.uploadEndpoint, { method: "POST", body: form });
    if (!response.ok) throw new Error(`Cloudinary upload failed with HTTP ${response.status}.`);
    const uploaded = uploadResponseSchema.safeParse(await response.json().catch(() => undefined));
    if (!uploaded.success) throw new Error("Cloudinary returned an invalid upload response.");
    if (uploaded.data.public_id !== expectedPublicId) {
      const removed = await cloudinary.deleteCloudinaryAsset({ publicId: uploaded.data.public_id, resourceType: "image", deliveryType: "upload" });
      throw new Error(`Cloudinary returned an unexpected asset identity; uploaded asset cleanup ${removed ? "succeeded" : "failed"}.`);
    }
    verification = await cloudinary.verifyCloudinaryAsset({ purpose: "admin_image", userId: staffId, publicId: uploaded.data.public_id });
    if (!verification.valid) {
      await printCloudinaryDiagnostic({ env, cloudinary, signed, publicId: uploaded.data.public_id, expectedFolder: mediaPolicy("admin_image").folder(staffId) });
      const removed = await cloudinary.deleteCloudinaryAsset({ publicId: uploaded.data.public_id, resourceType: "image", deliveryType: "upload" });
      throw new Error(`Cloudinary verification failed: ${verification.reason}; uploaded asset cleanup ${removed ? "succeeded" : "failed"}.`);
    }
  }

  const mediaData = {
    kind: verification.asset.kind,
    origin: verification.asset.origin,
    publicId: verification.asset.publicId,
    resourceType: verification.asset.resourceType,
    deliveryType: verification.asset.deliveryType,
    format: verification.asset.format,
    bytes: verification.asset.bytes,
    width: verification.asset.width,
    height: verification.asset.height,
    durationSec: verification.asset.durationSec,
    contentHash: verification.asset.contentHash,
    altText: asJson({ en: candidate.altText }),
    tags: ["provisional-pdf"],
    category: candidate.category,
    meta: asJson({ provisional: true, source: { file: "docs/source/CHAWAN FARM PRESENTATION 01.10.2026.pdf", objectNumber: candidate.objectNumber, sha256: candidate.sourceSha256 }, replacement: "Replace with original client photograph." }),
    uploadedById: staffId,
    isPublic: true,
  };
  media = media ? await db.media.update({ where: { id: media.id }, data: mediaData }) : await db.media.create({ data: mediaData });
  return media;
}

async function addUsage(db: PrismaClient, mediaId: string, entityType: string, entityId: string, field: string) {
  await db.mediaUsage.upsert({ where: { mediaId_entityType_entityId_field: { mediaId, entityType, entityId, field } }, update: {}, create: { mediaId, entityType, entityId, field } });
}

async function attachExperience(db: PrismaClient, mediaId: string, slug: string) {
  const experience = await db.experience.findUnique({ where: { slug }, select: { id: true } });
  if (!experience) return false;
  await db.experience.update({ where: { id: experience.id }, data: { heroMediaId: mediaId } });
  await addUsage(db, mediaId, "Experience", experience.id, "hero");
  return true;
}

async function main() {
  const config = (await import("../src/config/env")) as unknown as EnvModule;
  const env = config.env;
  if (env.APP_ENV === "production") throw new Error("Refusing to seed provisional images while APP_ENV=production.");
  if (env.CLOUDINARY_TEST_MODE) throw new Error("Refusing to seed provisional images while Cloudinary test mode is enabled.");
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");

  const pdfPath = resolve(requireArgument("--pdf"));
  const staffId = requireArgument("--staff-id");
  // This is a deliberate local CLI input, not a path derived from request data.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const pdf = await readFile(pdfPath);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  const loadedCloudinary = (await import("../src/server/integrations/cloudinary")) as unknown as { default?: CloudinaryModule } & CloudinaryModule;
  const cloudinary = loadedCloudinary.default ?? loadedCloudinary;
  const webhookUrl = new URL("/api/webhooks/cloudinary", env.NEXT_PUBLIC_SITE_URL).toString();

  if (debug) {
    for (const candidate of candidates) {
      const signed = cloudinary.createUploadSignature({ purpose: "admin_image", userId: staffId, webhookUrl, assetId: candidate.assetId });
      await printCloudinaryDiagnostic({ env, cloudinary, signed, publicId: publicIdFromSignature(signed), expectedFolder: mediaPolicy("admin_image").folder(staffId) });
    }
  }

  try {
    const staff = await db.user.findFirst({ where: { id: staffId, type: "STAFF", status: "ACTIVE", deletedAt: null }, select: { id: true } });
    if (!staff) throw new Error("The supplied staff ID is not an active DEV staff account.");
    const home = await db.page.findFirst({ where: { slug: "home", deletedAt: null }, select: { id: true, sections: { where: { type: "hero" }, take: 1, select: { id: true, content: true } } } });
    if (!home?.sections[0]) throw new Error("The Home page has no hero section.");

    const mediaByObject = new Map<number, Awaited<ReturnType<typeof db.media.create>>>();
    for (const candidate of candidates) mediaByObject.set(candidate.objectNumber, await uploadAndRecord({ db, cloudinary, env, staffId: staff.id, pdf, candidate }));

    const farmMedia = mediaByObject.get(531);
    const flowerMedia = mediaByObject.get(534);
    if (!farmMedia || !flowerMedia) throw new Error("The expected provisional media records were not created.");

    const heroContent = home.sections[0].content && typeof home.sections[0].content === "object" && !Array.isArray(home.sections[0].content) ? home.sections[0].content as Record<string, unknown> : {};
    await db.pageSection.update({ where: { id: home.sections[0].id }, data: { content: asJson({ ...heroContent, imageMediaId: farmMedia.id }) } });
    await addUsage(db, farmMedia.id, "PageSection", home.sections[0].id, "image");
    for (const candidate of candidates) {
      const media = mediaByObject.get(candidate.objectNumber);
      if (!media) throw new Error(`Missing media for PDF object ${candidate.objectNumber}.`);
      await attachExperience(db, media.id, candidate.experienceSlug);
    }

    for (const candidate of candidates) {
      const media = mediaByObject.get(candidate.objectNumber);
      if (!media) throw new Error(`Missing media for PDF object ${candidate.objectNumber}.`);
      const gallery = await db.galleryItem.findFirst({ where: { mediaId: media.id, deletedAt: null }, select: { id: true } });
      const item = gallery
        ? await db.galleryItem.update({ where: { id: gallery.id }, data: { category: candidate.category, status: "PUBLISHED", publishAt: null } })
        : await db.galleryItem.create({ data: { mediaId: media.id, category: candidate.category, status: "PUBLISHED", publishAt: null, caption: asJson({ en: candidate.altText }), sortOrder: 0 } });
      await addUsage(db, media.id, "GalleryItem", item.id, "media");
    }

    console.log("Seeded 2 provisional PDF images in DEV: Home hero, 2 related experiences, and 2 gallery items.");
    console.log("No accommodation, package, or activity image was attached because no reviewed PDF image was an honest match.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Provisional image seed failed.");
  process.exitCode = 1;
});
