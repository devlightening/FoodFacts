import { NativeModules, Platform } from 'react-native';

import type { ProductAnalysisResult } from '../types/product';

const DEFAULT_BACKEND_URL = Platform.select({
  android: 'http://10.0.2.2:3001',
  default: 'http://localhost:3001',
});
const LAN_BACKEND_URLS = ['http://172.20.10.3:3001', 'http://10.60.216.173:3001'];
const REQUEST_TIMEOUT_MS = 16_000;

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

export class ProductNotFoundError extends Error {
  constructor(barcode: string) {
    super(`Product not found for barcode: ${barcode}`);
    this.name = 'ProductNotFoundError';
  }
}

export class ProductFetchError extends Error {
  constructor(message = 'Product request failed') {
    super(message);
    this.name = 'ProductFetchError';
  }
}

export async function getProductByBarcode(barcode: string): Promise<ProductAnalysisResult> {
  const normalizedBarcode = barcode.trim();

  if (!normalizedBarcode) {
    throw new ProductFetchError('Barkod boş.');
  }

  const urls = getCandidateApiBaseUrls().map(
    (baseUrl) => `${baseUrl}/api/products/scan/${encodeURIComponent(normalizedBarcode)}`,
  );
  let lastError: unknown;

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url);

      if (response.status === 404) {
        throw new ProductNotFoundError(normalizedBarcode);
      }

      if (!response.ok) {
        const errorBody = await safeReadError(response);
        throw new ProductFetchError(errorBody.message ?? 'Ürün çözümleyici hata döndürdü.');
      }

      return (await response.json()) as ProductAnalysisResult;
    } catch (error) {
      if (error instanceof ProductNotFoundError || error instanceof ProductFetchError) {
        throw error;
      }

      lastError = error;
    }
  }

  throw new ProductFetchError(
    lastError instanceof Error ? 'Backend bağlantısı kurulamadı.' : 'Ürün çözümleyiciye ulaşılamadı.',
  );
}

async function safeReadError(response: Response): Promise<ApiErrorResponse> {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return {};
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getCandidateApiBaseUrls(): string[] {
  const globalProcess = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };
  const configuredUrl = globalProcess.process?.env?.EXPO_PUBLIC_PRODUCT_API_BASE_URL?.replace(/\/$/, '');
  const metroUrl = getMetroDerivedBackendUrl();
  const urls = [configuredUrl, metroUrl, DEFAULT_BACKEND_URL, ...LAN_BACKEND_URLS].filter(
    (url): url is string => Boolean(url),
  );

  return [...new Set(urls.map((url) => url.replace(/\/$/, '')))];
}

function getMetroDerivedBackendUrl(): string | undefined {
  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  const host = scriptUrl?.match(/^https?:\/\/([^:/]+)(?::\d+)?\//)?.[1];

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return undefined;
  }

  return `http://${host}:3001`;
}
