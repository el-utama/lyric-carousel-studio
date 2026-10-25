import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { fileToBackgroundDataUrl } from '../lib/imageProcessing';
import type { ImageLayer } from '../lib/types';
import { useEditorStore } from '../store/editorStore';

const labelClass = 'font-sans text-[9px] uppercase tracking-[0.2em] text-muted';
const smallButtonClass =
  'border px-2 py-1 font-sans text-[8px] uppercase tracking-[0.14em] transition-colors';
const rangeClass = 'mt-2 w-full accent-accent';

export default function PhotoPanel(): ReactNode {
  const slides = useEditorStore((state) => state.slides);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const checkpoint = useEditorStore((state) => state.checkpoint);
  const setBackgroundImage = useEditorStore((state) => state.setBackgroundImage);
  const updateImageLayer = useEditorStore((state) => state.updateImageLayer);
  const applyImageToAllSlides = useEditorStore((state) => state.applyImageToAllSlides);
  const removeBackgroundImage = useEditorStore((state) => state.removeBackgroundImage);
  const [varyPerSlide, setVaryPerSlide] = useState(false);

  const uploadRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const layer = activeSlide?.layers.find((candidate): candidate is ImageLayer => {
    return candidate.type === 'image';
  });

  const handleFile = async (fileList: FileList | null): Promise<void> => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const source = await fileToBackgroundDataUrl(file);
      setBackgroundImage(source);
      setFeedback('Foto dipasang sebagai latar slide ini.');
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Foto gagal dibaca.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border border-white/10 bg-panel" aria-label="Foto latar">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-paper">Foto latar</h2>
        <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted">
          {layer ? 'aktif' : 'belum ada'}
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files);
            event.target.value = '';
          }}
        />

        {!layer ? (
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            disabled={busy}
            className="w-full border border-dashed border-white/15 px-3 py-8 text-center transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="block font-display text-[20px] leading-snug text-paper/85">
              {busy ? 'Membaca foto…' : 'Pilih foto latar'}
            </span>
            <span className="mt-1.5 block font-sans text-[8px] uppercase tracking-[0.18em] text-muted">
              JPG atau PNG · diproses di peramban
            </span>
          </button>
        ) : (
          <div className="relative border border-white/10">
            <img
              src={layer.props.src}
              alt="Pratinjau foto latar"
              className="aspect-[3/4] w-full object-cover"
              style={{
                filter: `grayscale(${layer.props.grayscale ? 1 : 0}) brightness(${layer.props.brightness.toFixed(2)})`,
              }}
            />
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              disabled={busy}
              className="absolute bottom-2 right-2 border border-white/20 bg-ink/85 px-2 py-1 font-sans text-[8px] uppercase tracking-[0.14em] text-paper transition-colors hover:border-accent/60 hover:text-accent disabled:opacity-40"
            >
              {busy ? 'Membaca…' : 'Ganti foto'}
            </button>
          </div>
        )}

        {layer ? (
          <>
            <div className="space-y-3">
              <label className="block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={labelClass}>Zoom</span>
                  <span className="font-sans text-[9px] tabular-nums text-muted">
                    {layer.props.zoom.toFixed(2)}×
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.01}
                  value={layer.props.zoom}
                  onFocus={checkpoint}
                  onPointerDown={checkpoint}
                  onChange={(event) =>
                    updateImageLayer(
                      layer.id,
                      { zoom: Number(event.target.value) },
                      false,
                    )
                  }
                  className={rangeClass}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className={labelClass}>Geser X</span>
                    <span className="font-sans text-[9px] tabular-nums text-muted">
                      {Math.round(layer.props.positionX)}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={layer.props.positionX}
                    onFocus={checkpoint}
                    onPointerDown={checkpoint}
                    onChange={(event) =>
                      updateImageLayer(
                        layer.id,
                        { positionX: Number(event.target.value) },
                        false,
                      )
                    }
                    className={rangeClass}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className={labelClass}>Geser Y</span>
                    <span className="font-sans text-[9px] tabular-nums text-muted">
                      {Math.round(layer.props.positionY)}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={layer.props.positionY}
                    onFocus={checkpoint}
                    onPointerDown={checkpoint}
                    onChange={(event) =>
                      updateImageLayer(
                        layer.id,
                        { positionY: Number(event.target.value) },
                        false,
                      )
                    }
                    className={rangeClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className={labelClass}>Terang</span>
                    <span className="font-sans text-[9px] tabular-nums text-muted">
                      {layer.props.brightness.toFixed(2)}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={1.6}
                    step={0.05}
                    value={layer.props.brightness}
                    onFocus={checkpoint}
                    onPointerDown={checkpoint}
                    onChange={(event) =>
                      updateImageLayer(
                        layer.id,
                        { brightness: Number(event.target.value) },
                        false,
                      )
                    }
                    className={rangeClass}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className={labelClass}>Overlay manual</span>
                    <span className="font-sans text-[9px] tabular-nums text-muted">
                      {Math.round(layer.props.overlay * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={layer.props.overlay}
                    onFocus={checkpoint}
                    onPointerDown={checkpoint}
                    onChange={(event) =>
                      updateImageLayer(
                        layer.id,
                        { overlay: Number(event.target.value) },
                        false,
                      )
                    }
                    className={rangeClass}
                  />
                </label>
              </div>

              <label className="block min-w-0">
                <span className="flex items-baseline justify-between gap-1">
                  <span className={labelClass}>Blur (depth)</span>
                  <span className="font-sans text-[9px] tabular-nums text-muted">
                    {layer.props.blur.toFixed(1)} px
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={0.5}
                  value={layer.props.blur}
                  onFocus={checkpoint}
                  onPointerDown={checkpoint}
                  onChange={(event) =>
                    updateImageLayer(layer.id, { blur: Number(event.target.value) }, false)
                  }
                  className={rangeClass}
                />
              </label>

              <label className="flex items-center justify-between gap-3 font-sans text-[10px] text-muted">
                <span>Hitam putih</span>
                <input
                  type="checkbox"
                  checked={layer.props.grayscale}
                  onChange={(event) =>
                    updateImageLayer(layer.id, { grayscale: event.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-accent"
                />
              </label>

              <p className="font-sans text-[8px] leading-relaxed text-muted">
                <span className="text-accent">Auto scrim aktif.</span> Kecerahan foto dibaca
                otomatis untuk menjaga teks off-white tetap terbaca. Overlay manual hanya
                menambah kegelapan; crop cover tetap tanpa ruang kosong.
              </p>
            </div>

            <div className="space-y-1.5 border-t border-white/10 pt-3">
              <label className="flex items-center justify-between gap-3 font-sans text-[10px] text-muted">
                <span>Variasi per slide</span>
                <input
                  type="checkbox"
                  checked={varyPerSlide}
                  onChange={(event) => setVaryPerSlide(event.target.checked)}
                  className="h-3.5 w-3.5 accent-accent"
                />
              </label>
              <p className="font-sans text-[8px] leading-relaxed text-muted">
                Saat aktif, foto diterapkan ke semua slide dengan perbedaan
                fokus crop dan blur ringan tiap slide — dari satu upload yang sama.
              </p>
              <button
                type="button"
                onClick={() => {
                  applyImageToAllSlides(varyPerSlide);
                  setFeedback(
                    `Foto diterapkan ke ${slides.length} slide${varyPerSlide ? ' dengan variasi' : ''}.`,
                  );
                  setError(null);
                }}
                className="w-full border border-accent/50 px-3 py-2 font-sans text-[9px] uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent/10"
              >
                Terapkan ke semua slide
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    removeBackgroundImage('slide');
                    setFeedback('Foto dihapus dari slide ini.');
                    setError(null);
                  }}
                  className={`${smallButtonClass} border-white/10 text-muted hover:border-white/25 hover:text-paper`}
                >
                  Hapus slide ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeBackgroundImage('all');
                    setFeedback('Foto dihapus dari semua slide.');
                    setError(null);
                  }}
                  className={`${smallButtonClass} border-white/10 text-muted hover:border-accent/50 hover:text-accent`}
                >
                  Hapus semua
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="font-sans text-[9px] leading-relaxed text-muted">
            Foto menutupi seluruh kanvas di belakang teks. Unggah satu foto, atur crop, lalu
            terapkan ke semua slide agar carousel tetap konsisten.
          </p>
        )}

        {feedback ? (
          <p className="font-sans text-[9px] leading-relaxed text-paper/75" aria-live="polite">
            {feedback}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="font-sans text-[9px] leading-relaxed text-accent">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
