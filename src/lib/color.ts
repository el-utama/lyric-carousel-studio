interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(value: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const raw = match[1];
  if (!raw) {
    return null;
  }

  const expanded =
    raw.length === 3
      ? raw
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : raw;

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function parseColor(value: string): Rgb | null {
  const trimmed = value.trim();
  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(trimmed);
  if (rgbMatch) {
    return {
      r: Math.min(255, Number(rgbMatch[1])),
      g: Math.min(255, Number(rgbMatch[2])),
      b: Math.min(255, Number(rgbMatch[3])),
    };
  }
  return parseHex(trimmed);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const parsed = parseHex(hex);
  return parsed ? { ...parsed } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

/** Mixes two colours; amount is how much of the second colour to use (0..1). */
export function mixColors(first: string, second: string, amount: number): string {
  const a = parseColor(first);
  const b = parseColor(second);
  if (!a || !b) {
    return first;
  }
  const ratio = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    a.r + (b.r - a.r) * ratio,
    a.g + (b.g - a.g) * ratio,
    a.b + (b.b - a.b) * ratio,
  );
}

export function colorWithAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  const opacity = Math.max(0, Math.min(1, alpha));
  if (!parsed) {
    return `rgba(0,0,0,${opacity})`;
  }
  return `rgba(${parsed.r},${parsed.g},${parsed.b},${opacity})`;
}

export function colorSaturation(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) {
    return 0;
  }
  const maximum = Math.max(rgb.r, rgb.g, rgb.b) / 255;
  const minimum = Math.min(rgb.r, rgb.g, rgb.b) / 255;
  if (maximum === 0) {
    return 0;
  }
  return (maximum - minimum) / maximum;
}

/** Pushes a colour toward white or black until it reaches the contrast target. */
export function ensureContrast(
  foreground: string,
  background: string,
  minimum: number,
): string {
  if (contrastRatio(foreground, background) === null) {
    return foreground;
  }

  const backgroundLuminance = relativeLuminance(background) ?? 0;
  const target = backgroundLuminance > 0.32 ? '#000000' : '#FFFFFF';
  let candidate = foreground;

  for (let step = 0; step < 24; step += 1) {
    const ratio = contrastRatio(candidate, background) ?? 0;
    if (ratio >= minimum) {
      return candidate;
    }
    candidate = mixColors(candidate, target, 0.08);
  }

  return candidate;
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) {
    return null;
  }
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function contrastRatio(foreground: string, background: string): number | null {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  if (foregroundLuminance === null || backgroundLuminance === null) {
    return null;
  }

  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match || !match[1]) {
    return null;
  }
  const raw = match[1];
  if (raw.length === 3) {
    return `#${raw
      .split('')
      .map((character) => `${character}${character}`)
      .join('')
      .toUpperCase()}`;
  }
  return `#${raw.toUpperCase()}`;
}
