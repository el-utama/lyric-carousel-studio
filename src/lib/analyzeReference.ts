import { hexToRgb, rgbToHex } from './color';
import type {
  LightingAnalysis,
  LightingContrast,
  LightingTemperature,
  ReferenceAnalysis,
} from './types';

const MAX_PREVIEW_EDGE = 900;
const ANALYSIS_EDGE = 144;
const PALETTE_SIZE = 6;

interface Sample {
  r: number;
  g: number;
  b: number;
  x: number;
  y: number;
  luma: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gambar tidak dapat dibaca.'));
      }
    };
    reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gambar referensi gagal dimuat.'));
    image.src = source;
  });
}

export async function fileToPreviewDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar.');
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest === 0) {
    throw new Error('Gambar tidak memiliki ukuran yang valid.');
  }

  const scale = Math.min(1, MAX_PREVIEW_EDGE / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Kanvas tidak tersedia untuk membaca gambar.');
  }

  // A dark base keeps transparent PNGs inside the editorial palette.
  context.fillStyle = '#121212';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.84);
}

function collectSamples(image: HTMLImageElement): Sample[] {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(1, longest));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Kanvas tidak tersedia untuk analisis.');
  }

  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const samples: Sample[] = [];
  const step = width * height > 12_000 ? 2 : 1;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 255;
      if (alpha < 24) {
        continue;
      }
      samples.push({
        r,
        g,
        b,
        x: width > 1 ? x / (width - 1) : 0.5,
        y: height > 1 ? y / (height - 1) : 0.5,
        luma: 0.2126 * r + 0.7152 * g + 0.0722 * b,
      });
    }
  }

  return samples;
}

function luminanceOf(color: Rgb): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function distanceSquared(first: Rgb, second: Rgb): number {
  const dr = first.r - second.r;
  const dg = first.g - second.g;
  const db = first.b - second.b;
  return dr * dr + dg * dg + db * db;
}

function initialCentroids(samples: Sample[], count: number): Rgb[] {
  if (samples.length === 0) {
    return [];
  }

  let darkest = samples[0] as Sample;
  for (const sample of samples) {
    if (sample.luma < darkest.luma) {
      darkest = sample;
    }
  }

  const centroids: Rgb[] = [{ r: darkest.r, g: darkest.g, b: darkest.b }];
  const minimumDistances = samples.map((sample) =>
    distanceSquared(
      { r: sample.r, g: sample.g, b: sample.b },
      { r: darkest.r, g: darkest.g, b: darkest.b },
    ),
  );

  while (centroids.length < count) {
    let farthestIndex = 0;
    for (let index = 1; index < samples.length; index += 1) {
      if ((minimumDistances[index] ?? 0) > (minimumDistances[farthestIndex] ?? 0)) {
        farthestIndex = index;
      }
    }
    const sample = samples[farthestIndex];
    if (!sample) {
      break;
    }
    const centroid = { r: sample.r, g: sample.g, b: sample.b };
    centroids.push(centroid);
    samples.forEach((candidate, index) => {
      const distance = distanceSquared(
        { r: candidate.r, g: candidate.g, b: candidate.b },
        centroid,
      );
      if (distance < (minimumDistances[index] ?? Number.POSITIVE_INFINITY)) {
        minimumDistances[index] = distance;
      }
    });
  }

  return centroids;
}

function kMeans(samples: Sample[], count: number): Rgb[] {
  const centroids = initialCentroids(samples, count);
  if (centroids.length === 0) {
    return [];
  }

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const sample of samples) {
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < centroids.length; index += 1) {
        const centroid = centroids[index];
        if (!centroid) {
          continue;
        }
        const distance = distanceSquared({ r: sample.r, g: sample.g, b: sample.b }, centroid);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      }

      const bucket = sums[nearest];
      if (bucket) {
        bucket.r += sample.r;
        bucket.g += sample.g;
        bucket.b += sample.b;
        bucket.count += 1;
      }
    }

    sums.forEach((bucket, index) => {
      if (bucket.count === 0) {
        return;
      }
      const centroid = centroids[index];
      if (centroid) {
        centroid.r = bucket.r / bucket.count;
        centroid.g = bucket.g / bucket.count;
        centroid.b = bucket.b / bucket.count;
      }
    });
  }

  return centroids.sort((first, second) => luminanceOf(first) - luminanceOf(second));
}

function padPalette(palette: string[]): string[] {
  const unique = [...new Set(palette.map((color) => color.toUpperCase()))];
  let cursor = 0;

  while (unique.length < PALETTE_SIZE && cursor < 32) {
    const source = unique[cursor % Math.max(1, unique.length)];
    const rgb = source ? hexToRgb(source) : null;
    if (rgb) {
      const amount = 0.12 + (cursor % 4) * 0.06;
      const target = cursor % 2 === 0 ? 255 : 0;
      const mixed = rgbToHex(
        rgb.r + (target - rgb.r) * amount,
        rgb.g + (target - rgb.g) * amount,
        rgb.b + (target - rgb.b) * amount,
      );
      if (!unique.includes(mixed)) {
        unique.push(mixed);
      }
    }
    cursor += 1;
  }

  return unique.slice(0, PALETTE_SIZE);
}

function contrastLabel(deviation: number): LightingContrast {
  if (deviation < 26) {
    return 'rendah';
  }
  if (deviation < 55) {
    return 'sedang';
  }
  return 'tinggi';
}

function temperatureLabel(warmth: number): LightingTemperature {
  if (warmth > 6) {
    return 'hangat';
  }
  if (warmth < -6) {
    return 'dingin';
  }
  return 'netral';
}

function directionLabel(horizontal: number, vertical: number): string {
  const parts: string[] = [];
  if (horizontal < -0.055) {
    parts.push('kiri');
  } else if (horizontal > 0.055) {
    parts.push('kanan');
  }
  if (vertical < -0.055) {
    parts.push('atas');
  } else if (vertical > 0.055) {
    parts.push('bawah');
  }
  return parts.length > 0 ? parts.join(' ') : 'menyebar';
}

function moodLabel(contrast: LightingContrast, temperature: LightingTemperature): string {
  if (contrast === 'tinggi' && temperature === 'hangat') {
    return 'dramatis dan hangat';
  }
  if (contrast === 'tinggi' && temperature === 'dingin') {
    return 'tegas dan sejuk';
  }
  if (contrast === 'rendah') {
    return 'lembut dan tenang';
  }
  if (temperature === 'hangat') {
    return 'intim dan hangat';
  }
  if (temperature === 'dingin') {
    return 'tenang dan sejuk';
  }
  return 'seimbang dan tenang';
}

function analyseLighting(samples: Sample[]): LightingAnalysis {
  const count = Math.max(1, samples.length);
  const meanLuma = samples.reduce((total, sample) => total + sample.luma, 0) / count;
  const variance =
    samples.reduce((total, sample) => total + (sample.luma - meanLuma) ** 2, 0) / count;
  const deviation = Math.sqrt(variance);
  const meanRed = samples.reduce((total, sample) => total + sample.r, 0) / count;
  const meanBlue = samples.reduce((total, sample) => total + sample.b, 0) / count;
  const warmth = meanRed - meanBlue;

  const brightThreshold = meanLuma + Math.max(10, deviation * 0.7);
  const brightSamples = samples.filter((sample) => sample.luma >= brightThreshold);
  const lightPool = brightSamples.length >= Math.min(24, samples.length * 0.04)
    ? brightSamples
    : [...samples].sort((first, second) => second.luma - first.luma).slice(0, Math.max(1, Math.round(samples.length * 0.1)));

  const lightCount = Math.max(1, lightPool.length);
  const meanX = lightPool.reduce((total, sample) => total + sample.x, 0) / lightCount;
  const meanY = lightPool.reduce((total, sample) => total + sample.y, 0) / lightCount;

  const contrast = contrastLabel(deviation);
  const temperature = temperatureLabel(warmth);
  const direction = directionLabel(meanX - 0.5, meanY - 0.5);
  const mood = moodLabel(contrast, temperature);

  return {
    keyDirection: direction,
    contrast,
    temperature,
    mood,
    summary: `Cahaya dominan dari ${direction}, kontras ${contrast}, nuansa ${temperature}. Suasana ${mood}.`,
  };
}

export async function analyzeReferenceImages(sources: string[]): Promise<ReferenceAnalysis> {
  if (sources.length === 0) {
    throw new Error('Tambahkan minimal satu gambar referensi.');
  }

  const images = await Promise.all(sources.map((source) => loadImage(source)));
  const samples = images.flatMap((image) => collectSamples(image));
  if (samples.length === 0) {
    throw new Error('Tidak ada piksel yang bisa dianalisis.');
  }

  const palette = padPalette(
    kMeans(samples, PALETTE_SIZE).map((color) =>
      rgbToHex(color.r, color.g, color.b),
    ),
  );

  return {
    palette,
    lighting: analyseLighting(samples),
    sourceCount: sources.length,
  };
}
