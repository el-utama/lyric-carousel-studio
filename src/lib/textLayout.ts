export interface RichTextOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  lineHeight: number;
  maxWidth: number;
  maxLines?: number;
}

export interface RichTextWord {
  text: string;
  emphasis: boolean;
  x: number;
  y: number;
  width: number;
}

export interface RichTextLayout {
  words: RichTextWord[];
  lineCount: number;
  truncated: boolean;
}

interface StyledWord {
  text: string;
  emphasis: boolean;
}

interface PlacedWord extends StyledWord {
  x: number;
  width: number;
}

interface StyledSegment {
  text: string;
  emphasis: boolean;
}

function parseSegments(text: string): StyledSegment[] {
  const segments: StyledSegment[] = [];
  const pattern = /\*([^*]+)\*/g;
  let cursor = 0;
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index), emphasis: false });
    }
    segments.push({ text: match[1] ?? '', emphasis: true });
    cursor = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), emphasis: false });
  }

  return segments;
}

function toWords(text: string): StyledWord[] {
  const words: StyledWord[] = [];
  let buffer = '';
  let bufferEmphasis = false;

  const flush = (): void => {
    if (buffer.length > 0) {
      words.push({ text: buffer, emphasis: bufferEmphasis });
      buffer = '';
      bufferEmphasis = false;
    }
  };

  for (const segment of parseSegments(text)) {
    for (const character of segment.text) {
      if (/\s/.test(character)) {
        flush();
        continue;
      }
      // Punctuation that touches an emphasised phrase stays in the same token,
      // so it never gains an artificial space before it.
      bufferEmphasis = bufferEmphasis || segment.emphasis;
      buffer += character;
    }
  }

  flush();
  return words;
}

function fontString(italic: boolean, weight: number, size: number, family: string): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px "${family}", serif`;
}

export function layoutRichText(options: RichTextOptions): RichTextLayout {
  const { text, fontFamily, fontSize, fontWeight, italic, lineHeight, maxWidth } = options;
  const maxLines = options.maxLines ?? Number.POSITIVE_INFINITY;
  const words = toWords(text);

  if (words.length === 0) {
    return { words: [], lineCount: 0, truncated: false };
  }

  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return {
      words: [{ text: text.replace(/\*/g, ''), emphasis: false, x: 0, y: 0, width: maxWidth }],
      lineCount: 1,
      truncated: false,
    };
  }

  const widths = new Map<string, number>();

  const measure = (value: string, emphasis: boolean): number => {
    const key = `${emphasis ? 'i' : 'n'}:${value}`;
    const cached = widths.get(key);
    if (cached !== undefined) {
      return cached;
    }
    context.font = fontString(italic || emphasis, fontWeight, fontSize, fontFamily);
    const width = context.measureText(value).width;
    widths.set(key, width);
    return width;
  };

  const spaceWidth = measure(' ', false);
  const lines: PlacedWord[][] = [];
  let currentLine: PlacedWord[] = [];
  let cursorX = 0;

  for (const word of words) {
    const width = measure(word.text, word.emphasis);
    const occupies = currentLine.length > 0 ? spaceWidth + width : width;

    if (currentLine.length > 0 && cursorX + occupies > maxWidth) {
      lines.push(currentLine);
      currentLine = [];
      cursorX = 0;
    }

    const x = currentLine.length > 0 ? cursorX + spaceWidth : 0;
    currentLine.push({ ...word, x, width });
    cursorX = x + width;
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const lineHeightPx = fontSize * lineHeight;
  const visibleLines = lines.slice(0, Math.max(1, maxLines));
  const truncated = lines.length > visibleLines.length;

  if (truncated) {
    const lastLine = visibleLines[visibleLines.length - 1];
    if (lastLine && lastLine.length > 0) {
      const lastWord = lastLine[lastLine.length - 1];
      const ellipsisWidth = measure('…', false);
      if (lastWord) {
        let endX = lastWord.x + lastWord.width;
        if (endX + spaceWidth + ellipsisWidth > maxWidth && lastLine.length > 1) {
          lastLine.pop();
          const previous = lastLine[lastLine.length - 1];
          endX = previous ? previous.x + previous.width : 0;
        }
        lastLine.push({
          text: '…',
          emphasis: false,
          x: endX + spaceWidth,
          width: ellipsisWidth,
        });
      }
    }
  }

  const placed: RichTextWord[] = [];
  visibleLines.forEach((line, lineIndex) => {
    for (const word of line) {
      placed.push({ ...word, y: lineIndex * lineHeightPx });
    }
  });

  return { words: placed, lineCount: visibleLines.length, truncated };
}
