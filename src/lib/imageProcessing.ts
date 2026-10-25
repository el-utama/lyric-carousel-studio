import { rgbToHex } from './color';

const LIGHTNESS_SAMPLE_EDGE = 64;

export function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gambar gagal dimuat.'));
    image.src = source;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Berkas gambar tidak dapat dibaca.'));
      }
    };
    reader.onerror = () => reject(new Error('Berkas gambar tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
}

const IMAGE_EDGE = 2000;

interface CachedVariant {
  promise: Promise<HTMLCanvasElement>;
}

const processedCache = new Map<string, Map<string, CachedVariant>>();
const MAX_VARIANTS_PER_SOURCE = 3;
const MAX_CACHED_SOURCES = 4;

/** Reads a user photo and stores a canvas-friendly JPEG data URL. */
export async function fileToBackgroundDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar.');
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest === 0) {
    throw new Error('Gambar tidak memiliki ukuran yang valid.');
  }

  const scale = Math.min(1, IMAGE_EDGE / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Kanvas tidak tersedia untuk memproses gambar.');
  }

  context.fillStyle = '#121212';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.9);
}

/** Bakes grayscale, brightness, and blur into a canvas so Konva and exports match. */
export function buildProcessedImage(
  image: HTMLImageElement,
  grayscale: boolean,
  brightness: number,
  blur: number,
): HTMLCanvasElement {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, IMAGE_EDGE / Math.max(1, longest));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }

  const amount = Math.max(0.4, Math.min(1.6, brightness));
  const blurPx = Math.max(0, Math.min(8, blur));
  const filters = [`grayscale(${grayscale ? 1 : 0})`, `brightness(${amount})`];
  if (blurPx > 0) {
    filters.push(`blur(${blurPx}px)`);
  }
  try {
    context.filter = filters.join(' ');
  } catch {
    // Older engines ignore the filter; the original image remains usable.
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

/**
 * Loads and bakes grayscale/brightness/blur once, then reuses the result for both
 * the interactive stage and the export stage. Only a few slider variants are
 * kept so dragging a control cannot grow memory without bound.
 */
export function loadProcessedImage(
  source: string,
  grayscale: boolean,
  brightness: number,
  blur: number,
): Promise<HTMLCanvasElement> {
  const amount = Math.max(0.4, Math.min(1.6, brightness));
  const blurPx = Math.max(0, Math.min(8, blur));
  const variantKey = `${grayscale ? 'gray' : 'color'}:${amount.toFixed(2)}:blur${blurPx.toFixed(1)}`;

  let variants = processedCache.get(source);
  if (!variants) {
    variants = new Map();
    processedCache.set(source, variants);
    while (processedCache.size > MAX_CACHED_SOURCES) {
      const oldestSource = processedCache.keys().next().value;
      if (typeof oldestSource !== 'string') {
        break;
      }
      processedCache.delete(oldestSource);
    }
  }

  const cached = variants.get(variantKey);
  if (cached) {
    return cached.promise;
  }

  const promise = loadImageElement(source).then((image) =>
    buildProcessedImage(image, grayscale, amount, blurPx),
  );

  variants.set(variantKey, { promise });

  while (variants.size > MAX_VARIANTS_PER_SOURCE) {
    const oldest = variants.keys().next().value;
    if (typeof oldest !== 'string') {
      break;
    }
    variants.delete(oldest);
  }

  promise.catch(() => {
    const current = processedCache.get(source);
    current?.delete(variantKey);
    if (current && current.size === 0) {
      processedCache.delete(source);
    }
  });

  return promise;
}

/**
 * Returns the colour at the 95th luminance percentile of a processed photo.
 * The auto scrim uses this rather than the average so a bright sky or window
 * behind text cannot be hidden by a mostly dark frame.
 */
export function sampleImageLightness(image: HTMLCanvasElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = LIGHTNESS_SAMPLE_EDGE;
  canvas.height = LIGHTNESS_SAMPLE_EDGE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return '#121212';
  }

  context.drawImage(image, 0, 0, LIGHTNESS_SAMPLE_EDGE, LIGHTNESS_SAMPLE_EDGE);
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(
      0,
      0,
      LIGHTNESS_SAMPLE_EDGE,
      LIGHTNESS_SAMPLE_EDGE,
    ).data;
  } catch {
    return '#121212';
  }

  const samples: { r: number; g: number; b: number; luma: number }[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha < 16) {
      continue;
    }
    const r = pixels[index] ?? 0;
    const g = pixels[index + 1] ?? 0;
    const b = pixels[index + 2] ?? 0;
    samples.push({ r, g, b, luma: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }

  if (samples.length === 0) {
    return '#121212';
  }

  samples.sort((first, second) => first.luma - second.luma);
  const index = Math.min(samples.length - 1, Math.floor((samples.length - 1) * 0.95));
  const sample = samples[index];
  return rgbToHex(sample?.r ?? 0, sample?.g ?? 0, sample?.b ?? 0);
}
