import type { FoodBaseUnit, SupportedLocale } from 'src/domain/types';

export interface ExternalFood {
  source: 'open_food_facts';
  externalId: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  baseAmountG: number;
  baseUnit: FoodBaseUnit;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

export interface OpenFoodFactsSearchArgs {
  locale: SupportedLocale;
  query: string;
  pageSize?: number;
}

export interface OpenFoodFactsBarcodeArgs {
  locale: SupportedLocale;
  barcode: string;
}
