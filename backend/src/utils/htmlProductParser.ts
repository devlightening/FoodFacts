import { load } from 'cheerio';

export function extractJsonLdProducts(html: string): unknown[] {
  const $ = load(html);
  const products: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();

    if (!raw.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (isProductLike(item)) {
          products.push(item);
        }
      }
    } catch {
      // Market pages often include non-standard JSON-LD; adapters can add source-specific parsing later.
    }
  });

  return products;
}

function isProductLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const type = (value as { '@type'?: unknown })['@type'];
  return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
}
