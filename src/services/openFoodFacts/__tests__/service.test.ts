import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPEN_FOOD_FACTS_CONNECTION_ERROR, openFoodFactsService } from 'src/services/openFoodFacts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('openFoodFactsService', () => {
  it('searchFoods normalizes results and derives the country tag from locale', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            code: '7622210449283',
            product_name: 'Cereal',
            brands: 'Nesfit',
            nutriments: {
              'energy-kcal_100g': 389,
              proteins_100g: 8,
              carbohydrates_100g: 78,
              fat_100g: 5,
              fiber_100g: 7,
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const results = await openFoodFactsService.searchFoods({
      locale: 'pt-BR',
      query: 'cereal',
      pageSize: 5,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.searchParams.get('countries_tags_en')).toBe('en:brazil');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: 'open_food_facts',
      externalId: '7622210449283',
      barcode: '7622210449283',
      name: 'Cereal',
      brand: 'Nesfit',
      baseAmountG: 100,
      baseUnit: 'g',
      kcal: 389,
      proteinG: 8,
      carbsG: 78,
      fatG: 5,
      fiberG: 7,
    });
  });

  it('retries transient failures up to three attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValue(
        jsonResponse({
          products: [
            {
              code: '123',
              product_name: 'Retry cereal',
              nutriments: {
                'energy-kcal_100g': 120,
                proteins_100g: 4,
                carbohydrates_100g: 20,
                fat_100g: 2,
              },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const promise = openFoodFactsService.searchFoods({
      locale: 'en',
      query: 'retry cereal',
    });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry when the product is not found', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 0 }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await openFoodFactsService.findByBarcode({
      locale: 'en',
      barcode: '0000000000000',
    });

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws the connection toast message after the final retry fails', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = openFoodFactsService.searchFoods({
      locale: 'en',
      query: 'broken',
    });
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).rejects.toThrow(OPEN_FOOD_FACTS_CONNECTION_ERROR);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
