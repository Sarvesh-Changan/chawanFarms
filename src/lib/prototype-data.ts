// PROTOTYPE ONLY: static content for the marketing prototype.
// Source of truth: docs/PRD.md Appendix A. Unknown client data is intentionally null.

export const PROTOTYPE_IMAGE = "/placeholder-farm.svg";

export const prototypeBusiness = {
  name: "Chawan Farms",
  title: "Agri-Tourism Centre",
  address: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra, India",
  phones: ["9821502956", "9821089375", "9359895322"],
  whatsappHref: null,
  email: null,
} as const;

export const prototypeHero = {
  eyebrow: "CHAWAN FARMS · कृषी पर्यटन केंद्र",
  title: "Where time slows down.",
  description:
    "Come live, experience & rediscover yourself & nature at its best.",
  poster: PROTOTYPE_IMAGE,
  posterAlt: "A reserved farm landscape image frame awaiting approved photography",
  videoSrc: null,
} as const;

export const prototypeExperiences = [
  {
    title: "Work with the land",
    description: "Spend time around horticultural farming, dairy, poultry and organic farming.",
    label: "Farm life",
    imageAlt: "Reserved image frame for a farm-life experience",
  },
  {
    title: "Follow the wild edges",
    description: "Observe birds, insects and the living details around the farm and trails.",
    label: "Nature",
    imageAlt: "Reserved image frame for a nature observation experience",
  },
  {
    title: "Make room for wonder",
    description: "Look up at the night sky, join a workshop or share a quiet meal outdoors.",
    label: "Slow time",
    imageAlt: "Reserved image frame for an evening farm experience",
  },
] as const;

export type PrototypePackage = {
  id: string;
  part: string;
  title: string;
  subtitle: string;
  vegPricePaise: number | null;
  nonVegPricePaise: number | null;
  conditions: string[];
  inclusions: string[];
  imageAlt: string;
};

export const prototypePackages: PrototypePackage[] = [
  {
    id: "camping-tents-dormitory",
    part: "Part A",
    title: "Camping tents / Dormitory",
    subtitle: "One night stay · per person per day",
    vegPricePaise: 140000,
    nonVegPricePaise: 180000,
    conditions: [],
    inclusions: ["Breakfast", "Lunch", "Evening tea", "Dinner"],
    imageAlt: "Reserved image frame for camping tents and dormitory accommodation",
  },
  {
    id: "guest-house",
    part: "Part B",
    title: "Guest House",
    subtitle: "2 self-contained AC rooms with terrace",
    vegPricePaise: 230000,
    nonVegPricePaise: 280000,
    conditions: ["Rates valid for a group of minimum 10 persons. Scope to be confirmed."],
    inclusions: ["Breakfast", "Lunch", "Evening tea", "Dinner", "24-hour stay"],
    imageAlt: "Reserved image frame for the guest house",
  },
  {
    id: "camp-organiser",
    part: "Part C",
    title: "Camp Organiser",
    subtitle: "Lawn only · bring your own tents",
    vegPricePaise: 120000,
    nonVegPricePaise: 180000,
    conditions: ["Group size 30–50", "Rates valid one month", "Timing 5 pm to 11 am next morning"],
    inclusions: ["Morning breakfast", "Evening tea + nasta", "Dinner", "Dining area", "Washroom facility", "Campfire", "Electricity + service"],
    imageAlt: "Reserved image frame for the camp organiser lawn",
  },
  {
    id: "one-day-picnic",
    part: "Day visit",
    title: "One-day picnic",
    subtitle: "No accommodation",
    vegPricePaise: 110000,
    nonVegPricePaise: null,
    conditions: ["Kid price: 60% for ages 4–10", "Under 4 years: free"],
    inclusions: ["Breakfast & tea", "Lunch", "Evening tea", "Veg / non-veg meal (chicken)"],
    imageAlt: "Reserved image frame for a day picnic at the farm",
  },
];

export const prototypeAccommodation = [
  {
    title: "Camping tents / Dormitory",
    detail: "One night stay included",
    imageAlt: "Reserved image frame for camping accommodation",
  },
  {
    title: "Guest House",
    detail: "2 self-contained AC rooms with terrace",
    imageAlt: "Reserved image frame for the guest house accommodation",
  },
  {
    title: "Camp organiser lawn",
    detail: "Set up your own tents with dining, washroom, campfire, electricity and service",
    imageAlt: "Reserved image frame for the camp organiser lawn",
  },
] as const;

export const prototypeActivities = [
  { title: "Mountain trek", label: "Trails", extra: false },
  { title: "Jungle / nature trail", label: "Nature", extra: false },
  { title: "Star gazing", label: "Evenings", extra: false },
  { title: "Birdwatching", label: "Nature", extra: false },
  { title: "Bullock cart", label: "Farm life", extra: true },
  { title: "White-water river rafting", label: "Water", extra: false },
] as const;

export const prototypeGallery = [
  { id: "farm", category: "Farm", title: "Working farm", imageAlt: "Reserved farm gallery image" },
  { id: "stay", category: "Stay", title: "A place to pause", imageAlt: "Reserved accommodation gallery image" },
  { id: "food", category: "Food", title: "From the farm kitchen", imageAlt: "Reserved food gallery image" },
  { id: "nature", category: "Nature", title: "The living edges", imageAlt: "Reserved nature gallery image" },
  { id: "night-sky", category: "Night sky", title: "Look up", imageAlt: "Reserved night-sky gallery image" },
  { id: "activities", category: "Activities", title: "Make a day of it", imageAlt: "Reserved activities gallery image" },
] as const;

export const prototypeFood = {
  vegLunchDinner: ["Dal", "Rice", "Four chapati / three bhakri", "2 vegetables", "Sweet", "Pickle", "Papad", "Salad"],
  nonVegLunchDinner: ["Dal", "Rice", "Four chapati / three bhakri", "Chicken/mutton curry", "Chicken/mutton masala", "Sweet", "Pickle", "Papad", "Salad"],
  vegBreakfast: ["Kanda-poha", "Sweet sheera", "Upma", "Misal-pav", "Idli-sambar"],
  nonVegBreakfast: ["Bread-omelette", "Egg bhurji"],
  extras: ["Fish / shellfish as per availability & size", "Mutton charged per kg", "Chicken charged per kg", "Barbecue facility available"],
} as const;

export const prototypeStories = {
  title: "Stories are waiting to be shared",
  description: "Customer stories will appear here after the farm receives publishing consent.",
} as const;
