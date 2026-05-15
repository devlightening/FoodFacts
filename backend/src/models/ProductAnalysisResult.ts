import type { NutritionInfo } from './NutritionInfo.js';

export type AnalysisSeverity = 'good' | 'warning' | 'danger' | 'neutral';

export type AnalysisCardModel = {
  id: string;
  title: string;
  value: string;
  description: string;
  severity: AnalysisSeverity;
  icon: string;
};

export type ProductCompleteness = {
  score: number;
  hasProductName: boolean;
  hasImage: boolean;
  hasIngredients: boolean;
  hasNutrition: boolean;
  hasAllergens: boolean;
  hasAdditives: boolean;
};

export type SourceCheck = {
  sourceName: string;
  status: 'hit' | 'miss' | 'error' | 'skipped' | 'cache';
  message?: string;
};

export type ProductDataSources = {
  productName?: string;
  brand?: string;
  imageUrl?: string;
  ingredientsText?: string;
  nutrition?: string;
  allergens?: string;
  additives?: string;
  nutriScore?: string;
  novaGroup?: string;
  dietaryTags?: string;
  checked: SourceCheck[];
  cacheHit: boolean;
};

export type ProductAnalysisResult = {
  barcode: string;
  productName: string;
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
  analysisCards: AnalysisCardModel[];
  sources: ProductDataSources;
  completeness: ProductCompleteness;
};
