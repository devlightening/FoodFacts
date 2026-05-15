import type { NutritionInfo } from './NutritionInfo.js';

export type SourceProductResult = {
  sourceName: string;
  barcode: string;
  productName?: string;
  brand?: string;
  imageUrl?: string;
  ingredientsText?: string;
  nutrition?: NutritionInfo;
  allergens?: string[];
  additives?: string[];
  nutriScore?: string;
  novaGroup?: number;
  dietaryTags?: string[];
  labels?: string[];
  categories?: string[];
  productUrl?: string;
  confidence: number;
};
