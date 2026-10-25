import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import {
  contradictsLanguage,
  detectLanguage,
  resolveLanguage,
} from '../src/lib/detectLanguage';
import type {
  GeneratedHook,
  GeneratedSlide,
  GenerationResult,
  HookAngle,
  HookRegenerationResult,
  LanguageSelection,
  Platform,
  SlideRole,
} from '../src/lib/types';
import {
  HOOK_ANGLE_ORDER,
  buildCarouselPrompt,
  buildHookPrompt,
  buildLanguageCorrectionPrompt,
  buildSystemPrompt,
  buildVisionPrompt,
} from './prompts';

const ROLE_ORDER: SlideRole[] = ['hook', 'verse', 'chorus', 'outro'];
const PLATFORMS: Platform[] = ['tiktok', 'reels', 'shorts'];
const LANGUAGE_MODES = ['auto', 'en', 'id', 'mixed', 'other'] as const;

const app = express();
app.use(express.json({ limit: '12mb' }));

const llmConfigured = (): boolean =>
  Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);

const geminiConfigured = (): boolean => Boolean(process.env.GEMINI_API_KEY);

const visionConfigured = (): boolean =>
  Boolean(process.env.VISION_BASE_URL && process.env.VISION_API_KEY && process.env.VISION_MODEL);

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    llmConfigured: llmConfigured(),
    geminiConfigured: geminiConfigured(),
    visionConfigured: visionConfigured(),
  });
});

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

class SchemaError extends Error {}

class LanguageError extends Error {}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ParsedHooksRequest {
  title: string;
  artist: string;
  lyrics: string;
  language: LanguageSelection;
  platform: Platform;
  mode: 'carousel' | 'hook';
  angle: HookAngle | null;
  avoid: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, maxLength: number, required = true): string {
  if (typeof value !== 'string') {
    if (required) {
      throw new RequestError(`Field "${field}" harus berupa teks.`);
    }
    return '';
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new RequestError(`Field "${field}" tidak boleh kosong.`);
  }
  return trimmed.slice(0, maxLength);
}

function parseHooksRequest(body: unknown): ParsedHooksRequest {
  if (!isRecord(body)) {
    throw new RequestError('Body permintaan tidak valid.');
  }

  const title = readString(body.title, 'title', 160, false);
  const artist = readString(body.artist, 'artist', 160, false);
  const lyrics = readString(body.lyrics, 'lyrics', 12000);
  if (lyrics.length < 20) {
    throw new RequestError('Materi lagu terlalu pendek. Beri minimal 20 karakter.');
  }

  if (!isRecord(body.language)) {
    throw new RequestError('Pilihan bahasa tidak valid.');
  }
  const mode = body.language.mode;
  if (typeof mode !== 'string' || !LANGUAGE_MODES.includes(mode as (typeof LANGUAGE_MODES)[number])) {
    throw new RequestError('Mode bahasa tidak dikenal.');
  }
  const language: LanguageSelection = {
    mode: mode as LanguageSelection['mode'],
    other: readString(body.language.other, 'language.other', 60, false),
  };

  const platform = body.platform;
  if (typeof platform !== 'string' || !PLATFORMS.includes(platform as Platform)) {
    throw new RequestError('Platform tidak dikenal.');
  }

  const requestMode = body.mode === 'hook' ? 'hook' : 'carousel';
  let angle: HookAngle | null = null;
  if (requestMode === 'hook') {
    if (typeof body.angle !== 'string' || !HOOK_ANGLE_ORDER.includes(body.angle as HookAngle)) {
      throw new RequestError('Angle hook tidak dikenal.');
    }
    angle = body.angle as HookAngle;
  }

  const avoid = Array.isArray(body.avoid)
    ? body.avoid
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().slice(0, 240))
        .filter((value) => value.length > 0)
        .slice(0, 8)
    : [];

  return {
    title,
    artist,
    lyrics,
    language,
    platform: platform as Platform,
    mode: requestMode,
    angle,
    avoid,
  };
}

function parseJsonObject(content: string): Record<string, unknown> {
  let text = content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new SchemaError('Respons model bukan objek JSON.');
  }
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!isRecord(parsed)) {
      throw new SchemaError('Respons model harus berupa objek JSON.');
    }
    return parsed;
  } catch (error) {
    if (error instanceof SchemaError) {
      throw error;
    }
    throw new SchemaError('JSON tidak dapat dibaca.');
  }
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["'“”]+|["'“”]+$/g, '').trim();
}

function balanceAsterisks(value: string): string {
  const markers = (value.match(/\*/g) ?? []).length;
  if (markers % 2 === 0) {
    return value;
  }
  const last = value.lastIndexOf('*');
  return `${value.slice(0, last)}${value.slice(last + 1)}`;
}

function cleanCopy(value: string): string {
  return balanceAsterisks(stripWrappingQuotes(normalizeSpace(value)));
}

function truncateWords(value: string, limit: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return value;
  }
  return balanceAsterisks(words.slice(0, limit).join(' ').replace(/[.,;:—–-]+$/, ''));
}

function truncateChars(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  const slice = value.slice(0, limit - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
  return balanceAsterisks(`${cut.replace(/[\s,;:—–-]+$/, '')}…`);
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SchemaError(`Bagian "${field}" kosong.`);
  }
  return cleanCopy(value).slice(0, maxLength);
}

function normalizeHookText(value: unknown, field: string): string {
  const text = truncateWords(requireText(value, field, 300), 14);
  if (text.length === 0) {
    throw new SchemaError(`Bagian "${field}" kosong.`);
  }
  return text;
}

function normalizeHooks(raw: unknown): GeneratedHook[] {
  if (!Array.isArray(raw) || raw.length < 5) {
    throw new SchemaError('Daftar hook harus berisi lima variasi.');
  }

  return HOOK_ANGLE_ORDER.map((angle, index) => {
    const candidate =
      raw.find((item) => isRecord(item) && item.angle === angle) ?? raw[index];
    if (!isRecord(candidate)) {
      throw new SchemaError(`Hook dengan angle "${angle}" tidak ditemukan.`);
    }
    return { angle, text: normalizeHookText(candidate.text, `hook.${angle}`) };
  });
}

function normalizeSlides(raw: unknown): GeneratedSlide[] {
  if (!Array.isArray(raw) || raw.length < 4) {
    throw new SchemaError('Daftar slide harus berisi empat bagian.');
  }

  return ROLE_ORDER.map((role, index) => {
    const candidate = raw.find((item) => isRecord(item) && item.role === role) ?? raw[index];
    if (!isRecord(candidate)) {
      throw new SchemaError(`Slide dengan role "${role}" tidak ditemukan.`);
    }

    const footer = readOptionalCopy(candidate.footer, 80);
    if (role !== 'outro' && footer.length === 0) {
      throw new SchemaError(`Footer slide "${role}" kosong.`);
    }

    return {
      role,
      header: requireText(candidate.header, `slides.${role}.header`, 60),
      marker: requireText(candidate.marker, `slides.${role}.marker`, 64),
      quote: requireText(candidate.quote, `slides.${role}.quote`, 600),
      body: truncateChars(requireText(candidate.body, `slides.${role}.body`, 240), 160),
      footer,
    };
  });
}

function readOptionalCopy(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  const clean = cleanCopy(value);
  return clean.length > 0 ? clean.slice(0, maxLength) : '';
}

function normalizeHashtags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const tags = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') {
      continue;
    }
    const tag = value
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N}_]/gu, '')
      .toLocaleLowerCase();
    if (tag.length > 1) {
      tags.add(`#${tag}`);
    }
    if (tags.size >= 8) {
      break;
    }
  }
  return [...tags];
}

interface NormalizedCarousel {
  rawLanguage: string;
  hooks: GeneratedHook[];
  slides: GeneratedSlide[];
  caption: string;
  hashtags: string[];
}

function normalizeCarousel(raw: Record<string, unknown>): NormalizedCarousel {
  const caption = requireText(raw.caption, 'caption', 1400);
  if (caption.length < 10) {
    throw new SchemaError('Caption terlalu pendek.');
  }

  const rawLanguage =
    typeof raw.language === 'string' ? normalizeSpace(raw.language).slice(0, 60) : '';

  return {
    rawLanguage,
    hooks: normalizeHooks(raw.hooks),
    slides: normalizeSlides(raw.slides),
    caption,
    hashtags: normalizeHashtags(raw.hashtags),
  };
}

function copyForLanguageCheck(normalized: NormalizedCarousel): string {
  return [
    ...normalized.hooks.map((hook) => hook.text),
    ...normalized.slides.flatMap((slide) => [
      slide.header,
      slide.marker,
      slide.quote,
      slide.body,
      slide.footer,
    ]),
    normalized.caption,
  ].join(' ');
}

function languageName(code: 'en' | 'id'): string {
  return code === 'id' ? 'Bahasa Indonesia' : 'English';
}

async function callModel(messages: ChatMessage[], useJsonMode = true): Promise<string> {
  const baseUrl = (process.env.LLM_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const apiKey = process.env.LLM_API_KEY ?? '';
  const model = process.env.LLM_MODEL ?? '';
  if (!baseUrl || !apiKey || !model) {
    throw new RequestError('LLM belum dikonfigurasi.', 503);
  }

  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.82,
        max_tokens: 2400,
        ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();

    if (!response.ok) {
      if (response.status === 400 && useJsonMode) {
        return callModel(messages, false);
      }
      let detail = rawText.slice(0, 280);
      try {
        const parsed: unknown = JSON.parse(rawText);
        if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
          detail = parsed.error.message.slice(0, 280);
        }
      } catch {
        // The plain-text body is already a useful fallback.
      }
      throw new RequestError(
        `Permintaan ke penyedia model gagal (${response.status}). ${detail}`,
        502,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new RequestError('Respons penyedia model bukan JSON.', 502);
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.choices) || parsed.choices.length === 0) {
      throw new RequestError('Respons penyedia model tidak memuat pilihan.', 502);
    }

    const first = parsed.choices[0];
    if (!isRecord(first) || !isRecord(first.message)) {
      throw new RequestError('Respons penyedia model tidak memuat pesan.', 502);
    }

    const content = first.message.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      return content;
    }
    if (Array.isArray(content)) {
      const joined = content
        .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
        .join('');
      if (joined.trim().length > 0) {
        return joined;
      }
    }

    throw new RequestError('Model tidak mengembalikan teks.', 502);
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestError('Waktu tunggu model habis. Coba lagi.', 504);
    }
    throw new RequestError(
      error instanceof Error ? `Gagal menghubungi model: ${error.message}` : 'Gagal menghubungi model.',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

function geminiTextFromMessages(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const prefix = message.role === 'system' ? 'System instruction: ' : '';
      return `${prefix}${message.content}`;
    })
    .join('\n\n');
}

async function callGeminiModel(text: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';
  if (!apiKey) {
    throw new RequestError('Gemini belum dikonfigurasi.', 503);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          temperature: 0.82,
          maxOutputTokens: 2400,
        },
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();

    if (!response.ok) {
      let detail = rawText.slice(0, 280);
      try {
        const parsed: unknown = JSON.parse(rawText);
        if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
          detail = parsed.error.message.slice(0, 280);
        }
      } catch {
        // The plain-text body is already a useful fallback.
      }
      throw new RequestError(
        `Permintaan ke Gemini gagal (${response.status}). ${detail}`,
        502,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new RequestError('Respons Gemini bukan JSON.', 502);
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
      throw new RequestError('Respons Gemini tidak memuat kandidat.', 502);
    }

    const first = parsed.candidates[0];
    if (!isRecord(first) || !isRecord(first.content)) {
      throw new RequestError('Respons Gemini tidak memuat konten.', 502);
    }

    const parts = Array.isArray(first.content.parts) ? first.content.parts : [];
    const textParts = parts
      .filter((part): part is Record<string, unknown> => isRecord(part))
      .map((part) => part.text)
      .filter((value): value is string => typeof value === 'string');

    const joined = textParts.join('');
    if (joined.trim().length === 0) {
      throw new RequestError('Gemini tidak mengembalikan teks.', 502);
    }

    return joined;
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestError('Waktu tunggu Gemini habis. Coba lagi.', 504);
    }
    throw new RequestError(
      error instanceof Error ? `Gagal menghubungi Gemini: ${error.message}` : 'Gagal menghubungi Gemini.',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function generateCarousel(
  request: ParsedHooksRequest,
  resolved: ReturnType<typeof resolveLanguage>,
): Promise<GenerationResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: buildCarouselPrompt({
        title: request.title,
        artist: request.artist,
        lyrics: request.lyrics,
        languageLabel: resolved.label,
        languageCode: resolved.code,
        platform: request.platform,
      }),
    },
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    let content: string;
    if (llmConfigured()) {
      content = await callModel(messages);
    } else if (geminiConfigured()) {
      content = await callGeminiModel(geminiTextFromMessages(messages));
    } else {
      throw new RequestError(
        'LLM belum dikonfigurasi. Isi LLM_BASE_URL, LLM_API_KEY, dan LLM_MODEL di file .env, atau isi GEMINI_API_KEY untuk menggunakan Gemini, lalu jalankan ulang server.',
        503,
      );
    }

    try {
      const normalized = normalizeCarousel(parseJsonObject(content));
      if (resolved.code === 'en' || resolved.code === 'id') {
        if (contradictsLanguage(copyForLanguageCheck(normalized), resolved.code)) {
          const detected = detectLanguage(copyForLanguageCheck(normalized)).language;
          throw new LanguageError(
            `Model menulis dalam ${detected === 'id' ? 'Bahasa Indonesia' : 'English'}, bukan ${languageName(resolved.code)}.`,
          );
        }
      }
      // Mode 'mixed' sengaja tidak divalidasi secara ketat karena code-switching adalah pilihan sengaja.

      const language =
        resolved.source === 'undetermined' && normalized.rawLanguage.length > 0
          ? normalized.rawLanguage
          : resolved.label;

      return {
        language,
        hooks: normalized.hooks,
        slides: normalized.slides,
        caption: normalized.caption,
        hashtags: normalized.hashtags,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Konten model tidak valid.');

      if (error instanceof LanguageError) {
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: buildLanguageCorrectionPrompt(resolved.label),
        });
      } else if (error instanceof SchemaError) {
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: `The previous JSON was rejected: ${error.message} Return the same JSON shape with every required field filled correctly, and nothing else.`,
        });
      } else {
        throw error;
      }
    }
  }

  if (lastError instanceof LanguageError) {
    throw new RequestError(
      `Model tidak mengikuti bahasa ${resolved.label} setelah dua koreksi. Coba lagi atau ganti pilihan bahasa.`,
      502,
    );
  }

  throw new RequestError(
    `Model tidak menghasilkan struktur yang valid setelah dua koreksi. ${lastError?.message ?? ''}`.trim(),
    502,
  );
}

async function generateSingleHook(
  request: ParsedHooksRequest,
  resolved: ReturnType<typeof resolveLanguage>,
): Promise<HookRegenerationResult> {
  const angle = request.angle;
  if (!angle) {
    throw new RequestError('Angle hook wajib diisi.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: buildHookPrompt({
        title: request.title,
        artist: request.artist,
        lyrics: request.lyrics,
        languageLabel: resolved.label,
        languageCode: resolved.code,
        platform: request.platform,
        angle,
        avoid: request.avoid,
      }),
    },
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    let content: string;
    if (llmConfigured()) {
      content = await callModel(messages);
    } else if (geminiConfigured()) {
      content = await callGeminiModel(geminiTextFromMessages(messages));
    } else {
      throw new RequestError(
        'LLM belum dikonfigurasi. Isi LLM_BASE_URL, LLM_API_KEY, dan LLM_MODEL di file .env, atau isi GEMINI_API_KEY untuk menggunakan Gemini, lalu jalankan ulang server.',
        503,
      );
    }

    try {
      const raw = parseJsonObject(content);
      const candidate = isRecord(raw.hook) ? raw.hook : undefined;
      const fallback = Array.isArray(raw.hooks) ? raw.hooks[0] : undefined;
      const source = candidate ?? (isRecord(fallback) ? fallback : undefined);
      if (!source) {
        throw new SchemaError('Objek hook tidak ditemukan.');
      }

      const text = normalizeHookText(source.text, 'hook');
      if (
        (resolved.code === 'en' || resolved.code === 'id') &&
        contradictsLanguage(text, resolved.code)
      ) {
        throw new LanguageError(`Hook tidak ditulis dalam ${resolved.label}.`);
      }

      return {
        language: resolved.label,
        hook: { angle, text },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Hook tidak valid.');

      if (error instanceof LanguageError) {
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: buildLanguageCorrectionPrompt(resolved.label),
        });
      } else if (error instanceof SchemaError) {
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content:
            'Return {"language":"...","hook":{"angle":"...","text":"..."}} with a non-empty hook, and nothing else.',
        });
      } else {
        throw error;
      }
    }
  }

  throw new RequestError(
    `Hook baru tidak berhasil dibuat. ${lastError?.message ?? ''}`.trim(),
    502,
  );
}

async function callVisionModel(images: string[]): Promise<Record<string, unknown>> {
  const baseUrl = (process.env.VISION_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const apiKey = process.env.VISION_API_KEY ?? '';
  const model = process.env.VISION_MODEL ?? '';
  if (!baseUrl || !apiKey || !model) {
    throw new RequestError('Vision belum dikonfigurasi.', 503);
  }

  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 900,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildVisionPrompt() },
              ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    if (!response.ok) {
      let detail = rawText.slice(0, 280);
      try {
        const parsed: unknown = JSON.parse(rawText);
        if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
          detail = parsed.error.message.slice(0, 280);
        }
      } catch {
        // The plain-text body is already a useful fallback.
      }
      throw new RequestError(
        `Permintaan vision gagal (${response.status}). ${detail}`,
        502,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new RequestError('Respons vision bukan JSON.', 502);
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.choices) || parsed.choices.length === 0) {
      throw new RequestError('Respons vision tidak memuat pilihan.', 502);
    }
    const first = parsed.choices[0];
    if (!isRecord(first) || !isRecord(first.message)) {
      throw new RequestError('Respons vision tidak memuat pesan.', 502);
    }

    const content = first.message.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new RequestError('Vision tidak mengembalikan teks.', 502);
    }

    return parseJsonObject(content);
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestError('Waktu tunggu vision habis. Coba lagi.', 504);
    }
    throw new RequestError(
      error instanceof Error ? `Gagal menghubungi vision: ${error.message}` : 'Gagal menghubungi vision.',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

function normalizeVisionPalette(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const palette: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') {
      continue;
    }
    const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
    if (!match || !match[1]) {
      continue;
    }
    const hex = `#${match[1].toUpperCase()}`;
    if (!palette.includes(hex)) {
      palette.push(hex);
    }
    if (palette.length >= 8) {
      break;
    }
  }
  return palette;
}

app.post('/api/analyze', async (requesting: Request, response: Response) => {
  if (!visionConfigured()) {
    response.status(503).json({
      error:
        'Vision belum dikonfigurasi. Isi VISION_BASE_URL, VISION_API_KEY, dan VISION_MODEL di file .env untuk membaca referensi dengan model.',
    });
    return;
  }

  try {
    const body: unknown = requesting.body;
    if (!isRecord(body) || !Array.isArray(body.images)) {
      throw new RequestError('Daftar gambar tidak valid.');
    }
    if (body.images.length === 0 || body.images.length > 8) {
      throw new RequestError('Lampirkan satu sampai delapan gambar referensi.');
    }

    const images: string[] = [];
    for (const value of body.images) {
      if (typeof value !== 'string' || !value.startsWith('data:image/')) {
        throw new RequestError('Setiap gambar harus berupa data gambar yang valid.');
      }
      if (value.length > 3_500_000) {
        throw new RequestError('Salah satu gambar terlalu besar. Gunakan gambar yang lebih ringkas.');
      }
      images.push(value);
    }

    const raw = await callVisionModel(images);
    const description =
      typeof raw.description === 'string' ? normalizeSpace(raw.description).slice(0, 1200) : '';
    if (description.length < 10) {
      throw new RequestError('Vision tidak memberikan deskripsi yang cukup.', 502);
    }

    response.json({
      description,
      palette: normalizeVisionPalette(raw.palette),
      lighting: typeof raw.lighting === 'string' ? normalizeSpace(raw.lighting).slice(0, 400) : '',
    });
  } catch (error) {
    if (error instanceof RequestError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Unexpected vision error:', error);
    response.status(500).json({ error: 'Terjadi kesalahan tak terduga saat membaca referensi.' });
  }
});

app.post('/api/hooks', async (requesting: Request, response: Response) => {
  if (!llmConfigured() && !geminiConfigured()) {
    response.status(503).json({
      error:
        'LLM belum dikonfigurasi. Isi LLM_BASE_URL, LLM_API_KEY, dan LLM_MODEL di file .env, atau isi GEMINI_API_KEY untuk menggunakan Gemini, lalu jalankan ulang server.',
    });
    return;
  }

  try {
    const parsed = parseHooksRequest(requesting.body);
    const resolved = resolveLanguage(parsed.lyrics, parsed.language);

    const payload =
      parsed.mode === 'hook'
        ? await generateSingleHook(parsed, resolved)
        : await generateCarousel(parsed, resolved);

    response.json(payload);
  } catch (error) {
    if (error instanceof RequestError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Unexpected generation error:', error);
    response.status(500).json({ error: 'Terjadi kesalahan tak terduga saat membuat carousel.' });
  }
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
app.listen(port, host, () => {
  console.log(`Lyric Carousel Studio API listening on http://${host}:${port}`);
});
