import type { SourceProductResult } from '../models/SourceProductResult.js';
import type { ProductSourceAdapter } from './ProductSourceAdapter.js';

export class TrendyolSource implements ProductSourceAdapter {
  name = 'Trendyol';

  async searchByBarcode(_barcode: string): Promise<SourceProductResult | null> {
    // TODO: Query only publicly accessible product pages and parse available product facts.
    // Do not use private endpoints or bypass bot protection.
    return null;
  }
}
