import { reflowSlideContent } from './contentRhythm';
import type {
  IconLayer,
  IconVariant,
  Layer,
  LineLayer,
  Slide,
  SlideLayout,
  SlideRatio,
  SlideRole,
  Template,
  TemplateTokens,
  TextLayer,
  TextSemantic,
  TextWeight,
} from './types';

export const CANVAS_WIDTH = 1200;
/** The editor master is 4:5. Other export ratios get their own artboard. */
export const CANVAS_HEIGHT = 1500;
export const MARGIN = 96;
export const CONTENT_WIDTH = CANVAS_WIDTH - MARGIN * 2;

export const DESIGN_TOKENS: TemplateTokens = {
  bg: '#121212',
  bgGradient: 'rgba(90,50,35,0.25)',
  textPrimary: '#F5F0E8',
  textMuted: '#B8B2A7',
  accent: '#E07A5F',
  fontDisplay: 'Cormorant Garamond',
  fontLabel: 'Montserrat',
  fontBody: 'Montserrat',
};

export interface PalettePreset {
  id: string;
  name: string;
  shortName: string;
  description: string;
  tokens: TemplateTokens;
}

/**
 * Curated dark palettes. Typography, spacing, and the single-accent rule stay
 * fixed; only the base/light/accent colours move.
 */
export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: 'editorial',
    name: 'Editorial Sinematik',
    shortName: 'Editorial',
    description: 'Charcoal hangat + terracotta',
    tokens: { ...DESIGN_TOKENS },
  },
  {
    id: 'ink-ochre',
    name: 'Ink & Ochre',
    shortName: 'Ink & Ochre',
    description: 'Charcoal kebiruan + ochre',
    tokens: {
      bg: '#101417',
      bgGradient: 'rgba(78,64,38,0.26)',
      textPrimary: '#F2EFE7',
      textMuted: '#B9B3A7',
      accent: '#C9A36A',
      fontDisplay: DESIGN_TOKENS.fontDisplay,
      fontLabel: DESIGN_TOKENS.fontLabel,
      fontBody: DESIGN_TOKENS.fontBody,
    },
  },
  {
    id: 'plum-rose',
    name: 'Plum & Rose',
    shortName: 'Plum & Rose',
    description: 'Plum pekat + rose lembut',
    tokens: {
      bg: '#171014',
      bgGradient: 'rgba(78,44,58,0.27)',
      textPrimary: '#F4EEF0',
      textMuted: '#BEB2B7',
      accent: '#C98B93',
      fontDisplay: DESIGN_TOKENS.fontDisplay,
      fontLabel: DESIGN_TOKENS.fontLabel,
      fontBody: DESIGN_TOKENS.fontBody,
    },
  },
];

/** Percentage buffers used by the 9:16 layout and its export preview overlay. */
export const TIKTOK_SAFE_ZONES = {
  top: 15,
  bottom: 25,
  right: 8,
} as const;

export const DEFAULT_SONG = {
  title: 'Pernah Bahagia Bersama',
  artist: 'eL Utama',
};

/**
 * 4:5 master. The body position here is only a fallback; generated copy is
 * reflowed from the measured quote height before it reaches the canvas.
 */
const BASE_LAYOUT: SlideLayout = {
  margin: MARGIN,
  headerY: 96,
  markerY: 98,
  quoteY: 400,
  quoteWidth: 1000,
  quoteFontSize: 90,
  bodyY: 960,
  bodyWidth: 740,
  footerLineY: 1320,
  footerTextY: 1356,
  iconY: 1343,
  iconSize: 56,
};

export const SLIDE_LAYOUTS: Record<SlideRole, SlideLayout> = {
  hook: { ...BASE_LAYOUT, quoteY: 376, quoteFontSize: 92 },
  verse: { ...BASE_LAYOUT, quoteY: 408, quoteFontSize: 86 },
  chorus: { ...BASE_LAYOUT, quoteY: 360, quoteFontSize: 94 },
  outro: { ...BASE_LAYOUT, quoteY: 400, quoteFontSize: 86 },
};

export interface RatioArtboard {
  width: number;
  height: number;
  /** Horizontal scale from the 1200-wide master. */
  scale: number;
  layout: SlideLayout;
}

/**
 * Export artboards. 9:16 uses a 1080-wide TikTok canvas; all other ratios stay
 * on the 1200-wide master grid so type sizes remain consistent.
 */
export const RATIO_ARTBOARDS: Record<SlideRatio, RatioArtboard> = {
  '4:5': {
    width: 1200,
    height: 1500,
    scale: 1,
    layout: BASE_LAYOUT,
  },
  '9:16': {
    width: 1080,
    height: 1920,
    scale: 0.9,
    layout: {
      margin: 86.4,
      // The top 15% is TikTok UI; header/marker start at 17% to clear it.
      headerY: 326,
      markerY: 328,
      quoteY: 542,
      quoteWidth: 900,
      quoteFontSize: 81,
      bodyY: 1046,
      bodyWidth: 666,
      footerLineY: 1314,
      footerTextY: 1346,
      iconY: 1334,
      iconSize: 50.4,
    },
  },
  '3:4': {
    width: 1200,
    height: 1600,
    scale: 1,
    layout: {
      ...BASE_LAYOUT,
      quoteY: 420,
      bodyY: 1032,
      footerLineY: 1405,
      footerTextY: 1441,
      iconY: 1428,
    },
  },
  '1:1': {
    width: 1200,
    height: 1200,
    scale: 1,
    layout: {
      ...BASE_LAYOUT,
      headerY: 96,
      markerY: 98,
      quoteY: 250,
      bodyY: 770,
      footerLineY: 1030,
      footerTextY: 1066,
      iconY: 1053,
    },
  },
};

export const defaultTemplate: Template = {
  id: 'editorial-cinematic',
  name: 'Editorial Sinematik',
  ratio: '4:5',
  tokens: DESIGN_TOKENS,
  slideLayouts: SLIDE_LAYOUTS,
};

let idCounter = 0;

export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

interface TextLayerInput {
  semantic: TextSemantic;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle?: 'normal' | 'italic';
  fontWeight: TextWeight;
  fill: string;
  letterSpacing: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  zIndex: number;
  rich?: boolean;
}

function createTextLayer(input: TextLayerInput): TextLayer {
  return {
    id: createId('text'),
    type: 'text',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: 0,
    zIndex: input.zIndex,
    locked: false,
    visible: true,
    props: {
      text: input.text,
      semantic: input.semantic,
      fontFamily: input.fontFamily,
      fontSize: input.fontSize,
      fontStyle: input.fontStyle ?? 'normal',
      fontWeight: input.fontWeight,
      fill: input.fill,
      letterSpacing: input.letterSpacing,
      lineHeight: input.lineHeight,
      align: input.align,
      opacity: 1,
      shadow: null,
      glow: false,
      rich: input.rich ?? false,
    },
  };
}

function createLineLayer(stroke: string, zIndex: number): LineLayer {
  const layout = BASE_LAYOUT;
  return {
    id: createId('line'),
    type: 'line',
    x: MARGIN,
    y: layout.footerLineY,
    width: CONTENT_WIDTH,
    height: 1,
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    props: {
      stroke,
      strokeWidth: 1,
      opacity: 0.2,
    },
  };
}

function createIconLayer(
  x: number,
  y: number,
  size: number,
  variant: IconVariant,
  accent: string,
  zIndex: number,
): IconLayer {
  return {
    id: createId('icon'),
    type: 'icon',
    x,
    y,
    width: size,
    height: size,
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    props: {
      variant,
      stroke: accent,
      strokeWidth: 2.2,
      opacity: 1,
    },
  };
}

interface SlideSeed {
  role: SlideRole;
  headerLabel: string;
  marker: string;
  quote: string;
  body: string;
  footer: string;
  icons: IconVariant[];
}

const SLIDE_SEEDS: SlideSeed[] = [
  {
    role: 'hook',
    headerLabel: 'LYRICAL NOTES',
    marker: '01 // Reflection',
    quote: 'Some feelings never really leave. They just learn to *live in a song*.',
    body: 'This one found me at 2 a.m. and refused to let go. Swipe slowly.',
    footer: 'SLIDE THROUGH THE FEELING',
    icons: ['arrow'],
  },
  {
    role: 'verse',
    headerLabel: 'LISTEN CLOSE',
    marker: '02 // The Build',
    quote: 'I kept the version of us that only *existed at midnight*.',
    body: 'Not every ending needs a reason. Some just need a witness.',
    footer: 'THERE IS MORE ON THE NEXT ONE',
    icons: ['arrow'],
  },
  {
    role: 'chorus',
    headerLabel: 'THE HARDEST TRUTH',
    marker: '03 // Payoff',
    quote: 'Maybe healing is just *learning to miss you* without asking you back.',
    body: 'If this chorus feels familiar, you already know why.',
    footer: 'STAY FOR THE PART THAT HURTS',
    icons: ['arrow'],
  },
  {
    role: 'outro',
    headerLabel: 'STILL WITH YOU',
    marker: '04 // Closing',
    quote: 'Not every love stays. But the *song always does*.',
    body: 'Save this for the night you need it. Then play it once more.',
    footer: 'PERNAH BAHAGIA BERSAMA — eL Utama',
    icons: ['like', 'save'],
  },
];

function buildSlide(seed: SlideSeed, template: Template): Slide {
  const layout = template.slideLayouts[seed.role];
  const tokens = template.tokens;
  const layers: Layer[] = [
    createTextLayer({
      semantic: 'header',
      x: layout.margin,
      y: layout.headerY,
      width: 620,
      height: 40,
      text: seed.headerLabel,
      fontFamily: tokens.fontLabel,
      fontSize: 28,
      fontWeight: 700,
      fill: tokens.accent,
      letterSpacing: 7,
      lineHeight: 1,
      align: 'left',
      zIndex: 0,
    }),
    createTextLayer({
      semantic: 'marker',
      x: layout.margin,
      y: layout.markerY,
      width: CONTENT_WIDTH,
      height: 40,
      text: seed.marker,
      fontFamily: tokens.fontLabel,
      fontSize: 28,
      fontWeight: 300,
      fill: tokens.textMuted,
      letterSpacing: 4.2,
      lineHeight: 1,
      align: 'right',
      zIndex: 1,
    }),
    createTextLayer({
      semantic: 'main',
      x: layout.margin,
      y: layout.quoteY,
      width: layout.quoteWidth,
      height: 520,
      text: seed.quote,
      fontFamily: tokens.fontDisplay,
      fontSize: layout.quoteFontSize,
      fontWeight: 400,
      fill: tokens.textPrimary,
      letterSpacing: 0,
      lineHeight: 1.1,
      align: 'left',
      zIndex: 2,
      rich: true,
    }),
    createTextLayer({
      semantic: 'body',
      x: layout.margin,
      y: layout.bodyY,
      width: layout.bodyWidth,
      height: 200,
      text: seed.body,
      fontFamily: tokens.fontBody,
      fontSize: 35,
      fontWeight: 300,
      fill: tokens.textMuted,
      letterSpacing: 0,
      lineHeight: 1.6,
      align: 'left',
      zIndex: 3,
    }),
    createLineLayer(tokens.textMuted, 4),
    createTextLayer({
      semantic: 'footer',
      x: layout.margin,
      y: layout.footerTextY,
      width: 780,
      height: 34,
      text: seed.footer,
      fontFamily: tokens.fontBody,
      fontSize: 26,
      fontWeight: 400,
      fill: tokens.textMuted,
      letterSpacing: 5.2,
      lineHeight: 1,
      align: 'left',
      zIndex: 5,
    }),
  ];

  if (seed.icons.length === 1) {
    layers.push(
      createIconLayer(
        CANVAS_WIDTH - MARGIN - layout.iconSize,
        layout.iconY,
        layout.iconSize,
        seed.icons[0] ?? 'arrow',
        tokens.accent,
        6,
      ),
    );
  } else {
    const gap = 18;
    const totalWidth = layout.iconSize * seed.icons.length + gap * (seed.icons.length - 1);
    const startX = CANVAS_WIDTH - MARGIN - totalWidth;
    seed.icons.forEach((icon, index) => {
      const x = startX + (layout.iconSize + gap) * index;
      layers.push(createIconLayer(x, layout.iconY, layout.iconSize, icon, tokens.accent, 6 + index));
    });
  }

  return reflowSlideContent({
    id: createId('slide'),
    role: seed.role,
    layers,
  });
}

export function createDefaultSlides(): Slide[] {
  return SLIDE_SEEDS.map((seed) => buildSlide(seed, defaultTemplate));
}

const ROLE_TITLES: Record<SlideRole, string> = {
  hook: 'Opening',
  verse: 'The Build',
  chorus: 'Payoff',
  outro: 'Closing',
};

export function createNewSlide(template: Template, role: SlideRole, order: number): Slide {
  const seed: SlideSeed = {
    role,
    headerLabel: role === 'outro' ? 'ONE LAST THING' : 'A NEW CHAPTER',
    marker: `${String(order).padStart(2, '0')} // ${ROLE_TITLES[role]}`,
    quote: 'Write something worth *pausing for*.',
    body: 'Add a short supporting line here.',
    footer: role === 'outro' ? 'SAVE THIS FOR LATER' : 'SWIPE FOR MORE',
    icons: role === 'outro' ? ['like', 'save'] : ['arrow'],
  };

  return buildSlide(seed, template);
}
