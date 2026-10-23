"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export type FilterTab = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type FilterTabsProps = {
  items: readonly FilterTab[];
  ariaLabel: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
};

export function FilterTabs({ items, ariaLabel, value, defaultValue, onChange, className }: FilterTabsProps) {
  const generatedId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.id ?? "");
  const selectedValue = value ?? internalValue;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const select = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  const moveFocus = (currentIndex: number, direction: 1 | -1 | "first" | "last") => {
    const enabledIndexes = items.flatMap((item, index) => item.disabled ? [] : [index]);
    if (!enabledIndexes.length) return;
    const currentEnabledIndex = enabledIndexes.indexOf(currentIndex);
    const targetIndex = direction === "first"
      ? enabledIndexes[0]
      : direction === "last"
        ? enabledIndexes.at(-1)
        : enabledIndexes[(currentEnabledIndex + direction + enabledIndexes.length) % enabledIndexes.length];
    if (targetIndex === undefined) return;
    const target = items.find((item, index) => index === targetIndex);
    if (!target) return;
    tabRefs.current.get(target.id)?.focus();
    select(target.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); moveFocus(index, 1); }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveFocus(index, -1); }
    if (event.key === "Home") { event.preventDefault(); moveFocus(index, "first"); }
    if (event.key === "End") { event.preventDefault(); moveFocus(index, "last"); }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const selected = item.id === selectedValue;
        return <button key={item.id} ref={(element) => { if (element) tabRefs.current.set(item.id, element); else tabRefs.current.delete(item.id); }} type="button" disabled={item.disabled} aria-pressed={selected} tabIndex={selected || (!selectedValue && index === 0) ? 0 : -1} onClick={() => select(item.id)} onKeyDown={(event) => handleKeyDown(event, index)} className={cn("inline-flex min-h-11 items-center rounded-[var(--radius-pill)] border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500", selected ? "border-forest-700 bg-forest-700 text-cream-50" : "border-forest-900/15 bg-cream-50 text-forest-700 hover:border-forest-700 hover:bg-clay-100", "disabled:cursor-not-allowed disabled:opacity-50")} id={`${generatedId}-${item.id}`}>
          {item.label}
        </button>;
      })}
    </div>
  );
}
