import { create } from 'zustand';
import { buildGeneratedSlides } from '../lib/applyGeneration';
import { DEFAULT_SONG } from '../lib/defaultTemplate';
import { resolveLanguage } from '../lib/detectLanguage';
import { requestCarousel, requestSingleHook } from '../lib/generate';
import type {
  GenerationResult,
  HookAngle,
  HookRequest,
  LanguageMode,
  Platform,
} from '../lib/types';
import { useEditorStore } from './editorStore';

export type GenerationStatus = 'idle' | 'loading' | 'ready' | 'error';

export type RegeneratingTarget = HookAngle | 'all' | null;

interface GenerationState {
  title: string;
  artist: string;
  lyrics: string;
  languageMode: LanguageMode;
  languageOther: string;
  platform: Platform;
  status: GenerationStatus;
  error: string | null;
  result: GenerationResult | null;
  selectedHookIndex: number;
  regenerating: RegeneratingTarget;
  setTitle: (value: string) => void;
  setArtist: (value: string) => void;
  setLyrics: (value: string) => void;
  setLanguageMode: (value: LanguageMode) => void;
  setLanguageOther: (value: string) => void;
  setPlatform: (value: Platform) => void;
  setCaption: (value: string) => void;
  generate: () => Promise<void>;
  regenerateAllHooks: () => Promise<void>;
  regenerateHook: (index: number) => Promise<void>;
  selectHook: (index: number) => void;
  clearError: () => void;
}

function buildRequest(state: GenerationState): HookRequest {
  return {
    title: state.title.trim(),
    artist: state.artist.trim(),
    lyrics: state.lyrics.trim(),
    language: {
      mode: state.languageMode,
      other: state.languageOther.trim(),
    },
    platform: state.platform,
  };
}

function canGenerate(state: GenerationState): boolean {
  return state.lyrics.trim().length >= 20;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  title: DEFAULT_SONG.title,
  artist: DEFAULT_SONG.artist,
  lyrics: '',
  languageMode: 'auto',
  languageOther: '',
  platform: 'tiktok',
  status: 'idle',
  error: null,
  result: null,
  selectedHookIndex: 0,
  regenerating: null,

  setTitle: (value) => set({ title: value }),
  setArtist: (value) => set({ artist: value }),
  setLyrics: (value) => set({ lyrics: value }),
  setLanguageMode: (value) => set({ languageMode: value }),
  setLanguageOther: (value) => set({ languageOther: value }),
  setPlatform: (value) => set({ platform: value }),
  setCaption: (value) =>
    set((state) =>
      state.result ? { result: { ...state.result, caption: value } } : {},
    ),
  clearError: () => set({ error: null }),

  generate: async () => {
    const state = get();
    if (!canGenerate(state) || state.status === 'loading') {
      return;
    }

    set({ status: 'loading', error: null });

    try {
      const result = await requestCarousel(buildRequest(state));
      const editor = useEditorStore.getState();
      const slides = buildGeneratedSlides(editor.slides, editor.template, result, {
        title: state.title,
        artist: state.artist,
        selectedHook: result.hooks[0]?.text,
      });
      editor.replaceSlides(slides);

      set({
        result,
        selectedHookIndex: 0,
        status: 'ready',
        error: null,
        regenerating: null,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Carousel gagal dibuat.',
        regenerating: null,
      });
    }
  },

  regenerateAllHooks: async () => {
    const state = get();
    if (!state.result || state.regenerating || !canGenerate(state)) {
      return;
    }

    set({ regenerating: 'all', error: null });

    try {
      const next = await requestCarousel(buildRequest(state));
      const selectedIndex = Math.min(state.selectedHookIndex, next.hooks.length - 1);
      const selectedHook = next.hooks[selectedIndex]?.text;
      if (selectedHook) {
        useEditorStore.getState().applyHookToCarousel(selectedHook);
      }
      set({
        result: { ...state.result, hooks: next.hooks },
        selectedHookIndex: Math.max(0, selectedIndex),
        regenerating: null,
        error: null,
      });
    } catch (error) {
      set({
        regenerating: null,
        error: error instanceof Error ? error.message : 'Hook gagal dibuat ulang.',
      });
    }
  },

  regenerateHook: async (index) => {
    const state = get();
    const hook = state.result?.hooks[index];
    if (!state.result || !hook || state.regenerating || !canGenerate(state)) {
      return;
    }

    const language = resolveLanguage(state.lyrics, {
      mode: state.languageMode,
      other: state.languageOther,
    });

    set({ regenerating: hook.angle, error: null });

    try {
      const response = await requestSingleHook(
        buildRequest(state),
        hook.angle,
        state.result.hooks.map((candidate) => candidate.text),
      );
      const hooks = state.result.hooks.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, text: response.hook.text }
          : candidate,
      );
      if (index === state.selectedHookIndex) {
        useEditorStore.getState().applyHookToCarousel(response.hook.text);
      }
      set({
        result: {
          ...state.result,
          language: response.language || language.label,
          hooks,
        },
        regenerating: null,
        error: null,
      });
    } catch (error) {
      set({
        regenerating: null,
        error: error instanceof Error ? error.message : 'Hook gagal dibuat ulang.',
      });
    }
  },

  selectHook: (index) => {
    const state = get();
    const hook = state.result?.hooks[index];
    if (!hook) {
      return;
    }
    useEditorStore.getState().applyHookToCarousel(hook.text);
    set({ selectedHookIndex: index });
  },
}));
