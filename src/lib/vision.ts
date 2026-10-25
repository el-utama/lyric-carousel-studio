import { normalizeHex } from './color';
import type { VisionAnalysisResult } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function requestVisionAnalysis(images: string[]): Promise<VisionAnalysisResult> {
  if (images.length === 0) {
    throw new Error('Tambahkan gambar referensi terlebih dahulu.');
  }

  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    });
  } catch {
    throw new Error('Server tidak dapat dihubungi untuk analisis vision.');
  }

  const raw: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isRecord(raw) && typeof raw.error === 'string'
        ? raw.error
        : `Analisis vision gagal (${response.status}).`;
    throw new Error(message);
  }

  if (!isRecord(raw) || typeof raw.description !== 'string') {
    throw new Error('Respons vision tidak valid.');
  }

  const palette = Array.isArray(raw.palette)
    ? raw.palette
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeHex(value))
        .filter((value): value is string => value !== null)
        .slice(0, 8)
    : [];

  return {
    description: raw.description.slice(0, 1200),
    palette,
    lighting: typeof raw.lighting === 'string' ? raw.lighting.slice(0, 400) : '',
  };
}
