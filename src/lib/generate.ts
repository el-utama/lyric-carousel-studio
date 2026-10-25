import type {
  GenerationResult,
  HookRegenerationResult,
  HookRequest,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function postHooks<T>(payload: HookRequest): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/hooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Server tidak dapat dihubungi. Pastikan npm run dev berjalan.');
  }

  const raw: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isRecord(raw) && typeof raw.error === 'string'
        ? raw.error
        : `Permintaan gagal (${response.status}).`;
    throw new Error(message);
  }

  if (!isRecord(raw)) {
    throw new Error('Respons server tidak valid.');
  }

  return raw as T;
}

export async function requestCarousel(request: HookRequest): Promise<GenerationResult> {
  const result = await postHooks<GenerationResult>({ ...request, mode: 'carousel' });
  if (!Array.isArray(result.hooks) || result.hooks.length < 5) {
    throw new Error('Respons server tidak memuat lima hook.');
  }
  if (!Array.isArray(result.slides) || result.slides.length < 4) {
    throw new Error('Respons server tidak memuat empat slide.');
  }
  if (typeof result.caption !== 'string') {
    throw new Error('Respons server tidak memuat caption.');
  }
  return {
    ...result,
    hashtags: Array.isArray(result.hashtags) ? result.hashtags : [],
  };
}

export async function requestSingleHook(
  request: HookRequest,
  angle: NonNullable<HookRequest['angle']>,
  avoid: string[],
): Promise<HookRegenerationResult> {
  const result = await postHooks<HookRegenerationResult>({
    ...request,
    mode: 'hook',
    angle,
    avoid,
  });
  if (!isRecord(result.hook) || typeof result.hook.text !== 'string') {
    throw new Error('Respons server tidak memuat hook baru.');
  }
  return result;
}
