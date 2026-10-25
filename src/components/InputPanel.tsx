import type { ReactNode } from 'react';
import { detectLanguage, resolveLanguage } from '../lib/detectLanguage';
import type { LanguageMode, Platform } from '../lib/types';
import { useGenerationStore } from '../store/generationStore';

const labelClass = 'font-sans text-[9px] uppercase tracking-[0.2em] text-muted';
const fieldClass =
  'mt-1.5 w-full border border-white/10 bg-[#0D0D0D] px-2.5 py-2 font-sans text-[11px] text-paper outline-none transition-colors placeholder:text-muted/60 focus:border-accent/70 disabled:cursor-not-allowed disabled:opacity-50';

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  shorts: 'YouTube Shorts',
};

const LANGUAGE_OPTIONS: { value: LanguageMode; label: string }[] = [
  { value: 'auto', label: 'Auto — deteksi dari materi' },
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'mixed', label: 'Campuran EN–ID' },
  { value: 'other', label: 'Lainnya' },
];

function isLanguageMode(value: string): value is LanguageMode {
  return value === 'auto' || value === 'en' || value === 'id' || value === 'mixed' || value === 'other';
}

function isPlatform(value: string): value is Platform {
  return value === 'tiktok' || value === 'reels' || value === 'shorts';
}

export default function InputPanel(): ReactNode {
  const title = useGenerationStore((state) => state.title);
  const artist = useGenerationStore((state) => state.artist);
  const lyrics = useGenerationStore((state) => state.lyrics);
  const languageMode = useGenerationStore((state) => state.languageMode);
  const languageOther = useGenerationStore((state) => state.languageOther);
  const platform = useGenerationStore((state) => state.platform);
  const status = useGenerationStore((state) => state.status);
  const error = useGenerationStore((state) => state.error);
  const result = useGenerationStore((state) => state.result);
  const setTitle = useGenerationStore((state) => state.setTitle);
  const setArtist = useGenerationStore((state) => state.setArtist);
  const setLyrics = useGenerationStore((state) => state.setLyrics);
  const setLanguageMode = useGenerationStore((state) => state.setLanguageMode);
  const setLanguageOther = useGenerationStore((state) => state.setLanguageOther);
  const setPlatform = useGenerationStore((state) => state.setPlatform);
  const generate = useGenerationStore((state) => state.generate);

  const loading = status === 'loading';
  const tooShort = lyrics.trim().length < 20;
  const detection = detectLanguage(lyrics);
  const resolved = resolveLanguage(lyrics, {
    mode: languageMode,
    other: languageOther,
  });

  const detectionHint = (() => {
    if (languageMode !== 'auto') {
      return `Keluaran: ${resolved.label}. Tidak ada terjemahan otomatis.`;
    }
    if (lyrics.trim().length < 20) {
      return 'Mode auto membaca bahasa dari materi yang ditempel.';
    }
    if (detection.language === 'en') {
      return `Terdeteksi Inggris (${Math.round(detection.confidence * 100)}% yakin). Kamu tetap bisa menimpanya.`;
    }
    if (detection.language === 'id') {
      return `Terdeteksi Bahasa Indonesia (${Math.round(detection.confidence * 100)}% yakin). Kamu tetap bisa menimpanya.`;
    }
    return 'Bahasa belum yakin. Pilih manual bila materi berbahasa lain.';
  })();

  return (
    <section className="border border-white/10 bg-panel" aria-label="Materi lagu">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-paper">Materi lagu</h2>
        <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted">01</span>
      </div>

      <div className="space-y-3.5 px-4 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block min-w-0">
            <span className={labelClass}>Judul</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="Judul lagu"
              className={fieldClass}
            />
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Artis</span>
            <input
              type="text"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              maxLength={160}
              placeholder="Nama artis"
              className={fieldClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Materi</span>
          <textarea
            value={lyrics}
            onChange={(event) => setLyrics(event.target.value)}
            rows={7}
            maxLength={12000}
            placeholder="Tempel potongan lagu atau catatan di sini. Sertakan baris yang paling ingin diangkat."
            className={`${fieldClass} resize-y leading-relaxed`}
          />
          <span className="mt-1.5 flex items-center justify-between gap-2 font-sans text-[9px] text-muted">
            <span>{lyrics.trim().length} karakter</span>
            <span>{tooShort ? 'minimal 20' : 'siap'}</span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block min-w-0">
            <span className={labelClass}>Bahasa</span>
            <select
              value={languageMode}
              onChange={(event) => {
                if (isLanguageMode(event.target.value)) {
                  setLanguageMode(event.target.value);
                }
              }}
              className={fieldClass}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className={labelClass}>Platform</span>
            <select
              value={platform}
              onChange={(event) => {
                if (isPlatform(event.target.value)) {
                  setPlatform(event.target.value);
                }
              }}
              className={fieldClass}
            >
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((value) => (
                <option key={value} value={value}>
                  {PLATFORM_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {languageMode === 'other' ? (
          <label className="block">
            <span className={labelClass}>Nama bahasa</span>
            <input
              type="text"
              value={languageOther}
              onChange={(event) => setLanguageOther(event.target.value)}
              maxLength={60}
              placeholder="mis. Español, Français, 한국어"
              className={fieldClass}
            />
          </label>
        ) : null}

        <p className="font-sans text-[9px] leading-relaxed text-muted">{detectionHint}</p>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={tooShort || loading}
          className="group relative w-full overflow-hidden border border-accent/60 bg-accent px-4 py-3 font-sans text-[10px] uppercase tracking-[0.22em] text-[#171210] transition-colors hover:bg-[#e98a70] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-muted"
        >
          {loading ? 'Menyusun halaman…' : result ? 'Buat ulang carousel' : 'Buat carousel'}
        </button>

        {loading ? (
          <div className="h-px w-full overflow-hidden bg-white/10" aria-hidden="true">
            <div className="h-px w-1/3 animate-pulse bg-accent" />
          </div>
        ) : null}

        {status === 'error' && error ? (
          <div
            role="alert"
            className="border border-accent/30 bg-accent/[0.06] px-3 py-2.5 font-sans text-[10px] leading-relaxed text-accent"
          >
            {error}
          </div>
        ) : null}

        {result && status === 'ready' ? (
          <p className="border-t border-white/10 pt-3 font-sans text-[9px] leading-relaxed text-muted">
            <span className="text-paper">{result.hooks.length} hook</span> · {result.slides.length}{' '}
            slide · {resolved.label}. Pilih pembuka di bawah kanvas.
          </p>
        ) : null}
      </div>
    </section>
  );
}
