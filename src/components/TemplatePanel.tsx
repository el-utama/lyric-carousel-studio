import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { saveAs } from 'file-saver';
import { normalizeHex } from '../lib/color';
import { DESIGN_TOKENS, PALETTE_PRESETS } from '../lib/defaultTemplate';
import type { LightingContrast, LightingTemperature } from '../lib/types';
import { useEditorStore } from '../store/editorStore';
import { useTemplateStore } from '../store/templateStore';

const labelClass = 'font-sans text-[9px] uppercase tracking-[0.2em] text-muted';
const fieldClass =
  'mt-1.5 w-full border border-white/10 bg-[#0D0D0D] px-2.5 py-2 font-sans text-[10px] text-paper outline-none transition-colors placeholder:text-muted/60 focus:border-accent/70 disabled:cursor-not-allowed disabled:opacity-50';
const smallButtonClass =
  'border px-2 py-1 font-sans text-[8px] uppercase tracking-[0.14em] transition-colors';

const CONTRAST_OPTIONS: LightingContrast[] = ['rendah', 'sedang', 'tinggi'];
const TEMPERATURE_OPTIONS: LightingTemperature[] = ['dingin', 'netral', 'hangat'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function TemplatePanel(): ReactNode {
  const references = useTemplateStore((state) => state.references);
  const analysis = useTemplateStore((state) => state.analysis);
  const analysisStatus = useTemplateStore((state) => state.analysisStatus);
  const analysisError = useTemplateStore((state) => state.analysisError);
  const visionNotes = useTemplateStore((state) => state.visionNotes);
  const visionStatus = useTemplateStore((state) => state.visionStatus);
  const visionError = useTemplateStore((state) => state.visionError);
  const savedTemplates = useTemplateStore((state) => state.savedTemplates);
  const addReferenceFiles = useTemplateStore((state) => state.addReferenceFiles);
  const removeReference = useTemplateStore((state) => state.removeReference);
  const clearReferences = useTemplateStore((state) => state.clearReferences);
  const updatePaletteColor = useTemplateStore((state) => state.updatePaletteColor);
  const updateLighting = useTemplateStore((state) => state.updateLighting);
  const setVisionNotes = useTemplateStore((state) => state.setVisionNotes);
  const analyzeWithVision = useTemplateStore((state) => state.analyzeWithVision);
  const applyAnalysis = useTemplateStore((state) => state.applyAnalysis);
  const saveTemplate = useTemplateStore((state) => state.saveTemplate);
  const applySavedTemplate = useTemplateStore((state) => state.applySavedTemplate);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const importTemplates = useTemplateStore((state) => state.importTemplates);
  const exportTemplates = useTemplateStore((state) => state.exportTemplates);
  const applyTheme = useEditorStore((state) => state.applyTheme);
  const template = useEditorStore((state) => state.template);

  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [visionConfigured, setVisionConfigured] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth(): Promise<void> {
      try {
        const response = await fetch('/api/health');
        const data: unknown = await response.json();
        if (!cancelled) {
          setVisionConfigured(isRecord(data) && data.visionConfigured === true);
        }
      } catch {
        if (!cancelled) {
          setVisionConfigured(false);
        }
      }
    }

    void checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiles = (fileList: FileList | null): void => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    setErrorMessage(null);
    setFeedback(null);
    void addReferenceFiles(Array.from(fileList));
  };

  const handleSaveTemplate = (): void => {
    const result = saveTemplate(templateName);
    if (result.ok) {
      setFeedback('Template tersimpan di peramban ini.');
      setErrorMessage(null);
      setTemplateName('');
    } else {
      setErrorMessage(result.error ?? 'Template gagal disimpan.');
      setFeedback(null);
    }
  };

  const handleExport = (): void => {
    if (savedTemplates.length === 0) {
      setErrorMessage('Belum ada template untuk diekspor.');
      return;
    }
    const blob = new Blob([exportTemplates()], { type: 'application/json;charset=utf-8' });
    saveAs(blob, 'lyric-carousel-templates.json');
    setFeedback(`${savedTemplates.length} template diekspor.`);
    setErrorMessage(null);
  };

  const handleImport = async (fileList: FileList | null): Promise<void> => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const count = importTemplates(text);
      setFeedback(`${count} template diimpor.`);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impor gagal.');
      setFeedback(null);
    }
  };

  return (
    <section className="border border-white/10 bg-panel" aria-label="Referensi visual">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-paper">
          Referensi visual
        </h2>
        <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted">
          {references.length} / 8
        </span>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>Gambar acuan</span>
            {references.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  clearReferences();
                  setFeedback(null);
                  setErrorMessage(null);
                }}
                className="font-sans text-[8px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-accent"
              >
                Bersihkan
              </button>
            ) : null}
          </div>

          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            disabled={references.length >= 8}
            className="mt-2 w-full border border-dashed border-white/15 px-3 py-5 text-center transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="block font-display text-[18px] leading-snug text-paper/85">
              {references.length === 0 ? 'Tambahkan foto acuan' : 'Tambah gambar lain'}
            </span>
            <span className="mt-1 block font-sans text-[8px] uppercase tracking-[0.18em] text-muted">
              1–8 gambar · palet dibaca lokal
            </span>
          </button>

          {references.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {references.map((source, index) => (
                <div key={`${source.slice(-24)}-${index}`} className="group relative">
                  <img
                    src={source}
                    alt={`Referensi ${index + 1}`}
                    className="aspect-square w-full object-cover opacity-80"
                  />
                  <button
                    type="button"
                    onClick={() => void removeReference(index)}
                    aria-label={`Hapus gambar referensi ${index + 1}`}
                    className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center bg-ink/85 font-sans text-[10px] leading-none text-paper transition-colors hover:text-accent"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className={labelClass}>Palet kurasi</span>
            <span className="font-sans text-[8px] text-muted">satu aksen</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {PALETTE_PRESETS.map((preset) => {
              const active =
                preset.tokens.bg === template.tokens.bg &&
                preset.tokens.accent === template.tokens.accent;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    applyTheme(preset.tokens, preset.name);
                    setFeedback(`Palet ${preset.name} diterapkan ke semua slide.`);
                    setErrorMessage(null);
                  }}
                  aria-pressed={active}
                  aria-label={`Terapkan palet ${preset.name}`}
                  title={`${preset.name} — ${preset.description}`}
                  className={`border px-2 py-2 text-left transition-colors ${
                    active
                      ? 'border-accent/70 bg-accent/[0.06]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <span
                    className="flex h-3 overflow-hidden border border-white/10"
                    aria-hidden="true"
                  >
                    {[preset.tokens.bg, preset.tokens.accent, preset.tokens.textPrimary].map(
                      (color) => (
                        <span
                          key={`${preset.id}-${color}`}
                          className="flex-1"
                          style={{ backgroundColor: color }}
                        />
                      ),
                    )}
                  </span>
                  <span
                    className={`mt-1.5 block truncate font-sans text-[8px] uppercase tracking-[0.12em] ${
                      active ? 'text-accent' : 'text-paper/80'
                    }`}
                  >
                    {preset.shortName}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 font-sans text-[8px] leading-relaxed text-muted">
            Tipografi dan layout tetap; hanya palet yang berubah.
          </p>
        </div>

        {analysisStatus === 'analyzing' ? (
          <div className="flex items-center gap-2 font-sans text-[9px] text-muted" aria-live="polite">
            <span className="h-px w-6 animate-pulse bg-accent" aria-hidden="true" />
            Membaca palet dan arah cahaya…
          </div>
        ) : null}

        {analysisError ? (
          <p role="alert" className="font-sans text-[9px] leading-relaxed text-accent">
            {analysisError}
          </p>
        ) : null}

        {analysis ? (
          <div className="space-y-4 border-t border-white/10 pt-4">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className={labelClass}>Palet</span>
                <span className="font-sans text-[8px] text-muted">klik untuk ubah</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {analysis.palette.map((color, index) => (
                  <label key={`${color}-${index}`} className="block min-w-0">
                    <span className="sr-only">Warna {index + 1}</span>
                    <input
                      type="color"
                      value={normalizeHex(color) ?? '#121212'}
                      onChange={(event) => updatePaletteColor(index, event.target.value)}
                      className="h-8 w-full cursor-pointer border border-white/10 bg-transparent p-0.5"
                    />
                    <span className="mt-1 block truncate font-sans text-[8px] tracking-[0.06em] text-muted">
                      {color}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block min-w-0">
                <span className={labelClass}>Arah cahaya</span>
                <input
                  type="text"
                  value={analysis.lighting.keyDirection}
                  onChange={(event) => updateLighting({ keyDirection: event.target.value })}
                  maxLength={60}
                  className={fieldClass}
                />
              </label>
              <label className="block min-w-0">
                <span className={labelClass}>Suasana</span>
                <input
                  type="text"
                  value={analysis.lighting.mood}
                  onChange={(event) => updateLighting({ mood: event.target.value })}
                  maxLength={80}
                  className={fieldClass}
                />
              </label>
              <label className="block min-w-0">
                <span className={labelClass}>Kontras</span>
                <select
                  value={analysis.lighting.contrast}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'rendah' || value === 'sedang' || value === 'tinggi') {
                      updateLighting({ contrast: value });
                    }
                  }}
                  className={fieldClass}
                >
                  {CONTRAST_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className={labelClass}>Suhu</span>
                <select
                  value={analysis.lighting.temperature}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'dingin' || value === 'netral' || value === 'hangat') {
                      updateLighting({ temperature: value });
                    }
                  }}
                  className={fieldClass}
                >
                  {TEMPERATURE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Catatan cahaya</span>
              <textarea
                value={analysis.lighting.summary}
                onChange={(event) => updateLighting({ summary: event.target.value })}
                rows={3}
                maxLength={400}
                className={`${fieldClass} resize-y leading-relaxed`}
              />
            </label>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const applied = applyAnalysis();
                  setFeedback(
                    applied
                      ? 'Tema diterapkan ke semua slide. Ctrl+Z untuk membatalkan.'
                      : 'Belum ada analisis untuk diterapkan.',
                  );
                  setErrorMessage(null);
                }}
                className="border border-accent/60 px-3 py-2 font-sans text-[9px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/10"
              >
                Terapkan ke semua slide
              </button>
              <button
                type="button"
                onClick={() => {
                  applyTheme(DESIGN_TOKENS, 'Editorial Sinematik');
                  setFeedback('Tema default dipulihkan.');
                  setErrorMessage(null);
                }}
                className="self-start font-sans text-[8px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-paper"
              >
                Kembalikan default
              </button>
            </div>
          </div>
        ) : null}

        {references.length > 0 ? (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className={labelClass}>Vision opsional</span>
              <span className="font-sans text-[8px] text-muted">
                {visionConfigured ? 'aktif' : 'belum aktif'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void analyzeWithVision()}
              disabled={!visionConfigured || visionStatus === 'loading'}
              className={`${smallButtonClass} w-full border-white/10 text-muted hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {visionStatus === 'loading' ? 'Membaca dengan vision…' : 'Baca nuansa dengan vision'}
            </button>
            {!visionConfigured ? (
              <p className="font-sans text-[8px] leading-relaxed text-muted">
                Isi VISION_BASE_URL, VISION_API_KEY, dan VISION_MODEL untuk mengaktifkan. Analisis
                lokal tetap berjalan tanpa model.
              </p>
            ) : null}
            {visionError ? (
              <p role="alert" className="font-sans text-[9px] leading-relaxed text-accent">
                {visionError}
              </p>
            ) : null}
            {visionNotes ? (
              <label className="block">
                <span className={labelClass}>Catatan vision</span>
                <textarea
                  value={visionNotes}
                  onChange={(event) => setVisionNotes(event.target.value)}
                  rows={3}
                  className={`${fieldClass} resize-y leading-relaxed`}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 border-t border-white/10 pt-4">
          <span className={labelClass}>Simpan tema</span>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              maxLength={80}
              placeholder="Nama template"
              className={`${fieldClass} mt-0 min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={templateName.trim().length === 0}
              className={`${smallButtonClass} shrink-0 border-accent/50 text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-muted`}
            >
              Simpan
            </button>
          </div>
          <p className="font-sans text-[8px] leading-relaxed text-muted">
            Tema menyimpan palet, catatan cahaya, dan warna kanvas di peramban ini.
          </p>
        </div>

        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className={labelClass}>Template tersimpan</span>
            <span className="font-sans text-[8px] text-muted">{savedTemplates.length}</span>
          </div>

          {savedTemplates.length === 0 ? (
            <p className="font-sans text-[9px] leading-relaxed text-muted">
              Belum ada tema tersimpan. Simpan satu setelah membaca referensi.
            </p>
          ) : (
            <ul className="divide-y divide-white/5 border border-white/10">
              {savedTemplates.map((template) => (
                <li key={template.id} className="flex items-center gap-2 px-2 py-2">
                  <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                    {template.palette.slice(0, 4).map((color, index) => (
                      <span
                        key={`${template.id}-${color}-${index}`}
                        className="h-2.5 w-2.5 border border-white/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-[10px] text-paper">
                      {template.name}
                    </span>
                    <span className="font-sans text-[8px] uppercase tracking-[0.12em] text-muted">
                      {template.sourceCount > 0 ? `${template.sourceCount} gambar` : 'tema manual'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const applied = applySavedTemplate(template.id);
                      setFeedback(
                        applied
                          ? `Template "${template.name}" diterapkan. Ctrl+Z untuk membatalkan.`
                          : 'Template tidak ditemukan.',
                      );
                      setErrorMessage(null);
                    }}
                    className={`${smallButtonClass} shrink-0 border-white/10 text-muted hover:border-accent/50 hover:text-accent`}
                  >
                    Pakai
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(template.id)}
                    aria-label={`Hapus template ${template.name}`}
                    className="grid h-6 w-5 shrink-0 place-items-center font-sans text-[11px] text-muted transition-colors hover:text-accent"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleExport}
              className={`${smallButtonClass} border-white/10 text-muted hover:border-white/25 hover:text-paper`}
            >
              Ekspor JSON
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className={`${smallButtonClass} border-white/10 text-muted hover:border-white/25 hover:text-paper`}
            >
              Impor JSON
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              void handleImport(event.target.files);
              event.target.value = '';
            }}
          />

          {feedback ? (
            <p className="font-sans text-[9px] leading-relaxed text-paper/75" aria-live="polite">
              {feedback}
            </p>
          ) : null}
          {errorMessage ? (
            <p role="alert" className="font-sans text-[9px] leading-relaxed text-accent">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
