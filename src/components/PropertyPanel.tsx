import type { ReactNode } from 'react';
import { contrastRatio, normalizeHex } from '../lib/color';
import type { TextWeight } from '../lib/types';
import { useEditorStore } from '../store/editorStore';

const labelClass = 'font-sans text-[9px] uppercase tracking-[0.2em] text-muted';
const fieldClass =
  'mt-1.5 w-full border border-white/10 bg-[#0D0D0D] px-2.5 py-2 font-sans text-[11px] text-paper outline-none transition-colors focus:border-accent/70 disabled:cursor-not-allowed';
const smallButtonClass =
  'border px-2 py-1 font-sans text-[9px] uppercase tracking-[0.14em] transition-colors';
const rangeClass = 'mt-2 w-full accent-accent';

function isTextWeight(value: number): value is TextWeight {
  return value === 300 || value === 400 || value === 500 || value === 600 || value === 700;
}

export default function PropertyPanel(): ReactNode {
  const slides = useEditorStore((state) => state.slides);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const template = useEditorStore((state) => state.template);
  const checkpoint = useEditorStore((state) => state.checkpoint);
  const updateTextLayer = useEditorStore((state) => state.updateTextLayer);
  const updateLineLayer = useEditorStore((state) => state.updateLineLayer);
  const updateIconLayer = useEditorStore((state) => state.updateIconLayer);

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const layer = activeSlide?.layers.find((candidate) => candidate.id === selectedLayerId);
  const tokens = template.tokens;

  if (!layer) {
    return (
      <section className="border border-white/10 bg-panel" aria-label="Properti lapisan">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-paper">Properti</h2>
        </div>
        <div className="px-4 py-8">
          <p className="font-display text-[22px] leading-snug text-paper/80">
            Pilih satu lapisan
            <span className="italic text-accent"> untuk mulai.</span>
          </p>
          <p className="mt-3 font-sans text-[10px] leading-relaxed text-muted">
            Klik elemen di kanvas atau pilih dari daftar lapisan. Drag untuk memindahkan, tarik
            handle untuk mengubah ukuran dan rotasi.
          </p>
        </div>
      </section>
    );
  }

  const isLocked = layer.locked;
  const families = Array.from(
    new Set([
      tokens.fontDisplay,
      tokens.fontBody,
      ...(layer.type === 'text' ? [layer.props.fontFamily] : []),
    ]),
  );

  return (
    <section className="border border-white/10 bg-panel" aria-label="Properti lapisan">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.24em] text-paper">Properti</h2>
        <span className="max-w-[150px] truncate font-sans text-[9px] uppercase tracking-[0.16em] text-muted">
          {layer.type === 'text' ? 'Teks' : layer.type === 'line' ? 'Garis' : layer.type === 'icon' ? 'Ikon' : 'Foto'}
        </span>
      </div>

      {isLocked ? (
        <p className="border-b border-accent/20 bg-accent/[0.06] px-4 py-2 font-sans text-[9px] leading-relaxed text-accent">
          Lapisan terkunci. Buka kunci lewat panel lapisan untuk mengubahnya.
        </p>
      ) : null}

      <fieldset
        disabled={isLocked}
        className={`min-w-0 px-4 py-4 ${isLocked ? 'pointer-events-none opacity-50' : ''}`}
      >
        {layer.type === 'text' ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Teks</span>
              <textarea
                value={layer.props.text}
                rows={4}
                onFocus={checkpoint}
                onChange={(event) => updateTextLayer(layer.id, { text: event.target.value }, false)}
                className={`${fieldClass} resize-y leading-relaxed`}
              />
              <span className="mt-1.5 block font-sans text-[9px] leading-relaxed text-muted">
                Bungkus frasa dengan *tanda bintang* untuk italic berwarna aksen.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Font</span>
                <select
                  value={layer.props.fontFamily}
                  onFocus={checkpoint}
                  onChange={(event) =>
                    updateTextLayer(layer.id, { fontFamily: event.target.value }, false)
                  }
                  className={fieldClass}
                >
                  {families.map((family) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelClass}>Ukuran</span>
                <input
                  type="number"
                  min={12}
                  max={240}
                  step={1}
                  value={layer.props.fontSize}
                  onFocus={checkpoint}
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value);
                    if (Number.isFinite(value)) {
                      updateTextLayer(
                        layer.id,
                        { fontSize: Math.min(240, Math.max(12, value)) },
                        false,
                      );
                    }
                  }}
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Ketebalan</span>
                <select
                  value={layer.props.fontWeight}
                  onFocus={checkpoint}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    if (isTextWeight(value)) {
                      updateTextLayer(layer.id, { fontWeight: value }, false);
                    }
                  }}
                  className={fieldClass}
                >
                  <option value={300}>300 · Light</option>
                  <option value={400}>400 · Regular</option>
                  <option value={500}>500 · Medium</option>
                  <option value={600}>600 · Semi</option>
                  <option value={700}>700 · Bold</option>
                </select>
              </label>

              <div>
                <span className={labelClass}>Gaya</span>
                <button
                  type="button"
                  onClick={() =>
                    updateTextLayer(layer.id, {
                      fontStyle: layer.props.fontStyle === 'italic' ? 'normal' : 'italic',
                    })
                  }
                  aria-pressed={layer.props.fontStyle === 'italic'}
                  className={`mt-1.5 w-full px-2.5 py-2 font-display text-[14px] italic transition-colors ${
                    layer.props.fontStyle === 'italic'
                      ? 'border border-accent/70 text-accent'
                      : 'border border-white/10 text-muted hover:border-white/25 hover:text-paper'
                  }`}
                >
                  Italic
                </button>
              </div>

              <label className="block">
                <span className={labelClass}>Spasi huruf</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.2}
                  value={layer.props.letterSpacing}
                  onFocus={checkpoint}
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value);
                    if (Number.isFinite(value)) {
                      updateTextLayer(
                        layer.id,
                        { letterSpacing: Math.min(40, Math.max(0, value)) },
                        false,
                      );
                    }
                  }}
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Tinggi baris</span>
                <input
                  type="number"
                  min={0.8}
                  max={2.4}
                  step={0.05}
                  value={layer.props.lineHeight}
                  onFocus={checkpoint}
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value);
                    if (Number.isFinite(value)) {
                      updateTextLayer(
                        layer.id,
                        { lineHeight: Math.min(2.4, Math.max(0.8, value)) },
                        false,
                      );
                    }
                  }}
                  className={fieldClass}
                />
              </label>
            </div>

            <div>
              <span className={labelClass}>Perataan</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateTextLayer(layer.id, { align })}
                    aria-pressed={layer.props.align === align}
                    className={`${smallButtonClass} ${
                      layer.props.align === align
                        ? 'border-accent/70 text-accent'
                        : 'border-white/10 text-muted hover:border-white/25 hover:text-paper'
                    }`}
                  >
                    {align === 'left' ? 'Kiri' : align === 'center' ? 'Tengah' : 'Kanan'}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className={labelClass}>Warna teks</span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(layer.props.fill) ?? '#F5F0E8'}
                  onFocus={checkpoint}
                  onChange={(event) =>
                    updateTextLayer(layer.id, { fill: event.target.value.toUpperCase() }, false)
                  }
                  className="h-9 w-11 cursor-pointer border border-white/10 bg-transparent p-0.5"
                />
                <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-muted">
                  {normalizeHex(layer.props.fill) ?? layer.props.fill}
                </span>
              </div>
            </label>

            {(() => {
              const ratio = contrastRatio(layer.props.fill, tokens.bg);
              if (ratio === null) {
                return null;
              }
              const required = layer.props.fontSize >= 32 ? 3 : 4.5;
              const passes = ratio >= required;
              return (
                <p
                  aria-live="polite"
                  className={`font-sans text-[9px] leading-relaxed ${
                    passes ? 'text-muted' : 'text-accent'
                  }`}
                >
                  {passes
                    ? `Kontras ${ratio.toFixed(1)}:1 · lolos WCAG AA`
                    : `Kontras rendah ${ratio.toFixed(1)}:1 · minimal ${required}:1 untuk WCAG AA`}
                </p>
              );
            })()}

            <label className="block">
              <span className={labelClass}>Opasitas</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={Math.round(layer.props.opacity * 100)}
                  onFocus={checkpoint}
                  onPointerDown={checkpoint}
                  onChange={(event) =>
                    updateTextLayer(
                      layer.id,
                      { opacity: Number(event.target.value) / 100 },
                      false,
                    )
                  }
                  className={rangeClass}
                />
                <span className="w-9 text-right font-sans text-[10px] tabular-nums text-muted">
                  {Math.round(layer.props.opacity * 100)}%
                </span>
              </div>
            </label>

            <div className="border-t border-white/10 pt-4">
              <span className={labelClass}>Efek teks</span>
              <div className="mt-2 space-y-2">
                <label className="flex items-center justify-between gap-3 font-sans text-[10px] text-muted">
                  <span>Bayangan lembut</span>
                  <input
                    type="checkbox"
                    checked={layer.props.shadow !== null}
                    onChange={(event) =>
                      updateTextLayer(layer.id, {
                        shadow: event.target.checked
                          ? {
                              color: '#000000',
                              blur: 18,
                              opacity: 0.35,
                              offsetX: 0,
                              offsetY: 8,
                            }
                          : null,
                        glow: event.target.checked ? false : layer.props.glow,
                      })
                    }
                    className="h-3.5 w-3.5 accent-accent"
                  />
                </label>

                {layer.props.shadow ? (
                  <div className="space-y-2 border-l border-white/10 pl-3">
                    <label className="block">
                      <span className="font-sans text-[9px] text-muted">Blur bayangan</span>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={layer.props.shadow.blur}
                        onPointerDown={checkpoint}
                        onChange={(event) =>
                          updateTextLayer(
                            layer.id,
                            {
                              shadow: layer.props.shadow
                                ? {
                                    ...layer.props.shadow,
                                    blur: Number(event.target.value),
                                  }
                                : null,
                            },
                            false,
                          )
                        }
                        className={rangeClass}
                      />
                    </label>
                    <label className="block">
                      <span className="font-sans text-[9px] text-muted">Kekuatan bayangan</span>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={1}
                        value={Math.round(layer.props.shadow.opacity * 100)}
                        onPointerDown={checkpoint}
                        onChange={(event) =>
                          updateTextLayer(
                            layer.id,
                            {
                              shadow: layer.props.shadow
                                ? {
                                    ...layer.props.shadow,
                                    opacity: Number(event.target.value) / 100,
                                  }
                                : null,
                            },
                            false,
                          )
                        }
                        className={rangeClass}
                      />
                    </label>
                  </div>
                ) : null}

                <label className="flex items-center justify-between gap-3 font-sans text-[10px] text-muted">
                  <span>Glow lembut</span>
                  <input
                    type="checkbox"
                    checked={layer.props.glow}
                    onChange={(event) =>
                      updateTextLayer(layer.id, {
                        glow: event.target.checked,
                        shadow: event.target.checked ? null : layer.props.shadow,
                      })
                    }
                    className="h-3.5 w-3.5 accent-accent"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {layer.type === 'line' ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Warna garis</span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(layer.props.stroke) ?? '#B8B2A7'}
                  onFocus={checkpoint}
                  onChange={(event) =>
                    updateLineLayer(layer.id, { stroke: event.target.value.toUpperCase() }, false)
                  }
                  className="h-9 w-11 cursor-pointer border border-white/10 bg-transparent p-0.5"
                />
                <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-muted">
                  {normalizeHex(layer.props.stroke) ?? layer.props.stroke}
                </span>
              </div>
            </label>

            <label className="block">
              <span className={labelClass}>Ketebalan</span>
              <input
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={layer.props.strokeWidth}
                onFocus={checkpoint}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  if (Number.isFinite(value)) {
                    updateLineLayer(
                      layer.id,
                      { strokeWidth: Math.min(12, Math.max(0.5, value)) },
                      false,
                    );
                  }
                }}
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Opasitas</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(layer.props.opacity * 100)}
                onFocus={checkpoint}
                onPointerDown={checkpoint}
                onChange={(event) =>
                  updateLineLayer(layer.id, { opacity: Number(event.target.value) / 100 }, false)
                }
                className={rangeClass}
              />
            </label>
          </div>
        ) : null}

        {layer.type === 'icon' ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Jenis ikon</span>
              <select
                value={layer.props.variant}
                onFocus={checkpoint}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'arrow' || value === 'like' || value === 'save') {
                    updateIconLayer(layer.id, { variant: value }, false);
                  }
                }}
                className={fieldClass}
              >
                <option value="arrow">Panah</option>
                <option value="like">Like</option>
                <option value="save">Simpan</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Warna</span>
              <input
                type="color"
                value={normalizeHex(layer.props.stroke) ?? '#E07A5F'}
                onFocus={checkpoint}
                onChange={(event) =>
                  updateIconLayer(layer.id, { stroke: event.target.value.toUpperCase() }, false)
                }
                className="mt-1.5 h-9 w-11 cursor-pointer border border-white/10 bg-transparent p-0.5"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Ketebalan goresan</span>
              <input
                type="number"
                min={0.5}
                max={8}
                step={0.1}
                value={layer.props.strokeWidth}
                onFocus={checkpoint}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  if (Number.isFinite(value)) {
                    updateIconLayer(
                      layer.id,
                      { strokeWidth: Math.min(8, Math.max(0.5, value)) },
                      false,
                    );
                  }
                }}
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Opasitas</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(layer.props.opacity * 100)}
                onFocus={checkpoint}
                onPointerDown={checkpoint}
                onChange={(event) =>
                  updateIconLayer(layer.id, { opacity: Number(event.target.value) / 100 }, false)
                }
                className={rangeClass}
              />
            </label>
          </div>
        ) : null}

        {layer.type === 'image' ? (
          <p className="font-sans text-[10px] leading-relaxed text-muted">
            Foto latar aktif. Buka tab <span className="text-paper">Foto</span> untuk mengatur
            zoom, posisi, hitam putih, kecerahan, dan overlay.
          </p>
        ) : null}
      </fieldset>
    </section>
  );
}
