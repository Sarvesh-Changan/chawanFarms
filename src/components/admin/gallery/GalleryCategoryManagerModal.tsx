"use client";

import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addGalleryCategoryAction,
  deleteGalleryCategoryAction,
  editGalleryCategoryAction,
} from "@/server/actions/gallery-categories";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categories?: string[];
  initialCategories?: string[];
  categoryCounts?: Array<{ category: string; count: number }>;
  onCategoriesChanged: (categories: string[]) => void;
};

export function GalleryCategoryManagerModal({
  isOpen,
  onClose,
  categories,
  initialCategories,
  categoryCounts = [],
  onCategoriesChanged,
}: Props) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [reassignCategory, setReassignCategory] = useState<string>("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const activeCategories = categories ?? initialCategories ?? [];

  if (!isOpen) return null;

  const countMap = new Map((categoryCounts ?? []).map((c) => [c.category.toLowerCase(), c.count]));
  const getCount = (cat: string) => countMap.get(cat.toLowerCase()) ?? 0;

  function handleAdd() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setMessage({ text: "Please enter a category name.", error: true });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await addGalleryCategoryAction({ name: trimmed });
      if (result.ok) {
        setNewCategoryName("");
        onCategoriesChanged(result.data.categories);
        setMessage({ text: `Category "${trimmed}" added.` });
      } else {
        setMessage({ text: result.error.message, error: true });
      }
    });
  }

  function handleEdit(oldName: string) {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingCategory(null);
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await editGalleryCategoryAction({ oldName, newName: trimmed });
      if (result.ok) {
        setEditingCategory(null);
        onCategoriesChanged(result.data.categories);
        setMessage({ text: `Renamed to "${trimmed}".` });
      } else {
        setMessage({ text: result.error.message, error: true });
      }
    });
  }

  function handleDelete(name: string) {
    const count = getCount(name);
    if (count > 0 && !reassignCategory) {
      setMessage({
        text: `"${name}" has ${count} items. Choose another category to reassign them to.`,
        error: true,
      });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await deleteGalleryCategoryAction({
        name,
        reassignTo: count > 0 ? reassignCategory : undefined,
      });
      if (result.ok) {
        setDeletingCategory(null);
        setReassignCategory("");
        onCategoriesChanged(result.data.categories);
        setMessage({ text: `Category "${name}" deleted.` });
      } else {
        setMessage({ text: result.error.message, error: true });
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-categories-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 id="manage-categories-heading" className="text-lg font-bold text-foreground">
              Manage Gallery Categories
            </h2>
            <p className="text-xs text-muted-foreground">
              Add new categories, rename, or delete existing ones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <div
            role="status"
            className={`mt-4 rounded-lg p-3 text-sm ${
              message.error ? "bg-destructive/10 text-destructive" : "bg-forest-900/10 text-forest-900"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Add Category Form */}
        <div className="mt-5 rounded-xl border border-border/70 bg-muted/40 p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add New Category
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Wildlife, Monsoon, Sunset…"
              disabled={pending}
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAdd}
              disabled={pending || !newCategoryName.trim()}
              className="gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        {/* Categories List */}
        <div className="mt-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Existing Categories ({activeCategories.length})
          </label>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {activeCategories.map((category) => {
              const count = getCount(category);
              const isEditing = editingCategory === category;
              const isDeleting = deletingCategory === category;
              const otherCategories = activeCategories.filter((c) => c !== category);

              if (isEditing) {
                return (
                  <div
                    key={category}
                    className="flex items-center gap-2 rounded-lg border border-forest-700 bg-background p-2.5"
                  >
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      disabled={pending}
                      maxLength={50}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEdit(category);
                        if (e.key === "Escape") setEditingCategory(null);
                      }}
                      className="h-9 text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleEdit(category)}
                      disabled={pending || !editedName.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingCategory(null)}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  </div>
                );
              }

              if (isDeleting) {
                return (
                  <div
                    key={category}
                    className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-3"
                  >
                    <p className="font-medium text-destructive">
                      Delete category &ldquo;{category}&rdquo;?
                    </p>
                    {count > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {count} item(s) are currently in this category. Reassign them to:
                        </p>
                        <select
                          value={reassignCategory}
                          onChange={(e) => setReassignCategory(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select a replacement category…</option>
                          {otherCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={pending || (count > 0 && !reassignCategory)}
                        onClick={() => handleDelete(category)}
                      >
                        Confirm Delete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDeletingCategory(null);
                          setReassignCategory("");
                        }}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={category}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-foreground">{category}</span>
                    <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-xs text-secondary-foreground">
                      {count} {count === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCategory(category);
                        setEditedName(category);
                        setDeletingCategory(null);
                      }}
                      disabled={pending}
                      aria-label={`Rename ${category}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setDeletingCategory(category);
                        setReassignCategory(otherCategories[0] ?? "");
                        setEditingCategory(null);
                      }}
                      disabled={pending || activeCategories.length <= 1}
                      aria-label={`Delete ${category}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
