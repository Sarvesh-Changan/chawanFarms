"use client";

import { useEffect, useRef, useState } from "react";

type HeroVideoProps = {
  cloudName: string;
  publicId: string;
  posterPublicId?: string;
  className?: string;
};

type NetworkInformation = EventTarget & { saveData?: boolean };
type DeviceInformation = Navigator & { connection?: NetworkInformation; deviceMemory?: number };

function videoUrl(cloudName: string, publicId: string) {
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/video/upload/f_mp4,vc_h264,q_auto/${encodeURI(publicId)}.mp4`;
}

function posterUrl(cloudName: string, publicId: string) {
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/video/upload/so_0,f_jpg,q_auto/${encodeURI(publicId)}.jpg`;
}

export function HeroVideo({ cloudName, publicId, posterPublicId, className }: HeroVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const poster = posterPublicId ? posterUrl(cloudName, posterPublicId) : posterUrl(cloudName, publicId);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const device = navigator as DeviceInformation;
    const connection = device.connection;
    const lowPowerMobile = window.matchMedia("(max-width: 768px) and (pointer: coarse)").matches && (connection?.saveData === true || (navigator.hardwareConcurrency ?? 8) <= 4 || (device.deviceMemory ?? 8) <= 4);
    const update = () => setMotionAllowed(!motion.matches && !lowPowerMobile && !connection?.saveData);
    update();
    motion.addEventListener("change", update);
    connection?.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !motionAllowed) return;
    let idleCallback: number | undefined;
    let timeout: number | undefined;
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const loadAfterPaint = () => {
      if (typeof browserWindow.requestIdleCallback === "function") {
        idleCallback = browserWindow.requestIdleCallback(() => setIsVisible(true), { timeout: 1200 });
      } else {
        timeout = window.setTimeout(() => setIsVisible(true), 700);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        loadAfterPaint();
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (idleCallback !== undefined && typeof browserWindow.cancelIdleCallback === "function") {
        browserWindow.cancelIdleCallback(idleCallback);
      }
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [motionAllowed]);

  return <div ref={containerRef} className={className} aria-hidden="true" style={{ backgroundImage: `url("${poster}")`, backgroundPosition: "center", backgroundSize: "cover" }}>
    {motionAllowed && isVisible ? <video className="size-full object-cover" poster={poster} muted loop playsInline autoPlay preload="none"><source src={videoUrl(cloudName, publicId)} type="video/mp4" /></video> : null}
  </div>;
}
