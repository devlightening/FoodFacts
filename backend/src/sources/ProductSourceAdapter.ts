import type { SourceProductResult } from '../models/SourceProductResult.js';

export interface ProductSourceAdapter {
  name: string;
  searchByBarcode(barcode: string): Promise<SourceProductResult | null>;
}
