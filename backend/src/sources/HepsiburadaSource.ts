import type { SourceProductResult } from '../models/SourceProductResult.js';
import type { ProductSourceAdapter } from './ProductSourceAdapter.js';

export class HepsiburadaSource implements ProductSourceAdapter {
  name = 'Hepsiburada';

  async searchByBarcode(_barcode: string): Promise<SourceProductResult | null> {
    // TODO: Implement public page lookup after testing real product pages.
    // Keep this adapter isolated so markup changes cannot break the resolver.
    return null;
  }
}
