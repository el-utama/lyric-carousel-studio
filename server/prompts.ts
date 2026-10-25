import type { HookAngle, Platform } from '../src/lib/types';

export const HOOK_ANGLE_ORDER: HookAngle[] = [
  'curiosity',
  'relatable',
  'contrast',
  'strongest_line',
  'confession',
];

export const HOOK_ANGLE_BRIEFS: Record<HookAngle, string> = {
  curiosity: 'a question or half-reveal that makes the reader need the next slide',
  relatable: 'a plain, personal truth that sounds like the reader could have written it',
  contrast: 'a quiet surprise or contradiction between two ideas',
  strongest_line: 'lean on the strongest existing fragment of the supplied material',
  confession: 'a first-person admission, intimate but never melodramatic',
};

const PLATFORM_BRIEFS: Record<Platform, string> = {
  tiktok: 'TikTok, where the first line has to stop a fast scroll',
  reels: 'Instagram Reels, where the tone should feel curated and personal',
  shorts: 'YouTube Shorts, where the opening needs a clear emotional promise',
};

export interface CarouselPromptInput {
  title: string;
  artist: string;
  lyrics: string;
  languageLabel: string;
  languageCode: 'en' | 'id' | 'mixed' | 'other';
  platform: Platform;
}

export function buildSystemPrompt(): string {
  return [
    'You are the editorial lead for a quiet, cinematic music carousel.',
    'The result should read like a page from an independent music journal: restrained, intimate and confident.',
    'You write short copy, not advertising. You never use emoji, stickers, hype, exclamation marks or sales language.',
    'You treat the supplied material as the only source of truth and never invent another writer\'s words.',
    'You return only one valid JSON object. No commentary, no markdown fence, no trailing text.',
  ].join(' ');
}

export function buildCarouselPrompt(input: CarouselPromptInput): string {
  const languageRule =
    input.languageCode === 'other'
      ? `Write everything in ${input.languageLabel}. Do not switch to English or Indonesian unless the supplied material already uses it.`
      : input.languageCode === 'mixed'
      ? `Write in a natural mix of English and Indonesian (code-switching). Use English for short emotional punches and Indonesian for context, like everyday social captions. Do not translate word for word. Do not make it sound formal, robotic, or AI-generated. Keep it casual, elegant, and marketable. The hooks, slide copy, caption and labels should feel like a real person writing a personal note.`
      : `Write everything in ${input.languageLabel}. Do not translate the supplied material into another language. The hooks, slide copy, caption and labels must all stay in ${input.languageLabel}.`;

  return [
    'Create one four-page editorial music carousel and a short social caption.',
    '',
    `Song: ${input.title || '(untitled)'}`,
    `Artist: ${input.artist || '(unknown)'}`,
    `Publishing platform: ${PLATFORM_BRIEFS[input.platform]}.`,
    `Output language: ${input.languageLabel}.`,
    '',
    'Supplied material (lyrics or notes):',
    '"""',
    input.lyrics,
    '"""',
    '',
    languageRule,
    '',
    'Return exactly this JSON shape:',
    '{',
    '  "language": "the output language name",',
    '  "hooks": [',
    '    { "angle": "curiosity", "text": "..." },',
    '    { "angle": "relatable", "text": "..." },',
    '    { "angle": "contrast", "text": "..." },',
    '    { "angle": "strongest_line", "text": "..." },',
    '    { "angle": "confession", "text": "..." }',
    '  ],',
    '  "slides": [',
    '    { "role": "hook", "header": "...", "marker": "01 // ...", "quote": "...", "body": "...", "footer": "..." },',
    '    { "role": "verse", "header": "...", "marker": "02 // ...", "quote": "...", "body": "...", "footer": "..." },',
    '    { "role": "chorus", "header": "...", "marker": "03 // ...", "quote": "...", "body": "...", "footer": "..." },',
    '    { "role": "outro", "header": "...", "marker": "04 // ...", "quote": "...", "body": "...", "footer": "..." }',
    '  ],',
    '  "caption": "...",',
    '  "hashtags": ["#...", "#..."]',
    '}',
    '',
    'Copy rules:',
    '1. The five hooks follow the angles in this order: curiosity, relatable, contrast, strongest_line, confession. Each hook is at most 14 words. No numbering inside the text.',
    '2. Each hook may wrap one key phrase in *asterisks*; never use asterisks anywhere else.',
    '3. The four slides follow the arc: hook (opening provocation), verse (build-up), chorus (emotional payoff), outro (soft invitation to save or listen again).',
    '4. Slide headers are short editorial titles in capitals, one to four words, specific to this song. Never use a generic label that names the content format, such as an excerpt, passage, lyric sheet or quotation.',
    '5. Slide markers look like "01 // Reflection" or "03 // Payoff"; the short phrase after the slash is in the output language and fits the moment.',
    '6. A quote is at most 22 words and at most five lines at 1000px width. Use at most one or two short original fragments per slide; paraphrase or reflect for the rest. Wrap the single strongest phrase in *asterisks*.',
    '7. A body line is at most 160 characters. It should add a quiet thought, not summarise the quote.',
    '8. Footers are short uppercase swipe cues in the output language. Leave the outro footer empty; the app adds the song credit.',
    '9. The caption is two to four sentences, written like a private note someone saves for a friend. It names the feeling before the song. No calls to buy, stream or follow.',
    '10. Provide four to six lowercase hashtags, each starting with #, specific to the song and the feeling. No repeated tags.',
    '11. Keep one language across the whole carousel. Song titles and artist names may stay in their original form.',
    '12. Never mention that the text was generated or that it is a carousel template.',
    '',
    'Output only the JSON object.',
  ].join('\n');
}

export interface HookPromptInput extends CarouselPromptInput {
  angle: HookAngle;
  avoid: string[];
}

export function buildHookPrompt(input: HookPromptInput): string {
  return [
    'Write one fresh alternative hook for an editorial music carousel.',
    '',
    `Song: ${input.title || '(untitled)'}`,
    `Artist: ${input.artist || '(unknown)'}`,
    `Publishing platform: ${PLATFORM_BRIEFS[input.platform]}.`,
    `Output language: ${input.languageLabel}.`,
    `Required angle: ${input.angle} — ${HOOK_ANGLE_BRIEFS[input.angle]}.`,
    '',
    'Supplied material:',
    '"""',
    input.lyrics,
    '"""',
    '',
    'Avoid repeating these existing hooks:',
    ...(input.avoid.length > 0 ? input.avoid.map((hook) => `- ${hook}`) : ['- none']),
    '',
    'Return exactly this JSON shape:',
    '{ "language": "the output language name", "hook": { "angle": "...", "text": "..." } }',
    '',
    'Rules: at most 14 words, one clear angle, no numbering, no emoji, no quotation marks around the line. You may wrap one key phrase in *asterisks*. Stay in the requested output language.',
    'Output only the JSON object.',
  ].join('\n');
}

export function buildLanguageCorrectionPrompt(expectedLabel: string): string {
  return `The previous attempt did not stay in ${expectedLabel}. Rewrite every hook, slide label, quote, body, footer, caption and hashtag in ${expectedLabel}. Keep the same JSON shape and all length rules. Return only the JSON object.`;
}

export function buildVisionPrompt(): string {
  return [
    'You are a visual editor for a quiet, cinematic music carousel.',
    'Study the supplied reference photographs only for palette and lighting. Do not describe people, brands, text or private details.',
    'Write in Bahasa Indonesia, with the calm precision of an art director.',
    '',
    'Return exactly this JSON shape:',
    '{',
    '  "description": "two or three sentences about the light, shadow and colour temperature, and how they would translate into an editorial page",',
    '  "palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],',
    '  "lighting": "one short sentence naming the dominant light direction and contrast"',
    '}',
    '',
    'Rules: five colours maximum, each a valid six-digit hex value sampled from the images. No markdown, no emoji, no extra keys. Output only the JSON object.',
  ].join('\n');
}
