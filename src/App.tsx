import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Canvas from './components/Canvas';
import ExportDialog from './components/ExportDialog';
import PromoKitDialog from './components/PromoKitDialog';
import HookPicker from './components/HookPicker';
import InputPanel from './components/InputPanel';
import LayerPanel from './components/LayerPanel';
import PhotoPanel from './components/PhotoPanel';
import PropertyPanel from './components/PropertyPanel';
import SlideTabs from './components/SlideTabs';
import TemplatePanel from './components/TemplatePanel';
import { useEditorStore } from './store/editorStore';

export default function App(): ReactNode {
  const template = useEditorStore((state) => state.template);
  const slides = useEditorStore((state) => state.slides);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const nudgeSelected = useEditorStore((state) => state.nudgeSelected);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const selectLayer = useEditorStore((state) => state.selectLayer);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'photo' | 'reference'>(
    'properties',
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [promoKitOpen, setPromoKitOpen] = useState(false);

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isEditing =
        target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
      if (isEditing) {
        return;
      }

      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (command && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (command && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === 'Escape') {
        selectLayer(null);
        return;
      }

      if (!selectedLayerId) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        nudgeSelected(event.key === 'ArrowLeft' ? -step : step, 0);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        nudgeSelected(0, event.key === 'ArrowUp' ? -step : step);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteLayer(selectedLayerId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteLayer, nudgeSelected, redo, selectLayer, selectedLayerId, undo]);

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="whitespace-nowrap font-display text-[24px] leading-none tracking-tight text-paper">
              Lyric Carousel
            </span>
            <span className="font-display text-[24px] italic leading-none text-accent">Studio</span>
            <span className="hidden border-l border-white/15 pl-3 font-sans text-[9px] uppercase tracking-[0.24em] text-muted sm:inline">
              {template.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="mr-2 hidden font-sans text-[9px] uppercase tracking-[0.2em] text-muted sm:inline">
              Slide {String(slides.findIndex((slide) => slide.id === activeSlide?.id) + 1).padStart(2, '0')} /{' '}
              {String(slides.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="grid h-8 w-8 place-items-center border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 7 4 12l5 5M4.5 12H14a5.5 5.5 0 0 1 0 11"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
              className="grid h-8 w-8 place-items-center border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m15 7 5 5-5 5M19.5 12H10a5.5 5.5 0 0 0 0 11"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setPromoKitOpen(true)}
              className="ml-1 border border-accent/60 px-3 py-1.5 font-sans text-[9px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/10"
            >
              Caption &amp; Tag
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="ml-1 border border-accent/60 px-3 py-1.5 font-sans text-[9px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/10"
            >
              Ekspor
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_336px] xl:items-start">
          <aside className="order-2 xl:order-1">
            <div className="space-y-5">
              <InputPanel />
              <LayerPanel />
            </div>
          </aside>

          <section className="order-1 min-w-0 xl:order-2" aria-label="Editor kanvas">
            <SlideTabs />
            <div className="mx-auto mt-4 max-w-[640px]">
              <div className="border border-white/10 bg-panel p-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
                {activeSlide ? <Canvas slide={activeSlide} template={template} /> : null}
              </div>
              <div className="mt-3 flex flex-col gap-2 font-sans text-[9px] leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between">
                <span>Drag untuk geser · handle untuk resize dan rotasi</span>
                <span>Snap: margin 96 · tengah · tepi lapisan</span>
              </div>
              <HookPicker />
            </div>
          </section>

          <aside className="order-3 xl:sticky xl:top-[72px] xl:order-3">
            <div
              role="tablist"
              aria-label="Panel editor"
              className="mb-3 grid grid-cols-3 border border-white/10 bg-panel"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'properties'}
                onClick={() => setInspectorTab('properties')}
                className={`px-2 py-2 font-sans text-[9px] uppercase tracking-[0.18em] transition-colors ${
                  inspectorTab === 'properties'
                    ? 'bg-white/[0.05] text-paper'
                    : 'text-muted hover:text-paper'
                }`}
              >
                Properti
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'photo'}
                onClick={() => setInspectorTab('photo')}
                className={`border-l border-white/10 px-2 py-2 font-sans text-[9px] uppercase tracking-[0.18em] transition-colors ${
                  inspectorTab === 'photo'
                    ? 'bg-white/[0.05] text-paper'
                    : 'text-muted hover:text-paper'
                }`}
              >
                Foto
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'reference'}
                onClick={() => setInspectorTab('reference')}
                className={`border-l border-white/10 px-2 py-2 font-sans text-[9px] uppercase tracking-[0.18em] transition-colors ${
                  inspectorTab === 'reference'
                    ? 'bg-white/[0.05] text-paper'
                    : 'text-muted hover:text-paper'
                }`}
              >
                Referensi
              </button>
            </div>
            <div role="tabpanel">
              {inspectorTab === 'properties' ? (
                <PropertyPanel />
              ) : inspectorTab === 'photo' ? (
                <PhotoPanel />
              ) : (
                <TemplatePanel />
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-2 px-4 py-4 font-sans text-[9px] uppercase tracking-[0.22em] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Panah geser 1px · Shift + panah 10px · Ctrl/⌘ Z undo</span>
          <span>1200 × 1500 internal · default 4:5 · ekspor 4:5 / 9:16 / 3:4 / 1:1</span>
        </div>
      </footer>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <PromoKitDialog open={promoKitOpen} onClose={() => setPromoKitOpen(false)} />
    </div>
  );
}
