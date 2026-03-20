// sbe/src/types/vanta.d.ts

// Strongly-typed specific file:
declare module "vanta/dist/vanta.globe.min.js" {
  interface VantaOptions {
    el: HTMLElement;
    THREE?: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    size?: number;
  }

  interface VantaEffect {
    destroy(): void;
  }
  const VANTA: (options: VantaOptions) => VantaEffect;
  export default VANTA;
}

// (optional) catch-all for other Vanta effects if you use them later
declare module "vanta/dist/*" {
  const VANTA: (options: unknown) => { destroy?: () => void };
  export default VANTA;
}
