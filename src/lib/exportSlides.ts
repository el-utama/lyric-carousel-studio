import JSZip from 'jszip';
import Konva from 'konva';
import { colorWithAlpha } from './color';
import { RATIO_ARTBOARDS } from './defaultTemplate';
import { HEART_PATH, SAVE_PATH } from './iconPaths';
import { loadProcessedImage, sampleImageLightness } from './imageProcessing';
import { adaptSlideToRatio } from './ratioLayout';
import {
  autoScrimAlpha,
  backgroundGlowGeometry,
  backgroundVignetteGeometry,
  computeCoverRect,
  FONT_SPECS,
  imageBottomGradientStops,
  imageOverlayAlphas,
  imageTopGradientStops,
  konvaFontStyle,
  resolveTextShadow,
} from './renderShared';
import { layoutRichText } from './textLayout';
import type {
  IconLayer,
  ImageLayer,
  Layer,
  LineLayer,
  Slide,
  SlideRatio,
  SlideRole,
  Template,
  TextLayer,
} from './types';

const EXPORT_PIXEL_RATIO = 2;

interface ExportSize {
  width: number;
  height: number;
}

/** Final pixel dimensions at 2× for each true artboard. */
export const EXPORT_SIZES: Record<SlideRatio, ExportSize> = {
  '4:5': { width: 2400, height: 3000 },
  '9:16': { width: 2160, height: 3840 },
  '3:4': { width: 2400, height: 3200 },
  '1:1': { width: 2400, height: 2400 },
};

/** Colon-free ratio token that is safe in file names, e.g. 9:16 -> 9x16. */
export function ratioFileSlug(ratio: SlideRatio): string {
  return ratio.replace(':', 'x');
}

/** Zero-based slide index, matching the editor's slide order. */
export function slideExportFileName(ratio: SlideRatio, index: number): string {
  return `lyric-carousel-${ratioFileSlug(ratio)}-${String(index + 1).padStart(2, '0')}.png`;
}

export function zipExportFileName(ratio: SlideRatio): string {
  return `lyric-carousel-${ratioFileSlug(ratio)}.zip`;
}

export async function waitForFonts(): Promise<void> {
  try {
    await Promise.all(FONT_SPECS.map((font) => document.fonts.load(font)));
    await document.fonts.ready;
  } catch {
    // The export continues with fallback fonts if the webfonts are unavailable.
  }
}

function addBackground(
  layer: Konva.Layer,
  template: Template,
  width: number,
  height: number,
  role: SlideRole,
): void {
  const tokens = template.tokens;
  const glow = backgroundGlowGeometry(width, height, role);
  const vignette = backgroundVignetteGeometry(width, height, role);

  layer.add(
    new Konva.Rect({
      width,
      height,
      fill: tokens.bg,
      listening: false,
    }),
  );

  layer.add(
    new Konva.Rect({
      width,
      height,
      fillRadialGradientStartPoint: glow.start,
      fillRadialGradientStartRadius: glow.startRadius,
      fillRadialGradientEndPoint: glow.end,
      fillRadialGradientEndRadius: glow.endRadius,
      fillRadialGradientColorStops: [
        0,
        tokens.bgGradient,
        0.38,
        colorWithAlpha(tokens.bgGradient, 0.12),
        0.7,
        colorWithAlpha(tokens.bgGradient, 0.025),
        1,
        colorWithAlpha(tokens.bgGradient, 0),
      ],
      listening: false,
    }),
  );

  layer.add(
    new Konva.Rect({
      width,
      height,
      fillRadialGradientStartPoint: vignette.start,
      fillRadialGradientStartRadius: vignette.startRadius,
      fillRadialGradientEndPoint: vignette.end,
      fillRadialGradientEndRadius: vignette.endRadius,
      fillRadialGradientColorStops: [
        0,
        'rgba(0,0,0,0)',
        0.58,
        'rgba(0,0,0,0.03)',
        1,
        'rgba(0,0,0,0.55)',
      ],
      listening: false,
    }),
  );
}

function shadowProps(layer: TextLayer): {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
} {
  const shadow = resolveTextShadow(layer.props);
  if (!shadow) {
    return {};
  }
  return {
    shadowColor: shadow.color,
    shadowBlur: shadow.blur,
    shadowOpacity: shadow.opacity,
    shadowOffsetX: shadow.offsetX,
    shadowOffsetY: shadow.offsetY,
  };
}

function addTextLayer(group: Konva.Group, layer: TextLayer, template: Template): void {
  const props = layer.props;

  if (props.rich) {
    const rich = layoutRichText({
      text: props.text,
      fontFamily: props.fontFamily,
      fontSize: props.fontSize,
      fontWeight: props.fontWeight,
      italic: props.fontStyle === 'italic',
      lineHeight: props.lineHeight,
      maxWidth: layer.width,
      maxLines: 5,
    });

    for (const word of rich.words) {
      group.add(
        new Konva.Text({
          x: word.x,
          y: word.y,
          text: word.text,
          fontFamily: props.fontFamily,
          fontSize: props.fontSize,
          fontStyle: konvaFontStyle(
            props.fontStyle === 'italic' || word.emphasis,
            props.fontWeight,
          ),
          fill: word.emphasis ? template.tokens.accent : props.fill,
          listening: false,
          ...shadowProps(layer),
        }),
      );
    }
    return;
  }

  group.add(
    new Konva.Text({
      width: layer.width,
      height: layer.height,
      text: props.text,
      fontFamily: props.fontFamily,
      fontSize: props.fontSize,
      fontStyle: konvaFontStyle(props.fontStyle === 'italic', props.fontWeight),
      fill: props.fill,
      letterSpacing: props.letterSpacing,
      lineHeight: props.lineHeight,
      align: props.align,
      verticalAlign: 'top',
      wrap: 'word',
      listening: false,
      ...shadowProps(layer),
    }),
  );
}

function addLineLayer(group: Konva.Group, layer: LineLayer): void {
  group.add(
    new Konva.Line({
      points: [0, 0, layer.width, 0],
      stroke: layer.props.stroke,
      strokeWidth: layer.props.strokeWidth,
      lineCap: 'round',
      listening: false,
    }),
  );
}

function addIconLayer(group: Konva.Group, layer: IconLayer): void {
  const props = layer.props;

  if (props.variant === 'arrow') {
    group.add(
      new Konva.Arrow({
        points: [2, layer.height / 2, layer.width - 2, layer.height / 2],
        stroke: props.stroke,
        fill: props.stroke,
        strokeWidth: props.strokeWidth,
        pointerLength: 11,
        pointerWidth: 11,
        lineCap: 'round',
        listening: false,
      }),
    );
    return;
  }

  const scaleX = layer.width / 24;
  const scaleY = layer.height / 24;
  group.add(
    new Konva.Path({
      data: props.variant === 'like' ? HEART_PATH : SAVE_PATH,
      scaleX,
      scaleY,
      stroke: props.stroke,
      strokeWidth: props.strokeWidth / Math.max(scaleX, 0.001),
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    }),
  );
}

async function addImageLayer(
  group: Konva.Group,
  layer: ImageLayer,
  template: Template,
): Promise<void> {
  const image = await loadProcessedImage(
    layer.props.src,
    layer.props.grayscale,
    layer.props.brightness,
    layer.props.blur,
  );
  const cover = computeCoverRect(
    image.width,
    image.height,
    layer.width,
    layer.height,
    layer.props.zoom,
    layer.props.positionX,
    layer.props.positionY,
  );
  const alphas = imageOverlayAlphas(layer.props.overlay);
  const scrim = autoScrimAlpha(
    sampleImageLightness(image),
    template.tokens,
    layer.props.overlay,
  );
  const clip = new Konva.Group({
    clipX: 0,
    clipY: 0,
    clipWidth: layer.width,
    clipHeight: layer.height,
    listening: false,
  });

  clip.add(
    new Konva.Image({
      image,
      x: cover.x,
      y: cover.y,
      width: cover.width,
      height: cover.height,
      listening: false,
    }),
  );

  if (scrim > 0) {
    clip.add(
      new Konva.Rect({
        width: layer.width,
        height: layer.height,
        fill: `rgba(0,0,0,${scrim})`,
        listening: false,
      }),
    );
  }

  if (alphas.tint > 0) {
    clip.add(
      new Konva.Rect({
        width: layer.width,
        height: layer.height,
        fill: `rgba(0,0,0,${alphas.tint})`,
        listening: false,
      }),
    );
  }

  if (alphas.top > 0) {
    clip.add(
      new Konva.Rect({
        width: layer.width,
        height: layer.height,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: layer.height * 0.22 },
        fillLinearGradientColorStops: imageTopGradientStops(alphas.top),
        listening: false,
      }),
    );
  }

  if (alphas.bottom > 0) {
    clip.add(
      new Konva.Rect({
        width: layer.width,
        height: layer.height,
        fillLinearGradientStartPoint: { x: 0, y: layer.height * 0.18 },
        fillLinearGradientEndPoint: { x: 0, y: layer.height },
        fillLinearGradientColorStops: imageBottomGradientStops(alphas.bottom),
        listening: false,
      }),
    );
  }

  group.add(clip);
}

async function addLayerContent(
  group: Konva.Group,
  layer: Layer,
  template: Template,
): Promise<void> {
  switch (layer.type) {
    case 'text':
      addTextLayer(group, layer, template);
      return;
    case 'line':
      addLineLayer(group, layer);
      return;
    case 'icon':
      addIconLayer(group, layer);
      return;
    case 'image':
      await addImageLayer(group, layer, template);
      return;
    default:
      return;
  }
}

export async function renderSlideArtwork(
  slide: Slide,
  template: Template,
  ratio: SlideRatio,
  pixelRatio = EXPORT_PIXEL_RATIO,
): Promise<HTMLCanvasElement> {
  await waitForFonts();

  const artboard = RATIO_ARTBOARDS[ratio];
  const adapted = adaptSlideToRatio(slide, template, ratio);
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-12000px';
  host.style.top = '0';
  host.style.width = `${artboard.width}px`;
  host.style.height = `${artboard.height}px`;
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  let stage: Konva.Stage | null = null;

  try {
    stage = new Konva.Stage({
      container: host,
      width: artboard.width,
      height: artboard.height,
    });
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    addBackground(layer, template, artboard.width, artboard.height, slide.role);

    const ordered = [...adapted.layers].sort((first, second) => first.zIndex - second.zIndex);
    for (const sceneLayer of ordered) {
      if (!sceneLayer.visible) {
        continue;
      }
      const group = new Konva.Group({
        x: sceneLayer.x,
        y: sceneLayer.y,
        rotation: sceneLayer.rotation,
        opacity: sceneLayer.type === 'image' ? 1 : sceneLayer.props.opacity,
        listening: false,
      });
      await addLayerContent(group, sceneLayer, template);
      layer.add(group);
    }

    stage.draw();
    return stage.toCanvas({ pixelRatio });
  } finally {
    stage?.destroy();
    host.remove();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('PNG tidak dapat dibuat dari kanvas.'));
      }
    }, 'image/png');
  });
}

export async function exportSlidePng(
  slide: Slide,
  template: Template,
  ratio: SlideRatio,
): Promise<Blob> {
  const artwork = await renderSlideArtwork(slide, template, ratio);
  return canvasToBlob(artwork);
}

export async function exportCarouselZip(
  slides: Slide[],
  template: Template,
  ratio: SlideRatio,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (slides.length === 0) {
    throw new Error('Tidak ada slide untuk diekspor.');
  }

  const zip = new JSZip();
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    if (!slide) {
      continue;
    }
    const artwork = await renderSlideArtwork(slide, template, ratio);
    const blob = await canvasToBlob(artwork);
    zip.file(slideExportFileName(ratio, index), blob);
    onProgress?.(index + 1, slides.length);
    // Yield with a timer, not rAF: rAF can pause in background tabs and stall ZIP exports.
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 0);
    });
  }

  return zip.generateAsync({ type: 'blob' });
}
