import {
  fitMainText,
  fitSingleLineSize,
  fitSupportingText,
} from './autoFit';
import { createNewSlide } from './defaultTemplate';
import { reflowSlideContent } from './contentRhythm';
import type { GenerationResult, Layer, Slide, SlideRole, Template, TextLayer } from './types';

export const CAROUSEL_ROLES: SlideRole[] = ['hook', 'verse', 'chorus', 'outro'];

const ROLE_LABEL_FALLBACK: Record<SlideRole, string> = {
  hook: 'LYRICAL NOTES',
  verse: 'LISTEN CLOSE',
  chorus: 'THE HARDEST TRUTH',
  outro: 'STILL WITH YOU',
};

export interface GenerationApplyOptions {
  title: string;
  artist: string;
  /** When present, replaces the main text on the opening slide. */
  selectedHook?: string;
}

function normalizeMarker(raw: string, index: number): string {
  const prefix = String(index + 1).padStart(2, '0');
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const match = /^(?:\d{1,2}\s*\/\/\s*)?(.+)$/.exec(cleaned);
  const label = match?.[1]?.trim() || ROLE_LABEL_FALLBACK[CAROUSEL_ROLES[index] ?? 'hook'];
  return `${prefix} // ${label}`;
}

function uppercase(value: string, language: string): string {
  const locale = language === 'id' ? 'id-ID' : language === 'en' ? 'en-US' : undefined;
  try {
    return value.toLocaleUpperCase(locale);
  } catch {
    return value.toUpperCase();
  }
}

function songCredit(title: string, artist: string): string {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();
  if (cleanTitle && cleanArtist) {
    return `${cleanTitle} — ${cleanArtist}`.toLocaleUpperCase();
  }
  return (cleanTitle || cleanArtist).toLocaleUpperCase();
}

function updateTextLayer(
  layer: TextLayer,
  update: (props: TextLayer['props']) => TextLayer['props'],
  geometry?: Partial<Pick<TextLayer, 'height'>>,
): TextLayer {
  return { ...layer, ...geometry, props: update(layer.props) };
}

function applyContentToSlide(
  slide: Slide,
  content: GenerationResult['slides'][number],
  index: number,
  result: GenerationResult,
  options: GenerationApplyOptions,
): Slide {
  const role = CAROUSEL_ROLES[index] ?? slide.role;
  const header = uppercase(content.header.trim() || ROLE_LABEL_FALLBACK[role], result.language);
  const marker = normalizeMarker(content.marker, index);
  const main =
    role === 'hook' && options.selectedHook?.trim()
      ? options.selectedHook.trim()
      : content.quote.trim();
  const footer =
    role === 'outro' && (options.title.trim() || options.artist.trim())
      ? songCredit(options.title, options.artist)
      : uppercase(content.footer.trim(), result.language);

  const layers: Layer[] = slide.layers.map((layer) => {
    if (layer.type !== 'text') {
      return layer;
    }

    switch (layer.props.semantic) {
      case 'header':
        return updateTextLayer(layer, (props) => {
          const text = header;
          return {
            ...props,
            text,
            fontSize: fitSingleLineSize(
              text,
              props.fontFamily,
              props.fontWeight,
              props.letterSpacing,
              layer.width,
              props.fontSize,
            ),
          };
        });
      case 'marker':
        return updateTextLayer(layer, (props) => {
          const text = marker;
          return {
            ...props,
            text,
            fontSize: fitSingleLineSize(
              text,
              props.fontFamily,
              props.fontWeight,
              props.letterSpacing,
              layer.width,
              props.fontSize,
            ),
          };
        });
      case 'main': {
        const fit = fitMainText(
          main,
          layer.props.fontFamily,
          layer.props.fontWeight,
          layer.props.lineHeight,
          layer.width,
          layer.props.fontSize,
        );
        return updateTextLayer(
          layer,
          (props) => ({ ...props, text: main, fontSize: fit.fontSize }),
          { height: Math.max(layer.height, Math.ceil(fit.fontSize * layer.props.lineHeight * 5)) },
        );
      }
      case 'body': {
        const fit = fitSupportingText(
          content.body,
          layer.props.fontFamily,
          layer.props.fontWeight,
          layer.props.lineHeight,
          layer.width,
          layer.props.fontSize,
        );
        return updateTextLayer(
          layer,
          (props) => ({ ...props, text: fit.text, fontSize: fit.fontSize }),
          { height: Math.max(layer.height, Math.ceil(fit.fontSize * layer.props.lineHeight * 3)) },
        );
      }
      case 'footer': {
        if (!footer) {
          return layer;
        }
        return updateTextLayer(layer, (props) => ({
          ...props,
          text: footer,
          fontSize: fitSingleLineSize(
            footer,
            props.fontFamily,
            props.fontWeight,
            props.letterSpacing,
            layer.width,
            props.fontSize,
          ),
        }));
      }
      default:
        return layer;
    }
  });

  return reflowSlideContent({ ...slide, role, layers });
}

/**
 * Reuses matching role layers so styling and non-text layers survive
 * regeneration, then reflows the quote and body around the new copy.
 */
export function buildGeneratedSlides(
  existingSlides: Slide[],
  template: Template,
  result: GenerationResult,
  options: GenerationApplyOptions,
): Slide[] {
  return CAROUSEL_ROLES.map((role, index) => {
    const content =
      result.slides.find((candidate) => candidate.role === role) ?? result.slides[index];
    const source =
      existingSlides.find((slide) => slide.role === role) ??
      createNewSlide(template, role, index + 1);

    if (!content) {
      return source;
    }

    return applyContentToSlide(source, content, index, result, options);
  });
}

export function withSelectedHook(slides: Slide[], hookText: string): Slide[] {
  const targetIndex = slides.findIndex((slide) => slide.role === 'hook');
  const index = targetIndex >= 0 ? targetIndex : 0;
  const target = slides[index];
  if (!target) {
    return slides;
  }

  const layers: Layer[] = target.layers.map((layer) => {
    if (layer.type !== 'text' || layer.props.semantic !== 'main') {
      return layer;
    }
    const fit = fitMainText(
      hookText,
      layer.props.fontFamily,
      layer.props.fontWeight,
      layer.props.lineHeight,
      layer.width,
      layer.props.fontSize,
    );
    return updateTextLayer(layer, (props) => ({ ...props, text: hookText, fontSize: fit.fontSize }));
  });

  return slides.map((slide, slideIndex) =>
    slideIndex === index ? reflowSlideContent({ ...target, layers }) : slide,
  );
}
