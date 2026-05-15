import type { NutritionInfo } from '../models/NutritionInfo.js';
import type { SourceProductResult } from '../models/SourceProductResult.js';
import { normalizeText } from '../utils/normalizeText.js';
import { parseNumber } from '../utils/parseNutrition.js';
import type { ProductSourceAdapter } from './ProductSourceAdapter.js';

const API_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'brands',
  'image_front_url',
  'nutriments',
  'ingredients_text',
  'ingredients_analysis_tags',
  'allergens_tags',
  'additives_tags',
  'nutriscore_grade',
  'nova_group',
  'labels_tags',
  'categories_tags',
];

type OpenFoodFactsResponse = {
  status?: number;
  product?: OpenFoodFactsProduct;
};

type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  nutriments?: Record<string, unknown>;
  ingredients_text?: string;
  ingredients_analysis_tags?: unknown;
  allergens_tags?: unknown;
  additives_tags?: unknown;
  nutriscore_grade?: string;
  nova_group?: unknown;
  labels_tags?: unknown;
  categories_tags?: unknown;
};

export class OpenFoodFactsSource implements ProductSourceAdapter {
  name = 'Open Food Facts';

  async searchByBarcode(barcode: string): Promise<SourceProductResult | null> {
    const url = `${API_BASE_URL}/${encodeURIComponent(barcode)}.json?fields=${PRODUCT_FIELDS.join(',')}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FoodFactsBackend/1.0 (contact: local-mvp)',
      },
    });

    if (!response.ok) {
      throw new Error(`Open Food Facts returned ${response.status}`);
    }

    const data = (await response.json()) as OpenFoodFactsResponse;

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    const result: SourceProductResult = {
      sourceName: this.name,
      barcode: normalizeText(product.code) ?? barcode,
      productName: normalizeText(product.product_name),
      brand: pickFirstBrand(product.brands),
      imageUrl: normalizeText(product.image_front_url),
      ingredientsText: normalizeText(product.ingredients_text),
      nutrition: mapNutrition(product.nutriments),
      allergens: toStringArray(product.allergens_tags),
      additives: toStringArray(product.additives_tags),
      nutriScore: normalizeText(product.nutriscore_grade)?.toLowerCase(),
      novaGroup: parseNumber(product.nova_group),
      dietaryTags: toStringArray(product.ingredients_analysis_tags),
      labels: toStringArray(product.labels_tags),
      categories: toStringArray(product.categories_tags),
      productUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`,
      confidence: 0.92,
    };

    return result;
  }
}

function mapNutrition(nutriments: Record<string, unknown> | undefined): NutritionInfo | undefined {
  if (!nutriments) {
    return undefined;
  }

  const nutrition: NutritionInfo = {
    energyKcal100g: parseNumber(nutriments['energy-kcal_100g']),
    fat100g: parseNumber(nutriments.fat_100g),
    saturatedFat100g: parseNumber(nutriments['saturated-fat_100g']),
    carbohydrates100g: parseNumber(nutriments.carbohydrates_100g),
    sugars100g: parseNumber(nutriments.sugars_100g),
    fiber100g: parseNumber(nutriments.fiber_100g),
    proteins100g: parseNumber(nutriments.proteins_100g),
    salt100g: parseNumber(nutriments.salt_100g),
  };

  return Object.values(nutrition).some((value) => value !== undefined) ? nutrition : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickFirstBrand(brands: string | undefined): string | undefined {
  return brands
    ?.split(',')
    .map((brand) => normalizeText(brand))
    .find((brand): brand is string => Boolean(brand));
}
