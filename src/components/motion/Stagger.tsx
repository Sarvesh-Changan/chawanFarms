import { Children, type ReactNode } from "react";

import { Reveal } from "@/components/motion/Reveal";

export function Stagger({ children, className, delay = 60, distance = 12 }: { children: ReactNode; className?: string; delay?: number; distance?: number }) {
  return <div className={className}>{Children.map(children, (child, index) => child ? <Reveal delay={Math.min(index, 2) * delay} distance={distance}>{child}</Reveal> : null)}</div>;
}
