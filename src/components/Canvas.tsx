import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Arrow,
  Group,
  Image as KonvaImage,
  Layer as KonvaLayer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { Transformer as KonvaTransformer } from 'konva/lib/shapes/Transformer';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../lib/defaultTemplate';
import { colorWithAlpha } from '../lib/color';
import { HEART_PATH, SAVE_PATH } from '../lib/iconPaths';
import { loadProcessedImage, sampleImageLightness } from '../lib/imageProcessing';
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
} from '../lib/renderShared';
import { layoutRichText } from '../lib/textLayout';
import type {
  IconLayer,
  ImageLayer,
  Layer,
  LineLayer,
  Slide,
  Template,
  TextLayer,
} from '../lib/types';
import { useEditorStore } from '../store/editorStore';

const SNAP_TOLERANCE = 8;
const EMPTY_GUIDES: SnapGuides = { x: null, y: null };

interface SnapGuides {
  x: number | null;
  y: number | null;
}

interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuides;
}

function nearestSnap(edges: number[], candidates: number[]): { offset: number; guide: number | null } {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestOffset = 0;
  let bestGuide: number | null = null;

  for (const candidate of candidates) {
    for (const edge of edges) {
      const distance = Math.abs(candidate - edge);
      if (distance <= SNAP_TOLERANCE && distance < bestDistance) {
        bestDistance = distance;
        bestOffset = candidate - edge;
        bestGuide = candidate;
      }
    }
  }

  return { offset: bestOffset, guide: bestGuide };
}

function snapPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  otherLayers: Layer[],
  margin: number,
): SnapResult {
  const xCandidates = [margin, CANVAS_WIDTH / 2, CANVAS_WIDTH - margin];
  const yCandidates = [margin, CANVAS_HEIGHT / 2, CANVAS_HEIGHT - margin];

  for (const layer of otherLayers) {
    xCandidates.push(layer.x, layer.x + layer.width / 2, layer.x + layer.width);
    yCandidates.push(layer.y, layer.y + layer.height / 2, layer.y + layer.height);
  }

  const vertical = nearestSnap([x, x + width / 2, x + width], xCandidates);
  const horizontal = nearestSnap([y, y + height / 2, y + height], yCandidates);

  return {
    x: x + vertical.offset,
    y: y + horizontal.offset,
    guides: { x: vertical.guide, y: horizontal.guide },
  };
}

interface CanvasProps {
  slide: Slide;
  template: Template;
  className?: string;
}

export default function Canvas({ slide, template, className }: CanvasProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage>(null);
  const transformerRef = useRef<KonvaTransformer>(null);
  const dragCheckpointed = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>(EMPTY_GUIDES);
  const [imageNodes, setImageNodes] = useState<Record<string, HTMLCanvasElement>>({});
  const [imageScrims, setImageScrims] = useState<Record<string, number>>({});

  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectLayer = useEditorStore((state) => state.selectLayer);
  const checkpoint = useEditorStore((state) => state.checkpoint);
  const updateLayerGeometry = useEditorStore((state) => state.updateLayerGeometry);

  useEffect(() => {
    let cancelled = false;

    async function prepareFonts(): Promise<void> {
      try {
        await Promise.all(FONT_SPECS.map((font) => document.fonts.load(font)));
        await document.fonts.ready;
      } catch {
        // Fallback fonts keep the canvas usable when the webfont request fails.
      }
      if (!cancelled) {
        setFontsReady(true);
      }
    }

    void prepareFonts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const measure = (): void => {
      setContainerWidth(node.clientWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const tokens = template.tokens;
  const layout = template.slideLayouts[slide.role];
  const scale = containerWidth / CANVAS_WIDTH;
  const glow = backgroundGlowGeometry(CANVAS_WIDTH, CANVAS_HEIGHT, slide.role);
  const vignette = backgroundVignetteGeometry(CANVAS_WIDTH, CANVAS_HEIGHT, slide.role);
  const orderedLayers = [...slide.layers].sort((a, b) => a.zIndex - b.zIndex);
  const selectedLayer = slide.layers.find((layer) => layer.id === selectedLayerId);
  const canTransform = Boolean(selectedLayer && !selectedLayer.locked && selectedLayer.visible);
  const imageSignature = slide.layers
    .filter((layer): layer is ImageLayer => layer.type === 'image')
    .map(
      (layer) =>
        `${layer.id}:${layer.props.grayscale ? 1 : 0}:${layer.props.brightness.toFixed(2)}:${layer.props.blur.toFixed(1)}:${layer.props.overlay.toFixed(2)}:${layer.props.src.length}:${layer.props.src.slice(-24)}`,
    )
    .join('|');

  useEffect(() => {
    let cancelled = false;
    const imageLayers = slide.layers.filter(
      (layer): layer is ImageLayer => layer.type === 'image',
    );

    if (imageLayers.length === 0) {
      setImageNodes({});
      setImageScrims({});
      return;
    }

    void Promise.all(
      imageLayers.map(async (layer) => {
        try {
          const node = await loadProcessedImage(
            layer.props.src,
            layer.props.grayscale,
            layer.props.brightness,
            layer.props.blur,
          );
          const scrim = autoScrimAlpha(
            sampleImageLightness(node),
            tokens,
            layer.props.overlay,
          );
          return { id: layer.id, node, scrim };
        } catch {
          return { id: layer.id, node: null, scrim: 0 };
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      const next: Record<string, HTMLCanvasElement> = {};
      const nextScrims: Record<string, number> = {};
      for (const entry of entries) {
        if (entry.node) {
          next[entry.id] = entry.node;
          nextScrims[entry.id] = entry.scrim;
        }
      }
      setImageNodes(next);
      setImageScrims(nextScrims);
    });

    return () => {
      cancelled = true;
    };
  }, [imageSignature, slide.id, tokens]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer) {
      return;
    }

    if (!canTransform || !selectedLayerId || !stage) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const node = stage.findOne(`#${selectedLayerId}`);
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [canTransform, selectedLayerId, slide.layers, fontsReady, scale]);

  useEffect(() => {
    setSnapGuides(EMPTY_GUIDES);
  }, [slide.id]);

  const handleStagePointer = (event: KonvaEventObject<Event>): void => {
    if (event.target === event.target.getStage()) {
      selectLayer(null);
    }
  };

  const handleDragStart = (event: KonvaEventObject<DragEvent>, layer: Layer): void => {
    event.cancelBubble = true;
    selectLayer(layer.id);
    dragCheckpointed.current = false;
    setSnapGuides(EMPTY_GUIDES);
  };

  const handleDragMove = (event: KonvaEventObject<DragEvent>, layer: Layer): void => {
    if (!dragCheckpointed.current) {
      checkpoint();
      dragCheckpointed.current = true;
    }

    const node = event.target;
    const state = useEditorStore.getState();
    const liveSlide = state.slides.find((candidate) => candidate.id === slide.id);
    const liveLayer = liveSlide?.layers.find((candidate) => candidate.id === layer.id);
    const otherLayers = (liveSlide?.layers ?? slide.layers).filter(
      (candidate) => candidate.id !== layer.id && candidate.visible,
    );
    const snapped = snapPosition(
      node.x(),
      node.y(),
      liveLayer?.width ?? layer.width,
      liveLayer?.height ?? layer.height,
      otherLayers,
      layout.margin,
    );

    setSnapGuides(snapped.guides);
    updateLayerGeometry(layer.id, { x: snapped.x, y: snapped.y }, false);
  };

  const handleDragEnd = (): void => {
    dragCheckpointed.current = false;
    setSnapGuides(EMPTY_GUIDES);
  };

  const handleTransformStart = (event: KonvaEventObject<Event>): void => {
    event.cancelBubble = true;
    checkpoint();
  };

  const handleTransformEnd = (event: KonvaEventObject<Event>, layer: Layer): void => {
    const node = event.target;
    const nextWidth = Math.max(20, layer.width * Math.abs(node.scaleX()));
    const nextHeight = Math.max(20, layer.height * Math.abs(node.scaleY()));

    node.scaleX(1);
    node.scaleY(1);
    updateLayerGeometry(
      layer.id,
      {
        x: node.x(),
        y: node.y(),
        width: nextWidth,
        height: nextHeight,
        rotation: node.rotation(),
      },
      false,
    );
  };

  const renderLayerContent = (layer: Layer): ReactNode => {
    switch (layer.type) {
      case 'text':
        return renderText(layer);
      case 'line':
        return renderLine(layer);
      case 'icon':
        return renderIcon(layer);
      case 'image':
        return renderImage(layer);
      default:
        return null;
    }
  };

  const renderText = (layer: TextLayer): ReactNode => {
    const props = layer.props;
    const shadow = resolveTextShadow(props);
    const shadowProps = shadow
      ? {
          shadowColor: shadow.color,
          shadowBlur: shadow.blur,
          shadowOpacity: shadow.opacity,
          shadowOffsetX: shadow.offsetX,
          shadowOffsetY: shadow.offsetY,
        }
      : {};

    if (props.rich) {
      const richLayout = layoutRichText({
        text: props.text,
        fontFamily: props.fontFamily,
        fontSize: props.fontSize,
        fontWeight: props.fontWeight,
        italic: props.fontStyle === 'italic',
        lineHeight: props.lineHeight,
        maxWidth: layer.width,
        maxLines: 5,
      });

      return (
        <>
          {richLayout.words.map((word, index) => (
            <Text
              key={`${layer.id}-word-${index}`}
              x={word.x}
              y={word.y}
              text={word.text}
              fontFamily={props.fontFamily}
              fontSize={props.fontSize}
              fontStyle={konvaFontStyle(
                props.fontStyle === 'italic' || word.emphasis,
                props.fontWeight,
              )}
              fill={word.emphasis ? tokens.accent : props.fill}
              listening={false}
              {...shadowProps}
            />
          ))}
        </>
      );
    }

    return (
      <Text
        width={layer.width}
        height={layer.height}
        text={props.text}
        fontFamily={props.fontFamily}
        fontSize={props.fontSize}
        fontStyle={konvaFontStyle(props.fontStyle === 'italic', props.fontWeight)}
        fill={props.fill}
        letterSpacing={props.letterSpacing}
        lineHeight={props.lineHeight}
        align={props.align}
        verticalAlign="top"
        wrap="word"
        listening={false}
        {...shadowProps}
      />
    );
  };

  const renderLine = (layer: LineLayer): ReactNode => (
    <Line
      points={[0, 0, layer.width, 0]}
      stroke={layer.props.stroke}
      strokeWidth={layer.props.strokeWidth}
      lineCap="round"
      listening={false}
    />
  );

  const renderIcon = (layer: IconLayer): ReactNode => {
    const props = layer.props;
    const iconScaleX = layer.width / 24;
    const iconScaleY = layer.height / 24;
    const scaledStroke = props.strokeWidth / Math.max(iconScaleX, 0.001);

    if (props.variant === 'arrow') {
      return (
        <Arrow
          points={[2, layer.height / 2, layer.width - 2, layer.height / 2]}
          stroke={props.stroke}
          fill={props.stroke}
          strokeWidth={props.strokeWidth}
          pointerLength={11}
          pointerWidth={11}
          lineCap="round"
          listening={false}
        />
      );
    }

    return (
      <Path
        data={props.variant === 'like' ? HEART_PATH : SAVE_PATH}
        scaleX={iconScaleX}
        scaleY={iconScaleY}
        stroke={props.stroke}
        strokeWidth={scaledStroke}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    );
  };

  const renderImage = (layer: ImageLayer): ReactNode => {
    const node = imageNodes[layer.id];
    if (!node) {
      return (
        <Rect
          width={layer.width}
          height={layer.height}
          fill="rgba(245,240,232,0.04)"
          stroke="rgba(245,240,232,0.12)"
          strokeWidth={1}
          listening={false}
        />
      );
    }

    const cover = computeCoverRect(
      node.width,
      node.height,
      layer.width,
      layer.height,
      layer.props.zoom,
      layer.props.positionX,
      layer.props.positionY,
    );
    const alphas = imageOverlayAlphas(layer.props.overlay);
    const scrim = imageScrims[layer.id] ?? 0;

    return (
      <Group
        clipX={0}
        clipY={0}
        clipWidth={layer.width}
        clipHeight={layer.height}
        listening={false}
      >
        <KonvaImage
          image={node}
          x={cover.x}
          y={cover.y}
          width={cover.width}
          height={cover.height}
          listening={false}
        />
        {scrim > 0 ? (
          <Rect
            width={layer.width}
            height={layer.height}
            fill={`rgba(0,0,0,${scrim})`}
            listening={false}
          />
        ) : null}
        {alphas.tint > 0 ? (
          <Rect
            width={layer.width}
            height={layer.height}
            fill={`rgba(0,0,0,${alphas.tint})`}
            listening={false}
          />
        ) : null}
        {alphas.top > 0 ? (
          <Rect
            width={layer.width}
            height={layer.height}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: layer.height * 0.22 }}
            fillLinearGradientColorStops={imageTopGradientStops(alphas.top)}
            listening={false}
          />
        ) : null}
        {alphas.bottom > 0 ? (
          <Rect
            width={layer.width}
            height={layer.height}
            fillLinearGradientStartPoint={{ x: 0, y: layer.height * 0.18 }}
            fillLinearGradientEndPoint={{ x: 0, y: layer.height }}
            fillLinearGradientColorStops={imageBottomGradientStops(alphas.bottom)}
            listening={false}
          />
        ) : null}
      </Group>
    );
  };

  const layerOpacity = (layer: Layer): number => {
    if (layer.type === 'image') {
      return 1;
    }
    return layer.props.opacity;
  };

  const hitHeight = (layer: Layer): number =>
    layer.type === 'line' ? Math.max(layer.height, 24) : layer.height;

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Kanvas slide interaktif"
      className={`relative w-full overflow-hidden bg-[#121212] ${className ?? ''}`}
      style={{ aspectRatio: '4 / 5', touchAction: 'none' }}
    >
      {fontsReady && containerWidth > 0 ? (
        <Stage
          ref={stageRef}
          width={containerWidth}
          height={Math.round(containerWidth * (CANVAS_HEIGHT / CANVAS_WIDTH))}
          onMouseDown={handleStagePointer}
          onTouchStart={handleStagePointer}
        >
          <KonvaLayer scaleX={scale} scaleY={scale}>
            <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={tokens.bg} listening={false} />
            <Rect
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fillRadialGradientStartPoint={glow.start}
              fillRadialGradientStartRadius={glow.startRadius}
              fillRadialGradientEndPoint={glow.end}
              fillRadialGradientEndRadius={glow.endRadius}
              fillRadialGradientColorStops={[
                0,
                tokens.bgGradient,
                0.38,
                colorWithAlpha(tokens.bgGradient, 0.12),
                0.7,
                colorWithAlpha(tokens.bgGradient, 0.025),
                1,
                colorWithAlpha(tokens.bgGradient, 0),
              ]}
              listening={false}
            />
            <Rect
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fillRadialGradientStartPoint={vignette.start}
              fillRadialGradientStartRadius={vignette.startRadius}
              fillRadialGradientEndPoint={vignette.end}
              fillRadialGradientEndRadius={vignette.endRadius}
              fillRadialGradientColorStops={[
                0,
                'rgba(0,0,0,0)',
                0.58,
                'rgba(0,0,0,0.03)',
                1,
                'rgba(0,0,0,0.55)',
              ]}
              listening={false}
            />

            {orderedLayers.map((layer) =>
              layer.visible ? (
                <Group
                  key={layer.id}
                  id={layer.id}
                  x={layer.x}
                  y={layer.y}
                  rotation={layer.rotation}
                  opacity={layerOpacity(layer)}
                  draggable={!layer.locked}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    selectLayer(layer.id);
                  }}
                  onTap={(event) => {
                    event.cancelBubble = true;
                    selectLayer(layer.id);
                  }}
                  onDragStart={(event) => handleDragStart(event, layer)}
                  onDragMove={(event) => handleDragMove(event, layer)}
                  onDragEnd={handleDragEnd}
                  onTransformStart={handleTransformStart}
                  onTransformEnd={(event) => handleTransformEnd(event, layer)}
                >
                  {renderLayerContent(layer)}
                  <Rect
                    width={layer.width}
                    height={hitHeight(layer)}
                    y={layer.type === 'line' ? -(hitHeight(layer) - layer.height) / 2 : 0}
                    fill="rgba(245,240,232,0.001)"
                    listening
                  />
                </Group>
              ) : null,
            )}

            <Transformer
              ref={transformerRef}
              rotateEnabled={canTransform}
              resizeEnabled={canTransform}
              keepRatio={false}
              flipEnabled={false}
              padding={6 / Math.max(scale, 0.05)}
              anchorSize={14 / Math.max(scale, 0.05)}
              anchorStroke={tokens.accent}
              anchorFill={tokens.bg}
              anchorCornerRadius={1}
              anchorStrokeWidth={1.4 / Math.max(scale, 0.05)}
              borderStroke={tokens.accent}
              borderStrokeWidth={1.4 / Math.max(scale, 0.05)}
              rotateAnchorOffset={38 / Math.max(scale, 0.05)}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 24 || Math.abs(newBox.height) < 24 ? oldBox : newBox
              }
            />
          </KonvaLayer>

          <KonvaLayer scaleX={scale} scaleY={scale} listening={false}>
            {snapGuides.x !== null ? (
              <Line
                points={[snapGuides.x, 0, snapGuides.x, CANVAS_HEIGHT]}
                stroke={tokens.accent}
                strokeWidth={1.2 / Math.max(scale, 0.05)}
                dash={[6 / Math.max(scale, 0.05), 7 / Math.max(scale, 0.05)]}
                opacity={0.8}
                listening={false}
              />
            ) : null}
            {snapGuides.y !== null ? (
              <Line
                points={[0, snapGuides.y, CANVAS_WIDTH, snapGuides.y]}
                stroke={tokens.accent}
                strokeWidth={1.2 / Math.max(scale, 0.05)}
                dash={[6 / Math.max(scale, 0.05), 7 / Math.max(scale, 0.05)]}
                opacity={0.8}
                listening={false}
              />
            ) : null}
          </KonvaLayer>
        </Stage>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted">
            Preparing the page
          </span>
        </div>
      )}
    </div>
  );
}
