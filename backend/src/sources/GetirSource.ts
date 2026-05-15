import type { SourceProductResult } from '../models/SourceProductResult.js';
import type { ProductSourceAdapter } from './ProductSourceAdapter.js';

export class GetirSource implements ProductSourceAdapter {
  name = 'Getir';

  async searchByBarcode(_barcode: string): Promise<SourceProductResult | null> {
    // TODO: Prefer official/public data partnerships. Do not access login-only data.
    return null;
  }
}
