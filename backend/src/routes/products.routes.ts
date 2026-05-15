import { Router } from 'express';

import {
  InvalidBarcodeError,
  ProductNotFoundError,
  ProductResolverService,
} from '../services/ProductResolverService.js';

export function createProductsRouter(productResolverService = new ProductResolverService()) {
  const router = Router();

  router.get('/scan/:barcode', async (request, response, next) => {
    try {
      const product = await productResolverService.resolveProductByBarcode(request.params.barcode);
      response.json(product);
    } catch (error) {
      if (error instanceof InvalidBarcodeError) {
        response.status(400).json({
          error: 'INVALID_BARCODE',
          message: 'Barkod formatı geçerli değil.',
        });
        return;
      }

      if (error instanceof ProductNotFoundError) {
        response.status(404).json({
          error: 'PRODUCT_NOT_FOUND',
          message: 'Bu ürün hiçbir kaynakta bulunamadı.',
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
