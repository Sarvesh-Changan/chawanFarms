export type PlateSlot = {
  id: string;
  name: string;
  matchKeywords: string[];
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  accentColor?: string;
  label: string;
  sublabel?: string;
};

export type MealPlateLayout = {
  mealKey: "breakfast" | "lunch-dinner" | "evening-tea";
  plateRadius: number;
  innerRadius: number;
  rimColor: string;
  baseColor: string;
  slots: PlateSlot[];
};

export const LUNCH_DINNER_SLOTS: PlateSlot[] = [
  {
    id: "dal",
    name: "Dal",
    matchKeywords: ["dal", "daal", "lentil", "varan"],
    cx: 170,
    cy: 135,
    r: 46,
    fill: "#D9822B",
    stroke: "#B86616",
    accentColor: "#F4B860",
    label: "Dal",
  },
  {
    id: "curry",
    name: "Chicken curry / Veg curry",
    matchKeywords: ["chicken", "mutton", "curry", "gravy", "2 vegetables", "vegetable", "sabzi", "bhaji"],
    cx: 330,
    cy: 135,
    r: 48,
    fill: "#B4482A",
    stroke: "#8E3218",
    accentColor: "#E06D4E",
    label: "Curry",
  },
  {
    id: "masala",
    name: "Masala",
    matchKeywords: ["masala", "sukka", "dry"],
    cx: 120,
    cy: 260,
    r: 40,
    fill: "#B24D3D",
    stroke: "#8D3425",
    accentColor: "#D97262",
    label: "Masala",
  },
  {
    id: "bread",
    name: "Chapati / Bhakri",
    matchKeywords: ["chapati", "bhakri", "roti", "bread"],
    cx: 215,
    cy: 235,
    r: 38,
    fill: "#CCA677",
    stroke: "#AD8556",
    accentColor: "#E2C39B",
    label: "Bhakri",
  },
  {
    id: "rice",
    name: "Rice",
    matchKeywords: ["rice", "bhaat"],
    cx: 310,
    cy: 275,
    r: 56,
    fill: "#F7F4EB",
    stroke: "#DCD5C5",
    accentColor: "#FFFFFF",
    label: "Rice",
  },
  {
    id: "sweet",
    name: "Sweet",
    matchKeywords: ["sweet", "gulab", "kheer", "sheera", "modak", "halwa", "dessert"],
    cx: 250,
    cy: 375,
    r: 42,
    fill: "#DFC189",
    stroke: "#BFA064",
    accentColor: "#F3DCAC",
    label: "Sweet",
  },
  {
    id: "salad",
    name: "Salad",
    matchKeywords: ["salad", "koshimbir", "cucumber", "onion", "raw"],
    cx: 380,
    cy: 250,
    r: 26,
    fill: "#5B8A3C",
    stroke: "#436829",
    accentColor: "#7FB35C",
    label: "Salad",
  },
  {
    id: "pickle",
    name: "Pickle",
    matchKeywords: ["pickle", "lonche", "achar"],
    cx: 395,
    cy: 195,
    r: 18,
    fill: "#8C251C",
    stroke: "#68150D",
    accentColor: "#B53D32",
    label: "Pickle",
  },
  {
    id: "papad",
    name: "Papad",
    matchKeywords: ["papad", "papadum", "wafer"],
    cx: 165,
    cy: 345,
    r: 28,
    fill: "#E8C574",
    stroke: "#C7A34E",
    accentColor: "#F7DD96",
    label: "Papad",
  },
];

export const BREAKFAST_SLOTS: PlateSlot[] = [
  {
    id: "poha",
    name: "Kanda Poha",
    matchKeywords: ["poha", "pohe", "kanda-poha"],
    cx: 175,
    cy: 165,
    r: 50,
    fill: "#E6A82E",
    stroke: "#BF8316",
    accentColor: "#F9C75D",
    label: "Poha",
  },
  {
    id: "upma-idli",
    name: "Upma / Idli Sambar",
    matchKeywords: ["upma", "idli", "sambar", "idli-sambar"],
    cx: 325,
    cy: 165,
    r: 50,
    fill: "#ECE5D8",
    stroke: "#C7BEAF",
    accentColor: "#FAF7F2",
    label: "Upma / Idli",
  },
  {
    id: "misal",
    name: "Misal Pav",
    matchKeywords: ["misal", "misal-pav", "usal"],
    cx: 250,
    cy: 255,
    r: 46,
    fill: "#B84725",
    stroke: "#8E3214",
    accentColor: "#DF6844",
    label: "Misal",
  },
  {
    id: "sweet-sheera",
    name: "Sweet Sheera",
    matchKeywords: ["sheera", "shira", "halwa", "sweet"],
    cx: 175,
    cy: 340,
    r: 44,
    fill: "#DFC189",
    stroke: "#BF9F63",
    accentColor: "#F1D9AC",
    label: "Sheera",
  },
  {
    id: "egg-dish",
    name: "Omelette / Bhurji",
    matchKeywords: ["omelette", "bhurji", "egg", "bread-omelette", "zunka"],
    cx: 325,
    cy: 340,
    r: 44,
    fill: "#DE992B",
    stroke: "#B87515",
    accentColor: "#F7BB56",
    label: "Eggs",
  },
];

export const EVENING_TEA_SLOTS: PlateSlot[] = [
  {
    id: "tea",
    name: "Tea / Coffee",
    matchKeywords: ["tea", "chai", "coffee", "tea/coffee"],
    cx: 250,
    cy: 190,
    r: 48,
    fill: "#9E512B",
    stroke: "#783716",
    accentColor: "#C9784E",
    label: "Tea",
  },
  {
    id: "wada",
    name: "Batata Wada",
    matchKeywords: ["wada", "vada", "batata-wada", "batata"],
    cx: 175,
    cy: 310,
    r: 46,
    fill: "#D99B26",
    stroke: "#AF7611",
    accentColor: "#F2BD52",
    label: "Wada",
  },
  {
    id: "bhaji",
    name: "Mung Bhaji",
    matchKeywords: ["bhaji", "bhajji", "pakora", "mung", "mung-bhaji", "kanda-bhaji"],
    cx: 325,
    cy: 310,
    r: 46,
    fill: "#C78824",
    stroke: "#9E6410",
    accentColor: "#EAA847",
    label: "Bhaji",
  },
];

export const BREAKFAST_LAYOUT: MealPlateLayout = {
  mealKey: "breakfast",
  plateRadius: 215,
  innerRadius: 195,
  rimColor: "#D2D6DC",
  baseColor: "#EFECE6",
  slots: BREAKFAST_SLOTS,
};

export const DEFAULT_MEAL_LAYOUT: MealPlateLayout = {
  mealKey: "lunch-dinner",
  plateRadius: 232,
  innerRadius: 216,
  rimColor: "#CBD2D9",
  baseColor: "#ECEAE3",
  slots: LUNCH_DINNER_SLOTS,
};

export const EVENING_TEA_LAYOUT: MealPlateLayout = {
  mealKey: "evening-tea",
  plateRadius: 200,
  innerRadius: 180,
  rimColor: "#D2D6DC",
  baseColor: "#EFECE6",
  slots: EVENING_TEA_SLOTS,
};

export function getMealLayout(mealKey: string): MealPlateLayout {
  switch (mealKey) {
    case "breakfast":
      return BREAKFAST_LAYOUT;
    case "evening-tea":
      return EVENING_TEA_LAYOUT;
    case "lunch-dinner":
    default:
      return DEFAULT_MEAL_LAYOUT;
  }
}

/**
 * Finds the slot config for a given menu item name or slug.
 */
export function findSlotForItem(mealKey: string, itemName: string, itemSlug?: string): PlateSlot | null {
  const layout = getMealLayout(mealKey);
  const lowerName = `${itemName} ${itemSlug ?? ""}`.toLowerCase();

  for (const slot of layout.slots) {
    if (slot.matchKeywords.some((kw) => lowerName.includes(kw))) {
      return slot;
    }
  }
  return null;
}
