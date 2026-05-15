import type { SourceProductResult } from '../models/SourceProductResult.js';
import type { ProductSourceAdapter } from './ProductSourceAdapter.js';

export class MigrosSource implements ProductSourceAdapter {
  name = 'Migros';

  async searchByBarcode(_barcode: string): Promise<SourceProductResult | null> {
    // TODO: Search public Migros product pages or official public product data.
    // Keep request volume low and fail gracefully if the source blocks automated access.
    return null;
  }
}
