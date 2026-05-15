import type { ProductAnalysisResult, SourceCheck } from '../models/ProductAnalysisResult.js';
import type { SourceProductResult } from '../models/SourceProductResult.js';
import { CarrefourSource } from '../sources/CarrefourSource.js';
import { GetirSource } from '../sources/GetirSource.js';
import { HepsiburadaSource } from '../sources/HepsiburadaSource.js';
import { MigrosSource } from '../sources/MigrosSource.js';
import { OpenFoodFactsSource } from '../sources/OpenFoodFactsSource.js';
import type { ProductSourceAdapter } from '../sources/ProductSourceAdapter.js';
import { TrendyolSource } from '../sources/TrendyolSource.js';
import { CacheService } from './CacheService.js';
import { ProductAnalysisService } from './ProductAnalysisService.js';
import { ProductMergeService } from './ProductMergeService.js';

export class ProductNotFoundError extends Error {
  constructor(barcode: string) {
    super(`Product not found for barcode: ${barcode}`);
    this.name = 'ProductNotFoundError';
  }
}

export class InvalidBarcodeError extends Error {
  constructor() {
    super('Invalid barcode');
    this.name = 'InvalidBarcodeError';
  }
}

export class ProductResolverService {
  private readonly cacheService: CacheService;
  private readonly mergeService: ProductMergeService;
  private readonly analysisService: ProductAnalysisService;
  private readonly primarySource: ProductSourceAdapter;
  private readonly enrichmentSources: ProductSourceAdapter[];

  constructor(options?: {
    cacheService?: CacheService;
    mergeService?: ProductMergeService;
    analysisService?: ProductAnalysisService;
    primarySource?: ProductSourceAdapter;
    enrichmentSources?: ProductSourceAdapter[];
  }) {
    this.cacheService = options?.cacheService ?? new CacheService();
    this.mergeService = options?.mergeService ?? new ProductMergeService();
    this.analysisService = options?.analysisService ?? new ProductAnalysisService();
    this.primarySource = options?.primarySource ?? new OpenFoodFactsSource();
    this.enrichmentSources = options?.enrichmentSources ?? [
      new CarrefourSource(),
      new MigrosSource(),
      new TrendyolSource(),
      new HepsiburadaSource(),
      new GetirSource(),
    ];
  }

  async resolveProductByBarcode(barcode: string): Promise<ProductAnalysisResult> {
    const normalizedBarcode = barcode.trim();

    if (!/^[0-9]{6,32}$/.test(normalizedBarcode)) {
      throw new InvalidBarcodeError();
    }

    const cachedProduct = this.cacheService.get(normalizedBarcode);

    if (cachedProduct) {
      return cachedProduct;
    }

    const sourceChecks: SourceCheck[] = [];
    const results: SourceProductResult[] = [];
    const primaryResult = await this.safeSearch(this.primarySource, normalizedBarcode, sourceChecks);

    if (primaryResult) {
      results.push(primaryResult);
    }

    const primaryMerged = results.length
      ? this.mergeService.merge(normalizedBarcode, results, sourceChecks)
      : undefined;

    if (primaryMerged && isCompleteEnough(primaryMerged.completeness.score)) {
      const analyzed = this.analysisService.analyze(primaryMerged);
      this.cacheService.set(analyzed);
      return analyzed;
    }

    for (const source of this.enrichmentSources) {
      const result = await this.safeSearch(source, normalizedBarcode, sourceChecks);

      if (result) {
        results.push(result);
      }
    }

    if (!results.length) {
      throw new ProductNotFoundError(normalizedBarcode);
    }

    const merged = this.mergeService.merge(normalizedBarcode, results, sourceChecks);
    const analyzed = this.analysisService.analyze(merged);
    this.cacheService.set(analyzed);

    return analyzed;
  }

  private async safeSearch(
    source: ProductSourceAdapter,
    barcode: string,
    sourceChecks: SourceCheck[],
  ): Promise<SourceProductResult | null> {
    try {
      const result = await source.searchByBarcode(barcode);

      sourceChecks.push({
        sourceName: source.name,
        status: result ? 'hit' : 'miss',
        message: result ? 'Veri bulundu.' : 'Veri bulunamadı veya adapter henüz aktif değil.',
      });

      return result;
    } catch (error) {
      sourceChecks.push({
        sourceName: source.name,
        status: 'error',
        message: error instanceof Error ? error.message : 'Kaynak kontrolünde bilinmeyen hata.',
      });

      return null;
    }
  }
}

function isCompleteEnough(score: number): boolean {
  return score >= 80;
}
