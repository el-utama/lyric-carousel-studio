import { create } from 'zustand';
import { analyzeReferenceImages, fileToPreviewDataUrl } from '../lib/analyzeReference';
import {
  ensureContrast,
  normalizeHex,
  relativeLuminance,
} from '../lib/color';
import { createId, DESIGN_TOKENS } from '../lib/defaultTemplate';
import { buildThemeFromAnalysis, paletteFromTokens } from '../lib/theme';
import type {
  LightingAnalysis,
  ReferenceAnalysis,
  SavedTemplate,
  TemplateTokens,
} from '../lib/types';
import { requestVisionAnalysis } from '../lib/vision';
import { useEditorStore } from './editorStore';

const STORAGE_KEY = 'lyric-carousel-studio.templates.v1';
const MAX_REFERENCES = 8;
const MAX_SAVED_TEMPLATES = 40;

export type AnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'error';
export type VisionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SaveTemplateResult {
  ok: boolean;
  error?: string;
}

export const DEFAULT_LIGHTING: LightingAnalysis = {
  keyDirection: 'menyebar',
  contrast: 'sedang',
  temperature: 'netral',
  mood: 'seimbang dan tenang',
  summary: 'Cahaya menyebar lembut dengan kontras sedang dan nuansa netral.',
};

interface TemplateState {
  references: string[];
  analysis: ReferenceAnalysis | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  visionNotes: string;
  visionStatus: VisionStatus;
  visionError: string | null;
  savedTemplates: SavedTemplate[];
  addReferenceFiles: (files: File[]) => Promise<void>;
  removeReference: (index: number) => Promise<void>;
  clearReferences: () => void;
  analyzeReferences: () => Promise<void>;
  updatePaletteColor: (index: number, color: string) => void;
  updateLighting: (patch: Partial<LightingAnalysis>) => void;
  setVisionNotes: (value: string) => void;
  analyzeWithVision: () => Promise<void>;
  applyAnalysis: () => boolean;
  saveTemplate: (name: string) => SaveTemplateResult;
  applySavedTemplate: (id: string) => boolean;
  deleteTemplate: (id: string) => void;
  importTemplates: (json: string) => number;
  exportTemplates: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPalette(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const palette = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeHex(item))
    .filter((item): item is string => item !== null);
  return [...new Set(palette)].slice(0, MAX_REFERENCES);
}

function normalizeLighting(value: unknown): LightingAnalysis {
  if (!isRecord(value)) {
    return DEFAULT_LIGHTING;
  }

  const contrast =
    value.contrast === 'rendah' || value.contrast === 'sedang' || value.contrast === 'tinggi'
      ? value.contrast
      : DEFAULT_LIGHTING.contrast;
  const temperature =
    value.temperature === 'dingin' ||
    value.temperature === 'netral' ||
    value.temperature === 'hangat'
      ? value.temperature
      : DEFAULT_LIGHTING.temperature;

  return {
    keyDirection:
      typeof value.keyDirection === 'string' && value.keyDirection.trim().length > 0
        ? value.keyDirection.trim().slice(0, 60)
        : DEFAULT_LIGHTING.keyDirection,
    contrast,
    temperature,
    mood:
      typeof value.mood === 'string' && value.mood.trim().length > 0
        ? value.mood.trim().slice(0, 80)
        : DEFAULT_LIGHTING.mood,
    summary:
      typeof value.summary === 'string' && value.summary.trim().length > 0
        ? value.summary.trim().slice(0, 400)
        : DEFAULT_LIGHTING.summary,
  };
}

function readString(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function normalizeTokens(value: unknown, analysis: ReferenceAnalysis): TemplateTokens {
  const fallback = buildThemeFromAnalysis(analysis);
  if (!isRecord(value)) {
    return fallback;
  }

  const bg = normalizeHex(typeof value.bg === 'string' ? value.bg : '');
  const primary = normalizeHex(typeof value.textPrimary === 'string' ? value.textPrimary : '');
  const muted = normalizeHex(typeof value.textMuted === 'string' ? value.textMuted : '');
  const accent = normalizeHex(typeof value.accent === 'string' ? value.accent : '');
  if (!bg || !primary || !muted || !accent) {
    return fallback;
  }
  if ((relativeLuminance(bg) ?? 1) > 0.06) {
    return fallback;
  }

  return {
    bg,
    bgGradient:
      typeof value.bgGradient === 'string' && /^rgba?\(/i.test(value.bgGradient.trim())
        ? value.bgGradient.trim().slice(0, 80)
        : fallback.bgGradient,
    textPrimary: ensureContrast(primary, bg, 7),
    textMuted: ensureContrast(muted, bg, 4.5),
    accent: ensureContrast(accent, bg, 3),
    fontDisplay: DESIGN_TOKENS.fontDisplay,
    fontLabel: DESIGN_TOKENS.fontLabel,
    fontBody: DESIGN_TOKENS.fontBody,
  };
}

function normalizeSavedTemplate(
  raw: unknown,
  existingIds: Set<string>,
): SavedTemplate | null {
  if (!isRecord(raw)) {
    return null;
  }

  const palette = readPalette(raw.palette);
  if (palette.length < 2) {
    return null;
  }

  const lighting = normalizeLighting(raw.lighting);
  const analysis: ReferenceAnalysis = {
    palette,
    lighting,
    sourceCount:
      typeof raw.sourceCount === 'number' && Number.isFinite(raw.sourceCount)
        ? Math.max(0, Math.round(raw.sourceCount))
        : 0,
  };
  const suggestedId =
    typeof raw.id === 'string' && raw.id.trim().length > 0
      ? raw.id.trim().slice(0, 80)
      : createId('theme');
  const id = existingIds.has(suggestedId) ? createId('theme') : suggestedId;
  existingIds.add(id);

  return {
    id,
    name: readString(raw.name, 'Referensi tanpa nama', 80),
    palette,
    lighting,
    notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 1200) : '',
    tokens: normalizeTokens(raw.tokens, analysis),
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.length > 0
        ? raw.createdAt
        : new Date().toISOString(),
    sourceCount: analysis.sourceCount,
  };
}

function loadSavedTemplates(): SavedTemplate[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    const list = isRecord(parsed) && Array.isArray(parsed.templates)
      ? parsed.templates
      : Array.isArray(parsed)
        ? parsed
        : [];
    const ids = new Set<string>();
    return list
      .map((item) => normalizeSavedTemplate(item, ids))
      .filter((item): item is SavedTemplate => item !== null)
      .slice(0, MAX_SAVED_TEMPLATES);
  } catch {
    return [];
  }
}

function persistTemplates(templates: SavedTemplate[]): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, templates }),
    );
    return true;
  } catch {
    return false;
  }
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  references: [],
  analysis: null,
  analysisStatus: 'idle',
  analysisError: null,
  visionNotes: '',
  visionStatus: 'idle',
  visionError: null,
  savedTemplates: loadSavedTemplates(),

  addReferenceFiles: async (files) => {
    const accepted = files.filter((file) => file.type.startsWith('image/'));
    if (accepted.length === 0) {
      set({ analysisStatus: 'error', analysisError: 'Pilih berkas gambar yang valid.' });
      return;
    }

    const available = MAX_REFERENCES - get().references.length;
    if (available <= 0) {
      set({
        analysisStatus: 'error',
        analysisError: `Maksimal ${MAX_REFERENCES} gambar referensi. Hapus salah satu terlebih dahulu.`,
      });
      return;
    }

    const selected = accepted.slice(0, available);
    const results = await Promise.allSettled(selected.map((file) => fileToPreviewDataUrl(file)));
    const previews = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map((result) => result.value)
      .slice(0, available);

    if (previews.length === 0) {
      set({ analysisStatus: 'error', analysisError: 'Gambar tidak dapat dibaca.' });
      return;
    }

    set((state) => ({
      references: [...state.references, ...previews],
      analysisError:
        accepted.length > available
          ? `Hanya ${available} gambar ditambahkan karena batas ${MAX_REFERENCES}.`
          : null,
      visionNotes: '',
      visionStatus: 'idle',
      visionError: null,
    }));

    await get().analyzeReferences();
  },

  removeReference: async (index) => {
    set((state) => ({
      references: state.references.filter((_, candidate) => candidate !== index),
      visionNotes: '',
      visionStatus: 'idle',
      visionError: null,
    }));

    if (get().references.length === 0) {
      set({ analysis: null, analysisStatus: 'idle', analysisError: null });
      return;
    }

    await get().analyzeReferences();
  },

  clearReferences: () =>
    set({
      references: [],
      analysis: null,
      analysisStatus: 'idle',
      analysisError: null,
      visionNotes: '',
      visionStatus: 'idle',
      visionError: null,
    }),

  analyzeReferences: async () => {
    const current = get().references;
    if (current.length === 0) {
      set({ analysis: null, analysisStatus: 'idle', analysisError: null });
      return;
    }

    set({ analysisStatus: 'analyzing', analysisError: null });

    try {
      const analysis = await analyzeReferenceImages(current);
      if (get().references !== current) {
        return;
      }
      set({
        analysis,
        analysisStatus: 'ready',
        analysisError: null,
        visionNotes: '',
        visionStatus: 'idle',
        visionError: null,
      });
    } catch (error) {
      if (get().references !== current) {
        return;
      }
      set({
        analysisStatus: 'error',
        analysisError:
          error instanceof Error ? error.message : 'Analisis referensi gagal.',
      });
    }
  },

  updatePaletteColor: (index, color) => {
    const hex = normalizeHex(color);
    if (!hex) {
      return;
    }
    set((state) =>
      state.analysis
        ? {
            analysis: {
              ...state.analysis,
              palette: state.analysis.palette.map((candidate, candidateIndex) =>
                candidateIndex === index ? hex : candidate,
              ),
            },
          }
        : {},
    );
  },

  updateLighting: (patch) =>
    set((state) =>
      state.analysis
        ? {
            analysis: {
              ...state.analysis,
              lighting: { ...state.analysis.lighting, ...patch },
            },
          }
        : {},
    ),

  setVisionNotes: (value) => set({ visionNotes: value.slice(0, 1600) }),

  analyzeWithVision: async () => {
    const current = get().references;
    if (current.length === 0) {
      set({ visionStatus: 'error', visionError: 'Tambahkan gambar referensi terlebih dahulu.' });
      return;
    }

    set({ visionStatus: 'loading', visionError: null });

    try {
      const result = await requestVisionAnalysis(current);
      if (get().references !== current) {
        return;
      }
      set((state) => ({
        visionStatus: 'ready',
        visionError: null,
        visionNotes: [result.description, result.lighting].filter(Boolean).join(' ').slice(0, 1600),
        analysis:
          state.analysis && result.palette.length >= 3
            ? { ...state.analysis, palette: result.palette.slice(0, 8) }
            : state.analysis,
      }));
    } catch (error) {
      set({
        visionStatus: 'error',
        visionError: error instanceof Error ? error.message : 'Analisis vision gagal.',
      });
    }
  },

  applyAnalysis: () => {
    const analysis = get().analysis;
    if (!analysis) {
      return false;
    }
    const tokens = buildThemeFromAnalysis(analysis);
    useEditorStore.getState().applyTheme(tokens, 'Referensi Visual');
    return true;
  },

  saveTemplate: (name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: 'Beri nama template terlebih dahulu.' };
    }

    const state = get();
    const tokens = state.analysis
      ? buildThemeFromAnalysis(state.analysis)
      : useEditorStore.getState().template.tokens;
    const palette = state.analysis?.palette ?? paletteFromTokens(tokens);
    const lighting = state.analysis?.lighting ?? DEFAULT_LIGHTING;
    const template: SavedTemplate = {
      id: createId('theme'),
      name: trimmed.slice(0, 80),
      palette,
      lighting,
      notes: state.visionNotes.trim(),
      tokens,
      createdAt: new Date().toISOString(),
      sourceCount: state.analysis?.sourceCount ?? 0,
    };
    const templates = [template, ...state.savedTemplates].slice(0, MAX_SAVED_TEMPLATES);

    if (!persistTemplates(templates)) {
      return { ok: false, error: 'Template tidak dapat disimpan di peramban ini.' };
    }

    set({ savedTemplates: templates });
    return { ok: true };
  },

  applySavedTemplate: (id) => {
    const saved = get().savedTemplates.find((template) => template.id === id);
    if (!saved) {
      return false;
    }

    useEditorStore.getState().applyTheme(saved.tokens, saved.name);
    set({
      analysis: {
        palette: saved.palette,
        lighting: saved.lighting,
        sourceCount: saved.sourceCount || get().analysis?.sourceCount || 0,
      },
      analysisStatus: 'ready',
      analysisError: null,
      visionNotes: saved.notes,
      visionStatus: 'idle',
      visionError: null,
    });
    return true;
  },

  deleteTemplate: (id) => {
    const templates = get().savedTemplates.filter((template) => template.id !== id);
    persistTemplates(templates);
    set({ savedTemplates: templates });
  },

  importTemplates: (json) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('File JSON tidak valid.');
    }

    const list = isRecord(parsed) && Array.isArray(parsed.templates)
      ? parsed.templates
      : Array.isArray(parsed)
        ? parsed
        : null;
    if (!list) {
      throw new Error('File tidak memuat daftar template.');
    }

    const existing = get().savedTemplates;
    const ids = new Set(existing.map((template) => template.id));
    const imported = list
      .map((item) => normalizeSavedTemplate(item, ids))
      .filter((item): item is SavedTemplate => item !== null);
    if (imported.length === 0) {
      throw new Error('Tidak ada template yang cocok di dalam file.');
    }

    const merged = [...imported, ...existing].slice(0, MAX_SAVED_TEMPLATES);
    if (!persistTemplates(merged)) {
      throw new Error('Template tidak dapat disimpan di peramban ini.');
    }

    set({ savedTemplates: merged });
    return imported.length;
  },

  exportTemplates: () =>
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        templates: get().savedTemplates,
      },
      null,
      2,
    ),
}));
