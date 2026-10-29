"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GALLERY_CATEGORIES } from "@/config/gallery";
import { bulkUpdateGalleryAction, reorderGalleryItemAction, updateGalleryFlagsAction } from "@/server/actions/cms-content";
import { GalleryCategoryManagerModal } from "./GalleryCategoryManagerModal";

type Row = { id: string; category: string; status: string; sortOrder: number; isFeatured: boolean; media: { publicId: string; format: string | null; bytes: number | null; contentHash: string | null; isPublic: boolean } };

export function GalleryManager({
  rows,
  categories = [...GALLERY_CATEGORIES],
  categoryCounts,
  filters,
  canWrite,
}: {
  rows: Row[];
  categories?: string[];
  categoryCounts: Array<{ category: string; count: number }>;
  filters: { q: string; status: string; category: string; duplicatesOnly: boolean };
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [message, setMessage] = useState("");
  const [categoryList, setCategoryList] = useState<string[]>(categories);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? success : result.error?.message || "The change could not be saved.");
      if (result.ok) {
        setSelected([]);
        router.refresh();
      }
    });
  }

  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Gallery filters">
          <Link href="/admin/gallery" className="rounded-full border px-3 py-2 text-sm">
            Items ({rows.length})
          </Link>
          <span className="rounded-full border px-3 py-2 text-sm text-muted-foreground">
            Categories ({categoryList.length})
          </span>
        </div>
        {canWrite && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCategoryModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            Manage categories
          </Button>
        )}
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <label className="grid gap-1 text-xs font-medium">
          Search
          <Input name="q" defaultValue={filters.q} placeholder="Title or public ID" />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Status
          <select
            name="status"
            defaultValue={filters.status}
            className="min-h-11 rounded-lg border border-input bg-background px-3"
          >
            <option value="">All</option>
            {["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Category
          <select
            name="category"
            defaultValue={filters.category}
            className="min-h-11 rounded-lg border border-input bg-background px-3"
          >
            <option value="">All categories</option>
            {categoryList.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            name="duplicates"
            value="1"
            defaultChecked={filters.duplicatesOnly}
          />{" "}
          Duplicates only
        </label>
        <Button type="submit" variant="outline" className="sm:col-span-4 sm:w-fit">
          Apply filters
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canWrite || !selected.length || pending}
          onClick={() =>
            run(
              () => bulkUpdateGalleryAction({ ids: selected, action: "publish" }),
              "Selected items published."
            )
          }
        >
          Publish selected
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canWrite || !selected.length || pending}
          onClick={() =>
            run(
              () => bulkUpdateGalleryAction({ ids: selected, action: "unpublish" }),
              "Selected items unpublished."
            )
          }
        >
          Unpublish selected
        </Button>
        <select
          aria-label="Bulk category"
          value={bulkCategory}
          onChange={(event) => setBulkCategory(event.target.value)}
          className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Change category…</option>
          {categoryList.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={!canWrite || !selected.length || !bulkCategory || pending}
          onClick={() =>
            run(
              () =>
                bulkUpdateGalleryAction({
                  ids: selected,
                  action: "category",
                  category: bulkCategory,
                }),
              "Selected categories updated."
            )
          }
        >
          Apply category
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!canWrite || !selected.length || pending}
          onClick={() => {
            if (window.confirm("Delete the selected gallery items?"))
              run(
                () => bulkUpdateGalleryAction({ ids: selected, action: "delete" }),
                "Selected items deleted."
              );
          }}
        >
          Delete selected
        </Button>
        {message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  aria-label="Select all gallery items"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? [] : rows.map((row) => row.id))
                  }
                />
              </th>
              <th className="p-3">Media Public ID</th>
              <th className="p-3">Category</th>
              <th className="p-3">Format / size</th>
              <th className="p-3">Published</th>
              <th className="p-3">Featured</th>
              <th className="p-3">Order</th>
              <th className="p-3">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.media.publicId}`}
                    checked={selected.includes(row.id)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(row.id)
                          ? current.filter((id) => id !== row.id)
                          : [...current, row.id]
                      )
                    }
                  />
                </td>
                <td className="max-w-56 truncate p-3 font-medium">
                  {row.media.publicId}
                </td>
                <td className="p-3">{row.category}</td>
                <td className="p-3">
                  {row.media.format || "—"} ·{" "}
                  {row.media.bytes
                    ? `${Math.round(row.media.bytes / 1024)} KB`
                    : "—"}
                  {row.media.contentHash ? " · hash" : ""}
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Published ${row.media.publicId}`}
                    checked={row.status === "PUBLISHED"}
                    disabled={!canWrite || pending}
                    onChange={(event) =>
                      run(
                        () =>
                          updateGalleryFlagsAction({
                            id: row.id,
                            status: event.target.checked ? "PUBLISHED" : "DRAFT",
                          }),
                        "Publication updated."
                      )
                    }
                  />
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Featured ${row.media.publicId}`}
                    checked={row.isFeatured}
                    disabled={!canWrite || pending}
                    onChange={(event) =>
                      run(
                        () =>
                          updateGalleryFlagsAction({
                            id: row.id,
                            isFeatured: event.target.checked,
                          }),
                        "Featured state updated."
                      )
                    }
                  />
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!canWrite || pending}
                      onClick={() =>
                        run(
                          () =>
                            reorderGalleryItemAction({
                              id: row.id,
                              direction: "up",
                            }),
                          "Item moved up."
                        )
                      }
                      aria-label={`Move ${row.media.publicId} up`}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!canWrite || pending}
                      onClick={() =>
                        run(
                          () =>
                            reorderGalleryItemAction({
                              id: row.id,
                              direction: "down",
                            }),
                          "Item moved down."
                        )
                      }
                      aria-label={`Move ${row.media.publicId} down`}
                    >
                      ↓
                    </Button>
                  </div>
                </td>
                <td className="p-3">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/gallery/${row.id}`}>Edit</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No gallery items match these filters.
          </p>
        ) : null}
      </div>

      <GalleryCategoryManagerModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categoryList}
        categoryCounts={categoryCounts}
        onCategoriesChanged={(updated) => {
          setCategoryList(updated);
          router.refresh();
        }}
      />
    </div>
  );
}
