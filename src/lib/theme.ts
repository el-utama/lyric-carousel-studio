import {
  colorSaturation,
  colorWithAlpha,
  contrastRatio,
  ensureContrast,
  mixColors,
  normalizeHex,
  relativeLuminance,
} from './color';
import { DESIGN_TOKENS } from './defaultTemplate';
import type { Layer, ReferenceAnalysis, Slide, TemplateTokens } from './types';

function luminance(color: string): number {
  return relativeLuminance(color) ?? 0;
}

function safePalette(palette: string[]): string[] {
  const colors = palette
    .map((color) => normalizeHex(color))
    .filter((color): color is string => color !== null);
  return colors.length > 0 ? colors : [DESIGN_TOKENS.bg, DESIGN_TOKENS.textPrimary, DESIGN_TOKENS.accent];
}

export function buildThemeFromAnalysis(analysis: ReferenceAnalysis): TemplateTokens {
  const palette = safePalette(analysis.palette);
  const byLuminance = [...palette].sort((first, second) => luminance(first) - luminance(second));
  const darkest = byLuminance[0] ?? DESIGN_TOKENS.bg;
  const lightest = byLuminance[byLuminance.length - 1] ?? DESIGN_TOKENS.textPrimary;

  let bg = darkest;
  if (luminance(bg) > 0.028) {
    bg = mixColors(bg, '#0B0B0B', 0.84);
  }
  if (luminance(bg) < 0.004) {
    bg = mixColors(bg, '#121212', 0.85);
  }

  const textPrimary = ensureContrast(mixColors(lightest, '#F5F0E8', 0.45), bg, 7);
  const textMuted = ensureContrast(mixColors(textPrimary, bg, 0.4), bg, 4.5);

  let accentCandidate = DESIGN_TOKENS.accent;
  let bestScore = 0.05;
  for (const color of palette) {
    const saturation = colorSaturation(color);
    const score = saturation * (0.55 + luminance(color) * 0.45);
    if (score > bestScore) {
      bestScore = score;
      accentCandidate = color;
    }
  }
  const accent = ensureContrast(accentCandidate, bg, 3.4);
  const glowSource = mixColors(accent, bg, 0.55);

  // The single accent must remain legible against the darkest surface.
  const safeAccent = (contrastRatio(accent, bg) ?? 0) >= 3 ? accent : DESIGN_TOKENS.accent;

  return {
    bg,
    bgGradient: colorWithAlpha(glowSource, 0.34),
    textPrimary,
    textMuted,
    accent: safeAccent,
    fontDisplay: DESIGN_TOKENS.fontDisplay,
    fontLabel: DESIGN_TOKENS.fontLabel,
    fontBody: DESIGN_TOKENS.fontBody,
  };
}

function themeLayer(layer: Layer, tokens: TemplateTokens): Layer {
  switch (layer.type) {
    case 'text':
      switch (layer.props.semantic) {
        case 'header':
          return { ...layer, props: { ...layer.props, fill: tokens.accent } };
        case 'marker':
          return { ...layer, props: { ...layer.props, fill: tokens.textMuted } };
        case 'main':
          return { ...layer, props: { ...layer.props, fill: tokens.textPrimary } };
        case 'body':
        case 'footer':
          return { ...layer, props: { ...layer.props, fill: tokens.textMuted } };
        default:
          return { ...layer, props: { ...layer.props, fill: tokens.textPrimary } };
      }
    case 'line':
      return { ...layer, props: { ...layer.props, stroke: tokens.textMuted } };
    case 'icon':
      return { ...layer, props: { ...layer.props, stroke: tokens.accent } };
    default:
      return layer;
  }
}

export function applyThemeToSlides(slides: Slide[], tokens: TemplateTokens): Slide[] {
  return slides.map((slide) => ({
    ...slide,
    layers: slide.layers.map((layer) => themeLayer(layer, tokens)),
  }));
}

export function paletteFromTokens(tokens: TemplateTokens): string[] {
  return [tokens.bg, tokens.textMuted, tokens.accent, tokens.textPrimary];
}
