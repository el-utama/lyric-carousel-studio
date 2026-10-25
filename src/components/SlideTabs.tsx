import type { ReactNode } from 'react';
import { useEditorStore } from '../store/editorStore';

const ROLE_LABEL: Record<string, string> = {
  hook: 'Hook',
  verse: 'Verse',
  chorus: 'Chorus',
  outro: 'Outro',
};

export default function SlideTabs(): ReactNode {
  const slides = useEditorStore((state) => state.slides);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const setActiveSlide = useEditorStore((state) => state.setActiveSlide);
  const addSlide = useEditorStore((state) => state.addSlide);
  const duplicateSlide = useEditorStore((state) => state.duplicateSlide);
  const deleteSlide = useEditorStore((state) => state.deleteSlide);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {slides.map((slide, index) => {
          const active = slide.id === activeSlideId;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(slide.id)}
              aria-pressed={active}
              className={`shrink-0 border-b px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-accent text-paper'
                  : 'border-transparent text-muted hover:border-white/20 hover:text-paper'
              }`}
            >
              <span className="block font-sans text-[9px] uppercase tracking-[0.22em]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mt-1 block font-sans text-[10px] tracking-[0.08em]">
                {ROLE_LABEL[slide.role] ?? slide.role}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={addSlide}
          title="Tambah slide"
          aria-label="Tambah slide"
          className="grid h-8 w-8 place-items-center border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-paper"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => activeSlideId && duplicateSlide(activeSlideId)}
          disabled={!activeSlideId}
          title="Duplikat slide"
          aria-label="Duplikat slide"
          className="grid h-8 w-8 place-items-center border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="8" y="8" width="11" height="11" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 16V5h11" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => activeSlideId && deleteSlide(activeSlideId)}
          disabled={!activeSlideId || slides.length <= 1}
          title="Hapus slide"
          aria-label="Hapus slide"
          className="grid h-8 w-8 place-items-center border border-white/10 text-muted transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
