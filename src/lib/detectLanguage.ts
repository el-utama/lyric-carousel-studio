import type { LanguageMode, LanguageSelection } from './types';

export type DetectedLanguage = 'en' | 'id' | 'unknown';

export interface LanguageDetection {
  language: DetectedLanguage;
  /** 0..1, higher means the winning language is clearly ahead. */
  confidence: number;
  enMatches: number;
  idMatches: number;
  words: number;
}

const ENGLISH_WORDS = new Set([
  'the', 'and', 'you', 'that', 'was', 'for', 'are', 'with', 'his', 'her', 'they', 'this',
  'have', 'from', 'one', 'had', 'word', 'but', 'not', 'what', 'all', 'were', 'when', 'your',
  'can', 'said', 'there', 'use', 'each', 'which', 'she', 'how', 'their', 'will', 'other',
  'about', 'out', 'them', 'then', 'these', 'some', 'would', 'make', 'like', 'into', 'him',
  'has', 'two', 'more', 'write', 'see', 'number', 'way', 'could', 'people', 'than', 'first',
  'water', 'been', 'call', 'who', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get',
  'come', 'made', 'may', 'part', 'over', 'new', 'sound', 'take', 'only', 'little', 'work',
  'know', 'place', 'year', 'live', 'me', 'back', 'give', 'most', 'very', 'after', 'thing',
  'our', 'just', 'name', 'good', 'sentence', 'man', 'think', 'say', 'great', 'where', 'help',
  'through', 'much', 'before', 'line', 'right', 'too', 'mean', 'old', 'any', 'same', 'tell',
  'boy', 'follow', 'came', 'want', 'show', 'also', 'around', 'form', 'three', 'small', 'set',
  'put', 'end', 'does', 'another', 'well', 'large', 'must', 'big', 'even', 'such', 'because',
  'turn', 'here', 'why', 'ask', 'went', 'men', 'read', 'need', 'land', 'different', 'home',
  'us', 'move', 'try', 'kind', 'hand', 'picture', 'again', 'change', 'off', 'play', 'spell',
  'air', 'away', 'animal', 'house', 'point', 'page', 'letter', 'mother', 'answer', 'found',
  'study', 'still', 'learn', 'should', 'world', 'high', 'every', 'near', 'add', 'food',
  'between', 'own', 'below', 'country', 'plant', 'last', 'school', 'father', 'keep', 'tree',
  'never', 'start', 'city', 'earth', 'eye', 'light', 'thought', 'head', 'under', 'story',
  'saw', 'left', 'few', 'while', 'along', 'might', 'close', 'something', 'seem', 'next',
  'hard', 'open', 'example', 'begin', 'life', 'always', 'those', 'both', 'paper', 'together',
  'got', 'group', 'often', 'run', 'important', 'until', 'children', 'side', 'feet', 'car',
  'mile', 'night', 'walk', 'white', 'sea', 'began', 'grow', 'took', 'river', 'four', 'carry',
  'state', 'once', 'book', 'hear', 'stop', 'without', 'second', 'later', 'miss', 'idea',
  'enough', 'eat', 'face', 'watch', 'far', 'really', 'almost', 'let', 'above', 'girl',
  'sometimes', 'mountain', 'cut', 'young', 'talk', 'soon', 'list', 'song', 'being', 'leave',
  'family', 'love', 'heart', 'feel', 'feeling', 'stay', 'gone', 'hold', 'fall', 'wait',
  'broken', 'loud', 'quiet', 'cold', 'warm', 'skin', 'bone', 'ghost', 'memory', 'dream',
  'wake', 'sleep', 'breathe', 'oh', 'yeah', 'cause', 'ain', 'gonna', 'wanna', 'gotta',
]);

const INDONESIAN_WORDS = new Set([
  'yang', 'dan', 'di', 'itu', 'ini', 'aku', 'kamu', 'tidak', 'tak', 'untuk', 'dengan',
  'cinta', 'hati', 'kita', 'mereka', 'ada', 'sudah', 'akan', 'bisa', 'saat', 'karena',
  'jadi', 'kalau', 'tapi', 'selalu', 'pernah', 'jangan', 'rindu', 'dari', 'ke', 'pada',
  'dalam', 'juga', 'saja', 'hanya', 'masih', 'belum', 'harus', 'ingin', 'mau', 'lagi',
  'bagaimana', 'kenapa', 'siapa', 'kapan', 'dimana', 'kemana', 'apa', 'apakah', 'nya',
  'ku', 'kau', 'kita', 'kalian', 'dia', 'ia', 'oleh', 'seperti', 'sebagai', 'antara',
  'tanpa', 'sampai', 'sejak', 'setelah', 'sebelum', 'ketika', 'sementara', 'namun',
  'tetapi', 'meskipun', 'walaupun', 'bahwa', 'agar', 'supaya', 'atau', 'bukan', 'adalah',
  'ialah', 'merupakan', 'menjadi', 'membuat', 'melihat', 'mendengar', 'merasa', 'tahu',
  'ingat', 'lupa', 'pergi', 'pulang', 'datang', 'tinggal', 'menunggu', 'mencari', 'temukan',
  'hilang', 'jatuh', 'bangun', 'tidur', 'berdiri', 'berjalan', 'berlari', 'menangis',
  'tersenyum', 'tertawa', 'bisik', 'suara', 'lagu', 'kisah', 'cerita', 'waktu', 'masa',
  'hari', 'malam', 'pagi', 'senja', 'bulan', 'bintang', 'langit', 'laut', 'hujan', 'angin',
  'api', 'cahaya', 'gelap', 'terang', 'dingin', 'hangat', 'manis', 'pahit', 'sakit', 'luka',
  'bekas', 'kenangan', 'mimpi', 'nyata', 'dunia', 'rumah', 'jalan', 'kota', 'tempat',
  'orang', 'teman', 'keluarga', 'ibu', 'ayah', 'anak', 'perasaan', 'sayang', 'benci',
  'maaf', 'terima', 'kasih', 'tolong', 'boleh', 'mungkin', 'pasti', 'sungguh', 'sangat',
  'terlalu', 'lebih', 'kurang', 'paling', 'semua', 'setiap', 'beberapa', 'banyak', 'sedikit',
  'satu', 'dua', 'tiga', 'kecil', 'besar', 'panjang', 'pendek', 'jauh', 'dekat', 'dalam',
  'luar', 'atas', 'bawah', 'depan', 'belakang', 'kiri', 'kanan', 'sini', 'sana', 'begitu',
  'sering', 'jarang', 'sekarang', 'nanti', 'kemarin', 'besok', 'dulu', 'baru', 'lama',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

export function detectLanguage(text: string): LanguageDetection {
  const words = tokenize(text);
  let enMatches = 0;
  let idMatches = 0;

  for (const word of words) {
    const normalized = word.replace(/^'+|'+$/g, '');
    if (ENGLISH_WORDS.has(normalized)) {
      enMatches += 1;
    }
    if (INDONESIAN_WORDS.has(normalized)) {
      idMatches += 1;
    }
  }

  if (words.length === 0 || enMatches + idMatches < 2) {
    return { language: 'unknown', confidence: 0, enMatches, idMatches, words: words.length };
  }

  const total = enMatches + idMatches;
  const difference = Math.abs(enMatches - idMatches);
  const confidence = difference / total;

  if (difference < 2 || confidence < 0.15) {
    return { language: 'unknown', confidence, enMatches, idMatches, words: words.length };
  }

  return {
    language: enMatches > idMatches ? 'en' : 'id',
    confidence,
    enMatches,
    idMatches,
    words: words.length,
  };
}

/** True when the copy clearly belongs to a different language than requested. */
export function contradictsLanguage(text: string, expected: 'en' | 'id'): boolean {
  const detection = detectLanguage(text);
  if (detection.language === 'unknown' || detection.language === expected) {
    return false;
  }
  return detection.confidence >= 0.2 && detection.enMatches + detection.idMatches >= 4;
}

export interface ResolvedLanguage {
  code: 'en' | 'id' | 'mixed' | 'other';
  /** Human label sent to the model and shown in the editor. */
  label: string;
  source: 'explicit' | 'detected' | 'undetermined';
}

const LANGUAGE_LABELS: Record<'en' | 'id' | 'mixed', string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
  mixed: 'Campuran EN–ID',
};

export function resolveLanguage(
  lyrics: string,
  selection: LanguageSelection,
): ResolvedLanguage {
  if (selection.mode === 'en' || selection.mode === 'id' || selection.mode === 'mixed') {
    return { code: selection.mode, label: LANGUAGE_LABELS[selection.mode], source: 'explicit' };
  }

  if (selection.mode === 'other') {
    const label = selection.other?.trim();
    return {
      code: 'other',
      label: label && label.length > 0 ? label : 'the language of the supplied material',
      source: 'explicit',
    };
  }

  const detection = detectLanguage(lyrics);
  if (detection.language === 'en' || detection.language === 'id') {
    return {
      code: detection.language,
      label: LANGUAGE_LABELS[detection.language],
      source: 'detected',
    };
  }

  return {
    code: 'other',
    label: 'the language of the supplied material',
    source: 'undetermined',
  };
}

export function languageModeLabel(mode: LanguageMode): string {
  switch (mode) {
    case 'auto':
      return 'Auto';
    case 'en':
      return 'English';
    case 'id':
      return 'Bahasa Indonesia';
    case 'mixed':
      return 'Campuran EN–ID';
    case 'other':
      return 'Lainnya';
    default:
      return 'Auto';
  }
}
