import type { ReactNode } from 'react';
import type { Layer } from '../lib/types';
import { useEditorStore } from '../store/editorStore';

const TYPE_LABEL: Record<Layer['type'], string> = {
  text: 'Teks',
  image: 'Foto',
  line: 'Garis',
  icon: 'Ikon',
};

const ICON_LABEL: Record<string, string> = {
  arrow: 'Panah',
  like: 'Suka',
  save: 'Simpan',
};

function layerTitle(layer: Layer): string {
  switch (layer.type) {
    case 'text': {
      const plain = layer.props.text.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
      return plain.length > 44 ? `${plain.slice(0, 44)}…` : plain || 'Teks kosong';
    }
    case 'image':
      return 'Foto latar';
    case 'line':
      return 'Hairline footer';
    case 'icon':
      return ICON_LABEL[layer.props.variant] ?? 'Ikon';
    default:
      return 'Lapisan';
  }
}

export default function LayerPanel(): ReactNode {
  const slides = useEditorStore((state) => state.slides);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectLayer = useEditorStore((state) => state.selectLayer);
  const toggleLayerVisibility = useEditorStore((state) => state.toggleLayerVisibility);
  const toggleLayerLock = useEditorStore((state) => state.toggleLayerLock);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const layers = [...(activeSlide?.layers ?? [])].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <section className="border border-white/10 bg-panel" aria-label="Daftar lapisan">
      <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-paper">Lapisan</h2>
        <span className="font-sans text-[10px] tracking-[0.12em] text-muted">
          {layers.length} elemen
        </span>
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        {layers.length === 0 ? (
          <p className="px-4 py-6 font-sans text-[11px] leading-relaxed text-muted">
            Slide ini belum memiliki lapisan.
          </p>
        ) : (
          <ul>
            {layers.map((layer, index) => {
              const selected = layer.id === selectedLayerId;
              const canMoveUp = index > 0;
              const canMoveDown = index < layers.length - 1;

              return (
                <li
                  key={layer.id}
                  className={`border-b border-white/5 last:border-b-0 ${
                    selected ? 'bg-white/[0.035]' : ''
                  }`}
                >
                  <div className="flex items-center gap-1 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => selectLayer(layer.id)}
                      className={`min-w-0 flex-1 px-2 py-1 text-left ${
                        layer.visible ? 'text-paper' : 'text-muted/50'
                      }`}
                    >
                      <span className="block truncate font-sans text-[11px] font-normal leading-tight">
                        {layerTitle(layer)}
                      </span>
                      <span className="mt-1 flex items-center gap-2 font-sans text-[8px] uppercase tracking-[0.2em] text-muted">
                        {TYPE_LABEL[layer.type]}
                        {layer.locked ? <span className="text-accent">Terkunci</span> : null}
                        {!layer.visible ? <span>Disembunyikan</span> : null}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleLayerVisibility(layer.id)}
                      title={layer.visible ? 'Sembunyikan lapisan' : 'Tampilkan lapisan'}
                      aria-label={layer.visible ? 'Sembunyikan lapisan' : 'Tampilkan lapisan'}
                      className="grid h-7 w-7 shrink-0 place-items-center text-muted transition-colors hover:text-paper"
                    >
                      {layer.visible ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M4 4l16 16M9.7 6.4A10 10 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.4 7.2C3.9 9 2.5 12 2.5 12s3.4 6 9.5 6c1.2 0 2.3-.2 3.3-.7"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleLayerLock(layer.id)}
                      title={layer.locked ? 'Buka kunci lapisan' : 'Kunci lapisan'}
                      aria-label={layer.locked ? 'Buka kunci lapisan' : 'Kunci lapisan'}
                      className={`grid h-7 w-7 shrink-0 place-items-center transition-colors ${
                        layer.locked ? 'text-accent' : 'text-muted hover:text-paper'
                      }`}
                    >
                      {layer.locked ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect
                            x="5"
                            y="10"
                            width="14"
                            height="10"
                            rx="1.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M8 10V7.5a4 4 0 0 1 8 0V10"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect
                            x="5"
                            y="10"
                            width="14"
                            height="10"
                            rx="1.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M8 10V7.5a4 4 0 0 1 7.2-2.4"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {selected ? (
                    <div className="grid grid-cols-2 gap-1 border-t border-white/5 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => moveLayer(layer.id, 'up')}
                        disabled={!canMoveUp}
                        className="border border-white/10 px-2 py-1 text-center font-sans text-[8px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Naik
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(layer.id, 'down')}
                        disabled={!canMoveDown}
                        className="border border-white/10 px-2 py-1 text-center font-sans text-[8px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Turun
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateLayer(layer.id)}
                        className="border border-white/10 px-2 py-1 text-center font-sans text-[8px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-white/25 hover:text-paper"
                      >
                        Duplikat
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLayer(layer.id)}
                        disabled={layer.locked}
                        className="border border-white/10 px-2 py-1 text-center font-sans text-[8px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="border-t border-white/10 px-4 py-3 font-sans text-[9px] leading-relaxed text-muted">
        Klik lapisan untuk memilih. Ikon mata menyembunyikan, gembok mengunci dari drag.
      </p>
    </section>
  );
}
