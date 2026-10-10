"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { captureAttributionClient } from "@/lib/attribution";

export function AttributionCapture() {
  const pathname = usePathname();
  const firstPage = useRef(true);
  useEffect(() => {
    if (pathname.startsWith("/preview")) return;
    captureAttributionClient(pathname, window.location.search, firstPage.current ? document.referrer : undefined);
    firstPage.current = false;
  }, [pathname]);
  return null;
}
