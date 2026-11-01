"use client";

import Link from "next/link";
import React, { useId, useMemo, useRef, useState } from "react";

import {
  findSlotForItem,
  getMealLayout,
  type PlateSlot,
} from "@/config/plate-slots";
import type { PublicHomeData } from "@/server/services/public-content";

type FoodCategory = NonNullable<PublicHomeData["food"]>[number];
type FoodItem = FoodCategory["items"][number];

type MealKey = "breakfast" | "lunch-dinner" | "evening-tea";
type Preference = "veg" | "non-veg";

function localizedName(name: unknown): string {
  if (!name) return "";
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null && "en" in name) {
    const en = (name as Record<string, unknown>).en;
    if (typeof en === "string") return en;
  }
  return "";
}

interface PlateExplorerProps {
  categories: FoodCategory[];
}

export function PlateExplorer({ categories }: PlateExplorerProps) {
  const [selectedMeal, setSelectedMeal] = useState<MealKey>("lunch-dinner");
  const [selectedPreference, setSelectedPreference] = useState<Preference>("non-veg");
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const tabsRef = useRef<Map<number, HTMLButtonElement | null>>(new Map());
  const tablistId = useId();

  // Group items by canonical meal keys
  const mealItems = useMemo(() => {
    const breakfast: FoodItem[] = [];
    const lunchDinner: FoodItem[] = [];
    const eveningTea: FoodItem[] = [];

    for (const cat of categories) {
      const slug = cat.slug.toLowerCase();
      if (slug.includes("breakfast") || slug.includes("morning")) {
        breakfast.push(...cat.items);
      } else if (slug.includes("lunch") || slug.includes("dinner")) {
        lunchDinner.push(...cat.items);
      } else if (slug.includes("evening") || slug.includes("tea") || slug.includes("part-c")) {
        eveningTea.push(...cat.items);
      } else if (!slug.includes("extras")) {
        lunchDinner.push(...cat.items);
      }
    }

    return {
      breakfast,
      lunchDinner,
      eveningTea,
    };
  }, [categories]);

  // Extra items notice condition: check if any published item has isExtraCharge
  const hasExtraChargeItems = useMemo(() => {
    return categories.some((cat) => cat.items.some((item) => item.isExtraCharge));
  }, [categories]);

  // Filter current meal items based on preference
  const visibleItems = useMemo(() => {
    const items =
      selectedMeal === "breakfast"
        ? mealItems.breakfast
        : selectedMeal === "evening-tea"
        ? mealItems.eveningTea
        : mealItems.lunchDinner;

    if (selectedPreference === "veg") {
      return items.filter((item) => item.foodPreference === "VEG" || !item.foodPreference);
    }
    // For non-veg: include non-veg items PLUS staple items for that meal
    if (selectedMeal === "lunch-dinner") {
      const nonVegCatItems = categories.find((c) => c.slug === "lunch-dinner-non-veg")?.items;
      if (nonVegCatItems && nonVegCatItems.length > 0) {
        return nonVegCatItems;
      }
      return items;
    }
    return items;
  }, [mealItems, selectedMeal, selectedPreference, categories]);

  // Map visible items to layout slots
  const layout = getMealLayout(selectedMeal);

  const slotItemsMap = useMemo(() => {
    const map = new Map<string, { item: FoodItem; slot: PlateSlot }>();

    for (const item of visibleItems) {
      const name = localizedName(item.name);
      const slot = findSlotForItem(selectedMeal, name, item.id);
      if (slot && !map.has(slot.id)) {
        map.set(slot.id, { item, slot });
      }
    }
    return map;
  }, [visibleItems, selectedMeal]);

  const activeSlots = useMemo(() => {
    return layout.slots.map((slot) => {
      const mapped = slotItemsMap.get(slot.id);
      return {
        slot,
        item: mapped?.item ?? null,
        isActive: Boolean(mapped),
      };
    });
  }, [layout.slots, slotItemsMap]);

  // Accessible live status text
  const liveStatus = `Showing ${selectedPreference} ${
    selectedMeal === "breakfast" ? "breakfast" : selectedMeal === "lunch-dinner" ? "lunch and dinner" : "evening tea"
  }, ${visibleItems.length} items`;

  const tabs: readonly { readonly key: MealKey; readonly label: string }[] = [
    { key: "breakfast", label: "Breakfast" },
    { key: "lunch-dinner", label: "Lunch & dinner" },
    { key: "evening-tea", label: "Evening tea" },
  ];

  const handleTabKeyDown = (index: number, e: React.KeyboardEvent) => {
    let targetIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      const target = tabs.find((_, i) => i === targetIndex);
      if (target) {
        setSelectedMeal(target.key);
        tabsRef.current.get(targetIndex)?.focus();
      }
    }
  };

  return (
    <div className="w-full">
      {/* Screen-reader live region */}
      <div aria-live="polite" className="sr-only">
        {liveStatus}
      </div>

      {/* Interactive Controls & Plate Layout */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left column: Controls, Chips, and Info */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Meal Tabs (Accessible Tablist) */}
          <div>
            <div
              id={tablistId}
              role="tablist"
              aria-label="Meal selection"
              className="inline-flex flex-wrap gap-2 p-1 bg-cream-50/60 rounded-full border border-forest-900/10 shadow-sm"
            >
              {tabs.map((tab, idx) => {
                const isSelected = selectedMeal === tab.key;
                return (
                  <button
                    key={tab.key}
                    ref={(el) => {
                      tabsRef.current.set(idx, el);
                    }}
                    role="tab"
                    id={`tab-${tab.key}`}
                    aria-selected={isSelected}
                    aria-controls={`panel-${tab.key}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setSelectedMeal(tab.key)}
                    onKeyDown={(e) => handleTabKeyDown(idx, e)}
                    type="button"
                    className={`min-h-11 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 ${
                      isSelected
                        ? "bg-forest-900 text-cream-50 shadow-md"
                        : "text-forest-900/80 hover:text-forest-900 hover:bg-cream-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Veg / Non-veg Segmented Control / Radio Group */}
          <div>
            <div
              role="radiogroup"
              aria-label="Food preference"
              className="inline-flex gap-1.5 p-1 bg-cream-50/80 rounded-full border border-forest-900/10 shadow-sm"
            >
              <button
                type="button"
                role="radio"
                aria-checked={selectedPreference === "veg"}
                onClick={() => setSelectedPreference("veg")}
                className={`min-h-11 px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 ${
                  selectedPreference === "veg"
                    ? "bg-leaf-500 text-white shadow"
                    : "text-forest-900/70 hover:text-forest-900"
                }`}
              >
                Veg
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={selectedPreference === "non-veg"}
                onClick={() => setSelectedPreference("non-veg")}
                className={`min-h-11 px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 ${
                  selectedPreference === "non-veg"
                    ? "bg-laterite-600 text-white shadow"
                    : "text-forest-900/70 hover:text-forest-900"
                }`}
              >
                Non-veg
              </button>
            </div>
          </div>

          {/* Item Chips List */}
          <div
            id={`panel-${selectedMeal}`}
            role="tabpanel"
            aria-labelledby={`tab-${selectedMeal}`}
            className="flex flex-wrap gap-2.5 pt-2"
          >
            {visibleItems.map((item) => {
              const name = localizedName(item.name);
              const slot = findSlotForItem(selectedMeal, name, item.id);
              const slotId = slot?.id ?? null;
              const isSlotHighlighted = activeSlotId && activeSlotId === slotId;
              const hasSlot = Boolean(slot);

              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => slotId && setActiveSlotId(slotId)}
                  onMouseLeave={() => setActiveSlotId(null)}
                  onFocus={() => slotId && setActiveSlotId(slotId)}
                  onBlur={() => setActiveSlotId(null)}
                  className={`min-h-10 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500 ${
                    isSlotHighlighted
                      ? "bg-forest-900 text-cream-50 border-forest-900 scale-105 shadow-md"
                      : hasSlot
                      ? "bg-forest-900/90 text-cream-50 border-forest-900/90 hover:bg-forest-900"
                      : "bg-cream-50/90 text-forest-900 border-forest-900/20 hover:bg-cream-50"
                  }`}
                >
                  <span className="capitalize">{name}</span>
                  {item.isExtraCharge && (
                    <span className="ml-1.5 rounded bg-turmeric-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-laterite-600">
                      extra
                    </span>
                  )}
                  {item.extraPricePaise ? (
                    <span className="ml-1 text-xs text-forest-900/60 font-normal">
                      · ₹{Math.round(item.extraPricePaise / 100)}
                      {item.extraUnitLabel ? ` / ${item.extraUnitLabel}` : ""}
                    </span>
                  ) : item.isExtraCharge ? (
                    <span className="ml-1 text-xs text-forest-900/60 font-normal">
                      · quoted by our team
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Extra charge notice if present in data */}
          {hasExtraChargeItems && (
            <p className="text-xs text-forest-900/70 pt-1 leading-relaxed">
              Mutton, chicken, fish and barbecue are charged extra.
            </p>
          )}

          {/* Direct link to /food */}
          <div className="pt-2">
            <Link
              href="/food"
              className="text-forest-900 font-semibold text-sm inline-flex items-center gap-1.5 hover:text-laterite-600 transition-colors underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500"
            >
              Explore full dining details
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Right column: SVG Steel Thali Plate Visualizer */}
        <div className="lg:col-span-7 flex justify-center items-center py-4">
          <div className="relative w-full max-w-[420px] sm:max-w-[480px] aspect-square select-none">
            <svg
              viewBox="0 0 500 500"
              className="w-full h-full drop-shadow-2xl overflow-visible"
              aria-hidden="true"
            >
              <defs>
                {/* Steel plate outer rim gradient */}
                <radialGradient id="steelPlateRim" cx="45%" cy="40%" r="55%">
                  <stop offset="0%" stopColor="#E2E8F0" />
                  <stop offset="65%" stopColor="#CBD5E1" />
                  <stop offset="90%" stopColor="#94A3B8" />
                  <stop offset="100%" stopColor="#64748B" />
                </radialGradient>

                {/* Plate inner base gradient */}
                <radialGradient id="plateBase" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#F8FAFC" />
                  <stop offset="85%" stopColor="#E2E8F0" />
                  <stop offset="100%" stopColor="#CBD5E1" />
                </radialGradient>

                {/* Rice texture filter / subtle grain */}
                <filter id="riceTexture" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                </filter>

                {/* Katori outer bevel */}
                <filter id="katoriShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Plate Outer Rim (Steel Thali) */}
              <circle
                cx="250"
                cy="250"
                r={layout.plateRadius}
                fill="url(#steelPlateRim)"
                stroke="#94A3B8"
                strokeWidth="2"
              />

              {/* Secondary concentric rim bevel */}
              <circle
                cx="250"
                cy="250"
                r={layout.plateRadius - 8}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="1.5"
                opacity="0.8"
              />

              {/* Plate Inner Base */}
              <circle
                cx="250"
                cy="250"
                r={layout.innerRadius}
                fill="url(#plateBase)"
                stroke="#CBD5E1"
                strokeWidth="1.5"
              />

              {/* Soft specular sheen line on the plate rim */}
              <path
                d={`M ${250 - layout.plateRadius + 15} 250 A ${layout.plateRadius - 15} ${layout.plateRadius - 15} 0 0 1 250 ${250 - layout.plateRadius + 15}`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.6"
              />

              {/* Katoris and Food Items */}
              {activeSlots.map(({ slot, item, isActive }) => {
                const isHighlighted = activeSlotId === slot.id;
                const itemLabel = item ? localizedName(item.name) : "";
                const displayLabel = itemLabel
                  ? (itemLabel.split("/")[0]?.split("(")[0]?.trim() || slot.label)
                  : slot.label;

                return (
                  <g
                    key={slot.id}
                    onClick={() => isActive && setActiveSlotId(isHighlighted ? null : slot.id)}
                    onMouseEnter={() => isActive && setActiveSlotId(slot.id)}
                    onMouseLeave={() => setActiveSlotId(null)}
                    className="cursor-pointer outline-none transition-all duration-300 ease-[var(--motion-ease-standard)] motion-reduce:transition-none"
                    style={{
                      transformOrigin: `${slot.cx}px ${slot.cy}px`,
                      opacity: isActive ? 1 : 0,
                      transform: isActive
                        ? isHighlighted
                          ? "scale(1.08)"
                          : "scale(1)"
                        : "scale(0.5)",
                      pointerEvents: isActive ? "auto" : "none",
                    }}
                  >
                    {/* Katori Metallic Bevel / Rim */}
                    <circle
                      cx={slot.cx}
                      cy={slot.cy}
                      r={slot.r + 3}
                      fill="#CBD5E1"
                      stroke="#94A3B8"
                      strokeWidth="1"
                      filter="url(#katoriShadow)"
                    />

                    {/* Food Fill Dish */}
                    <circle
                      cx={slot.cx}
                      cy={slot.cy}
                      r={slot.r}
                      fill={slot.fill}
                      stroke={isHighlighted ? "#12301F" : (slot.stroke ?? "#64748B")}
                      strokeWidth={isHighlighted ? 3.5 : 1.5}
                      className="transition-colors duration-200"
                    />

                    {/* Highlight Ring */}
                    {isHighlighted && (
                      <circle
                        cx={slot.cx}
                        cy={slot.cy}
                        r={slot.r + 5}
                        fill="none"
                        stroke="#12301F"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                    )}

                    {/* Inner Accent Ring / Texture Accent */}
                    <circle
                      cx={slot.cx - slot.r * 0.25}
                      cy={slot.cy - slot.r * 0.25}
                      r={slot.r * 0.4}
                      fill={slot.accentColor ?? "#FFFFFF"}
                      opacity="0.25"
                    />

                    {/* Dish Text Label */}
                    <text
                      x={slot.cx}
                      y={slot.cy + 4}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[11px] sm:text-[12px] font-semibold select-none pointer-events-none fill-forest-900"
                      style={{
                        paintOrder: "stroke",
                        stroke: "#FFF",
                        strokeWidth: "2.5px",
                        strokeLinejoin: "round",
                      }}
                    >
                      {displayLabel.length > 12 ? `${displayLabel.slice(0, 10)}…` : displayLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Progressive Enhancement: Plain Grouped List for No-JS */}
      <noscript>
        <div className="mt-8 border-t border-forest-900/20 pt-6">
          <h4 className="text-base font-semibold text-forest-900 mb-4">Farm Menu Categories</h4>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-cream-50 p-4 rounded-xl border border-forest-900/10">
                <h5 className="font-semibold text-forest-900 capitalize mb-2">{localizedName(cat.name)}</h5>
                <ul className="text-sm space-y-1.5 text-forest-900/80">
                  {cat.items.map((item) => (
                    <li key={item.id} className="flex justify-between items-center">
                      <span>{localizedName(item.name)}</span>
                      {item.isExtraCharge && (
                        <span className="text-[10px] font-bold text-laterite-600 uppercase">Extra</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </noscript>
    </div>
  );
}
