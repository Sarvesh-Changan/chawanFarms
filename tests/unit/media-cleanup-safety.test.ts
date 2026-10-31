// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  deleteCloudinaryAsset: vi.fn(async () => true),
}));

vi.mock("@/server/db", () => ({ db: { media: mocks } }));
vi.mock("@/server/integrations/cloudinary", () => ({ deleteCloudinaryAsset: mocks.deleteCloudinaryAsset }));

describe("media cleanup safety", () => {
  it("queries only expired pending admin media with no usage or customer submission", async () => {
    mocks.findMany.mockResolvedValueOnce([]);
    const { reportMediaOrphans } = await import("@/server/jobs/notification-jobs");
    await reportMediaOrphans();
    const where = mocks.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ origin: "ADMIN", deletedAt: null, usages: { none: {} }, videoSubmission: null });
  });

  it("leaves customer, submission-linked, and referenced media untouched during replacement cleanup", async () => {
    const { cleanupUnusedAdminMedia } = await import("@/server/services/media");
    for (const media of [
      { origin: "CUSTOMER", usages: [], videoSubmission: null, deletedAt: null },
      { origin: "ADMIN", usages: [{ id: "story-usage" }], videoSubmission: null, deletedAt: null },
      { origin: "ADMIN", usages: [], videoSubmission: { id: "submission" }, deletedAt: null },
    ]) {
      mocks.findUnique.mockResolvedValueOnce(media);
      await cleanupUnusedAdminMedia("media-id");
    }
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteCloudinaryAsset).not.toHaveBeenCalled();
  });

  it("deletes an old admin asset only after all usages are gone", async () => {
    const { cleanupUnusedAdminMedia } = await import("@/server/services/media");
    mocks.findUnique.mockResolvedValueOnce({ id: "media-id", origin: "ADMIN", usages: [], videoSubmission: null, deletedAt: null, publicId: "admin/image", resourceType: "image", deliveryType: "upload" });
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });
    await cleanupUnusedAdminMedia("media-id");
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "media-id", origin: "ADMIN", deletedAt: null, usages: { none: {} }, videoSubmission: null }}));
    expect(mocks.deleteCloudinaryAsset).toHaveBeenCalledTimes(1);
  });
});
