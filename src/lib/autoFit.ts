import { layoutRichText } from './textLayout';

export interface TextFitInput {
  text: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  lineHeight: number;
  maxWidth: number;
  maxLines: number;
}

export interface TextFitResult {
  fontSize: number;
  lineCount: number;
  truncated: boolean;
}

const MIN_SCALE = 0.6;
const BODY_CHAR_LIMIT = 160;

export function fitRichTextSize(input: TextFitInput, baseFontSize: number): TextFitResult {
  const minimum = Math.max(12, Math.round(baseFontSize * MIN_SCALE));

  for (let size = baseFontSize; size >= minimum; size -= 1) {
    const layout = layoutRichText({
      text: input.text,
      fontFamily: input.fontFamily,
      fontSize: size,
      fontWeight: input.fontWeight,
      italic: input.italic,
      lineHeight: input.lineHeight,
      maxWidth: input.maxWidth,
      maxLines: input.maxLines,
    });
    if (!layout.truncated) {
      return { fontSize: size, lineCount: layout.lineCount, truncated: false };
    }
  }

  const fallback = layoutRichText({
    text: input.text,
    fontFamily: input.fontFamily,
    fontSize: minimum,
    fontWeight: input.fontWeight,
    italic: input.italic,
    lineHeight: input.lineHeight,
    maxWidth: input.maxWidth,
    maxLines: input.maxLines,
  });

  return { fontSize: minimum, lineCount: fallback.lineCount, truncated: fallback.truncated };
}

export function fitSingleLineSize(
  text: string,
  fontFamily: string,
  fontWeight: number,
  letterSpacing: number,
  maxWidth: number,
  baseFontSize: number,
): number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return baseFontSize;
  }

  const minimum = Math.max(10, Math.round(baseFontSize * MIN_SCALE));
  for (let size = baseFontSize; size >= minimum; size -= 1) {
    context.font = `${fontWeight} ${size}px "${fontFamily}", sans-serif`;
    const width = context.measureText(text.replace(/\*/g, '')).width + letterSpacing * text.length;
    if (width <= maxWidth) {
      return size;
    }
  }
  return minimum;
}

/** Keeps rich-text asterisks balanced after a character cut. */
export function balanceEmphasis(text: string): string {
  const markers = (text.match(/\*/g) ?? []).length;
  if (markers % 2 === 0) {
    return text;
  }
  const last = text.lastIndexOf('*');
  return `${text.slice(0, last)}${text.slice(last + 1)}`;
}

export function clampSupportingText(text: string, limit = BODY_CHAR_LIMIT): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) {
    return balanceEmphasis(clean);
  }

  const slice = clean.slice(0, limit - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
  return balanceEmphasis(`${cut.replace(/[\s,;:—–-]+$/, '')}…`);
}

export interface BodyFitResult {
  text: string;
  fontSize: number;
  truncated: boolean;
}

export function fitSupportingText(
  text: string,
  fontFamily: string,
  fontWeight: number,
  lineHeight: number,
  maxWidth: number,
  baseFontSize: number,
): BodyFitResult {
  const clamped = clampSupportingText(text);
  const fit = fitRichTextSize(
    {
      text: clamped,
      fontFamily,
      fontWeight,
      italic: false,
      lineHeight,
      maxWidth,
      maxLines: 3,
    },
    baseFontSize,
  );
  return { text: clamped, fontSize: fit.fontSize, truncated: fit.truncated };
}

export interface MainFitResult {
  fontSize: number;
  truncated: boolean;
}

export function fitMainText(
  text: string,
  fontFamily: string,
  fontWeight: number,
  lineHeight: number,
  maxWidth: number,
  baseFontSize: number,
): MainFitResult {
  const fit = fitRichTextSize(
    {
      text,
      fontFamily,
      fontWeight,
      italic: false,
      lineHeight,
      maxWidth,
      maxLines: 5,
    },
    baseFontSize,
  );
  return { fontSize: fit.fontSize, truncated: fit.truncated };
}
