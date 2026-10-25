import { layoutRichText } from './textLayout';
import type { Layer, LineLayer, Slide, TextLayer } from './types';

interface ReflowOptions {
  /** Space between the closing quote line and the supporting paragraph. */
  gap?: number;
  /** 0.5 centers the pair; higher values push it toward the footer. */
  bias?: number;
}

const DEFAULT_GAP = 88;
const DEFAULT_BIAS = 0.6;

function textBlockHeight(layer: TextLayer, maxLines: number): number {
  const props = layer.props;
  const layout = layoutRichText({
    text: props.text,
    fontFamily: props.fontFamily,
    fontSize: props.fontSize,
    fontWeight: props.fontWeight,
    italic: props.fontStyle === 'italic',
    lineHeight: props.lineHeight,
    maxWidth: layer.width,
    maxLines,
  });
  return layout.lineCount * props.fontSize * props.lineHeight;
}

function visibleLayer(layer: Layer): boolean {
  return layer.visible;
}

/**
 * Places the quote and supporting paragraph as one visual block. The quote no
 * longer sits on a fixed 520px reservation, so short copy does not leave a
 * large hole above the body and long copy does not collide with the footer.
 */
export function reflowSlideContent(slide: Slide, options: ReflowOptions = {}): Slide {
  const main = slide.layers.find(
    (layer): layer is TextLayer =>
      layer.type === 'text' && layer.props.semantic === 'main' && visibleLayer(layer),
  );
  const body = slide.layers.find(
    (layer): layer is TextLayer =>
      layer.type === 'text' && layer.props.semantic === 'body' && visibleLayer(layer),
  );
  const header = slide.layers.find(
    (layer): layer is TextLayer =>
      layer.type === 'text' && layer.props.semantic === 'header' && visibleLayer(layer),
  );
  const footerLine = slide.layers
    .filter((layer): layer is LineLayer => layer.type === 'line' && visibleLayer(layer))
    .sort((first, second) => second.y - first.y)[0];

  if (!main || !body || !header || !footerLine) {
    return slide;
  }

  const mainHeight = textBlockHeight(main, 5);
  const bodyHeight = textBlockHeight(body, 3);
  if (mainHeight <= 0 && bodyHeight <= 0) {
    return slide;
  }

  const contentTop = header.y + header.height + Math.max(48, header.height * 1.5);
  const contentBottom = footerLine.y - Math.max(80, footerLine.y * 0.08);
  const available = Math.max(80, contentBottom - contentTop);
  const preferredGap = Math.max(28, options.gap ?? DEFAULT_GAP);
  let gap = preferredGap;
  let total = mainHeight + gap + bodyHeight;

  if (total > available) {
    gap = Math.max(28, available - mainHeight - bodyHeight);
    total = mainHeight + gap + bodyHeight;
  }

  const slack = Math.max(0, available - total);
  const bias = Math.max(0, Math.min(1, options.bias ?? DEFAULT_BIAS));
  let mainY = contentTop + slack * bias;
  let bodyY = mainY + mainHeight + gap;

  // Keep the paragraph clear of the footer even when both blocks are tall.
  const maxBodyY = footerLine.y - 40 - bodyHeight;
  if (bodyY > maxBodyY) {
    bodyY = maxBodyY;
    mainY = Math.max(contentTop, bodyY - mainHeight - gap);
  }
  if (mainY < contentTop) {
    mainY = contentTop;
  }
  if (bodyY < mainY + mainHeight + 24) {
    bodyY = mainY + mainHeight + 24;
  }

  const nextMainY = Math.round(mainY);
  const nextBodyY = Math.round(bodyY);

  return {
    ...slide,
    layers: slide.layers.map((layer) => {
      if (layer.id === main.id) {
        return { ...main, y: nextMainY };
      }
      if (layer.id === body.id) {
        return { ...body, y: nextBodyY };
      }
      return layer;
    }),
  };
}
