CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "caption" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GalleryItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "GalleryItem_category_status_sortOrder_idx" ON "GalleryItem"("category", "status", "sortOrder");
CREATE INDEX "GalleryItem_mediaId_idx" ON "GalleryItem"("mediaId");
