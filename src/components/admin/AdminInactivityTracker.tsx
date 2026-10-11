"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { logoutAction } from "@/server/auth/actions";

const STORAGE_KEY = "cf_admin_last_activity";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 minutes before timeout (at 28 mins)
const CHECK_INTERVAL_MS = 5000; // check every 5 seconds
const THROTTLE_MS = 1000; // throttle activity capture to once per second
const TOAST_ID = "admin-inactivity-warning";

export type AdminInactivityTrackerProps = {
  /**
   * Timeout in milliseconds. Defaults to 30 minutes (1,800,000 ms).
   */
  timeoutMs?: number;
  /**
   * Milliseconds before timeout to display a warning toast. Defaults to 2 minutes (120,000 ms).
   */
  warningBeforeMs?: number;
};

export function AdminInactivityTracker({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningBeforeMs = WARNING_BEFORE_MS,
}: AdminInactivityTrackerProps) {
  const isLoggingOutRef = useRef(false);
  const warningShownRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastRecordedEventRef = useRef<number>(0);

  useEffect(() => {
    // Initialise last activity timestamp in ref and localStorage
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {
      // Ignore localStorage access issues in restricted environments
    }

    const performLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      toast.dismiss(TOAST_ID);
      toast.error("You have been logged out due to 30 minutes of inactivity.");

      try {
        await logoutAction();
      } catch {
        // Fallback redirection even if network action fails
      }

      window.location.href = "/login?reason=inactivity";
    };

    const recordActivity = () => {
      if (isLoggingOutRef.current) return;

      const current = Date.now();
      // Throttle activity captures
      if (current - lastRecordedEventRef.current < THROTTLE_MS) return;
      lastRecordedEventRef.current = current;
      lastActivityRef.current = current;

      try {
        localStorage.setItem(STORAGE_KEY, current.toString());
      } catch {
        // Ignore
      }

      // If warning was previously shown, dismiss it upon user activity
      if (warningShownRef.current) {
        warningShownRef.current = false;
        toast.dismiss(TOAST_ID);
      }
    };

    const checkInactivity = () => {
      if (isLoggingOutRef.current) return;

      // Read from localStorage to coordinate across multiple open tabs
      let effectiveLastActive = lastActivityRef.current;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = Number(stored);
          if (!Number.isNaN(parsed) && parsed > effectiveLastActive) {
            effectiveLastActive = parsed;
            lastActivityRef.current = parsed;
          }
        }
      } catch {
        // Ignore
      }

      const elapsed = Date.now() - effectiveLastActive;

      // 1. Check if full timeout reached
      if (elapsed >= timeoutMs) {
        void performLogout();
        return;
      }

      // 2. Check if warning threshold reached (between 28m and 30m)
      const remainingMs = timeoutMs - elapsed;
      if (remainingMs <= warningBeforeMs) {
        if (!warningShownRef.current) {
          warningShownRef.current = true;
          const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
          toast.warning(
            `You will be logged out in ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""} due to inactivity. Move your mouse or click anywhere to stay signed in.`,
            {
              id: TOAST_ID,
              duration: remainingMs,
            },
          );
        }
      } else if (warningShownRef.current) {
        // Activity elsewhere reset the timer
        warningShownRef.current = false;
        toast.dismiss(TOAST_ID);
      }
    };

    // Listen for tab synchronization via localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const parsed = Number(e.newValue);
        if (!Number.isNaN(parsed) && parsed > lastActivityRef.current) {
          lastActivityRef.current = parsed;
          if (warningShownRef.current) {
            warningShownRef.current = false;
            toast.dismiss(TOAST_ID);
          }
        }
      }
    };

    // User activity listeners
    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", checkInactivity);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    });

    // Periodic check interval
    const intervalId = window.setInterval(checkInactivity, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity);
      }
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", checkInactivity);
      toast.dismiss(TOAST_ID);
    };
  }, [timeoutMs, warningBeforeMs]);

  return null;
}
