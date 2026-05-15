import type { SourceProductResult } from '../models/SourceProductResult.js';
import type { ProductSourceAdapter } from './ProductSourceAdapter.js';

export class CarrefourSource implements ProductSourceAdapter {
  name = 'CarrefourSA';

  async searchByBarcode(_barcode: string): Promise<SourceProductResult | null> {
    // TODO: Search public CarrefourSA product pages by barcode or product keyword.
    // Parse product name, ingredients, nutrition and allergens when publicly visible.
    // Do not bypass anti-bot mechanisms, login walls or CAPTCHA.
    return null;
  }
}
