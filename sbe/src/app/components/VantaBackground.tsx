/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function VantaBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [effect, setEffect] = useState<{ destroy?: () => void } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const VANTA = (await import("vanta/dist/vanta.globe.min.js")).default;
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
    })();
    return () => {
      mounted = false;
      effect?.destroy?.();
    };
  }, [effect]);

  return <div ref={ref} className="fixed inset-0 -z-20 pointer-events-none opacity-50" />;
}
