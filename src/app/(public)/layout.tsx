import type { ReactNode } from "react";

import { AttributionCapture } from "@/components/forms/AttributionCapture";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}<AttributionCapture/></>;
}
