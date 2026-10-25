import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { HookAngle } from '../lib/types';
import { useGenerationStore } from '../store/generationStore';

const ANGLE_LABELS: Record<HookAngle, string> = {
  curiosity: 'Penasaran',
  relatable: 'Relatable',
  contrast: 'Kontras',
  strongest_line: 'Baris terkuat',
  confession: 'Konfesi',
};

function renderEmphasis(text: string): ReactNode {
  return text.split(/(\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={`${part}-${index}`} className="font-normal italic text-accent">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export default function HookPicker(): ReactNode {
  const result = useGenerationStore((state) => state.result);
  const status = useGenerationStore((state) => state.status);
  const error = useGenerationStore((state) => state.error);
  const selectedHookIndex = useGenerationStore((state) => state.selectedHookIndex);
  const regenerating = useGenerationStore((state) => state.regenerating);
  const selectHook = useGenerationStore((state) => state.selectHook);
  const regenerateHook = useGenerationStore((state) => state.regenerateHook);
  const regenerateAllHooks = useGenerationStore((state) => state.regenerateAllHooks);
  const setCaption = useGenerationStore((state) => state.setCaption);

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const copyCaption = async (): Promise<void> => {
    if (!result) {
      return;
    }
    const text = [result.caption, result.hashtags.join(' ')].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
      copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mt-5 border border-white/10 bg-panel" aria-label="Pilihan pembuka">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-paper">
            Pilih pembuka
          </h2>
          <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted">
            {result ? `${result.hooks.length} sudut` : 'belum ada'}
          </span>
        </div>
        {result ? (
          <button
            type="button"
            onClick={() => void regenerateAllHooks()}
            disabled={regenerating !== null}
            className="flex items-center gap-1.5 border border-white/10 px-2 py-1 font-sans text-[8px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 11a8 8 0 1 0-2.4 5.7M20 5v6h-6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {regenerating === 'all' ? 'Menyusun…' : 'Buat ulang semua'}
          </button>
        ) : null}
      </div>

      {!result ? (
        <div className="px-4 py-6">
          <p className="font-display text-[21px] leading-snug text-paper/80">
            Lima pembuka akan muncul
            <span className="italic text-accent"> di sini.</span>
          </p>
          <p className="mt-2 font-sans text-[10px] leading-relaxed text-muted">
            Isi materi lagu di panel kiri, lalu buat carousel. Setiap sudut bisa dipilih dan
            dibuat ulang sendiri.
          </p>
          {status === 'error' && error ? (
            <p className="mt-3 border-t border-white/10 pt-3 font-sans text-[10px] leading-relaxed text-accent">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <ol className="divide-y divide-white/10">
            {result.hooks.map((hook, index) => {
              const active = index === selectedHookIndex;
              const busy = regenerating === hook.angle;
              return (
                <li key={`${hook.angle}-${index}`} className="relative">
                  <button
                    type="button"
                    onClick={() => selectHook(index)}
                    aria-pressed={active}
                    className={`block w-full px-4 py-3 pr-12 text-left transition-colors ${
                      active ? 'bg-accent/[0.07]' : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-sans text-[8px] uppercase tracking-[0.18em] text-muted">
                      <span className={active ? 'text-accent' : ''}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={active ? 'text-accent' : ''}>{ANGLE_LABELS[hook.angle]}</span>
                    </span>
                    <span
                      className={`mt-1.5 block font-display text-[18px] leading-[1.3] ${
                        active ? 'text-paper' : 'text-paper/80'
                      }`}
                    >
                      {renderEmphasis(hook.text)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void regenerateHook(index)}
                    disabled={regenerating !== null}
                    aria-label={`Buat ulang pembuka ${index + 1}`}
                    title="Buat ulang pembuka ini"
                    className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center border border-white/10 text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className={busy ? 'animate-spin' : ''}
                    >
                      <path
                        d="M20 11a8 8 0 1 0-2.4 5.7M20 5v6h-6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ol>

          {error ? (
            <p
              role="alert"
              className="border-t border-accent/20 bg-accent/[0.05] px-4 py-2.5 font-sans text-[9px] leading-relaxed text-accent"
            >
              {error}
            </p>
          ) : null}

          <div className="border-t border-white/10 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted">
                Caption
              </span>
              <button
                type="button"
                onClick={() => void copyCaption()}
                className="border border-white/10 px-2 py-1 font-sans text-[8px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-white/25 hover:text-paper"
              >
                {copied ? 'Tersalin' : 'Salin caption'}
              </button>
            </div>
            <textarea
              value={result.caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={3}
              className="mt-2 w-full resize-y border border-white/10 bg-[#0D0D0D] px-2.5 py-2 font-sans text-[10px] leading-relaxed text-paper outline-none transition-colors focus:border-accent/70"
            />
            {result.hashtags.length > 0 ? (
              <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 font-sans text-[9px] leading-relaxed text-muted">
                {result.hashtags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
