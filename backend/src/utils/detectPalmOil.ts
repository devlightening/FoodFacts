const PALM_OIL_KEYWORDS = ['palm oil', 'palm', 'huile de palme', 'palmiye yağı', 'palm yağı'];
const PALM_FREE_KEYWORDS = ['palm-oil-free', 'without-palm-oil', 'no-palm-oil'];

export function detectPalmOil(input: {
  ingredientsText?: string;
  dietaryTags?: string[];
  labels?: string[];
}): 'detected' | 'not-detected' | 'unknown' {
  const hasAnyData =
    Boolean(input.ingredientsText?.trim()) ||
    Boolean(input.dietaryTags?.length) ||
    Boolean(input.labels?.length);

  if (!hasAnyData) {
    return 'unknown';
  }

  const tags = [...(input.dietaryTags ?? []), ...(input.labels ?? [])].map((tag) => tag.toLowerCase());
  const hasPalmFree = tags.some((tag) => PALM_FREE_KEYWORDS.some((keyword) => tag.includes(keyword)));
  const searchableTags = tags.filter(
    (tag) =>
      !PALM_FREE_KEYWORDS.some((keyword) => tag.includes(keyword)) &&
      !tag.includes('palm-oil-content-unknown') &&
      !tag.includes('palm-oil-status-unknown'),
  );
  const haystack = [input.ingredientsText, searchableTags.join(' ')]
    .join(' ')
    .toLocaleLowerCase('tr-TR');

  if (PALM_OIL_KEYWORDS.some((keyword) => haystack.includes(keyword.toLocaleLowerCase('tr-TR')))) {
    return 'detected';
  }

  return hasPalmFree || input.ingredientsText ? 'not-detected' : 'unknown';
}
