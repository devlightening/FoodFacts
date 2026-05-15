import type { NutritionInfo } from '../models/NutritionInfo.js';
import type {
  ProductCompleteness,
  ProductDataSources,
  SourceCheck,
} from '../models/ProductAnalysisResult.js';
import type { SourceProductResult } from '../models/SourceProductResult.js';
import { hasNutrition } from '../utils/parseNutrition.js';

const FIELD_WEIGHTS = {
  productName: 15,
  image: 10,
  ingredients: 30,
  nutrition: 25,
  allergens: 10,
  additives: 10,
};

const SOURCE_PRIORITY = ['Open Food Facts', 'CarrefourSA', 'Migros', 'Trendyol', 'Hepsiburada', 'Getir'];

export type MergedProduct = {
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
  sources: ProductDataSources;
  completeness: ProductCompleteness;
};

export class ProductMergeService {
  merge(
    barcode: string,
    results: SourceProductResult[],
    sourceChecks: SourceCheck[],
    cacheHit = false,
  ): MergedProduct {
    const sortedResults = [...results].sort((left, right) => {
      const leftPriority = SOURCE_PRIORITY.indexOf(left.sourceName);
      const rightPriority = SOURCE_PRIORITY.indexOf(right.sourceName);
      const normalizedLeftPriority = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
      const normalizedRightPriority = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;

      if (normalizedLeftPriority !== normalizedRightPriority) {
        return normalizedLeftPriority - normalizedRightPriority;
      }

      return right.confidence - left.confidence;
    });
    const sources: ProductDataSources = {
      checked: sourceChecks,
      cacheHit,
    };

    const productNamePick = pickField(sortedResults, 'productName');
    const brandPick = pickField(sortedResults, 'brand');
    const imagePick = pickField(sortedResults, 'imageUrl');
    const ingredientsPick = pickField(sortedResults, 'ingredientsText');
    const allergensPick = pickArrayField(sortedResults, 'allergens');
    const additivesPick = pickArrayField(sortedResults, 'additives');
    const nutriScorePick = pickField(sortedResults, 'nutriScore');
    const novaPick = pickNumberField(sortedResults, 'novaGroup');
    const dietaryPick = pickArrayField(sortedResults, 'dietaryTags');
    const labelsPick = pickArrayField(sortedResults, 'labels');
    const categoriesPick = pickArrayField(sortedResults, 'categories');
    const nutritionPick = mergeNutrition(sortedResults);

    sources.productName = productNamePick?.sourceName;
    sources.brand = brandPick?.sourceName;
    sources.imageUrl = imagePick?.sourceName;
    sources.ingredientsText = ingredientsPick?.sourceName;
    sources.allergens = allergensPick?.sourceName;
    sources.additives = additivesPick?.sourceName;
    sources.nutriScore = nutriScorePick?.sourceName;
    sources.novaGroup = novaPick?.sourceName;
    sources.dietaryTags = dietaryPick?.sourceName;
    sources.nutrition = nutritionPick?.sourceName;

    const merged: Omit<MergedProduct, 'completeness'> = {
      barcode,
      productName: productNamePick?.value ?? 'Bilinmeyen ürün',
      brand: brandPick?.value,
      imageUrl: imagePick?.value,
      ingredientsText: ingredientsPick?.value,
      nutrition: nutritionPick?.value,
      allergens: allergensPick?.value,
      additives: additivesPick?.value,
      nutriScore: nutriScorePick?.value,
      novaGroup: novaPick?.value,
      dietaryTags: dietaryPick?.value,
      labels: labelsPick?.value,
      categories: categoriesPick?.value,
      sources,
    };

    return {
      ...merged,
      completeness: calculateCompleteness(merged),
    };
  }
}

export function calculateCompleteness(product: {
  productName?: string;
  imageUrl?: string;
  ingredientsText?: string;
  nutrition?: NutritionInfo;
  allergens?: string[];
  additives?: string[];
}): ProductCompleteness {
  const hasProductName = Boolean(product.productName && product.productName !== 'Bilinmeyen ürün');
  const hasImage = Boolean(product.imageUrl);
  const hasIngredients = Boolean(product.ingredientsText);
  const hasNutritionInfo = hasNutrition(product.nutrition);
  const hasAllergens = Boolean(product.allergens);
  const hasAdditives = Boolean(product.additives);

  const score =
    (hasProductName ? FIELD_WEIGHTS.productName : 0) +
    (hasImage ? FIELD_WEIGHTS.image : 0) +
    (hasIngredients ? FIELD_WEIGHTS.ingredients : 0) +
    (hasNutritionInfo ? FIELD_WEIGHTS.nutrition : 0) +
    (hasAllergens ? FIELD_WEIGHTS.allergens : 0) +
    (hasAdditives ? FIELD_WEIGHTS.additives : 0);

  return {
    score,
    hasProductName,
    hasImage,
    hasIngredients,
    hasNutrition: hasNutritionInfo,
    hasAllergens,
    hasAdditives,
  };
}

function pickField<TField extends keyof SourceProductResult>(
  results: SourceProductResult[],
  field: TField,
): { value: Extract<SourceProductResult[TField], string>; sourceName: string } | undefined {
  for (const result of results) {
    const value = result[field];

    if (typeof value === 'string' && value.trim()) {
      return { value: value.trim() as Extract<SourceProductResult[TField], string>, sourceName: result.sourceName };
    }
  }

  return undefined;
}

function pickNumberField<TField extends keyof SourceProductResult>(
  results: SourceProductResult[],
  field: TField,
): { value: Extract<SourceProductResult[TField], number>; sourceName: string } | undefined {
  for (const result of results) {
    const value = result[field];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return { value: value as Extract<SourceProductResult[TField], number>, sourceName: result.sourceName };
    }
  }

  return undefined;
}

function pickArrayField<TField extends keyof SourceProductResult>(
  results: SourceProductResult[],
  field: TField,
): { value: Extract<SourceProductResult[TField], string[]>; sourceName: string } | undefined {
  for (const result of results) {
    const value = result[field];

    if (Array.isArray(value)) {
      return { value: value as Extract<SourceProductResult[TField], string[]>, sourceName: result.sourceName };
    }
  }

  return undefined;
}

function mergeNutrition(
  results: SourceProductResult[],
): { value: NutritionInfo; sourceName: string } | undefined {
  const nutrition: NutritionInfo = {};
  let sourceName: string | undefined;

  for (const key of [
    'energyKcal100g',
    'fat100g',
    'saturatedFat100g',
    'carbohydrates100g',
    'sugars100g',
    'fiber100g',
    'proteins100g',
    'salt100g',
  ] satisfies Array<keyof NutritionInfo>) {
    const pick = results.find((result) => typeof result.nutrition?.[key] === 'number');

    if (pick?.nutrition?.[key] !== undefined) {
      nutrition[key] = pick.nutrition[key];
      sourceName ??= pick.sourceName;
    }
  }

  return hasNutrition(nutrition) && sourceName ? { value: nutrition, sourceName } : undefined;
}
