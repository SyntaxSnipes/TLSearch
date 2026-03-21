"use client";

import { useEffect, useRef, useState } from "react";

export default function VantaBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [effect, setEffect] = useState<{ destroy?: () => void } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let mounted = true;

    const init = async () => {
      const [THREE, vantaModule] = await Promise.all([
        import("three"),
        import("vanta/dist/vanta.globe.min.js"),
      ]);
      const VANTA = vantaModule.default;

      if (mounted && !effect && ref.current) {
        const e = VANTA({
          el: ref.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0xffefef,
          size: 1.3,
        });
        setEffect(e);
      }
    };

    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    if ("requestIdleCallback" in globalThis) {
      idleHandle = (
        globalThis as typeof globalThis & {
          requestIdleCallback: (cb: () => void) => number;
        }
      ).requestIdleCallback(() => {
        void init();
      });
    } else {
      timeoutHandle = setTimeout(() => {
        void init();
      }, 250);
    }

    return () => {
      mounted = false;
      if (idleHandle !== null && "cancelIdleCallback" in globalThis) {
        (
          globalThis as typeof globalThis & {
            cancelIdleCallback: (id: number) => void;
          }
        ).cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      effect?.destroy?.();
    };
  }, [effect]);

  return <div ref={ref} className="fixed inset-0 -z-20 pointer-events-none opacity-50" />;
}
