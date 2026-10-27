export type PublicNavItem = { label: string; href: string };
export type PublicNavGroup = { label: string; items: readonly PublicNavItem[] };

export const publicNavHome = { label: "Home", href: "/" } as const satisfies PublicNavItem;

export const publicNavGroups = [
  {
    label: "Stay",
    items: [
      { label: "Accommodation", href: "/accommodation" },
      { label: "Packages", href: "/packages" },
      { label: "Food", href: "/food" },
    ],
  },
] satisfies readonly PublicNavGroup[];

export const publicNavTopLevel = [
  { label: "Activities", href: "/activities" },
  { label: "Stories", href: "/stories" },
  { label: "Gallery", href: "/gallery" },
  { label: "Rewards", href: "/rewards" },
  { label: "Contact", href: "/contact" },
] satisfies readonly PublicNavItem[];

export const publicNavFooter = [
  { label: "FAQ", href: "/faqs" },
] satisfies readonly PublicNavItem[];
