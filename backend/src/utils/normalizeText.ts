export function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);

    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase('tr-TR');

    if (!seen.has(key)) {
      seen.add(key);
      output.push(normalized);
    }
  }

  return output;
}
