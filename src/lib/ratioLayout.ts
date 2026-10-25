import { CANVAS_HEIGHT, CANVAS_WIDTH, RATIO_ARTBOARDS } from './defaultTemplate';
import { reflowSlideContent } from './contentRhythm';
import type {
  IconLayer,
  ImageLayer,
  Layer,
  LineLayer,
  Slide,
  SlideLayout,
  SlideRatio,
  Template,
  TextLayer,
  TextLayerProps,
} from './types';

const DEFAULT_GAP = 88;
const DEFAULT_BIAS = 0.6;
const FOOTER_ZONE = 0.78;

function scaleShadow(
  props: TextLayerProps,
  scale: number,
): TextLayerProps['shadow'] {
  if (!props.shadow) {
    return null;
  }
  return {
    ...props.shadow,
    blur: props.shadow.blur * scale,
    offsetX: props.shadow.offsetX * scale,
    offsetY: props.shadow.offsetY * scale,
  };
}

function scaleTextProps(props: TextLayerProps, scale: number): TextLayerProps {
  return {
    ...props,
    fontSize: props.fontSize * scale,
    letterSpacing: props.letterSpacing * scale,
    shadow: scaleShadow(props, scale),
  };
}

function mapTextLayer(
  layer: TextLayer,
  scale: number,
  sourceLayout: SlideLayout,
  targetLayout: SlideLayout,
  targetHeight: number,
): TextLayer {
  const semantic = layer.props.semantic;
  let y: number;

  switch (semantic) {
    case 'header':
      y = targetLayout.headerY + (layer.y - sourceLayout.headerY) * scale;
      break;
    case 'marker':
      y = targetLayout.markerY + (layer.y - sourceLayout.markerY) * scale;
      break;
    case 'main':
      y = targetLayout.quoteY;
      break;
    case 'body':
      y = targetLayout.bodyY;
      break;
    case 'footer':
      y = targetLayout.footerTextY + (layer.y - sourceLayout.footerTextY) * scale;
      break;
    default:
      y = layer.y * (targetHeight / CANVAS_HEIGHT);
      break;
  }

  return {
    ...layer,
    x: layer.x * scale,
    y,
    width: layer.width * scale,
    height: layer.height * scale,
    props: scaleTextProps(layer.props, scale),
  };
}

function mapLineLayer(
  layer: LineLayer,
  scale: number,
  sourceLayout: SlideLayout,
  targetLayout: SlideLayout,
  targetHeight: number,
): LineLayer {
  const isFooter = layer.y >= CANVAS_HEIGHT * FOOTER_ZONE;
  return {
    ...layer,
    x: layer.x * scale,
    y: isFooter
      ? targetLayout.footerLineY + (layer.y - sourceLayout.footerLineY) * scale
      : layer.y * (targetHeight / CANVAS_HEIGHT),
    width: layer.width * scale,
    height: Math.max(1, layer.height * scale),
    props: {
      ...layer.props,
      strokeWidth: Math.max(0.5, layer.props.strokeWidth * scale),
    },
  };
}

function mapIconLayer(
  layer: IconLayer,
  scale: number,
  sourceLayout: SlideLayout,
  targetLayout: SlideLayout,
  targetWidth: number,
  targetHeight: number,
): IconLayer {
  const isFooter = layer.y >= CANVAS_HEIGHT * FOOTER_ZONE;
  return {
    ...layer,
    x: isFooter
      ? targetWidth - (CANVAS_WIDTH - layer.x) * scale
      : layer.x * scale,
    y: isFooter
      ? targetLayout.iconY + (layer.y - sourceLayout.iconY) * scale
      : layer.y * (targetHeight / CANVAS_HEIGHT),
    width: layer.width * scale,
    height: layer.height * scale,
    props: {
      ...layer.props,
      strokeWidth: Math.max(0.5, layer.props.strokeWidth * scale),
    },
  };
}

function mapImageLayer(
  layer: ImageLayer,
  scale: number,
  targetWidth: number,
  targetHeight: number,
): ImageLayer {
  const fullBleed =
    layer.width >= CANVAS_WIDTH * 0.95 && layer.height >= CANVAS_HEIGHT * 0.95;

  if (fullBleed) {
    return {
      ...layer,
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight,
    };
  }

  return {
    ...layer,
    x: layer.x * scale,
    y: layer.y * (targetHeight / CANVAS_HEIGHT),
    width: layer.width * scale,
    height: layer.height * scale,
  };
}

function findSemanticText(slide: Slide, semantic: 'main' | 'body'): TextLayer | undefined {
  return slide.layers.find(
    (layer): layer is TextLayer =>
      layer.type === 'text' && layer.visible && layer.props.semantic === semantic,
  );
}

/**
 * Rebuilds the semantic text positions for another export ratio. Custom layers
 * are mapped proportionally; image backgrounds are expanded to cover the new
 * artboard instead of being letterboxed.
 */
export function adaptSlideToRatio(
  slide: Slide,
  template: Template,
  targetRatio: SlideRatio,
): Slide {
  if (targetRatio === template.ratio) {
    return slide;
  }

  const target = RATIO_ARTBOARDS[targetRatio];
  const sourceLayout =
    template.slideLayouts[slide.role] ?? RATIO_ARTBOARDS[template.ratio].layout;
  const targetLayout = target.layout;

  // Capture intentional drags relative to the automatic source rhythm before
  // the target reflow replaces the main/body positions.
  const sourceReflow = reflowSlideContent(slide);
  const sourceMain = findSemanticText(slide, 'main');
  const sourceBody = findSemanticText(slide, 'body');
  const autoMain = sourceReflow.layers.find((layer) => layer.id === sourceMain?.id);
  const autoBody = sourceReflow.layers.find((layer) => layer.id === sourceBody?.id);
  const mainOffset =
    sourceMain && autoMain?.type === 'text' ? sourceMain.y - autoMain.y : 0;
  const bodyOffset =
    sourceBody && autoBody?.type === 'text' ? sourceBody.y - autoBody.y : 0;

  const layers: Layer[] = slide.layers.map((layer) => {
    switch (layer.type) {
      case 'text':
        return mapTextLayer(layer, target.scale, sourceLayout, targetLayout, target.height);
      case 'line':
        return mapLineLayer(layer, target.scale, sourceLayout, targetLayout, target.height);
      case 'icon':
        return mapIconLayer(
          layer,
          target.scale,
          sourceLayout,
          targetLayout,
          target.width,
          target.height,
        );
      case 'image':
        return mapImageLayer(layer, target.scale, target.width, target.height);
      default:
        return layer;
    }
  });

  const reflowed = reflowSlideContent(
    { ...slide, layers },
    {
      gap: DEFAULT_GAP * target.scale,
      bias: targetRatio === '9:16' ? 0.5 : DEFAULT_BIAS,
    },
  );

  if (mainOffset === 0 && bodyOffset === 0) {
    return reflowed;
  }

  return {
    ...reflowed,
    layers: reflowed.layers.map((layer) => {
      if (layer.type !== 'text') {
        return layer;
      }
      if (layer.id === sourceMain?.id) {
        return { ...layer, y: layer.y + mainOffset * target.scale };
      }
      if (layer.id === sourceBody?.id) {
        return { ...layer, y: layer.y + bodyOffset * target.scale };
      }
      return layer;
    }),
  };
}
