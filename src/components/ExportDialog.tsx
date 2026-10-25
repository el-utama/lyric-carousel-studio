import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { saveAs } from 'file-saver';
import { TIKTOK_SAFE_ZONES } from '../lib/defaultTemplate';
import {
  EXPORT_SIZES,
  exportCarouselZip,
  exportSlidePng,
  renderSlideArtwork,
  slideExportFileName,
  zipExportFileName,
} from '../lib/exportSlides';
import type { SlideRatio } from '../lib/types';
import { useEditorStore } from '../store/editorStore';
import { useGenerationStore } from '../store/generationStore';

const RATIO_OPTIONS: { value: SlideRatio; label: string; note: string }[] = [
  { value: '4:5', label: '4:5', note: 'Feed IG · default' },
  { value: '9:16', label: '9:16', note: 'TikTok · safe zone' },
  { value: '3:4', label: '3:4', note: 'IG native' },
  { value: '1:1', label: '1:1', note: 'Kotak' },
];

type ExportFormat = 'png' | 'zip';
type ExportStatus = 'idle' | 'working' | 'done' | 'error';
type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';
type CopyTarget = 'caption' | 'hashtags';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportDialog({ open, onClose }: ExportDialogProps): ReactNode {
  const slides = useEditorStore((state) => state.slides);
  const template = useEditorStore((state) => state.template);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const result = useGenerationStore((state) => state.result);

  const [ratio, setRatio] = useState<SlideRatio>('4:5');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const busy = status === 'working';
  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const activeIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === activeSlide?.id),
  );
  const size = EXPORT_SIZES[ratio];
  const exportFileName =
    format === 'png' ? slideExportFileName(ratio, activeIndex) : zipExportFileName(ratio);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onClose, open]);

  useEffect(() => {
    setStatus('idle');
    setError(null);
    setProgress({ done: 0, total: 0 });
  }, [format, ratio]);

  useEffect(() => {
    if (!open || !activeSlide) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPreviewStatus('idle');
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    let nextObjectUrl: string | null = null;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPreviewStatus('loading');
    setPreviewError(null);

    void (async () => {
      try {
        const canvas = await renderSlideArtwork(activeSlide, template, ratio, 0.5);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });
        if (!blob) {
          throw new Error('Pratinjau tidak dapat dibuat.');
        }

        nextObjectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          nextObjectUrl = null;
          return;
        }
        previewUrlRef.current = nextObjectUrl;
        setPreviewUrl(nextObjectUrl);
        setPreviewStatus('ready');
      } catch (previewRenderError) {
        if (cancelled) {
          return;
        }
        setPreviewStatus('error');
        setPreviewError(
          previewRenderError instanceof Error
            ? previewRenderError.message
            : 'Pratinjau gagal dibuat.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSlide, open, ratio, template]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  if (!open) {
    return null;
  }

  const copyText = async (text: string, target: CopyTarget): Promise<void> => {
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setError(null);
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
      copyTimer.current = window.setTimeout(() => setCopied(null), 2200);
    } catch {
      setError('Clipboard tidak tersedia di peramban ini.');
    }
  };

  const handleExport = async (): Promise<void> => {
    if (!activeSlide || busy) {
      return;
    }

    setStatus('working');
    setError(null);
    setProgress({ done: 0, total: slides.length });

    try {
      if (format === 'png') {
        const blob = await exportSlidePng(activeSlide, template, ratio);
        saveAs(blob, slideExportFileName(ratio, activeIndex));
      } else {
        const blob = await exportCarouselZip(slides, template, ratio, (done, total) => {
          setProgress({ done, total });
        });
        saveAs(blob, zipExportFileName(ratio));
      }
      setStatus('done');
    } catch (exportError) {
      setStatus('error');
      setError(
        exportError instanceof Error ? exportError.message : 'Ekspor gagal. Coba lagi.',
      );
    }
  };

  const caption = result?.caption.trim() ?? '';
  const hashtags = result?.hashtags.join(' ') ?? '';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="max-h-full w-full max-w-[520px] overflow-y-auto border border-white/15 bg-panel shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2
              id="export-dialog-title"
              className="font-display text-[26px] leading-none text-paper"
            >
              Ekspor <span className="italic text-accent">carousel</span>
            </h2>
            <p className="mt-2 font-sans text-[9px] uppercase tracking-[0.18em] text-muted">
              PNG 2× · layout menyesuaikan rasio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup dialog ekspor"
            className="grid h-8 w-8 shrink-0 place-items-center border border-white/10 text-muted transition-colors hover:border-white/30 hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted">
                Pratinjau ekspor
              </span>
              <span className="font-sans text-[8px] uppercase tracking-[0.12em] text-muted">
                {activeSlide
                  ? `Slide ${String(activeIndex + 1).padStart(2, '0')} · ${ratio}`
                  : 'Tidak ada slide'}
              </span>
            </div>
            <div className="mt-2 flex min-h-[140px] items-center justify-center overflow-hidden border border-white/10 bg-[#0D0D0D] p-2">
              {previewUrl ? (
                <div
                  className="relative"
                  style={{
                    height: 'min(300px, 40vh, 76vw)',
                    aspectRatio: ratio.replace(':', ' / '),
                  }}
                >
                  <img
                    src={previewUrl}
                    alt={`Pratinjau ekspor slide ${activeIndex + 1} rasio ${ratio}`}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                  {ratio === '9:16' ? (
                    <>
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-accent/35 bg-accent/[0.03]"
                        style={{ height: `${TIKTOK_SAFE_ZONES.top}%` }}
                      />
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-accent/45 bg-accent/[0.04]"
                        style={{ height: `${TIKTOK_SAFE_ZONES.bottom}%` }}
                      />
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 border-l border-dashed border-accent/35 bg-accent/[0.03]"
                        style={{ width: `${TIKTOK_SAFE_ZONES.right}%` }}
                      />
                      <span className="pointer-events-none absolute left-2 top-2 font-sans text-[7px] uppercase tracking-[0.14em] text-accent/70">
                        UI atas
                      </span>
                      <span className="pointer-events-none absolute bottom-[26%] left-2 font-sans text-[7px] uppercase tracking-[0.14em] text-accent/80">
                        UI bawah
                      </span>
                    </>
                  ) : null}
                </div>
              ) : previewStatus === 'error' ? (
                <p
                  role="alert"
                  className="max-w-[220px] px-4 text-center font-sans text-[9px] leading-relaxed text-accent"
                >
                  {previewError ?? 'Pratinjau tidak dapat dibuat.'}
                </p>
              ) : (
                <p
                  aria-live="polite"
                  className="font-sans text-[8px] uppercase tracking-[0.18em] text-muted"
                >
                  {activeSlide ? 'Merender pratinjau…' : 'Tidak ada slide'}
                </p>
              )}
            </div>
            <p className="mt-2 font-sans text-[8px] leading-relaxed text-muted">
              Hasil render yang sama dengan ekspor.
              {ratio === '9:16'
                ? ` Garis putus-putus: aman UI atas ${TIKTOK_SAFE_ZONES.top}%, bawah ${TIKTOK_SAFE_ZONES.bottom}%, kanan ${TIKTOK_SAFE_ZONES.right}%.`
                : ''}
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted">
                Rasio
              </span>
              <span className="font-sans text-[9px] tabular-nums text-muted">
                {size.width} × {size.height} px
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {RATIO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRatio(option.value)}
                  disabled={busy}
                  aria-pressed={ratio === option.value}
                  className={`border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    ratio === option.value
                      ? 'border-accent/70 bg-accent/[0.07]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <span
                    className={`block font-display text-[20px] leading-none ${
                      ratio === option.value ? 'text-accent' : 'text-paper'
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="mt-1.5 block font-sans text-[8px] uppercase tracking-[0.14em] text-muted">
                    {option.note}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 font-sans text-[8px] leading-relaxed text-muted">
              {ratio === '9:16'
                ? 'Layout TikTok: bawah 25% dan tepi kanan 8% dijaga kosong dari UI.'
                : 'Setiap rasio memakai komposisi sendiri, tanpa letterbox.'}
            </p>
          </div>

          <div>
            <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted">
              Format
            </span>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setFormat('png')}
                disabled={busy}
                aria-pressed={format === 'png'}
                className={`border px-3 py-2 font-sans text-[9px] uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  format === 'png'
                    ? 'border-accent/70 text-accent'
                    : 'border-white/10 text-muted hover:border-white/25 hover:text-paper'
                }`}
              >
                PNG · slide aktif
              </button>
              <button
                type="button"
                onClick={() => setFormat('zip')}
                disabled={busy}
                aria-pressed={format === 'zip'}
                className={`border px-3 py-2 font-sans text-[9px] uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  format === 'zip'
                    ? 'border-accent/70 text-accent'
                    : 'border-white/10 text-muted hover:border-white/25 hover:text-paper'
                }`}
              >
                ZIP · {slides.length} slide
              </button>
            </div>
          </div>

          <div className="border border-white/10 bg-[#0D0D0D] px-3 py-3">
            <p className="mb-2 break-all font-sans text-[8px] leading-relaxed text-muted">
              Nama file: <span className="text-paper/80">{exportFileName}</span>
            </p>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={!activeSlide || busy}
              className="w-full border border-accent/60 bg-accent px-4 py-3 font-sans text-[10px] uppercase tracking-[0.22em] text-[#171210] transition-colors hover:bg-[#e98a70] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-muted"
            >
              {busy
                ? format === 'zip'
                  ? `Menyiapkan ${progress.done}/${progress.total}…`
                  : 'Merender PNG…'
                : format === 'zip'
                  ? 'Ekspor ZIP'
                  : 'Ekspor PNG'}
            </button>

            {busy && format === 'zip' ? (
              <div className="mt-3 h-px w-full overflow-hidden bg-white/10" aria-hidden="true">
                <div
                  className="h-px bg-accent transition-[width] duration-300"
                  style={{
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 4}%`,
                  }}
                />
              </div>
            ) : null}

            {status === 'done' ? (
              <p className="mt-3 font-sans text-[9px] leading-relaxed text-paper/75" aria-live="polite">
                Ekspor selesai. Berkas ada di folder unduhan.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-3 font-sans text-[9px] leading-relaxed text-accent">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted">
                Teks teman unggahan
              </span>
              <span className="font-sans text-[8px] uppercase tracking-[0.12em] text-muted">
                {result ? 'siap disalin' : 'belum ada'}
              </span>
            </div>

            {result ? (
              <>
                <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap font-sans text-[10px] leading-relaxed text-paper/75">
                  {result.caption}
                </p>
                {result.hashtags.length > 0 ? (
                  <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 font-sans text-[9px] leading-relaxed text-muted">
                    {result.hashtags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </p>
                ) : null}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void copyText(caption, 'caption')}
                    disabled={!caption}
                    className="border border-white/10 px-2 py-1.5 font-sans text-[8px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copied === 'caption' ? 'Caption tersalin' : 'Salin caption'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(hashtags, 'hashtags')}
                    disabled={!hashtags}
                    className="border border-white/10 px-2 py-1.5 font-sans text-[8px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copied === 'hashtags' ? 'Hashtag tersalin' : 'Salin hashtag'}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-2 font-sans text-[9px] leading-relaxed text-muted">
                Buat carousel dari panel kiri untuk mendapatkan caption dan hashtag.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
