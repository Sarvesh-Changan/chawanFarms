"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";


export type FaqItem = {
  id: string;
  question: unknown;
  answer: unknown;
  groupKey: string | null;
  sortOrder: number;
};

interface FaqAccordionProps {
  items: FaqItem[];
}

function localizedString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "en" in value) {
    const val = (value as { en?: unknown }).en;
    return typeof val === "string" ? val : "";
  }
  return "";
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("All");

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.groupKey?.trim()) {
        set.add(item.groupKey.trim());
      }
    }
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = localizedString(item.question).toLowerCase();
      const a = localizedString(item.answer).toLowerCase();
      const matchSearch =
        !searchQuery ||
        q.includes(searchQuery.toLowerCase()) ||
        a.includes(searchQuery.toLowerCase());
      const matchGroup =
        activeGroup === "All" ||
        (item.groupKey && item.groupKey.toLowerCase() === activeGroup.toLowerCase());
      return matchSearch && matchGroup;
    });
  }, [items, searchQuery, activeGroup]);

  // Group items by groupKey for presentation if "All" is active
  const groupedItems = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const item of filteredItems) {
      const group = item.groupKey?.trim() || "General Questions";
      const list = map.get(group) ?? [];
      list.push(item);
      map.set(group, list);
    }
    return map;
  }, [filteredItems]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Search Input */}
      <div className="relative">
        <label htmlFor="faq-search" className="sr-only">
          Search frequently asked questions
        </label>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground">
          <Search className="h-5 w-5" />
        </div>
        <input
          id="faq-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by keywords (e.g. food, check-in, tents, river, pets)..."
          className="w-full rounded-2xl border border-border/80 bg-card py-3.5 pl-12 pr-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-700/20"
        />
      </div>

      {/* Group Pills */}
      {groups.length > 2 && (
        <div
          role="toolbar"
          aria-label="Filter FAQs by category"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {groups.map((grp) => {
            const isActive = activeGroup.toLowerCase() === grp.toLowerCase();
            return (
              <button
                key={grp}
                type="button"
                onClick={() => setActiveGroup(grp)}
                aria-pressed={isActive}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 ${
                  isActive
                    ? "bg-forest-900 text-cream-50 shadow-sm"
                    : "border border-border/70 bg-card text-foreground hover:bg-muted"
                }`}
              >
                {grp}
              </button>
            );
          })}
        </div>
      )}

      {/* Accordion List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-10 text-center">
          <p className="font-heading text-lg text-forest-900">
            No questions match your query
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing your search or contact the farm team directly.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groupedItems.entries()).map(([groupName, groupList]) => (
            <div key={groupName} className="space-y-3">
              {groups.length > 2 && activeGroup === "All" && (
                <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-laterite-600">
                  {groupName}
                </h2>
              )}

              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                {groupList.map((item) => {
                  const isOpen = openIds.has(item.id);
                  const question = localizedString(item.question);
                  const answer = localizedString(item.answer);
                  const controlId = `faq-content-${item.id}`;
                  const buttonId = `faq-btn-${item.id}`;

                  return (
                    <div key={item.id} className="transition-colors">
                      <h3>
                        <button
                          id={buttonId}
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          aria-expanded={isOpen}
                          aria-controls={controlId}
                          className="flex w-full items-center justify-between gap-4 p-5 text-left font-heading text-lg text-forest-900 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 sm:text-xl"
                        >
                          <span>{question}</span>
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/60 text-forest-900 transition-transform duration-300 ${
                              isOpen ? "rotate-180 bg-forest-900/10 text-forest-900" : ""
                            }`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </button>
                      </h3>

                      {isOpen && (
                        <div
                          id={controlId}
                          role="region"
                          aria-labelledby={buttonId}
                          className="px-5 pb-6 pt-1 text-base leading-relaxed text-muted-foreground"
                        >
                          <div dangerouslySetInnerHTML={{ __html: answer }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
