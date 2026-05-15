import { normalizeText } from './normalizeText.js';

export function parseIngredients(value: string | undefined): string | undefined {
  return normalizeText(value);
}
