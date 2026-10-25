import { contrastRatio, mixColors } from './color';
import type { SlideRole, TemplateTokens, TextLayerProps, TextShadow } from './types';

/** Fonts loaded before the interactive stage and the export stage render. */
export const FONT_SPECS = [
  '400 90px "Cormorant Garamond"',
  '500 90px "Cormorant Garamond"',
  'italic 400 90px "Cormorant Garamond"',
  'italic 500 90px "Cormorant Garamond"',
  '300 35px "Montserrat"',
  '400 26px "Montserrat"',
  '600 28px "Montserrat"',
  '700 28px "Montserrat"',
];

export function konvaFontStyle(italic: boolean, weight: number): string {
  return `${italic ? 'italic ' : ''}${weight}`;
}

export function resolveTextShadow(props: TextLayerProps): TextShadow | null {
  return (
    props.shadow ??
    (props.glow
      ? { color: props.fill, blur: 26, opacity: 0.28, offsetX: 0, offsetY: 0 }
      : null)
  );
}

export interface RadialGradientGeometry {
  start: { x: number; y: number };
  startRadius: number;
  end: { x: number; y: number };
  endRadius: number;
}

interface GlowVariant {
  x: number;
  y: number;
  radius: number;
}

/** Every slide keeps one palette; only the light source moves with the role. */
const GLOW_BY_ROLE: Record<SlideRole, GlowVariant> = {
  hook: { x: 0.94, y: 0.025, radius: 0.95 },
  verse: { x: 0.06, y: 0.32, radius: 1.04 },
  chorus: { x: 0.9, y: 0.8, radius: 1.12 },
  outro: { x: 0.12, y: 0.9, radius: 0.9 },
};

interface VignetteVariant {
  inner: number;
  outer: number;
  centerY: number;
}

const VIGNETTE_BY_ROLE: Record<SlideRole, VignetteVariant> = {
  hook: { inner: 0.35, outer: 0.75, centerY: 0.53 },
  verse: { inner: 0.37, outer: 0.78, centerY: 0.51 },
  chorus: { inner: 0.33, outer: 0.72, centerY: 0.55 },
  outro: { inner: 0.4, outer: 0.8, centerY: 0.52 },
};

/** Shared background glow so the editor and the export stay pixel-close. */
export function backgroundGlowGeometry(
  width: number,
  height: number,
  role: SlideRole,
): RadialGradientGeometry {
  const variant = GLOW_BY_ROLE[role];
  const x = width * variant.x;
  const y = height * variant.y;
  return {
    start: { x, y },
    startRadius: 0,
    end: { x, y },
    endRadius: Math.max(width, height) * variant.radius,
  };
}

/** Shared vignette geometry for the editor and every export artboard. */
export function backgroundVignetteGeometry(
  width: number,
  height: number,
  role: SlideRole,
): RadialGradientGeometry {
  const variant = VIGNETTE_BY_ROLE[role];
  return {
    start: { x: width / 2, y: height * 0.5 },
    startRadius: Math.min(width, height) * variant.inner,
    end: { x: width / 2, y: height * variant.centerY },
    endRadius: Math.max(width, height) * variant.outer,
  };
}

export interface CoverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Fits a photo over a frame without empty edges. Position offsets are a
 * percentage of the croppable overflow, so -50/50 always stays in bounds.
 */
export function computeCoverRect(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  zoom: number,
  positionX: number,
  positionY: number,
): CoverRect {
  const sourceWidth = Math.max(1, imageWidth);
  const sourceHeight = Math.max(1, imageHeight);
  const frameW = Math.max(1, frameWidth);
  const frameH = Math.max(1, frameHeight);
  const scale = Math.max(frameW / sourceWidth, frameH / sourceHeight) * Math.max(1, zoom);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const overflowX = Math.max(0, width - frameW);
  const overflowY = Math.max(0, height - frameH);
  const offsetX = (Math.max(-50, Math.min(50, positionX)) / 100) * overflowX;
  const offsetY = (Math.max(-50, Math.min(50, positionY)) / 100) * overflowY;

  return {
    x: (frameW - width) / 2 + offsetX,
    y: (frameH - height) / 2 + offsetY,
    width,
    height,
  };
}

/** Overlay opacities that keep header and footer text legible on a photo. */
export function imageOverlayAlphas(overlay: number): {
  tint: number;
  top: number;
  bottom: number;
} {
  const value = Math.max(0, Math.min(1, overlay));
  return {
    tint: value * 0.38,
    top: value,
    bottom: value,
  };
}

export function imageTopGradientStops(top: number): (number | string)[] {
  return [0, `rgba(0,0,0,${top})`, 1, 'rgba(0,0,0,0)'];
}

export function imageBottomGradientStops(bottom: number): (number | string)[] {
  return [
    0,
    'rgba(0,0,0,0)',
    0.4,
    `rgba(0,0,0,${bottom * 0.55})`,
    0.58,
    `rgba(0,0,0,${bottom * 0.82})`,
    1,
    `rgba(0,0,0,${bottom})`,
  ];
}

const AUTO_SCRIM_TARGET = 4.5;
const AUTO_SCRIM_MAX = 0.82;

function requiredScrim(background: string, foreground: string): number {
  if ((contrastRatio(foreground, background) ?? 0) >= AUTO_SCRIM_TARGET) {
    return 0;
  }

  let low = 0;
  let high = AUTO_SCRIM_MAX;
  for (let step = 0; step < 12; step += 1) {
    const middle = (low + high) / 2;
    const darkened = mixColors(background, '#000000', middle);
    if ((contrastRatio(foreground, darkened) ?? 0) >= AUTO_SCRIM_TARGET) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
}

/**
 * Additional solid scrim needed over a photo so both text tokens keep WCAG AA
 * contrast. Existing manual tint is subtracted first, so the two darkening
 * effects complement each other instead of stacking into a black frame.
 */
export function autoScrimAlpha(
  lightest: string,
  tokens: TemplateTokens,
  manualOverlay: number,
): number {
  const required = Math.max(
    requiredScrim(lightest, tokens.textPrimary),
    requiredScrim(lightest, tokens.textMuted),
  );
  if (required <= 0) {
    return 0;
  }

  const manualTint = imageOverlayAlphas(manualOverlay).tint;
  const remaining = Math.max(0.01, 1 - manualTint);
  const additional = 1 - (1 - required) / remaining;
  return Math.max(0, Math.min(AUTO_SCRIM_MAX, additional));
}
