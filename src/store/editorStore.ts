import { create } from 'zustand';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  createDefaultSlides,
  createId,
  createNewSlide,
  defaultTemplate,
} from '../lib/defaultTemplate';
import { withSelectedHook } from '../lib/applyGeneration';
import { applyThemeToSlides } from '../lib/theme';
import type {
  IconLayer,
  IconLayerProps,
  ImageLayer,
  ImageLayerProps,
  Layer,
  LineLayer,
  LineLayerProps,
  Slide,
  SlideRole,
  Template,
  TextLayer,
  TextLayerProps,
} from '../lib/types';

const HISTORY_LIMIT = 50;

type LayerPatch = Partial<
  Pick<Layer, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'locked' | 'visible'>
>;

interface EditorSnapshot {
  slides: Slide[];
  activeSlideId: string | null;
  selectedLayerId: string | null;
}

interface EditorState {
  template: Template;
  slides: Slide[];
  activeSlideId: string | null;
  selectedLayerId: string | null;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  setActiveSlide: (slideId: string) => void;
  selectLayer: (layerId: string | null) => void;
  checkpoint: () => void;
  updateLayerGeometry: (layerId: string, patch: LayerPatch, record?: boolean) => void;
  updateTextLayer: (layerId: string, patch: Partial<TextLayerProps>, record?: boolean) => void;
  updateLineLayer: (layerId: string, patch: Partial<LineLayerProps>, record?: boolean) => void;
  updateIconLayer: (layerId: string, patch: Partial<IconLayerProps>, record?: boolean) => void;
  updateImageLayer: (layerId: string, patch: Partial<ImageLayerProps>, record?: boolean) => void;
  setBackgroundImage: (src: string) => void;
  applyImageToAllSlides: (vary?: boolean) => void;
  removeBackgroundImage: (scope?: 'slide' | 'all') => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  moveLayer: (layerId: string, direction: 'up' | 'down') => void;
  duplicateLayer: (layerId: string) => void;
  deleteLayer: (layerId: string) => void;
  nudgeSelected: (deltaX: number, deltaY: number) => void;
  addSlide: () => void;
  duplicateSlide: (slideId: string) => void;
  deleteSlide: (slideId: string) => void;
  replaceSlides: (slides: Slide[]) => void;
  applyHookToCarousel: (hookText: string) => void;
  applyTheme: (tokens: Template['tokens'], name?: string) => void;
  undo: () => void;
  redo: () => void;
}

function activeSlideOf(state: EditorState): Slide | undefined {
  return state.slides.find((slide) => slide.id === state.activeSlideId) ?? state.slides[0];
}

function snapshot(state: EditorState): EditorSnapshot {
  return {
    slides: state.slides,
    activeSlideId: state.activeSlideId,
    selectedLayerId: state.selectedLayerId,
  };
}

function withHistory(state: EditorState, next: Partial<EditorState>): Partial<EditorState> {
  return {
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
    future: [],
    ...next,
  };
}

function applyLayerPatch(layer: Layer, patch: LayerPatch): Layer {
  switch (layer.type) {
    case 'text':
      return { ...layer, ...patch };
    case 'image':
      return { ...layer, ...patch };
    case 'line':
      return { ...layer, ...patch };
    case 'icon':
      return { ...layer, ...patch };
    default:
      return layer;
  }
}

function mapLayer(
  slides: Slide[],
  slideId: string,
  layerId: string,
  update: (layer: Layer) => Layer,
): Slide[] {
  return slides.map((slide) =>
    slide.id === slideId
      ? {
          ...slide,
          layers: slide.layers.map((layer) => (layer.id === layerId ? update(layer) : layer)),
        }
      : slide,
  );
}

function isImageLayer(layer: Layer): layer is ImageLayer {
  return layer.type === 'image';
}

function backgroundZIndex(layers: Layer[]): number {
  const values = layers.filter((layer) => layer.type !== 'image').map((layer) => layer.zIndex);
  return Math.min(0, ...values) - 1;
}

function createBackgroundImageLayer(src: string, layers: Layer[]): ImageLayer {
  return {
    id: createId('image'),
    type: 'image',
    x: 0,
    y: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    rotation: 0,
    zIndex: backgroundZIndex(layers),
    locked: false,
    visible: true,
    props: {
      src,
      zoom: 1,
      positionX: 0,
      positionY: 0,
      grayscale: false,
      brightness: 1,
      overlay: 0.75,
      blur: 0,
    },
  };
}

function cloneLayer(layer: Layer, offset: boolean): Layer {
  const common = {
    id: createId(layer.type),
    x: layer.x + (offset ? 24 : 0),
    y: layer.y + (offset ? 24 : 0),
    zIndex: layer.zIndex + (offset ? 1 : 0),
  };

  switch (layer.type) {
    case 'text':
      return {
        ...layer,
        ...common,
        props: {
          ...layer.props,
          shadow: layer.props.shadow ? { ...layer.props.shadow } : null,
        },
      };
    case 'image':
      return { ...layer, ...common, props: { ...layer.props } };
    case 'line':
      return { ...layer, ...common, props: { ...layer.props } };
    case 'icon':
      return { ...layer, ...common, props: { ...layer.props } };
    default:
      return layer;
  }
}

const initialSlides = createDefaultSlides();

export const useEditorStore = create<EditorState>((set) => ({
  template: defaultTemplate,
  slides: initialSlides,
  activeSlideId: initialSlides[0]?.id ?? null,
  selectedLayerId: null,
  past: [],
  future: [],

  setActiveSlide: (slideId) =>
    set((state) => {
      if (!state.slides.some((slide) => slide.id === slideId)) {
        return {};
      }
      return { activeSlideId: slideId, selectedLayerId: null };
    }),

  selectLayer: (layerId) => set({ selectedLayerId: layerId }),

  checkpoint: () =>
    set((state) => {
      const last = state.past[state.past.length - 1];
      if (last && last.slides === state.slides) {
        return state.future.length > 0 ? { future: [] } : {};
      }
      return {
        past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
        future: [],
      };
    }),

  updateLayerGeometry: (layerId, patch, record = true) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked) {
        return {};
      }
      const slides = mapLayer(state.slides, slide.id, layerId, (candidate) =>
        applyLayerPatch(candidate, patch),
      );
      return record ? withHistory(state, { slides }) : { slides, future: [] };
    }),

  updateTextLayer: (layerId, patch, record = true) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked || layer.type !== 'text') {
        return {};
      }
      const textLayer: TextLayer = { ...layer, props: { ...layer.props, ...patch } };
      const slides = mapLayer(state.slides, slide.id, layerId, () => textLayer);
      return record ? withHistory(state, { slides }) : { slides, future: [] };
    }),

  updateLineLayer: (layerId, patch, record = true) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked || layer.type !== 'line') {
        return {};
      }
      const lineLayer: LineLayer = { ...layer, props: { ...layer.props, ...patch } };
      const slides = mapLayer(state.slides, slide.id, layerId, () => lineLayer);
      return record ? withHistory(state, { slides }) : { slides, future: [] };
    }),

  updateIconLayer: (layerId, patch, record = true) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked || layer.type !== 'icon') {
        return {};
      }
      const iconLayer: IconLayer = { ...layer, props: { ...layer.props, ...patch } };
      const slides = mapLayer(state.slides, slide.id, layerId, () => iconLayer);
      return record ? withHistory(state, { slides }) : { slides, future: [] };
    }),

  updateImageLayer: (layerId, patch, record = true) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked || layer.type !== 'image') {
        return {};
      }
      const imageLayer: ImageLayer = { ...layer, props: { ...layer.props, ...patch } };
      const slides = mapLayer(state.slides, slide.id, layerId, () => imageLayer);
      return record ? withHistory(state, { slides }) : { slides, future: [] };
    }),

  setBackgroundImage: (src) =>
    set((state) => {
      if (!src) {
        return {};
      }
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }

      const existing = slide.layers.find(isImageLayer);
      let imageId: string;
      let layers: Layer[];

      if (existing) {
        imageId = existing.id;
        layers = slide.layers.map((layer) =>
          layer.id === existing.id
            ? {
                ...existing,
                props: {
                  ...existing.props,
                  src,
                  zoom: 1,
                  positionX: 0,
                  positionY: 0,
                  grayscale: false,
                  brightness: 1,
                },
              }
            : layer,
        );
      } else {
        const imageLayer = createBackgroundImageLayer(src, slide.layers);
        imageId = imageLayer.id;
        layers = [...slide.layers, imageLayer];
      }

      const slides = state.slides.map((candidate) =>
        candidate.id === slide.id ? { ...candidate, layers } : candidate,
      );

      return withHistory(state, { slides, selectedLayerId: imageId });
    }),

  applyImageToAllSlides: (vary = false) =>
    set((state) => {
      const slide = activeSlideOf(state);
      const source = slide?.layers.find(isImageLayer);
      if (!slide || !source) {
        return {};
      }

      const slides = state.slides.map((candidate, index) => {
        const others = candidate.layers.filter((layer) => layer.type !== 'image');
        const existing = candidate.layers.find(isImageLayer);
        const zIndex = backgroundZIndex(others);

        // Variasi ringan per slide: geser fokus crop dan blur berbeda-beda
        // sehingga tiap slide memiliki mood visual yang sedikit berbeda
        // dari satu sumber foto yang sama.
        const offsetX = vary ? (index - 1) * 8 : 0;
        const offsetY = vary ? (index % 2 === 0 ? -6 : 6) : 0;
        const extraBlur = vary ? (index % 3 === 0 ? 1 : index % 3 === 1 ? 2 : 0) : 0;

        const imageLayer: ImageLayer = {
          ...(existing ?? createBackgroundImageLayer(source.props.src, others)),
          x: source.x,
          y: source.y,
          width: source.width,
          height: source.height,
          rotation: source.rotation,
          zIndex,
          visible: source.visible,
          props: {
            ...source.props,
            positionX: Math.max(-50, Math.min(50, source.props.positionX + offsetX)),
            positionY: Math.max(-50, Math.min(50, source.props.positionY + offsetY)),
            blur: Math.max(0, Math.min(8, source.props.blur + extraBlur)),
          },
        };
        return { ...candidate, layers: [imageLayer, ...others] };
      });

      return withHistory(state, { slides });
    }),

  removeBackgroundImage: (scope = 'slide') =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }

      const selectedImageRemoved =
        state.selectedLayerId !== null &&
        state.slides.some(
          (candidate) =>
            (scope === 'all' || candidate.id === slide.id) &&
            candidate.layers.some(
              (layer) => layer.id === state.selectedLayerId && layer.type === 'image',
            ),
        );

      const slides = state.slides.map((candidate) =>
        scope === 'all' || candidate.id === slide.id
          ? {
              ...candidate,
              layers: candidate.layers.filter((layer) => layer.type !== 'image'),
            }
          : candidate,
      );

      return withHistory(state, {
        slides,
        selectedLayerId: selectedImageRemoved ? null : state.selectedLayerId,
      });
    }),

  toggleLayerVisibility: (layerId) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer) {
        return {};
      }
      const slides = mapLayer(state.slides, slide.id, layerId, (candidate) =>
        applyLayerPatch(candidate, { visible: !candidate.visible }),
      );
      return withHistory(state, {
        slides,
        selectedLayerId:
          layer.visible && state.selectedLayerId === layerId ? null : state.selectedLayerId,
      });
    }),

  toggleLayerLock: (layerId) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer) {
        return {};
      }
      const slides = mapLayer(state.slides, slide.id, layerId, (candidate) =>
        applyLayerPatch(candidate, { locked: !candidate.locked }),
      );
      return withHistory(state, { slides });
    }),

  moveLayer: (layerId, direction) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const ordered = [...slide.layers].sort((a, b) => a.zIndex - b.zIndex);
      const index = ordered.findIndex((layer) => layer.id === layerId);
      const targetIndex = direction === 'up' ? index + 1 : index - 1;
      const current = ordered[index];
      const target = ordered[targetIndex];
      if (!current || !target) {
        return {};
      }

      ordered[index] = target;
      ordered[targetIndex] = current;
      const zOrder = new Map(ordered.map((layer, order) => [layer.id, order]));
      const slides = state.slides.map((candidateSlide) =>
        candidateSlide.id === slide.id
          ? {
              ...candidateSlide,
              layers: candidateSlide.layers.map((layer) =>
                applyLayerPatch(layer, { zIndex: zOrder.get(layer.id) ?? layer.zIndex }),
              ),
            }
          : candidateSlide,
      );
      return withHistory(state, { slides });
    }),

  duplicateLayer: (layerId) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer) {
        return {};
      }
      const duplicate = cloneLayer(layer, true);
      const topZ = Math.max(...slide.layers.map((candidate) => candidate.zIndex), -1);
      const slides = state.slides.map((candidateSlide) =>
        candidateSlide.id === slide.id
          ? {
              ...candidateSlide,
              layers: [
                ...candidateSlide.layers,
                applyLayerPatch(duplicate, { zIndex: topZ + 1 }),
              ],
            }
          : candidateSlide,
      );
      return withHistory(state, { slides, selectedLayerId: duplicate.id });
    }),

  deleteLayer: (layerId) =>
    set((state) => {
      const slide = activeSlideOf(state);
      if (!slide) {
        return {};
      }
      const layer = slide.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked) {
        return {};
      }
      const slides = state.slides.map((candidateSlide) =>
        candidateSlide.id === slide.id
          ? {
              ...candidateSlide,
              layers: candidateSlide.layers.filter((candidate) => candidate.id !== layerId),
            }
          : candidateSlide,
      );
      return withHistory(state, {
        slides,
        selectedLayerId: state.selectedLayerId === layerId ? null : state.selectedLayerId,
      });
    }),

  nudgeSelected: (deltaX, deltaY) =>
    set((state) => {
      const slide = activeSlideOf(state);
      const layer = slide?.layers.find((candidate) => candidate.id === state.selectedLayerId);
      if (!slide || !layer || layer.locked) {
        return {};
      }
      const slides = mapLayer(state.slides, slide.id, layer.id, (candidate) =>
        applyLayerPatch(candidate, {
          x: candidate.x + deltaX,
          y: candidate.y + deltaY,
        }),
      );
      return withHistory(state, { slides });
    }),

  addSlide: () =>
    set((state) => {
      const roles: SlideRole[] = ['hook', 'verse', 'chorus', 'outro'];
      const role = roles[state.slides.length % roles.length] ?? 'hook';
      const newSlide = createNewSlide(state.template, role, state.slides.length + 1);
      const activeIndex = state.slides.findIndex((slide) => slide.id === state.activeSlideId);
      const insertAt = activeIndex >= 0 ? activeIndex + 1 : state.slides.length;
      const slides = [
        ...state.slides.slice(0, insertAt),
        newSlide,
        ...state.slides.slice(insertAt),
      ];
      return withHistory(state, {
        slides,
        activeSlideId: newSlide.id,
        selectedLayerId: null,
      });
    }),

  duplicateSlide: (slideId) =>
    set((state) => {
      const index = state.slides.findIndex((slide) => slide.id === slideId);
      const source = state.slides[index];
      if (!source) {
        return {};
      }
      const duplicate: Slide = {
        ...source,
        id: createId('slide'),
        layers: source.layers.map((layer) => cloneLayer(layer, false)),
      };
      const slides = [
        ...state.slides.slice(0, index + 1),
        duplicate,
        ...state.slides.slice(index + 1),
      ];
      return withHistory(state, {
        slides,
        activeSlideId: duplicate.id,
        selectedLayerId: null,
      });
    }),

  deleteSlide: (slideId) =>
    set((state) => {
      if (state.slides.length <= 1) {
        return {};
      }
      const index = state.slides.findIndex((slide) => slide.id === slideId);
      if (index < 0) {
        return {};
      }
      const slides = state.slides.filter((slide) => slide.id !== slideId);
      const nextActive = slides[Math.min(index, slides.length - 1)];
      return withHistory(state, {
        slides,
        activeSlideId:
          state.activeSlideId === slideId ? (nextActive?.id ?? null) : state.activeSlideId,
        selectedLayerId: state.activeSlideId === slideId ? null : state.selectedLayerId,
      });
    }),

  replaceSlides: (slides) =>
    set((state) => {
      if (slides.length === 0) {
        return {};
      }
      return withHistory(state, {
        slides,
        activeSlideId: slides[0]?.id ?? null,
        selectedLayerId: null,
      });
    }),

  applyHookToCarousel: (hookText) =>
    set((state) => {
      if (!hookText.trim()) {
        return {};
      }
      const slides = withSelectedHook(state.slides, hookText.trim());
      if (slides === state.slides) {
        return {};
      }
      return withHistory(state, { slides });
    }),

  applyTheme: (tokens, name) =>
    set((state) =>
      withHistory(state, {
        slides: applyThemeToSlides(state.slides, tokens),
        template: {
          ...state.template,
          tokens,
          name: name?.trim() ? name.trim() : state.template.name,
        },
      }),
    ),

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) {
        return {};
      }
      return {
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
        slides: previous.slides,
        activeSlideId: previous.activeSlideId,
        selectedLayerId: previous.selectedLayerId,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) {
        return {};
      }
      return {
        past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        slides: next.slides,
        activeSlideId: next.activeSlideId,
        selectedLayerId: next.selectedLayerId,
      };
    }),
}));
