"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { err } from "@/lib/result";
import { requirePermission, requireStaff } from "@/server/authz";
import {
  approveVideo,
  featureOnWebsite,
  getVideoReviewDetail,
  listVideoReviewQueue,
  previewVideo,
  rejectVideo,
  removeVideo,
  unfeatureOnWebsite,
} from "@/server/services/videoReview";

async function reviewActor() {
  const staff = await requireStaff();
  await requirePermission("rewards.videos.review");
  return staff;
}

export async function getVideoReviewQueueAction(rawInput: unknown) {
  await reviewActor();
  return listVideoReviewQueue(rawInput);
}

export async function getVideoReviewDetailAction(rawInput: unknown) {
  await reviewActor();
  const input = z.string().uuid().safeParse(rawInput);
  if (!input.success) return err("VALIDATION", "Invalid video submission.");
  return getVideoReviewDetail(input.data);
}

export async function previewVideoAction(rawInput: unknown) {
  const staff = await reviewActor();
  return previewVideo(staff.id, rawInput);
}

export async function approveVideoAction(rawInput: unknown) {
  const staff = await reviewActor();
  return approveVideo(staff, rawInput);
}

export async function rejectVideoAction(rawInput: unknown) {
  const staff = await reviewActor();
  return rejectVideo(staff.id, rawInput);
}

export async function removeVideoAction(rawInput: unknown) {
  const staff = await reviewActor();
  const input = z.object({ reversePoints: z.boolean().optional() }).passthrough().safeParse(rawInput);
  if (input.success && input.data.reversePoints) await requirePermission("rewards.reverse");
  return removeVideo(staff.id, rawInput);
}

export async function featureVideoAction(rawInput: unknown) {
  const staff = await reviewActor();
  await requirePermission("cms.publish");
  const result = await featureOnWebsite(staff.id, rawInput);
  if (result.ok) { revalidateTag("cms:post", "max"); revalidateTag("cms:all", "max"); revalidatePath("/"); revalidatePath("/stories"); revalidatePath("/sitemap.xml"); }
  return result;
}

export async function unfeatureVideoAction(rawInput: unknown) {
  const staff = await reviewActor();
  await requirePermission("cms.publish");
  const result = await unfeatureOnWebsite(staff.id, rawInput);
  if (result.ok) { revalidateTag("cms:post", "max"); revalidateTag("cms:all", "max"); revalidatePath("/"); revalidatePath("/stories"); revalidatePath("/sitemap.xml"); }
  return result;
}

