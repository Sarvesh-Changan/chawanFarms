"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Film, Image as ImageIcon, Loader2, Play, Plus, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMediaBytes, mediaPolicy } from "@/config/media";
import { batchCreateGalleryItemsAction } from "@/server/actions/gallery-batch";
import { GalleryCategoryManagerModal } from "./GalleryCategoryManagerModal";

type Signature = {
  apiKey: string;
  uploadEndpoint: string;
  signature: string;
  signedParams: Record<string, string | number | boolean>;
};

function extension(file: File): string {
  return file.name.split(".").at(-1)?.toLowerCase() ?? "";
}

function uploadToCloudinary(
  endpoint: string,
  data: FormData,
  onProgress: (value: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onerror = () => reject(new Error("Upload connection failed."));
    request.onload = () => {
      try {
        const value = JSON.parse(request.responseText) as unknown;
        if (request.status >= 200 && request.status < 300) resolve(value);
        else reject(new Error("Cloudinary could not accept this file."));
      } catch {
        reject(new Error("Cloudinary returned an invalid response."));
      }
    };
    request.send(data);
  });
}

async function uploadMediaFile(
  file: File,
  kind: "IMAGE" | "VIDEO",
  caption: string,
  onProgress: (value: number) => void,
): Promise<{ mediaId: string; publicId: string }> {
  const purpose = kind === "VIDEO" ? "admin_video" : "admin_image";
  const signatureResponse = await fetch("/api/upload-signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose }),
  });

  const signature = (await signatureResponse.json().catch(() => undefined)) as Partial<Signature>;
  if (!signatureResponse.ok || !signature.apiKey || !signature.uploadEndpoint || !signature.signature || !signature.signedParams) {
    throw new Error("Could not authorize upload with Cloudinary.");
  }

  const data = new FormData();
  data.append("file", file);
  data.append("api_key", signature.apiKey);
  data.append("signature", signature.signature);
  for (const [key, entry] of Object.entries(signature.signedParams)) {
    data.append(key, String(entry));
  }

  const uploaded = (await uploadToCloudinary(signature.uploadEndpoint, data, onProgress)) as {
    public_id?: string;
  };

  const publicId = uploaded.public_id;
  if (!publicId) {
    throw new Error("Cloudinary returned incomplete upload details.");
  }

  const confirmBody =
    kind === "VIDEO"
      ? { publicId, description: caption.trim() || file.name }
      : { publicId, ...(caption.trim() ? { altText: { en: caption.trim() } } : {}) };

  const confirmation = await fetch("/api/upload-confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(confirmBody),
  });

  const confirmed = (await confirmation.json().catch(() => undefined)) as {
    mediaId?: string;
    error?: string;
  };

  if (!confirmation.ok || !confirmed.mediaId) {
    throw new Error(confirmed.error || "Upload verification failed.");
  }

  return { mediaId: confirmed.mediaId, publicId };
}

type BatchItem = {
  key: string;
  file: File;
  kind: "IMAGE" | "VIDEO";
  previewUrl: string;
  caption: string;
  category: string;
  isFeatured: boolean;
  status: "idle" | "uploading" | "uploaded" | "error";
  progress: number;
  mediaId?: string;
  error?: string;
};

export function GalleryBatchUploader({
  initialCategories = [],
  cloudName = "",
}: {
  initialCategories: string[];
  cloudName?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [defaultCategory, setDefaultCategory] = useState<string>(categories[0] ?? "Farm");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const imagePolicy = mediaPolicy("admin_image");
  const videoPolicy = mediaPolicy("admin_video");

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [items]);

  function handleFiles(files: FileList | File[] | null | undefined) {
    if (!files || !files.length) return;
    const fileList = Array.from(files);

    const newBatchItems: BatchItem[] = [];
    const errors: string[] = [];

    for (const file of fileList) {
      const ext = extension(file);
      const isImg = imagePolicy.formats.includes(ext) || file.type.startsWith("image/");
      const isVid = videoPolicy.formats.includes(ext) || file.type.startsWith("video/");

      if (!isImg && !isVid) {
        errors.push(`"${file.name}": Unsupported format.`);
        continue;
      }

      const kind: "IMAGE" | "VIDEO" = isVid ? "VIDEO" : "IMAGE";
      const maxBytes = kind === "VIDEO" ? videoPolicy.maxBytes : imagePolicy.maxBytes;
      if (file.size > maxBytes) {
        errors.push(
          `"${file.name}": File too large (max ${formatMediaBytes(maxBytes)}).`,
        );
        continue;
      }

      // Default caption: filename without extension, nicely formatted
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();

      newBatchItems.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`,
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
        caption: cleanName,
        category: defaultCategory,
        isFeatured: false,
        status: "idle",
        progress: 0,
      });
    }

    if (errors.length) {
      setGlobalMessage({ text: errors.slice(0, 3).join(" "), error: true });
    }

    if (!newBatchItems.length) return;

    setItems((current) => [...current, ...newBatchItems]);

    // Automatically trigger upload for each new item
    newBatchItems.forEach((item) => {
      startUpload(item);
    });
  }

  async function startUpload(item: BatchItem) {
    setItems((curr) =>
      curr.map((i) =>
        i.key === item.key ? { ...i, status: "uploading", progress: 0, error: undefined } : i,
      ),
    );

    try {
      const result = await uploadMediaFile(item.file, item.kind, item.caption, (progress) => {
        setItems((curr) =>
          curr.map((i) => (i.key === item.key ? { ...i, progress } : i)),
        );
      });

      setItems((curr) =>
        curr.map((i) =>
          i.key === item.key
            ? { ...i, status: "uploaded", progress: 100, mediaId: result.mediaId }
            : i,
        ),
      );
    } catch (err) {
      setItems((curr) =>
        curr.map((i) =>
          i.key === item.key
            ? {
                ...i,
                status: "error",
                error: err instanceof Error ? err.message : "Upload failed.",
              }
            : i,
        ),
      );
    }
  }

  function removeItem(key: string) {
    setItems((curr) => {
      const item = curr.find((i) => i.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return curr.filter((i) => i.key !== key);
    });
  }

  function applyCategoryToAll(cat: string) {
    setDefaultCategory(cat);
    setItems((curr) => curr.map((i) => ({ ...i, category: cat })));
  }

  const uploadedCount = items.filter((i) => i.status === "uploaded" && i.mediaId).length;
  const isAllUploaded = items.length > 0 && uploadedCount === items.length;
  const isAnyUploading = items.some((i) => i.status === "uploading");

  async function handleBatchSave(status: "DRAFT" | "PUBLISHED") {
    const validItems = items.filter((i) => i.status === "uploaded" && i.mediaId);
    if (!validItems.length) {
      setGlobalMessage({ text: "Please wait for files to finish uploading.", error: true });
      return;
    }

    setIsSubmitting(true);
    setGlobalMessage(null);

    const payload = {
      items: validItems.map((i) => ({
        mediaId: i.mediaId!,
        category: i.category,
        caption: i.caption,
        isFeatured: i.isFeatured,
      })),
      status,
    };

    const result = await batchCreateGalleryItemsAction(payload);
    setIsSubmitting(false);

    if (result.ok) {
      router.push("/admin/gallery");
      router.refresh();
    } else {
      setGlobalMessage({ text: result.error.message, error: true });
    }
  }

  return (
    <div className="space-y-6">
      {/* Category Manager Modal */}
      <GalleryCategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        categoryCounts={[]}
        onCategoriesChanged={(newCats) => {
          setCategories(newCats);
          if (!newCats.includes(defaultCategory)) {
            setDefaultCategory(newCats[0] ?? "Farm");
          }
        }}
      />

      {/* Global Message */}
      {globalMessage && (
        <div
          role="status"
          className={`rounded-xl p-4 text-sm font-medium ${
            globalMessage.error
              ? "border border-destructive/30 bg-destructive/10 text-destructive"
              : "border border-forest-900/30 bg-forest-900/10 text-forest-900"
          }`}
        >
          {globalMessage.text}
        </div>
      )}

      {/* Batch Header Controls */}
      <div className="grid gap-4 rounded-2xl border border-border/80 bg-card p-5 sm:flex sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Category for new items:
          </label>
          <div className="flex items-center gap-2">
            <select
              value={defaultCategory}
              onChange={(e) => applyCategoryToAll(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCategoryModalOpen(true)}
              className="gap-1.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Manage categories
            </Button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isAnyUploading || uploadedCount === 0}
              onClick={() => handleBatchSave("DRAFT")}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Save Draft (${uploadedCount})`
              )}
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || isAnyUploading || uploadedCount === 0}
              onClick={() => handleBatchSave("PUBLISHED")}
              className="bg-forest-900 text-cream-50 hover:bg-forest-800"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Publish All (${uploadedCount})`
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting || isAnyUploading}
              onClick={() => setItems([])}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative grid min-h-48 place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-forest-700 bg-forest-900/5"
            : "border-border/80 bg-muted/20 hover:bg-muted/40"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-900/10 text-forest-900">
            <UploadCloud className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-forest-800 underline underline-offset-4 hover:text-forest-900"
              >
                Choose multiple photos and videos
              </button>{" "}
              or drag &amp; drop them here
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Images up to 10MB (JPG, PNG, WebP, AVIF) · Videos up to 100MB (MP4, WebM)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="mt-2 gap-2"
          >
            <Plus className="h-4 w-4" /> Select Files
          </Button>
        </div>
      </div>

      {/* Uploaded Items List / Grid */}
      {items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg text-foreground">
              Upload Queue ({uploadedCount} of {items.length} ready)
            </h3>
            <span className="text-xs text-muted-foreground">
              Customize caption, category, or featured state for each item before saving.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isVideo = item.kind === "VIDEO";
              return (
                <div
                  key={item.key}
                  className="flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Media Preview Box */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    {isVideo ? (
                      <video
                        src={item.previewUrl}
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={item.previewUrl}
                        alt={item.caption || item.file.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    )}

                    {/* Media Type Badge */}
                    <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                      {isVideo ? (
                        <>
                          <Play className="h-3 w-3 fill-current" /> Video
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-3 w-3" /> Photo
                        </>
                      )}
                    </span>

                    {/* Upload Status Overlay */}
                    <span
                      className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.status === "uploaded"
                          ? "bg-forest-900/90 text-cream-50"
                          : item.status === "uploading"
                          ? "bg-black/75 text-white"
                          : item.status === "error"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status === "uploaded" ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" /> Ready
                        </span>
                      ) : item.status === "uploading" ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> {item.progress}%
                        </span>
                      ) : item.status === "error" ? (
                        "Failed"
                      ) : (
                        "Waiting"
                      )}
                    </span>

                    {/* Progress Bar when uploading */}
                    {item.status === "uploading" && (
                      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
                        <div
                          className="h-full bg-forest-600 transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Item Metadata Form */}
                  <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                    <div className="space-y-2">
                      <label className="grid gap-1 text-xs font-medium">
                        Caption
                        <Input
                          value={item.caption}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((curr) =>
                              curr.map((i) =>
                                i.key === item.key ? { ...i, caption: val } : i,
                              ),
                            );
                          }}
                          placeholder="Add caption…"
                          className="h-8 text-xs"
                          maxLength={500}
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="grid gap-1 text-xs font-medium">
                          Category
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItems((curr) =>
                                curr.map((i) =>
                                  i.key === item.key ? { ...i, category: val } : i,
                                ),
                              );
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex items-center gap-1.5 self-end text-xs font-medium pb-1.5">
                          <input
                            type="checkbox"
                            checked={item.isFeatured}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setItems((curr) =>
                                curr.map((i) =>
                                  i.key === item.key ? { ...i, isFeatured: checked } : i,
                                ),
                              );
                            }}
                            className="rounded border-input text-forest-700"
                          />
                          Featured
                        </label>
                      </div>

                      {item.error && (
                        <p className="text-xs text-destructive">{item.error}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                      <span className="truncate max-w-[180px]" title={item.file.name}>
                        {item.file.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.key)}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-4">
            <span className="text-sm text-muted-foreground">
              {uploadedCount} of {items.length} file(s) uploaded and ready to save.
            </span>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/gallery">Cancel</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || isAnyUploading || uploadedCount === 0}
                onClick={() => handleBatchSave("DRAFT")}
              >
                Save as draft
              </Button>
              <Button
                type="button"
                disabled={isSubmitting || isAnyUploading || uploadedCount === 0}
                onClick={() => handleBatchSave("PUBLISHED")}
                className="bg-forest-900 text-cream-50 hover:bg-forest-800"
              >
                Publish {uploadedCount > 0 ? `${uploadedCount} items` : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
