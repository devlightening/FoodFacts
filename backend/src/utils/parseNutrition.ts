import type { NutritionInfo } from '../models/NutritionInfo.js';

export function hasNutrition(nutrition: NutritionInfo | undefined): boolean {
  if (!nutrition) {
    return false;
  }

  return Object.values(nutrition).some((value) => typeof value === 'number' && Number.isFinite(value));
}

export function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}
