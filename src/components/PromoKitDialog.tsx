import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatPromoKit, formatHashtagString, platformDisplayName, type PromoPlatform } from '../lib/captionKit';
import { useGenerationStore } from '../store/generationStore';

type CopyStatus = Record<PromoPlatform, 'caption' | 'title' | 'description' | 'hashtags' | null>;

interface PromoKitDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function PromoKitDialog({ open, onClose }: PromoKitDialogProps): ReactNode {
  const result = useGenerationStore((state) => state.result);
  const title = useGenerationStore((state) => state.title);
  const artist = useGenerationStore((state) => state.artist);
  const lyrics = useGenerationStore((state) => state.lyrics);

  const [copied, setCopied] = useState<CopyStatus>({
    instagram: null,
    facebook: null,
    tiktok: null,
  });
  const copyTimers = useState<Record<PromoPlatform, number | null>>({
    instagram: null,
    facebook: null,
    tiktok: null,
  })[0];

  const PLATFORMS: PromoPlatform[] = ['instagram', 'facebook', 'tiktok'];

  const clearTimer = (platform: PromoPlatform): void => {
    if (copyTimers[platform] !== null) {
      window.clearTimeout(copyTimers[platform]);
    }
  };

  const copyText = async (text: string, platform: PromoPlatform, field: CopyStatus[PromoPlatform]): Promise<void> => {
    if (!text) {
      return;
    }
    clearTimer(platform);
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [platform]: field }));
      copyTimers[platform] = window.setTimeout(() => {
        setCopied((prev) => ({ ...prev, [platform]: null }));
      }, 2200);
    } catch {
      // Clipboard not available; silently ignore.
    }
  };

  if (!open || !result) {
    return null;
  }

  const kits = formatPromoKit(result.caption, result.hashtags, title, artist, lyrics);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-kit-dialog-title"
        className="max-h-full w-full max-w-[640px] overflow-y-auto border border-white/15 bg-panel shadow-[0_40px_120px_-30px_rgba(0,0,0,1)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="promo-kit-dialog-title" className="font-display text-[26px] leading-none text-paper">
              Caption &amp; Tag <span className="italic text-accent">promosi</span>
            </h2>
            <p className="mt-2 font-sans text-[9px] uppercase tracking-[0.18em] text-muted">
              Siap untuk unggahan IG, Facebook, dan TikTok
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog caption dan tag"
            className="grid h-8 w-8 shrink-0 place-items-center border border-white/10 text-muted transition-colors hover:border-white/30 hover:text-paper"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {PLATFORMS.map((platform) => {
            const kit = kits[platform];
            const fieldCopied = copied[platform];

            return (
              <div
                key={platform}
                className="border border-white/10 rounded-md bg-[#0D0D0D] p-4"
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted">
                    {platformDisplayName(platform)}
                  </span>
                  <span className="font-sans text-[8px] uppercase tracking-[0.12em] text-muted">
                    {fieldCopied ? 'tersalin' : ''}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <span className="block font-sans text-[8px] uppercase tracking-[0.14em] text-muted mb-1">
                      Judul
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={kit.title}
                        readOnly
                        className="flex-1 border border-white/10 bg-[#0D0D0D] px-2 py-1.5 font-sans text-[9px] text-paper outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void copyText(kit.title, platform, 'title')}
                        disabled={!kit.title}
                        className="shrink-0 border border-white/10 px-2 py-1 font-sans text-[8px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:opacity-40"
                      >
                        {fieldCopied === 'title' ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="block font-sans text-[8px] uppercase tracking-[0.14em] text-muted mb-1">
                      Deskripsi
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={kit.description}
                        readOnly
                        className="flex-1 border border-white/10 bg-[#0D0D0D] px-2 py-1.5 font-sans text-[9px] text-paper outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void copyText(kit.description, platform, 'description')}
                        disabled={!kit.description}
                        className="shrink-0 border border-white/10 px-2 py-1 font-sans text-[8px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:opacity-40"
                      >
                        {fieldCopied === 'description' ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="block font-sans text-[8px] uppercase tracking-[0.14em] text-muted mb-1">
                      Caption
                    </span>
                    <div className="flex items-center gap-2">
                      <textarea
                        value={kit.caption}
                        readOnly
                        rows={3}
                        className="flex-1 border border-white/10 bg-[#0D0D0D] px-2 py-1.5 font-sans text-[9px] leading-relaxed text-paper/90 outline-none resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => void copyText(kit.caption, platform, 'caption')}
                        disabled={!kit.caption}
                        className="shrink-0 border border-white/10 px-2 py-1 font-sans text-[8px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:opacity-40"
                      >
                        {fieldCopied === 'caption' ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="block font-sans text-[8px] uppercase tracking-[0.14em] text-muted mb-1">
                      Hashtag
                    </span>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 flex flex-wrap gap-x-2 gap-y-1 font-sans text-[9px] leading-relaxed text-muted">
                        {kit.hashtags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyText(formatHashtagString(kit.hashtags), platform, 'hashtags')}
                        disabled={kit.hashtags.length === 0}
                        className="shrink-0 border border-white/10 px-2 py-1 font-sans text-[8px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:opacity-40"
                      >
                        {fieldCopied === 'hashtags' ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
