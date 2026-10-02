import type { FoodBaseUnit, SupportedLocale } from 'src/domain/types';

import type {
  ExternalFood,
  OpenFoodFactsBarcodeArgs,
  OpenFoodFactsSearchArgs,
} from './contract';

export const OPEN_FOOD_FACTS_CONNECTION_ERROR =
  'Problema ao conectar com a API. Verifique a conexão com internet.';

const BASE_URL = 'https://world.openfoodfacts.org';
const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'nutriments',
] as const;
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;

const COUNTRY_TAGS: Record<SupportedLocale, string> = {
  en: 'en:united-states-of-america',
  es: 'en:spain',
  'pt-BR': 'en:brazil',
  de: 'en:germany',
  fr: 'en:france',
  ja: 'en:japan',
  ko: 'en:south-korea',
  it: 'en:italy',
};

interface OpenFoodFactsSearchResponse {
  products?: OffProduct[];
}

interface OpenFoodFactsBarcodeResponse {
  status?: number;
  product?: OffProduct;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof navigator === 'undefined') {
    const version = process.env.APP_VER ?? '0.0.0';
    headers['User-Agent'] = `AppNutrition/${version} (past.kun@gmail.com)`;
  }
  return headers;
}

function countryTagForLocale(locale: SupportedLocale): string {
  return COUNTRY_TAGS[locale];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function pickName(product: OffProduct): string | null {
  const candidates = [product.product_name, product.generic_name];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function pickBrand(product: OffProduct): string | null {
  if (typeof product.brands !== 'string') return null;
  const first = product.brands
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return first ?? null;
}

function pickNutrient(
  nutriments: Record<string, unknown> | undefined,
  suffix: '_100g' | '_100ml',
  base: 'energy-kcal' | 'proteins' | 'carbohydrates' | 'fat' | 'fiber',
): number | null {
  if (!nutriments) return null;
  const direct = toNumber(nutriments[`${base}${suffix}`]);
  if (direct !== null) return direct;
  if (base === 'energy-kcal') {
    const energy = toNumber(nutriments[`energy${suffix}`]);
    if (energy !== null) return energy;
  }
  return null;
}

function normalizeProduct(product: OffProduct): ExternalFood | null {
  const externalId = typeof product.code === 'string' ? product.code.trim() : '';
  if (externalId.length === 0) return null;
  const name = pickName(product);
  if (!name) return null;
  const brand = pickBrand(product);
  const nutriments = product.nutriments;

  const gKcal = pickNutrient(nutriments, '_100g', 'energy-kcal');
  const gProtein = pickNutrient(nutriments, '_100g', 'proteins');
  const gCarbs = pickNutrient(nutriments, '_100g', 'carbohydrates');
  const gFat = pickNutrient(nutriments, '_100g', 'fat');
  const gFiber = pickNutrient(nutriments, '_100g', 'fiber');

  const mlKcal = pickNutrient(nutriments, '_100ml', 'energy-kcal');
  const mlProtein = pickNutrient(nutriments, '_100ml', 'proteins');
  const mlCarbs = pickNutrient(nutriments, '_100ml', 'carbohydrates');
  const mlFat = pickNutrient(nutriments, '_100ml', 'fat');
  const mlFiber = pickNutrient(nutriments, '_100ml', 'fiber');

  const preferG = gKcal !== null && gProtein !== null && gCarbs !== null && gFat !== null;
  const preferMl = mlKcal !== null && mlProtein !== null && mlCarbs !== null && mlFat !== null;

  let baseUnit: FoodBaseUnit | null = null;
  let kcal: number | null = null;
  let proteinG: number | null = null;
  let carbsG: number | null = null;
  let fatG: number | null = null;
  let fiberG: number | null = null;

  if (preferG) {
    baseUnit = 'g';
    kcal = gKcal;
    proteinG = gProtein;
    carbsG = gCarbs;
    fatG = gFat;
    fiberG = gFiber;
  } else if (preferMl) {
    baseUnit = 'ml';
    kcal = mlKcal;
    proteinG = mlProtein;
    carbsG = mlCarbs;
    fatG = mlFat;
    fiberG = mlFiber;
  }

  if (
    baseUnit === null ||
    kcal === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null
  ) {
    return null;
  }

  return {
    source: 'open_food_facts',
    externalId,
    barcode: externalId,
    name,
    brand,
    baseAmountG: 100,
    baseUnit,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
  };
}

function isRetryableResponse(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...buildHeaders(),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok || !isRetryableResponse(response.status) || attempt === retries) {
        return response;
      }
      lastError = new Error(`Open Food Facts responded with ${response.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt === retries) {
        throw new Error(OPEN_FOOD_FACTS_CONNECTION_ERROR);
      }
    }
    if (attempt < retries) {
      await delay(RETRY_DELAY_MS);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(OPEN_FOOD_FACTS_CONNECTION_ERROR);
}

function buildSearchUrl(args: OpenFoodFactsSearchArgs): string {
  const params = new URLSearchParams({
    search_terms: args.query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(args.pageSize ?? 20),
    countries_tags_en: countryTagForLocale(args.locale),
    fields: PRODUCT_FIELDS.join(','),
  });
  return `${BASE_URL}/cgi/search.pl?${params.toString()}`;
}

function buildBarcodeUrl(barcode: string): string {
  const params = new URLSearchParams({
    fields: PRODUCT_FIELDS.join(','),
  });
  return `${BASE_URL}/api/v3/product/${encodeURIComponent(barcode)}?${params.toString()}`;
}

export const openFoodFactsService = {
  countryTagForLocale,

  async searchFoods(args: OpenFoodFactsSearchArgs): Promise<ExternalFood[]> {
    const query = args.query.trim();
    if (query.length === 0) return [];
    const response = await fetchWithRetry(buildSearchUrl(args), { method: 'GET' });
    if (!response.ok) {
      throw new Error(OPEN_FOOD_FACTS_CONNECTION_ERROR);
    }
    const json = (await response.json()) as OpenFoodFactsSearchResponse;
    const seen = new Set<string>();
    const foods: ExternalFood[] = [];
    for (const product of json.products ?? []) {
      const food = normalizeProduct(product);
      if (!food) continue;
      if (seen.has(food.externalId)) continue;
      seen.add(food.externalId);
      foods.push(food);
    }
    return foods;
  },

  async findByBarcode(args: OpenFoodFactsBarcodeArgs): Promise<ExternalFood | null> {
    const barcode = args.barcode.trim();
    if (barcode.length === 0) return null;
    const response = await fetchWithRetry(buildBarcodeUrl(barcode), { method: 'GET' });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(OPEN_FOOD_FACTS_CONNECTION_ERROR);
    }
    const json = (await response.json()) as OpenFoodFactsBarcodeResponse;
    if (json.status !== 1 || !json.product) return null;
    return normalizeProduct(json.product);
  },
};
