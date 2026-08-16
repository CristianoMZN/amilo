// Bundled food catalog — official reference rows seeded on first boot.
//
// IDs are stable string slugs (`'food:<name>'`). Corrections to a food's
// nutritional values never UPSERT an existing id — they add a new id and
// retire the old one — so historical `meal_item` snapshots stay immune.
//
// Per-100 g/100 ml values are taken from common published nutrition tables
// (USDA FoodData Central, TACO). Where a value was uncertain the row has
// a JSDoc range citation.
//
// Data organisation note: entries are kept in a single file so a future
// contributor can see the whole catalog at a glance. The actual exported
// array is sorted alphabetically by id for predictable diffs.

import type {
  Food,
  FoodBaseUnit,
  FoodOrigin,
  FoodTranslation,
  SupportedLocale,
} from 'src/domain/types';

/**
 * A seed row. `food` carries the nutritional columns normalised to
 * `baseAmountG` (always `100`); `translations` is a per-locale display
 * name keyed by the full `SupportedLocale` set so the catalog is
 * searchable in every shipped language from the very first boot.
 */
export interface OfficialFoodSeed {
  food: Omit<Food, 'createdAt' | 'updatedAt'>;
  translations: Record<SupportedLocale, string>;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Compact builder for an `OfficialFoodSeed` row. Keeps each entry readable
 * as a single multi-line `seedFood(...)` call while avoiding the noise of
 * sixty hand-written `{ food: {…}, translations: {…} }` literals.
 */
function seedFood(
  id: string,
  baseUnit: FoodBaseUnit,
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  fiberG: number | null,
  translations: Record<SupportedLocale, string>,
): OfficialFoodSeed {
  // `origin` is locked to `'official'`: this is the bundled catalog.
  // `baseAmountG` is always 100 — serving-size scaling lives in domain code.
  const food: Omit<Food, 'createdAt' | 'updatedAt'> = {
    id,
    origin: 'official' satisfies FoodOrigin,
    baseAmountG: 100,
    baseUnit,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
  };
  return { food, translations };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const FOOD_ROWS: OfficialFoodSeed[] = [
  // ----- Cereais (grains, pasta, flour) ----------------------------------
  seedFood('food:rice_white', 'g', 130, 2.7, 28.2, 0.3, 0.4, {
    en: 'White rice',
    es: 'Arroz blanco',
    'pt-BR': 'Arroz branco',
    de: 'Weißer Reis',
    fr: 'Riz blanc',
    ja: '白米',
    ko: '백미',
    it: 'Riso bianco',
  }),
  seedFood('food:rice_brown', 'g', 111, 2.6, 23, 0.9, 1.8, {
    en: 'Brown rice',
    es: 'Arroz integral',
    'pt-BR': 'Arroz integral',
    de: 'Brauner Reis',
    fr: 'Riz complet',
    ja: '玄米',
    ko: '현미',
    it: 'Riso integrale',
  }),
  seedFood('food:oats_rolled', 'g', 389, 16.9, 66.3, 6.9, 10.6, {
    en: 'Rolled oats',
    es: 'Avena',
    'pt-BR': 'Aveia em flocos',
    de: 'Haferflocken',
    fr: 'Flocons d’avoine',
    ja: 'オートミール',
    ko: '귀리',
    it: 'Fiocchi d’avena',
  }),
  seedFood('food:pasta_cooked', 'g', 158, 5.8, 30.9, 0.9, 1.8, {
    en: 'Pasta',
    es: 'Pasta',
    'pt-BR': 'Macarrão',
    de: 'Nudeln',
    fr: 'Pâtes',
    ja: 'パスタ',
    ko: '파스타',
    it: 'Pasta',
  }),
  seedFood('food:pasta_whole_wheat', 'g', 124, 5, 26.5, 0.6, 3.9, {
    en: 'Whole-wheat pasta',
    es: 'Pasta integral',
    'pt-BR': 'Macarrão integral',
    de: 'Vollkornnudeln',
    fr: 'Pâtes complètes',
    ja: '全粒粉パスタ',
    ko: '통밀 파스타',
    it: 'Pasta integrale',
  }),
  seedFood('food:flour_wheat', 'g', 364, 10.3, 76.3, 1, 2.7, {
    en: 'Wheat flour',
    es: 'Harina de trigo',
    'pt-BR': 'Farinha de trigo',
    de: 'Weizenmehl',
    fr: 'Farine de blé',
    ja: '小麦粉',
    ko: '밀가루',
    it: 'Farina di grano',
  }),
  seedFood('food:corn_flakes', 'g', 357, 7, 84, 0.4, 3, {
    en: 'Corn flakes',
    es: 'Copos de maíz',
    'pt-BR': 'Flocos de milho',
    de: 'Cornflakes',
    fr: 'Corn flakes',
    ja: 'コーンフレーク',
    ko: '콘플레이크',
    it: 'Corn flakes',
  }),
  seedFood('food:quinoa_cooked', 'g', 120, 4.4, 21.3, 1.9, 2.8, {
    en: 'Quinoa',
    es: 'Quinoa',
    'pt-BR': 'Quinoa',
    de: 'Quinoa',
    fr: 'Quinoa',
    ja: 'キヌア',
    ko: '키노아',
    it: 'Quinoa',
  }),

  // ----- Pães ------------------------------------------------------------
  seedFood('food:bread_white', 'g', 265, 9, 49, 3.2, 2.7, {
    en: 'White bread',
    es: 'Pan blanco',
    'pt-BR': 'Pão branco',
    de: 'Weißbrot',
    fr: 'Pain blanc',
    ja: '食パン',
    ko: '흰빵',
    it: 'Pane bianco',
  }),
  seedFood('food:bread_whole_wheat', 'g', 247, 13, 41, 3.4, 7, {
    en: 'Whole-wheat bread',
    es: 'Pan integral',
    'pt-BR': 'Pão integral',
    de: 'Vollkornbrot',
    fr: 'Pain complet',
    ja: '全粒粉パン',
    ko: '통밀빵',
    it: 'Pane integrale',
  }),
  seedFood('food:bread_french', 'g', 270, 9, 55, 1.5, 2.5, {
    en: 'French bread',
    es: 'Pan francés',
    'pt-BR': 'Pão francês',
    de: 'Französisches Brot',
    fr: 'Pain français',
    ja: 'フランスパン',
    ko: '프랑스빵',
    it: 'Pane francese',
  }),
  seedFood('food:bread_sourdough', 'g', 289, 11, 56, 1.6, 2.4, {
    en: 'Sourdough bread',
    es: 'Pan de masa madre',
    'pt-BR': 'Pão de fermentação natural',
    de: 'Sauerteigbrot',
    fr: 'Pain au levain',
    ja: 'サワーダウ',
    ko: '사워도우빵',
    it: 'Pane a lievitazione naturale',
  }),
  seedFood('food:bread_rye', 'g', 259, 9, 48, 1.5, 5.8, {
    en: 'Rye bread',
    es: 'Pan de centeno',
    'pt-BR': 'Pão de centeio',
    de: 'Roggenbrot',
    fr: 'Pain de seigle',
    ja: 'ライ麦パン',
    ko: '호밀빵',
    it: 'Pane di segale',
  }),

  // ----- Carnes ----------------------------------------------------------
  seedFood('food:chicken_breast', 'g', 165, 31, 0, 3.6, 0, {
    en: 'Chicken breast',
    es: 'Pechuga de pollo',
    'pt-BR': 'Peito de frango',
    de: 'Hähnchenbrust',
    fr: 'Blanc de poulet',
    ja: '鶏むね肉',
    ko: '닭가슴살',
    it: 'Petto di pollo',
  }),
  seedFood('food:beef_lean', 'g', 250, 26, 0, 17, 0, {
    en: 'Beef',
    es: 'Carne de res',
    'pt-BR': 'Carne bovina',
    de: 'Rindfleisch',
    fr: 'Bœuf',
    ja: '牛肉',
    ko: '소고기',
    it: 'Manzo',
  }),
  seedFood('food:pork_loin', 'g', 242, 27, 0, 14, 0, {
    en: 'Pork loin',
    es: 'Lomo de cerdo',
    'pt-BR': 'Lombo de porco',
    de: 'Schweinelende',
    fr: 'Filet de porc',
    ja: '豚ロース',
    ko: '돼지등심',
    it: 'Lonza di maiale',
  }),
  seedFood('food:ground_beef', 'g', 254, 17.2, 0, 20, 0, {
    en: 'Ground beef',
    es: 'Carne molida',
    'pt-BR': 'Carne moída',
    de: 'Hackfleisch',
    fr: 'Viande hachée',
    ja: '牛ひき肉',
    ko: '다진 소고기',
    it: 'Carne macinata',
  }),
  seedFood('food:fish_tilapia', 'g', 96, 20, 0, 1.7, 0, {
    en: 'Tilapia',
    es: 'Tilapia',
    'pt-BR': 'Tilápia',
    de: 'Tilapia',
    fr: 'Tilapia',
    ja: 'ティラピア',
    ko: '틸라피아',
    it: 'Tilapia',
  }),
  seedFood('food:fish_salmon', 'g', 208, 20, 0, 13, 0, {
    en: 'Salmon',
    es: 'Salmón',
    'pt-BR': 'Salmão',
    de: 'Lachs',
    fr: 'Saumon',
    ja: 'サーモン',
    ko: '연어',
    it: 'Salmone',
  }),

  // ----- Ovos ------------------------------------------------------------
  seedFood('food:egg_chicken', 'g', 155, 13, 1.1, 11, 0, {
    en: 'Egg',
    es: 'Huevo',
    'pt-BR': 'Ovo',
    de: 'Ei',
    fr: 'Œuf',
    ja: '卵',
    ko: '달걀',
    it: 'Uovo',
  }),
  seedFood('food:egg_white', 'g', 52, 11, 0.7, 0.2, 0, {
    en: 'Egg white',
    es: 'Clara de huevo',
    'pt-BR': 'Clara',
    de: 'Eiklar',
    fr: 'Blanc d’œuf',
    ja: '卵白',
    ko: '흰자',
    it: 'Albume',
  }),

  // ----- Leite e derivados ----------------------------------------------
  seedFood('food:milk_whole', 'ml', 61, 3.2, 4.8, 3.3, 0, {
    en: 'Whole milk',
    es: 'Leche entera',
    'pt-BR': 'Leite integral',
    de: 'Vollmilch',
    fr: 'Lait entier',
    ja: '全乳',
    ko: '전지유',
    it: 'Latte intero',
  }),
  seedFood('food:milk_semi_skimmed', 'ml', 50, 3.4, 5, 1.8, 0, {
    en: 'Semi-skimmed milk',
    es: 'Leche semidesnatada',
    'pt-BR': 'Leite semidesnatado',
    de: 'Halbfettmilch',
    fr: 'Lait demi-écrémé',
    ja: '低脂肪乳',
    ko: '저지방우유',
    it: 'Latte parzialmente scremato',
  }),
  seedFood('food:yogurt_natural', 'g', 61, 3.5, 4.7, 3.3, 0, {
    en: 'Plain yogurt',
    es: 'Yogur natural',
    'pt-BR': 'Iogurte natural',
    de: 'Naturjoghurt',
    fr: 'Yaourt nature',
    ja: 'ヨーグルト',
    ko: '요거트',
    it: 'Yogurt naturale',
  }),
  seedFood('food:cheese_mozzarella', 'g', 280, 28, 3.1, 17, 0, {
    en: 'Mozzarella cheese',
    es: 'Queso mozzarella',
    'pt-BR': 'Queijo mussarela',
    de: 'Mozzarella',
    fr: 'Mozzarella',
    ja: 'モッツァレラ',
    ko: '모차렐라',
    it: 'Mozzarella',
  }),
  seedFood('food:oat_milk', 'ml', 47, 1, 7.5, 1.5, 0.8, {
    en: 'Oat milk',
    es: 'Leche de avena',
    'pt-BR': 'Leite de aveia',
    de: 'Hafermilch',
    fr: 'Lait d’avoine',
    ja: 'オーツミルク',
    ko: '귀리밀크',
    it: 'Latte d’avena',
  }),

  // ----- Frutas ----------------------------------------------------------
  seedFood('food:banana', 'g', 89, 1.1, 22.8, 0.3, 2.6, {
    en: 'Banana',
    es: 'Plátano',
    'pt-BR': 'Banana',
    de: 'Banane',
    fr: 'Banane',
    ja: 'バナナ',
    ko: '바나나',
    it: 'Banana',
  }),
  seedFood('food:apple', 'g', 52, 0.3, 13.8, 0.2, 2.4, {
    en: 'Apple',
    es: 'Manzana',
    'pt-BR': 'Maçã',
    de: 'Apfel',
    fr: 'Pomme',
    ja: 'りんご',
    ko: '사과',
    it: 'Mela',
  }),
  seedFood('food:orange', 'g', 47, 0.9, 11.8, 0.1, 2.4, {
    en: 'Orange',
    es: 'Naranja',
    'pt-BR': 'Laranja',
    de: 'Orange',
    fr: 'Orange',
    ja: 'オレンジ',
    ko: '오렌지',
    it: 'Arancia',
  }),
  seedFood('food:papaya', 'g', 43, 0.5, 10.8, 0.3, 1.7, {
    en: 'Papaya',
    es: 'Papaya',
    'pt-BR': 'Mamão',
    de: 'Papaya',
    fr: 'Papaye',
    ja: 'パパイヤ',
    ko: '파파야',
    it: 'Papaya',
  }),
  seedFood('food:avocado', 'g', 160, 2, 8.5, 14.7, 6.7, {
    en: 'Avocado',
    es: 'Aguacate',
    'pt-BR': 'Abacate',
    de: 'Avocado',
    fr: 'Avocat',
    ja: 'アボカド',
    ko: '아보카도',
    it: 'Avocado',
  }),
  seedFood('food:strawberry', 'g', 32, 0.7, 7.7, 0.3, 2, {
    en: 'Strawberry',
    es: 'Fresa',
    'pt-BR': 'Morango',
    de: 'Erdbeere',
    fr: 'Fraise',
    ja: 'いちご',
    ko: '딸기',
    it: 'Fragola',
  }),
  seedFood('food:grape', 'g', 69, 0.7, 18, 0.2, 0.9, {
    en: 'Grape',
    es: 'Uva',
    'pt-BR': 'Uva',
    de: 'Traube',
    fr: 'Raisin',
    ja: 'ぶどう',
    ko: '포도',
    it: 'Uva',
  }),
  seedFood('food:pineapple', 'g', 50, 0.5, 13.1, 0.1, 1.4, {
    en: 'Pineapple',
    es: 'Piña',
    'pt-BR': 'Abacaxi',
    de: 'Ananas',
    fr: 'Ananas',
    ja: 'パイナップル',
    ko: '파인애플',
    it: 'Ananas',
  }),

  // ----- Vegetais --------------------------------------------------------
  seedFood('food:lettuce', 'g', 15, 1.4, 2.9, 0.2, 1.3, {
    en: 'Lettuce',
    es: 'Lechuga',
    'pt-BR': 'Alface',
    de: 'Kopfsalat',
    fr: 'Laitue',
    ja: 'レタス',
    ko: '상추',
    it: 'Lattuga',
  }),
  seedFood('food:tomato', 'g', 18, 1.1, 3.9, 0.2, 1.2, {
    en: 'Tomato',
    es: 'Tomate',
    'pt-BR': 'Tomate',
    de: 'Tomate',
    fr: 'Tomate',
    ja: 'トマト',
    ko: '토마토',
    it: 'Pomodoro',
  }),
  seedFood('food:broccoli', 'g', 34, 2.8, 6.6, 0.4, 2.6, {
    en: 'Broccoli',
    es: 'Brócoli',
    'pt-BR': 'Brócolis',
    de: 'Brokkoli',
    fr: 'Brocoli',
    ja: 'ブロッコリー',
    ko: '브로콜리',
    it: 'Broccoli',
  }),
  seedFood('food:sweet_potato', 'g', 86, 1.6, 20, 0.1, 3, {
    en: 'Sweet potato',
    es: 'Batata',
    'pt-BR': 'Batata-doce',
    de: 'Süßkartoffel',
    fr: 'Patate douce',
    ja: 'さつまいも',
    ko: '고구마',
    it: 'Patata dolce',
  }),
  seedFood('food:potato', 'g', 87, 1.9, 20, 0.1, 1.8, {
    en: 'Potato',
    es: 'Papa',
    'pt-BR': 'Batata',
    de: 'Kartoffel',
    fr: 'Pomme de terre',
    ja: 'じゃがいも',
    ko: '감자',
    it: 'Patata',
  }),
  seedFood('food:carrot', 'g', 41, 0.9, 9.6, 0.2, 2.8, {
    en: 'Carrot',
    es: 'Zanahoria',
    'pt-BR': 'Cenoura',
    de: 'Karotte',
    fr: 'Carotte',
    ja: 'にんじん',
    ko: '당근',
    it: 'Carota',
  }),
  seedFood('food:onion', 'g', 40, 1.1, 9.3, 0.1, 1.7, {
    en: 'Onion',
    es: 'Cebolla',
    'pt-BR': 'Cebola',
    de: 'Zwiebel',
    fr: 'Oignon',
    ja: '玉ねぎ',
    ko: '양파',
    it: 'Cipolla',
  }),
  seedFood('food:spinach', 'g', 23, 2.9, 3.6, 0.4, 2.2, {
    en: 'Spinach',
    es: 'Espinaca',
    'pt-BR': 'Espinafre',
    de: 'Spinat',
    fr: 'Épinards',
    ja: 'ほうれん草',
    ko: '시금치',
    it: 'Spinaci',
  }),

  // ----- Leguminosas ----------------------------------------------------
  seedFood('food:black_beans', 'g', 132, 8.9, 23.7, 0.5, 8.7, {
    en: 'Black beans',
    es: 'Frijoles negros',
    'pt-BR': 'Feijão preto',
    de: 'Schwarze Bohnen',
    fr: 'Haricots noirs',
    ja: '黒豆',
    ko: '검은콩',
    it: 'Fagioli neri',
  }),
  seedFood('food:pinto_beans', 'g', 143, 9, 26, 0.7, 9, {
    en: 'Pinto beans',
    es: 'Frijoles pintos',
    'pt-BR': 'Feijão carioca',
    de: 'Pintobohnen',
    fr: 'Haricots pinto',
    ja: 'ピント豆',
    ko: '핀토콩',
    it: 'Fagioli pinto',
  }),
  seedFood('food:lentils', 'g', 116, 9, 20, 0.4, 7.9, {
    en: 'Lentils',
    es: 'Lentejas',
    'pt-BR': 'Lentilha',
    de: 'Linsen',
    fr: 'Lentilles',
    ja: 'レンズ豆',
    ko: '렌틸콩',
    it: 'Lenticchie',
  }),
  seedFood('food:chickpeas', 'g', 164, 8.9, 27.4, 2.6, 7.6, {
    en: 'Chickpeas',
    es: 'Garbanzos',
    'pt-BR': 'Grão de bico',
    de: 'Kichererbsen',
    fr: 'Pois chiches',
    ja: 'ひよこ豆',
    ko: '병아리콩',
    it: 'Ceci',
  }),

  // ----- Bebidas ---------------------------------------------------------
  seedFood('food:water', 'ml', 0, 0, 0, 0, 0, {
    en: 'Water',
    es: 'Agua',
    'pt-BR': 'Água',
    de: 'Wasser',
    fr: 'Eau',
    ja: '水',
    ko: '물',
    it: 'Acqua',
  }),
  seedFood('food:coffee_black', 'ml', 2, 0.3, 0, 0, 0, {
    en: 'Coffee',
    es: 'Café',
    'pt-BR': 'Café',
    de: 'Kaffee',
    fr: 'Café',
    ja: 'コーヒー',
    ko: '커피',
    it: 'Caffè',
  }),
  seedFood('food:tea_green', 'ml', 1, 0, 0, 0, 0, {
    en: 'Green tea',
    es: 'Té verde',
    'pt-BR': 'Chá verde',
    de: 'Grüner Tee',
    fr: 'Thé vert',
    ja: '緑茶',
    ko: '녹차',
    it: 'Tè verde',
  }),
  seedFood('food:orange_juice', 'ml', 45, 0.7, 10.4, 0.2, 0.2, {
    en: 'Orange juice',
    es: 'Jugo de naranja',
    'pt-BR': 'Suco de laranja',
    de: 'Orangensaft',
    fr: 'Jus d’orange',
    ja: 'オレンジジュース',
    ko: '오렌지 주스',
    it: 'Succo d’arancia',
  }),
  seedFood('food:apple_juice', 'ml', 46, 0.1, 11.3, 0.1, 0.2, {
    en: 'Apple juice',
    es: 'Jugo de manzana',
    'pt-BR': 'Suco de maçã',
    de: 'Apfelsaft',
    fr: 'Jus de pomme',
    ja: 'りんごジュース',
    ko: '사과 주스',
    it: 'Succo di mela',
  }),

  // ----- Óleos / gorduras / açúcares ------------------------------------
  seedFood('food:olive_oil', 'ml', 884, 0, 0, 100, 0, {
    en: 'Olive oil',
    es: 'Aceite de oliva',
    'pt-BR': 'Azeite de oliva',
    de: 'Olivenöl',
    fr: 'Huile d’olive',
    ja: 'オリーブオイル',
    ko: '올리브유',
    it: 'Olio d’oliva',
  }),
  seedFood('food:sunflower_oil', 'ml', 884, 0, 0, 100, 0, {
    en: 'Sunflower oil',
    es: 'Aceite de girasol',
    'pt-BR': 'Óleo de girassol',
    de: 'Sonnenblumenöl',
    fr: 'Huile de tournesol',
    ja: 'ひまわり油',
    ko: '해바라기유',
    it: 'Olio di girasole',
  }),
  seedFood('food:butter', 'g', 717, 0.9, 0.1, 81, 0, {
    en: 'Butter',
    es: 'Mantequilla',
    'pt-BR': 'Manteiga',
    de: 'Butter',
    fr: 'Beurre',
    ja: 'バター',
    ko: '버터',
    it: 'Burro',
  }),
  seedFood('food:honey', 'g', 304, 0.3, 82, 0, 0.2, {
    en: 'Honey',
    es: 'Miel',
    'pt-BR': 'Mel',
    de: 'Honig',
    fr: 'Miel',
    ja: 'はちみつ',
    ko: '꿀',
    it: 'Miele',
  }),
  seedFood('food:sugar_white', 'g', 387, 0, 99.8, 0, 0, {
    en: 'Sugar',
    es: 'Azúcar',
    'pt-BR': 'Açúcar',
    de: 'Zucker',
    fr: 'Sucre',
    ja: '砂糖',
    ko: '설탕',
    it: 'Zucchero',
  }),

  // ----- Café da manhã / extras -----------------------------------------
  seedFood('food:granola', 'g', 471, 12, 64, 20, 6, {
    en: 'Granola',
    es: 'Granola',
    'pt-BR': 'Granola',
    de: 'Granola',
    fr: 'Granola',
    ja: 'グラノーラ',
    ko: '그래놀라',
    it: 'Granola',
  }),
  seedFood('food:almonds', 'g', 579, 21, 22, 50, 12.5, {
    en: 'Almonds',
    es: 'Almendras',
    'pt-BR': 'Amêndoas',
    de: 'Mandeln',
    fr: 'Amandes',
    ja: 'アーモンド',
    ko: '아몬드',
    it: 'Mandorle',
  }),
  seedFood('food:walnuts', 'g', 654, 15, 14, 65, 6.7, {
    en: 'Walnuts',
    es: 'Nueces',
    'pt-BR': 'Nozes',
    de: 'Walnüsse',
    fr: 'Noix',
    ja: 'くるみ',
    ko: '호두',
    it: 'Noci',
  }),
  seedFood('food:peanut_butter', 'g', 588, 25, 20, 50, 6, {
    en: 'Peanut butter',
    es: 'Crema de maní',
    'pt-BR': 'Pasta de amendoim',
    de: 'Erdnussbutter',
    fr: 'Beurre de cacahuète',
    ja: 'ピーナッツバター',
    ko: '땅콩버터',
    it: 'Burro di arachidi',
  }),
  seedFood('food:dark_chocolate', 'g', 598, 7.8, 45, 43, 11, {
    en: 'Dark chocolate',
    es: 'Chocolate negro',
    'pt-BR': 'Chocolate amargo',
    de: 'Zartbitter-Schokolade',
    fr: 'Chocolat noir',
    ja: 'ダークチョコレート',
    ko: '다크 초콜릿',
    it: 'Cioccolato fondente',
  }),
];

// ---------------------------------------------------------------------------
// Public export — sorted alphabetically by id for predictable diffs.
// ---------------------------------------------------------------------------

function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const SORTED_ROWS: OfficialFoodSeed[] = [...FOOD_ROWS].sort((a, b) =>
  compareIds(a.food.id, b.food.id),
);

/**
 * Bundled official food catalog. Sorted alphabetically by `food.id` so
 * structural diffs are easy to read across changes.
 *
 * The exported array is the canonical input for `applySeed` and is also
 * re-imported by structural tests under `src/seed/__tests__/`.
 */
export const OFFICIAL_FOODS: readonly OfficialFoodSeed[] = SORTED_ROWS;

/** Re-exported for type-checking convenience. */
export type { FoodTranslation };
