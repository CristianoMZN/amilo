<template>
  <q-dialog
    v-model="open"
    position="bottom"
    seamless
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="custom-food">
      <q-card-section class="custom-food__head">
        <div class="custom-food__title">
          <template v-if="isEditing">{{ t('nutrition.customFood.titleEdit') }}</template>
          <template v-else>{{ t('nutrition.customFood.titleNew') }}</template>
        </div>
        <q-btn flat round dense icon="close" v-close-popup @click="reset" />
      </q-card-section>

      <q-card-section class="custom-food__body">
        <div class="custom-food__lookup">
          <q-input
            v-model="externalQuery"
            outlined
            dense
            :label="t('nutrition.customFood.externalLookupLabel')"
            :placeholder="t('nutrition.customFood.externalLookupPlaceholder')"
            class="custom-food__lookup-input"
            @keyup.enter="searchExternal"
          >
            <template #append>
              <q-btn
                flat
                round
                dense
                icon="search"
                :loading="searchingExternal"
                @click="searchExternal"
              />
            </template>
          </q-input>

          <q-list v-if="externalResults.length" separator class="custom-food__results">
            <q-item
              v-for="food in externalResults"
              :key="food.externalId"
              clickable
              v-ripple
              @click="applyExternalFood(food)"
            >
              <q-item-section>
                <q-item-label>{{ food.name }}</q-item-label>
                <q-item-label caption>
                  {{ food.brand ?? t('nutrition.food.originExternal') }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="public" color="primary" size="18px" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <q-input
          v-model="name"
          outlined
          dense
          :label="t('nutrition.customFood.nameLabel')"
          :placeholder="t('nutrition.customFood.namePlaceholder')"
          class="custom-food__name"
          :error="!!errors.name"
          :error-message="errors.name"
        />

        <div class="custom-food__row">
          <q-input
            v-model="barcode"
            outlined
            dense
            :label="t('nutrition.customFood.barcodeLabel')"
            class="custom-food__barcode"
          />
          <q-input
            v-model="brand"
            outlined
            dense
            :label="t('nutrition.customFood.brandLabel')"
            class="custom-food__brand"
          />
        </div>

        <div class="custom-food__row">
          <q-input
            v-model.number="baseAmount"
            type="number"
            outlined
            dense
            :label="t('nutrition.customFood.baseAmountLabel')"
            class="amilio-numeric custom-food__amount"
          />
          <q-btn-toggle
            v-model="baseUnit"
            :options="unitOptions"
            unelevated
            no-caps
            dense
            toggle-color="primary"
            color="white"
            text-color="primary"
            class="custom-food__unit-toggle"
            :aria-label="t('nutrition.customFood.baseUnitLabel')"
          />
        </div>

        <div class="custom-food__grid">
          <q-input
            v-model.number="kcal"
            type="number"
            outlined
            dense
            :label="t('nutrition.customFood.kcalLabel')"
            class="amilio-numeric"
            :error="!!errors.kcal"
          />
          <q-input
            v-model.number="proteinG"
            type="number"
            outlined
            dense
            :label="t('nutrition.customFood.proteinLabel')"
            class="amilio-numeric"
            :error="!!errors.proteinG"
          />
          <q-input
            v-model.number="carbsG"
            type="number"
            outlined
            dense
            :label="t('nutrition.customFood.carbsLabel')"
            class="amilio-numeric"
            :error="!!errors.carbsG"
          />
          <q-input
            v-model.number="fatG"
            type="number"
            outlined
            dense
            :label="t('nutrition.customFood.fatLabel')"
            class="amilio-numeric"
            :error="!!errors.fatG"
          />
        </div>

        <q-input
          v-model.number="fiberG"
          type="number"
          outlined
          dense
          :label="t('nutrition.customFood.fiberLabel')"
          :hint="t('nutrition.customFood.fiberOptional')"
          class="amilio-numeric"
        />

        <div v-if="Object.keys(errors).length" class="custom-food__error-block">
          {{ t('nutrition.customFood.errorInvalidNumbers') }}
        </div>

        <div class="custom-food__preview amilio-numeric">
          <span class="custom-food__chip">{{ Math.round(previewKcal) }} kcal</span>
          <span class="custom-food__chip">
            {{ t('nutrition.macros.proteinShort') }} {{ Math.round(previewProtein) }}
            {{ t('units.g') }}
          </span>
          <span class="custom-food__chip">
            {{ t('nutrition.macros.carbsShort') }} {{ Math.round(previewCarbs) }} {{ t('units.g') }}
          </span>
          <span class="custom-food__chip">
            {{ t('nutrition.macros.fatShort') }} {{ Math.round(previewFat) }} {{ t('units.g') }}
          </span>
          <span v-if="fiberG !== null" class="custom-food__chip">
            {{ t('nutrition.macros.fiberShort') }} {{ Math.round(fiberG) }} {{ t('units.g') }}
          </span>
        </div>
      </q-card-section>

      <q-card-section class="custom-food__actions">
        <q-btn
          v-if="isEditing && editingCustom"
          flat
          color="negative"
          no-caps
          :label="t('nutrition.customFood.delete')"
          class="custom-food__delete"
          @click="confirmDelete"
        />
        <q-space />
        <q-btn flat no-caps :label="t('common.cancel')" v-close-popup @click="reset" />
        <q-btn
          unelevated
          color="primary"
          text-color="black"
          no-caps
          class="amilio-touch"
          :label="t('nutrition.customFood.save')"
          :loading="saving"
          :disable="saving"
          @click="save"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Dialog, Notify } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { Food, FoodBaseUnit, SupportedLocale } from 'src/domain/types';
import { getDatabase } from 'src/database/database';
import { nutritionService } from 'src/services/nutrition';
import type { ExternalFood } from 'src/services/openFoodFacts';
import { openFoodFactsService } from 'src/services/openFoodFacts';

const props = defineProps<{
  modelValue: boolean;
  editingId: string | null;
  locale: SupportedLocale;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'saved', food: Food): void;
  (e: 'deleted', id: string): void;
}>();

const { t } = useI18n();

const open = defineModel<boolean>({ required: true });

const saving = ref<boolean>(false);
const editingCustom = ref<Food | null>(null);
const externalQuery = ref<string>('');
const externalResults = ref<ExternalFood[]>([]);
const searchingExternal = ref<boolean>(false);
const selectedExternal = ref<ExternalFood | null>(null);

const name = ref<string>('');
const barcode = ref<string>('');
const brand = ref<string>('');
const baseAmount = ref<number>(100);
const baseUnit = ref<FoodBaseUnit>('g');
const kcal = ref<number>(0);
const proteinG = ref<number>(0);
const carbsG = ref<number>(0);
const fatG = ref<number>(0);
const fiberG = ref<number | null>(null);
const externalSource = ref<Food['externalSource']>(null);
const externalId = ref<string | null>(null);

const isEditing = computed<boolean>(() => props.editingId !== null);

const unitOptions = computed<Array<{ label: string; value: FoodBaseUnit }>>(() => [
  { label: t('nutrition.customFood.unitG'), value: 'g' },
  { label: t('nutrition.customFood.unitMl'), value: 'ml' },
]);

const previewKcal = computed<number>(() => kcal.value || 0);
const previewProtein = computed<number>(() => proteinG.value || 0);
const previewCarbs = computed<number>(() => carbsG.value || 0);
const previewFat = computed<number>(() => fatG.value || 0);

const errors = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  if (name.value.trim().length === 0) {
    out['name'] = t('nutrition.customFood.errorNameRequired');
  }
  const numericFields: Array<[string, number, boolean]> = [
    ['kcal', kcal.value, true],
    ['proteinG', proteinG.value, false],
    ['carbsG', carbsG.value, false],
    ['fatG', fatG.value, false],
  ];
  for (const [key, value, strict] of numericFields) {
    if (!Number.isFinite(value) || value < 0 || (strict && value <= 0)) {
      out[key] = t('nutrition.customFood.errorInvalidNumbers');
    }
  }
  if (fiberG.value !== null && (!Number.isFinite(fiberG.value) || fiberG.value < 0)) {
    out['fiberG'] = t('nutrition.customFood.errorInvalidNumbers');
  }
  return out;
});

watch(open, async (val) => {
  if (val) {
    externalQuery.value = '';
    externalResults.value = [];
    selectedExternal.value = null;
    if (props.editingId) {
      await loadForEdit(props.editingId);
    } else {
      reset();
    }
  }
});

async function loadForEdit(id: string): Promise<void> {
  const conn = await getDatabase();
  const foods = await nutritionService.listCustomFoods(conn, { locale: props.locale });
  const found = foods.find((f) => f.id === id);
  if (!found) {
    Notify.create({
      message: t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
    open.value = false;
    return;
  }
  editingCustom.value = found;
  name.value = found.name;
  barcode.value = found.barcode ?? '';
  brand.value = found.brand ?? '';
  baseAmount.value = found.baseAmountG;
  baseUnit.value = found.baseUnit;
  kcal.value = found.kcal;
  proteinG.value = found.proteinG;
  carbsG.value = found.carbsG;
  fatG.value = found.fatG;
  fiberG.value = found.fiberG;
  externalSource.value = found.externalSource ?? null;
  externalId.value = found.externalId ?? null;
  selectedExternal.value = null;
  externalQuery.value = '';
  externalResults.value = [];
}

function reset(): void {
  name.value = '';
  barcode.value = '';
  brand.value = '';
  baseAmount.value = 100;
  baseUnit.value = 'g';
  kcal.value = 0;
  proteinG.value = 0;
  carbsG.value = 0;
  fatG.value = 0;
  fiberG.value = null;
  editingCustom.value = null;
  externalSource.value = null;
  externalId.value = null;
  selectedExternal.value = null;
  externalQuery.value = '';
  externalResults.value = [];
  searchingExternal.value = false;
}

function generateUserFoodId(): string {
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoLike && typeof cryptoLike.randomUUID === 'function') {
    return `food:user:${cryptoLike.randomUUID()}`;
  }
  return `food:user:${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFoodIdSegment(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function generateExternalFoodId(food: ExternalFood): string {
  const key = sanitizeFoodIdSegment(food.barcode ?? food.externalId);
  return key.length > 0 ? `food:off:${key}` : generateUserFoodId();
}

function applyExternalFood(food: ExternalFood): void {
  selectedExternal.value = food;
  externalSource.value = food.source;
  externalId.value = food.externalId;
  name.value = food.name;
  barcode.value = food.barcode ?? '';
  brand.value = food.brand ?? '';
  baseAmount.value = food.baseAmountG;
  baseUnit.value = food.baseUnit;
  kcal.value = food.kcal;
  proteinG.value = food.proteinG;
  carbsG.value = food.carbsG;
  fatG.value = food.fatG;
  fiberG.value = food.fiberG;
}

async function searchExternal(): Promise<void> {
  const query = externalQuery.value.trim();
  const barcodeCandidate = query.replace(/[\s-]/g, '');
  selectedExternal.value = null;
  externalSource.value = null;
  externalId.value = null;
  externalResults.value = [];
  if (query.length === 0) {
    return;
  }
  searchingExternal.value = true;
  try {
    if (/^\d{8,14}$/.test(barcodeCandidate)) {
      const found = await openFoodFactsService.findByBarcode({
        locale: props.locale,
        barcode: barcodeCandidate,
      });
      externalResults.value = found ? [found] : [];
      if (!found) {
        barcode.value = barcodeCandidate;
      }
      return;
    }
    externalResults.value = await openFoodFactsService.searchFoods({
      locale: props.locale,
      query,
      pageSize: 20,
    });
  } catch (err) {
    Notify.create({
      message: t('nutrition.off.connectionError'),
      color: 'negative',
      position: 'bottom',
    });
    void err;
  } finally {
    searchingExternal.value = false;
  }
}

function buildFoodSnapshot(id: string): Food {
  return {
    id,
    origin: 'custom',
    externalSource: externalSource.value,
    externalId: externalId.value,
    barcode: barcode.value.trim().length > 0 ? barcode.value.trim() : null,
    brand: brand.value.trim().length > 0 ? brand.value.trim() : null,
    baseAmountG: baseAmount.value,
    baseUnit: baseUnit.value,
    kcal: kcal.value,
    proteinG: proteinG.value,
    carbsG: carbsG.value,
    fatG: fatG.value,
    fiberG: fiberG.value,
    createdAt: editingCustom.value?.createdAt ?? '',
    updatedAt: editingCustom.value?.updatedAt ?? '',
  };
}

async function save(): Promise<void> {
  if (Object.keys(errors.value).length > 0) return;
  saving.value = true;
  try {
    const conn = await getDatabase();
    if (props.editingId) {
      const food = buildFoodSnapshot(props.editingId);
      await nutritionService.updateCustomFood(conn, {
        id: props.editingId,
        name: name.value.trim(),
        locale: props.locale,
        externalSource: food.externalSource,
        externalId: food.externalId,
        barcode: food.barcode,
        brand: food.brand,
        baseAmountG: baseAmount.value,
        baseUnit: baseUnit.value,
        kcal: kcal.value,
        proteinG: proteinG.value,
        carbsG: carbsG.value,
        fatG: fatG.value,
        fiberG: fiberG.value,
      });
      emit('saved', food);
      Notify.create({
        message: t('common.save'),
        color: 'positive',
        position: 'bottom',
        timeout: 1500,
      });
    } else {
      const id = selectedExternal.value ? generateExternalFoodId(selectedExternal.value) : generateUserFoodId();
      const snapshot = buildFoodSnapshot(id);
      const createdFood = await nutritionService.createCustomFood(conn, {
        id,
        name: name.value.trim(),
        locale: props.locale,
        externalSource: snapshot.externalSource,
        externalId: snapshot.externalId,
        barcode: snapshot.barcode,
        brand: snapshot.brand,
        baseAmountG: snapshot.baseAmountG,
        baseUnit: snapshot.baseUnit,
        kcal: snapshot.kcal,
        proteinG: snapshot.proteinG,
        carbsG: snapshot.carbsG,
        fatG: snapshot.fatG,
        fiberG: snapshot.fiberG,
      });
      emit('saved', createdFood);
      Notify.create({
        message: t('common.save'),
        color: 'positive',
        position: 'bottom',
        timeout: 1500,
      });
    }
    open.value = false;
    reset();
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  } finally {
    saving.value = false;
  }
}

function confirmDelete(): void {
  if (!props.editingId) return;
  Dialog.create({
    title: t('nutrition.customFood.delete'),
    message: t('nutrition.customFood.deleteConfirm'),
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDelete();
  });
}

async function doDelete(): Promise<void> {
  if (!props.editingId) return;
  try {
    const conn = await getDatabase();
    await nutritionService.deleteCustomFood(conn, { id: props.editingId });
    emit('deleted', props.editingId);
    Notify.create({
      message: t('common.save'),
      color: 'positive',
      position: 'bottom',
      timeout: 1500,
    });
    open.value = false;
    reset();
  } catch (err) {
    Notify.create({
      message: err instanceof Error ? err.message : t('common.error'),
      color: 'negative',
      position: 'bottom',
    });
  }
}
</script>

<style lang="scss" scoped>
.custom-food {
  min-height: 70vh;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--amilio-border);
  }

  &__title {
    font-weight: 700;
    font-size: 1.05rem;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__lookup {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__results {
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid var(--amilio-border);
    border-radius: 12px;
  }

  &__row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  &__amount {
    flex: 1;
  }

  &__barcode,
  &__brand {
    flex: 1;
  }

  &__unit-toggle {
    border: 1px solid var(--amilio-border);
    border-radius: 8px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  &__preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  &__chip {
    background: var(--amilio-bg-light);
    border: 1px solid var(--amilio-border);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--amilio-text-dark);
  }

  &__error-block {
    color: var(--amilio-negative, #ef4444);
    font-size: 0.85rem;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid var(--amilio-border);
  }

  &__delete {
    margin-right: auto;
  }
}

.body--dark .custom-food {
  &__chip {
    background: var(--amilio-surface-dark);
    color: var(--amilio-text-light);
    border-color: var(--amilio-border);
  }

  &__head,
  &__actions {
    border-color: var(--amilio-surface-dark);
  }
}
</style>
