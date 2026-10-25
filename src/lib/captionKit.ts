export type PromoPlatform = 'instagram' | 'facebook' | 'tiktok';

export interface PromoKit {
  platform: PromoPlatform;
  title: string;
  caption: string;
  description: string;
  hashtags: string[];
}

const trimTo = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;

const hashtagLimit = (platform: PromoPlatform): number =>
  platform === 'instagram' ? 15 : platform === 'facebook' ? 5 : 10;

const platformTitle = (platform: PromoPlatform): string => {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'facebook':
      return 'Facebook';
    case 'tiktok':
      return 'TikTok';
    default:
      return platform;
  }
};

/* Mood-based tag defaults (Quick Edit, tidak perlu riset web real-time).
 * Setiap mood berisi tag luas + tag niche yang relatable. */
const MOOD_TAGS: Record<string, string[]> = {
  senja: ['#senja', '#laguberasa', '#moodlagu', '#musikindonesia', '#indiemusik', '#relatable', '#hitsdifferent', '#laguku', '#senjatemu', '#playlistpribadi'],
  rindu: ['#rindu', '#laguberasa', '#moodlagu', '#musikindonesia', '#indiemusik', '#memori', '#kenangan', '#hitsdifferent', '#senja', '#laguku'],
  kecewa: ['#kecewa', '#laguberasa', '#moodlagu', '#musikindonesia', '#indiemusik', '#patah hati', '#menyesal', '#hitsdifferent', '#senja', '#laguku'],
  refleksi: ['#refleksi', '#laguberasa', '#moodlagu', '#musikindonesia', '#indiemusik', '#hati', '#senja', '#hitsdifferent', '#laguku', '#senyum'],
  senang: ['#senang', '#laguberasa', '#moodlagu', '#musikindonesia', '#indiemusik', '#cerita', '#hitsdifferent', '#senja', '#laguku', '#musik'],
  malam: ['#malam', '#laguberasa', '#moodlagu', '#musikindonesia', '#indiemusik', '#senja', '#hitsdifferent', '#laguku', '#duduk sendirian', '#musik'],
  umum: ['#musikindonesia', '#laguberasa', '#moodlagu', '#indiemusik', '#hitsdifferent', '#laguku', '#senja', '#relatable', '#musik', '#playlist'],
};

function detectMood(lyrics: string, caption: string): string {
  const text = `${lyrics} ${caption}`.toLowerCase();
  const moodKeywords: Record<string, string[]> = {
    senja: ['senja', 'sunset', 'dusk', 'evening', 'malam', 'night'],
    rindu: ['rindu', 'miss', 'longing', 'kenangan', 'memory', 'ingat'],
    kecewa: ['kecewa', 'disappoint', 'heartbreak', 'patah', 'hurt', 'sakit', 'luka'],
    refleksi: ['refleksi', 'reflect', 'think', 'pikiran', 'hati', 'heart'],
    senang: ['senang', 'happy', 'senyum', 'smile', 'ceria', 'cerita'],
    malam: ['malam', 'night', 'midnight', 'jam dua', 'duduk'],
  };
  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return mood;
    }
  }
  return 'umum';
}

function pickTags(
  baseHashtags: string[],
  mood: string,
  platform: PromoPlatform,
): string[] {
  const moodTags: string[] = (MOOD_TAGS[mood] ?? MOOD_TAGS.umum) as string[];
  const limit = hashtagLimit(platform);

  const seen = new Set<string>();
  const result: string[] = [];

  // Prioritize base hashtags from LLM first.
  for (const tag of baseHashtags) {
    const clean = tag.replace(/^#+/, '').toLowerCase();
    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(`#${clean}`);
      if (result.length >= limit) {
        return result;
      }
    }
  }

  // Fill remaining with mood tags.
  for (const tag of moodTags) {
    const clean = tag.replace(/^#+/, '').toLowerCase();
    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(`#${clean}`);
      if (result.length >= limit) {
        return result;
      }
    }
  }

  return result;
}

export function formatPromoKit(
  baseCaption: string,
  baseHashtags: string[],
  title: string,
  artist: string,
  lyrics: string,
): Record<PromoPlatform, PromoKit> {
  const mood = detectMood(lyrics, baseCaption);
  const songCredit = title ? `${title} — ${artist}` : artist;

  const kits: Record<PromoPlatform, PromoKit> = {
    instagram: {
      platform: 'instagram',
      title: trimTo(`${title} · ${artist}`, 100),
      caption: baseCaption,
      description: baseCaption,
      hashtags: pickTags(baseHashtags, mood, 'instagram'),
    },
    facebook: {
      platform: 'facebook',
      title: trimTo(`${title} — ${artist}`, 100),
      caption: `${baseCaption}\n\n${songCredit}`,
      description: `${baseCaption}\n\n${songCredit}`,
      hashtags: pickTags(baseHashtags, mood, 'facebook'),
    },
    tiktok: {
      platform: 'tiktok',
      title: trimTo(`${title} · ${artist}`, 80),
      caption: baseCaption.split('.').slice(0, 2).join('. ') || baseCaption,
      description: baseCaption,
      hashtags: pickTags(baseHashtags, mood, 'tiktok'),
    },
  };

  return kits;
}

export function formatHashtagString(hashtags: string[]): string {
  return hashtags.join(' ');
}

export function platformDisplayName(platform: PromoPlatform): string {
  return platformTitle(platform);
}
