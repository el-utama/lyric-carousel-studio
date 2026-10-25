export type SlideRole = 'hook' | 'verse' | 'chorus' | 'outro';

export type SlideRatio = '3:4' | '4:5' | '9:16' | '1:1';

export interface TemplateTokens {
  bg: string;
  bgGradient: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  fontDisplay: string;
  fontLabel: string;
  fontBody: string;
}

export interface SlideLayout {
  margin: number;
  headerY: number;
  markerY: number;
  quoteY: number;
  quoteWidth: number;
  quoteFontSize: number;
  bodyY: number;
  bodyWidth: number;
  footerLineY: number;
  footerTextY: number;
  iconY: number;
  iconSize: number;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextWeight = 300 | 400 | 500 | 600 | 700;
export type TextStyle = 'normal' | 'italic';
export type TextSemantic = 'header' | 'marker' | 'main' | 'body' | 'footer';
export type LayerType = 'text' | 'image' | 'line' | 'icon';

export interface TextShadow {
  color: string;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

export interface TextLayerProps {
  text: string;
  semantic: TextSemantic;
  fontFamily: string;
  fontSize: number;
  fontStyle: TextStyle;
  fontWeight: TextWeight;
  fill: string;
  letterSpacing: number;
  lineHeight: number;
  align: TextAlign;
  opacity: number;
  shadow: TextShadow | null;
  glow: boolean;
  /** When true, *phrases* are rendered italic in the accent colour. */
  rich: boolean;
}

export interface ImageLayerProps {
  src: string;
  zoom: number;
  positionX: number;
  positionY: number;
  grayscale: boolean;
  brightness: number;
  overlay: number;
  /** Simulasi depth of field: 0 = tajam, angkat untuk blur lebih. */
  blur: number;
}

export interface LineLayerProps {
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export type IconVariant = 'arrow' | 'like' | 'save';

export interface IconLayerProps {
  variant: IconVariant;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

interface LayerBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  props: TextLayerProps;
}

export interface ImageLayer extends LayerBase {
  type: 'image';
  props: ImageLayerProps;
}

export interface LineLayer extends LayerBase {
  type: 'line';
  props: LineLayerProps;
}

export interface IconLayer extends LayerBase {
  type: 'icon';
  props: IconLayerProps;
}

export type Layer = TextLayer | ImageLayer | LineLayer | IconLayer;

export interface Slide {
  id: string;
  role: SlideRole;
  layers: Layer[];
}

export interface Template {
  id: string;
  name: string;
  ratio: SlideRatio;
  tokens: TemplateTokens;
  slideLayouts: Record<SlideRole, SlideLayout>;
}

export type HookAngle =
  | 'curiosity'
  | 'relatable'
  | 'contrast'
  | 'strongest_line'
  | 'confession';

export type Platform = 'tiktok' | 'reels' | 'shorts';

export type LanguageMode = 'auto' | 'en' | 'id' | 'mixed' | 'other';

export interface LanguageSelection {
  mode: LanguageMode;
  /** Free-text language name used when mode is "other". */
  other?: string;
}

export interface GeneratedHook {
  angle: HookAngle;
  text: string;
}

export interface GeneratedSlide {
  role: SlideRole;
  header: string;
  marker: string;
  quote: string;
  body: string;
  footer: string;
}

export interface GenerationResult {
  /** Resolved output language: "en", "id", or a free-text label for other. */
  language: string;
  hooks: GeneratedHook[];
  slides: GeneratedSlide[];
  caption: string;
  hashtags: string[];
}

export interface HookRequest {
  title: string;
  artist: string;
  lyrics: string;
  language: LanguageSelection;
  platform: Platform;
  /** "carousel" builds the full set; "hook" replaces one hook only. */
  mode?: 'carousel' | 'hook';
  angle?: HookAngle;
  avoid?: string[];
}

export interface HookRegenerationResult {
  language: string;
  hook: GeneratedHook;
}

export type LightingContrast = 'rendah' | 'sedang' | 'tinggi';
export type LightingTemperature = 'dingin' | 'netral' | 'hangat';

export interface LightingAnalysis {
  keyDirection: string;
  contrast: LightingContrast;
  temperature: LightingTemperature;
  mood: string;
  summary: string;
}

export interface ReferenceAnalysis {
  palette: string[];
  lighting: LightingAnalysis;
  sourceCount: number;
}

export interface SavedTemplate {
  id: string;
  name: string;
  palette: string[];
  lighting: LightingAnalysis;
  notes: string;
  tokens: TemplateTokens;
  createdAt: string;
  sourceCount: number;
}

export interface VisionAnalysisResult {
  description: string;
  palette: string[];
  lighting: string;
}
