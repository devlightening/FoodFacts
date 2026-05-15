import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { ProductAnalysisResult } from '../models/ProductAnalysisResult.js';

const DEFAULT_CACHE_PATH = resolve(process.cwd(), 'data', 'product-cache.sqlite');
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 14;

type CacheRow = {
  payload_json: string;
  updated_at: string;
};

export class CacheService {
  private readonly database: DatabaseSync;
  private readonly ttlMs: number;

  constructor(cachePath = process.env.PRODUCT_CACHE_PATH ?? DEFAULT_CACHE_PATH, ttlMs = DEFAULT_TTL_MS) {
    mkdirSync(dirname(cachePath), { recursive: true });
    this.database = new DatabaseSync(cachePath);
    this.ttlMs = ttlMs;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS product_cache (
        barcode TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        completeness_score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  get(barcode: string): ProductAnalysisResult | null {
    const statement = this.database.prepare(
      'SELECT payload_json, updated_at FROM product_cache WHERE barcode = ?',
    );
    const row = statement.get(barcode) as CacheRow | undefined;

    if (!row) {
      return null;
    }

    if (Date.now() - new Date(row.updated_at).getTime() > this.ttlMs) {
      return null;
    }

    const parsed = JSON.parse(row.payload_json) as ProductAnalysisResult;

    return {
      ...parsed,
      sources: {
        ...parsed.sources,
        cacheHit: true,
        checked: [
          { sourceName: 'Local Cache', status: 'cache', message: 'Önceden çözümlenen ürün kullanıldı.' },
          ...parsed.sources.checked,
        ],
      },
    };
  }

  set(product: ProductAnalysisResult): void {
    const now = new Date().toISOString();
    const statement = this.database.prepare(`
      INSERT INTO product_cache (barcode, payload_json, completeness_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(barcode) DO UPDATE SET
        payload_json = excluded.payload_json,
        completeness_score = excluded.completeness_score,
        updated_at = excluded.updated_at;
    `);
    statement.run(
      product.barcode,
      JSON.stringify(product),
      product.completeness.score,
      now,
      now,
    );
  }
}
