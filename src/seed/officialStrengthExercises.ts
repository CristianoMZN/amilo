// Bundled strength exercise catalog — official reference rows seeded on first boot.
//
// IDs are stable string slugs (`'exercise:<name>'`). Corrections to a
// strength exercise's `muscleGroup` or default unit never UPSERT an
// existing id — they add a new id and retire the old one — so historical
// `workout_planned_exercise` and `performed_workout_exercise` snapshots
// stay immune.
//
// `defaultUnit` policy:
//   - 'kg'        : external load expected (most free-weight / machine exercises)
//   - 'bodyweight': load is optional (e.g. weighted push-up, weighted pull-up)
//   - 'none'      : load does not apply (isometric or pure bodyweight reps)
//
// Data organisation note: entries are kept in a single file so a future
// contributor can see the whole catalog at a glance. Rows are grouped by
// primary muscle group for readability, then the exported array is sorted
// alphabetically by id for predictable diffs.

import type {
  Exercise,
  ExerciseDefaultUnit,
  ExerciseKind,
  ExerciseOrigin,
  MuscleGroup,
  SupportedLocale,
} from 'src/domain/types';

/**
 * A seed row for a strength exercise. `exercise` carries the parent-table
 * columns (timestamps are owned by the seed runner); `translations` is the
 * per-locale display name keyed by the full `SupportedLocale` set.
 */
export interface OfficialStrengthExerciseSeed {
  exercise: Omit<Exercise, 'createdAt' | 'updatedAt'>;
  translations: Record<SupportedLocale, string>;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Compact builder for an `OfficialStrengthExerciseSeed` row. Keeps each
 * entry readable as a single multi-line `seedStrength(...)` call while
 * avoiding the noise of hand-written `{ exercise: {…}, translations: {…} }`
 * literals. Strength exercises are rep-based, so `hasRepetitions` is locked
 * to `true` and `hasDuration` to `false` here.
 */
function seedStrength(
  id: string,
  muscleGroup: MuscleGroup,
  defaultUnit: ExerciseDefaultUnit,
  translations: Record<SupportedLocale, string>,
): OfficialStrengthExerciseSeed {
  // `origin` is locked to `'official'`: this is the bundled catalog.
  // `kind` is locked to `'strength'`. Reps-based flag pair is pinned.
  const exercise: Omit<Exercise, 'createdAt' | 'updatedAt'> = {
    id,
    origin: 'official' satisfies ExerciseOrigin,
    kind: 'strength' satisfies ExerciseKind,
    muscleGroup,
    defaultUnit,
    hasRepetitions: true,
    hasDuration: false,
    notes: null,
  };
  return { exercise, translations };
}

// ---------------------------------------------------------------------------
// Rows — grouped by primary muscle group for readability.
// ---------------------------------------------------------------------------

const STRENGTH_ROWS: OfficialStrengthExerciseSeed[] = [
  // ----- Chest ------------------------------------------------------------
  seedStrength('exercise:barbell_bench_press', 'chest', 'kg', {
    en: 'Barbell bench press',
    es: 'Press de banca con barra',
    'pt-BR': 'Supino reto com barra',
    de: 'Langhantel-Bankdrücken',
    fr: 'Développé couché à la barre',
    ja: 'バーベルベンチプレス',
    ko: '바벨 벤치 프레스',
    it: 'Panca piana con bilanciere',
  }),
  seedStrength('exercise:incline_barbell_bench_press', 'chest', 'kg', {
    en: 'Incline barbell bench press',
    es: 'Press de banca inclinado con barra',
    'pt-BR': 'Supino inclinado com barra',
    de: 'Langhantel-Schrägbankdrücken',
    fr: 'Développé incliné à la barre',
    ja: 'インクライン バーベルベンチプレス',
    ko: '인클라인 바벨 벤치 프레스',
    it: 'Panca inclinata con bilanciere',
  }),
  seedStrength('exercise:dumbbell_bench_press', 'chest', 'kg', {
    en: 'Dumbbell bench press',
    es: 'Press de banca con mancuernas',
    'pt-BR': 'Supino reto com halteres',
    de: 'Kurzhantel-Bankdrücken',
    fr: 'Développé couché aux haltères',
    ja: 'ダンベルベンチプレス',
    ko: '덤벨 벤치 프레스',
    it: 'Panca piana con manubri',
  }),
  seedStrength('exercise:incline_dumbbell_press', 'chest', 'kg', {
    en: 'Incline dumbbell press',
    es: 'Press inclinado con mancuernas',
    'pt-BR': 'Supino inclinado com halteres',
    de: 'Kurzhantel-Schrägbankdrücken',
    fr: 'Développé incliné aux haltères',
    ja: 'インクライン ダンベルプレス',
    ko: '인클라인 덤벨 프레스',
    it: 'Panca inclinata con manubri',
  }),
  seedStrength('exercise:dumbbell_fly', 'chest', 'kg', {
    en: 'Dumbbell fly',
    es: 'Aperturas con mancuernas',
    'pt-BR': 'Crucifixo com halteres',
    de: 'Kurzhantel-Fliegende',
    fr: 'Écarté aux haltères',
    ja: 'ダンベルフライ',
    ko: '덤벨 플라이',
    it: 'Croci con manubri',
  }),
  seedStrength('exercise:cable_crossover', 'chest', 'kg', {
    en: 'Cable crossover',
    es: 'Cruce de poleas',
    'pt-BR': 'Crossover na polia',
    de: 'Kabelzug-Fliegende',
    fr: 'Cable crossover',
    ja: 'ケーブルクロスオーバー',
    ko: '케이블 크로스오버',
    it: 'Cable crossover',
  }),
  seedStrength('exercise:push_up', 'chest', 'bodyweight', {
    en: 'Push-up',
    es: 'Flexión',
    'pt-BR': 'Flexão',
    de: 'Liegestütz',
    fr: 'Pompe',
    ja: 'プッシュアップ',
    ko: '푸시업',
    it: 'Piegamenti sulle braccia',
  }),
  seedStrength('exercise:dips', 'chest', 'bodyweight', {
    en: 'Dips',
    es: 'Fondos',
    'pt-BR': 'Mergulho',
    de: 'Dips',
    fr: 'Dips',
    ja: 'ディップス',
    ko: '딥스',
    it: 'Dips',
  }),

  // ----- Back -------------------------------------------------------------
  seedStrength('exercise:lat_pulldown', 'back', 'kg', {
    en: 'Lat pulldown',
    es: 'Jalón al pecho',
    'pt-BR': 'Puxada frontal',
    de: 'Latziehen',
    fr: 'Tirage vertical',
    ja: 'ラットプルダウン',
    ko: '랫 풀다운',
    it: 'Lat machine',
  }),
  seedStrength('exercise:barbell_row', 'back', 'kg', {
    en: 'Barbell row',
    es: 'Remo con barra',
    'pt-BR': 'Remada com barra',
    de: 'Langhantelrudern',
    fr: 'Rowing à la barre',
    ja: 'バーベルロウ',
    ko: '바벨 로우',
    it: 'Rematore con bilanciere',
  }),
  seedStrength('exercise:seated_cable_row', 'back', 'kg', {
    en: 'Seated cable row',
    es: 'Remo sentado en polea',
    'pt-BR': 'Remada sentada na polia',
    de: 'Sitzendes Kabelrudern',
    fr: 'Rowing à la poulie',
    ja: 'シーテッドケーブルロウ',
    ko: '시티드 케이블 로우',
    it: 'Rematore al cavo',
  }),
  seedStrength('exercise:dumbbell_row', 'back', 'kg', {
    en: 'Dumbbell row',
    es: 'Remo con mancuerna',
    'pt-BR': 'Remada unilateral com halter',
    de: 'Kurzhantelrudern',
    fr: 'Rowing à l’haltère',
    ja: 'ダンベルロウ',
    ko: '덤벨 로우',
    it: 'Rematore con manubrio',
  }),
  seedStrength('exercise:pull_up', 'back', 'bodyweight', {
    en: 'Pull-up',
    es: 'Dominada',
    'pt-BR': 'Barra fixa',
    de: 'Klimmzug',
    fr: 'Traction',
    ja: 'プルアップ',
    ko: '풀업',
    it: 'Trazione alla sbarra',
  }),
  seedStrength('exercise:chin_up', 'back', 'bodyweight', {
    en: 'Chin-up',
    es: 'Dominada supina',
    'pt-BR': 'Barra fixa supinada',
    de: 'Untergriff-Klimmzug',
    fr: 'Chin-up',
    ja: 'チンアップ',
    ko: '친업',
    it: 'Trazione a presa supinata',
  }),
  seedStrength('exercise:t_bar_row', 'back', 'kg', {
    en: 'T-bar row',
    es: 'Remo en T',
    'pt-BR': 'Remada cavalinho',
    de: 'T-Rudern',
    fr: 'Rowing à la barre T',
    ja: 'Tバーロウ',
    ko: 'T바 로우',
    it: 'Rematore a T',
  }),
  seedStrength('exercise:face_pull', 'back', 'kg', {
    en: 'Face pull',
    es: 'Face pull',
    'pt-BR': 'Face pull',
    de: 'Face Pull',
    fr: 'Face pull',
    ja: 'フェイスプル',
    ko: '페이스 풀',
    it: 'Face pull',
  }),

  // ----- Shoulders --------------------------------------------------------
  seedStrength('exercise:overhead_press', 'shoulders', 'kg', {
    en: 'Overhead press',
    es: 'Press militar',
    'pt-BR': 'Desenvolvimento militar',
    de: 'Schulterdrücken',
    fr: 'Développé militaire',
    ja: 'オーバーヘッドプレス',
    ko: '오버헤드 프레스',
    it: 'Lento avanti',
  }),
  seedStrength('exercise:dumbbell_shoulder_press', 'shoulders', 'kg', {
    en: 'Dumbbell shoulder press',
    es: 'Press de hombros con mancuernas',
    'pt-BR': 'Desenvolvimento com halteres',
    de: 'Kurzhantel-Schulterdrücken',
    fr: 'Développé épaules aux haltères',
    ja: 'ダンベルショルダープレス',
    ko: '덤벨 숄더 프레스',
    it: 'Lento avanti con manubri',
  }),
  seedStrength('exercise:lateral_raise', 'shoulders', 'kg', {
    en: 'Lateral raise',
    es: 'Elevaciones laterales',
    'pt-BR': 'Elevação lateral',
    de: 'Seitheben',
    fr: 'Élévation latérale',
    ja: 'サイドレイズ',
    ko: '레터럴 레이즈',
    it: 'Alzate laterali',
  }),
  seedStrength('exercise:front_raise', 'shoulders', 'kg', {
    en: 'Front raise',
    es: 'Elevaciones frontales',
    'pt-BR': 'Elevação frontal',
    de: 'Frontheben',
    fr: 'Élévation frontale',
    ja: 'フロントレイズ',
    ko: '프론트 레이즈',
    it: 'Alzate frontali',
  }),
  seedStrength('exercise:rear_delt_fly', 'shoulders', 'kg', {
    en: 'Rear delt fly',
    es: 'Apertura posterior de hombro',
    'pt-BR': 'Crucifixo inverso',
    de: 'Umgekehrtes Fliegende',
    fr: 'Écarté arrière',
    ja: 'リアデルトフライ',
    ko: '리어 델트 플라이',
    it: 'Croci inverse',
  }),
  seedStrength('exercise:arnold_press', 'shoulders', 'kg', {
    en: 'Arnold press',
    es: 'Press Arnold',
    'pt-BR': 'Desenvolvimento Arnold',
    de: 'Arnold-Press',
    fr: 'Press Arnold',
    ja: 'アーノルドプレス',
    ko: '아놀드 프레스',
    it: 'Press Arnold',
  }),
  seedStrength('exercise:upright_row', 'shoulders', 'kg', {
    en: 'Upright row',
    es: 'Remo al mentón',
    'pt-BR': 'Remada alta',
    de: 'Aufrechtes Rudern',
    fr: 'Tirage menton',
    ja: 'アップライトロウ',
    ko: '업라이트 로우',
    it: 'Tirate al mento',
  }),

  // ----- Biceps -----------------------------------------------------------
  seedStrength('exercise:barbell_curl', 'biceps', 'kg', {
    en: 'Barbell curl',
    es: 'Curl con barra',
    'pt-BR': 'Rosca direta com barra',
    de: 'Langhantel-Curl',
    fr: 'Curl à la barre',
    ja: 'バーベルカール',
    ko: '바벨 컬',
    it: 'Curl con bilanciere',
  }),
  seedStrength('exercise:dumbbell_curl', 'biceps', 'kg', {
    en: 'Dumbbell curl',
    es: 'Curl con mancuernas',
    'pt-BR': 'Rosca direta com halteres',
    de: 'Kurzhantel-Curl',
    fr: 'Curl aux haltères',
    ja: 'ダンベルカール',
    ko: '덤벨 컬',
    it: 'Curl con manubri',
  }),
  seedStrength('exercise:hammer_curl', 'biceps', 'kg', {
    en: 'Hammer curl',
    es: 'Curl martillo',
    'pt-BR': 'Rosca martelo',
    de: 'Hammer-Curl',
    fr: 'Curl marteau',
    ja: 'ハンマーカール',
    ko: '해머 컬',
    it: 'Curl a martello',
  }),
  seedStrength('exercise:preacher_curl', 'biceps', 'kg', {
    en: 'Preacher curl',
    es: 'Curl en banco Scott',
    'pt-BR': 'Rosca no banco Scott',
    de: 'Scott-Curl',
    fr: 'Curl pupitre',
    ja: 'プリーチャーカール',
    ko: '프리처 컬',
    it: 'Curl alla panca Scott',
  }),
  seedStrength('exercise:concentration_curl', 'biceps', 'kg', {
    en: 'Concentration curl',
    es: 'Curl concentrado',
    'pt-BR': 'Rosca concentrada',
    de: 'Konzentrations-Curl',
    fr: 'Curl concentré',
    ja: 'コンセントレーションカール',
    ko: '컨센트레이션 컬',
    it: 'Curl concentrato',
  }),
  seedStrength('exercise:cable_curl', 'biceps', 'kg', {
    en: 'Cable curl',
    es: 'Curl en polea',
    'pt-BR': 'Rosca na polia',
    de: 'Kabel-Curl',
    fr: 'Curl à la poulie',
    ja: 'ケーブルカール',
    ko: '케이블 컬',
    it: 'Curl al cavo',
  }),

  // ----- Triceps ----------------------------------------------------------
  seedStrength('exercise:tricep_pushdown', 'triceps', 'kg', {
    en: 'Tricep pushdown',
    es: 'Extensión de tríceps en polea',
    'pt-BR': 'Extensão de tríceps na polia',
    de: 'Trizeps-Drücken am Kabel',
    fr: 'Extension triceps à la poulie',
    ja: 'トライセッププッシュダウン',
    ko: '트라이셉 푸시다운',
    it: 'Pushdown tricipiti',
  }),
  seedStrength('exercise:skull_crusher', 'triceps', 'kg', {
    en: 'Skull crusher',
    es: 'Press francés',
    'pt-BR': 'Testa',
    de: 'Trizeps-Liegestütz',
    fr: 'Skull crusher',
    ja: 'スカルクラッシャー',
    ko: '스컬 크러셔',
    it: 'Skull crusher',
  }),
  seedStrength('exercise:close_grip_bench_press', 'triceps', 'kg', {
    en: 'Close-grip bench press',
    es: 'Press de banca cerrado',
    'pt-BR': 'Supino reto pegada fechada',
    de: 'Enges Bankdrücken',
    fr: 'Développé couché prise serrée',
    ja: 'クローズグリップベンチプレス',
    ko: '클로즈그립 벤치 프레스',
    it: 'Panca piana presa stretta',
  }),
  seedStrength('exercise:overhead_tricep_extension', 'triceps', 'kg', {
    en: 'Overhead tricep extension',
    es: 'Extensión de tríceps por encima de la cabeza',
    'pt-BR': 'Extensão de tríceps acima da cabeça',
    de: 'Trizeps-Überkopf-Streckung',
    fr: 'Extension triceps au-dessus de la tête',
    ja: 'オーバーヘッドトライセップエクステンション',
    ko: '오버헤드 트라이셉 익스텐션',
    it: 'Estensione tricipiti sopra la testa',
  }),
  seedStrength('exercise:tricep_dip', 'triceps', 'bodyweight', {
    en: 'Tricep dip',
    es: 'Fondos para tríceps',
    'pt-BR': 'Mergulho para tríceps',
    de: 'Trizeps-Dip',
    fr: 'Dip triceps',
    ja: 'トライセップディップ',
    ko: '트라이셉 딥',
    it: 'Dip per tricipiti',
  }),
  seedStrength('exercise:rope_pushdown', 'triceps', 'kg', {
    en: 'Rope pushdown',
    es: 'Extensión de tríceps con cuerda',
    'pt-BR': 'Extensão de tríceps com corda',
    de: 'Seil-Trizeps-Drücken',
    fr: 'Extension triceps à la corde',
    ja: 'ローププッシュダウン',
    ko: '로프 푸시다운',
    it: 'Pushdown con corda',
  }),

  // ----- Legs -------------------------------------------------------------
  seedStrength('exercise:barbell_back_squat', 'legs', 'kg', {
    en: 'Barbell back squat',
    es: 'Sentadilla trasera con barra',
    'pt-BR': 'Agachamento com barra nas costas',
    de: 'Langhantel-Kniebeuge',
    fr: 'Squat à la barre',
    ja: 'バーベルバックスクワット',
    ko: '바벨 백 스쿼트',
    it: 'Squat con bilanciere',
  }),
  seedStrength('exercise:front_squat', 'legs', 'kg', {
    en: 'Front squat',
    es: 'Sentadilla frontal',
    'pt-BR': 'Agachamento frontal',
    de: 'Front-Kniebeuge',
    fr: 'Squat avant',
    ja: 'フロントスクワット',
    ko: '프론트 스쿼트',
    it: 'Squat frontale',
  }),
  seedStrength('exercise:leg_press', 'legs', 'kg', {
    en: 'Leg press',
    es: 'Prensa de piernas',
    'pt-BR': 'Leg press',
    de: 'Beinpresse',
    fr: 'Presse à cuisses',
    ja: 'レッグプレス',
    ko: '레그 프레스',
    it: 'Leg press',
  }),
  seedStrength('exercise:hack_squat', 'legs', 'kg', {
    en: 'Hack squat',
    es: 'Hack squat',
    'pt-BR': 'Hack squat',
    de: 'Hackenschmidt-Kniebeuge',
    fr: 'Hack squat',
    ja: 'ハックスクワット',
    ko: '핵 스쿼트',
    it: 'Hack squat',
  }),
  seedStrength('exercise:bulgarian_split_squat', 'legs', 'kg', {
    en: 'Bulgarian split squat',
    es: 'Sentadilla búlgara',
    'pt-BR': 'Agachamento búlgaro',
    de: 'Bulgarian Split Squat',
    fr: 'Squat bulgare',
    ja: 'ブルガリアンスプリットスクワット',
    ko: '불가리안 스플릿 스쿼트',
    it: 'Squat bulgaro',
  }),
  seedStrength('exercise:walking_lunge', 'legs', 'kg', {
    en: 'Walking lunge',
    es: 'Zancada caminando',
    'pt-BR': 'Afundo caminhando',
    de: 'Walking Lunge',
    fr: 'Fente marchée',
    ja: 'ウォーキングランジ',
    ko: '워킹 런지',
    it: 'Affondi camminati',
  }),
  seedStrength('exercise:leg_extension', 'legs', 'kg', {
    en: 'Leg extension',
    es: 'Extensión de piernas',
    'pt-BR': 'Extensão de pernas',
    de: 'Beinstreckung',
    fr: 'Leg extension',
    ja: 'レッグエクステンション',
    ko: '레그 익스텐션',
    it: 'Leg extension',
  }),
  seedStrength('exercise:leg_curl', 'legs', 'kg', {
    en: 'Leg curl',
    es: 'Curl femoral',
    'pt-BR': 'Mesa flexora',
    de: 'Beinbeuger',
    fr: 'Leg curl',
    ja: 'レッグカール',
    ko: '레그 컬',
    it: 'Leg curl',
  }),
  seedStrength('exercise:romanian_deadlift', 'legs', 'kg', {
    en: 'Romanian deadlift',
    es: 'Peso muerto rumano',
    'pt-BR': 'Levantamento terra romeno',
    de: 'Rumänisches Kreuzheben',
    fr: 'Soulevé de terre roumain',
    ja: 'ルーマニアンデッドリフト',
    ko: '루마니안 데드리프트',
    it: 'Stacco rumeno',
  }),
  seedStrength('exercise:hip_thrust', 'glutes', 'kg', {
    en: 'Hip thrust',
    es: 'Empuje de cadera',
    'pt-BR': 'Hip thrust',
    de: 'Hip Thrust',
    fr: 'Hip thrust',
    ja: 'ヒップスラスト',
    ko: '힙 스러스트',
    it: 'Hip thrust',
  }),
  seedStrength('exercise:glute_bridge', 'glutes', 'bodyweight', {
    en: 'Glute bridge',
    es: 'Puente de glúteos',
    'pt-BR': 'Elevação de quadril',
    de: 'Glute Bridge',
    fr: 'Pont fessier',
    ja: 'グルートブリッジ',
    ko: '글루트 브릿지',
    it: 'Glute bridge',
  }),
  seedStrength('exercise:calf_raise', 'calves', 'kg', {
    en: 'Calf raise',
    es: 'Elevación de talones',
    'pt-BR': 'Elevação de panturrilha',
    de: 'Wadenheben',
    fr: 'Mollet',
    ja: 'カーフレイズ',
    ko: '카프 레이즈',
    it: 'Sollevamento polpacci',
  }),
  seedStrength('exercise:seated_calf_raise', 'calves', 'kg', {
    en: 'Seated calf raise',
    es: 'Elevación de talones sentado',
    'pt-BR': 'Elevação de panturrilha sentada',
    de: 'Sitzendes Wadenheben',
    fr: 'Mollet assis',
    ja: 'シーテッドカーフレイズ',
    ko: '시티드 카프 레이즈',
    it: 'Sollevamento polpacci da seduto',
  }),
  seedStrength('exercise:box_jump', 'legs', 'bodyweight', {
    en: 'Box jump',
    es: 'Salto al cajón',
    'pt-BR': 'Salto no caixa',
    de: 'Box Jump',
    fr: 'Jump box',
    ja: 'ボックスジャンプ',
    ko: '박스 점프',
    it: 'Salto sul box',
  }),

  // ----- Core -------------------------------------------------------------
  seedStrength('exercise:plank', 'core', 'none', {
    en: 'Plank',
    es: 'Plancha',
    'pt-BR': 'Prancha',
    de: 'Plank',
    fr: 'Planche',
    ja: 'プランク',
    ko: '플랭크',
    it: 'Plank',
  }),
  seedStrength('exercise:crunch', 'core', 'bodyweight', {
    en: 'Crunch',
    es: 'Crunch',
    'pt-BR': 'Abdominal',
    de: 'Crunch',
    fr: 'Crunch',
    ja: 'クランチ',
    ko: '크런치',
    it: 'Crunch',
  }),
  seedStrength('exercise:hanging_leg_raise', 'core', 'none', {
    en: 'Hanging leg raise',
    es: 'Elevación de piernas colgado',
    'pt-BR': 'Elevação de pernas na barra',
    de: 'Hängendes Beinheben',
    fr: 'Relevé de jambes suspendu',
    ja: 'ハンギングレッグレイズ',
    ko: '행잉 레그 레이즈',
    it: 'Sollevamento gambe sospeso',
  }),
  seedStrength('exercise:ab_wheel', 'core', 'bodyweight', {
    en: 'Ab wheel rollout',
    es: 'Rueda abdominal',
    'pt-BR': 'Abdominal com roda',
    de: 'Bauchrolle',
    fr: 'Roue abdominale',
    ja: 'アブローラー',
    ko: '앱휠',
    it: 'Ruota addominale',
  }),
  seedStrength('exercise:russian_twist', 'core', 'none', {
    en: 'Russian twist',
    es: 'Giros rusos',
    'pt-BR': 'Russian twist',
    de: 'Russischer Drehsitz',
    fr: 'Russian twist',
    ja: 'ロシアンツイスト',
    ko: '러시안 트위스트',
    it: 'Russian twist',
  }),
  seedStrength('exercise:cable_crunch', 'core', 'kg', {
    en: 'Cable crunch',
    es: 'Crunch en polea',
    'pt-BR': 'Abdominal na polia',
    de: 'Kabel-Crunch',
    fr: 'Crunch à la poulie',
    ja: 'ケーブルクランチ',
    ko: '케이블 크런치',
    it: 'Crunch al cavo',
  }),
  seedStrength('exercise:side_plank', 'core', 'none', {
    en: 'Side plank',
    es: 'Plancha lateral',
    'pt-BR': 'Prancha lateral',
    de: 'Seitplank',
    fr: 'Planche latérale',
    ja: 'サイドプランク',
    ko: '사이드 플랭크',
    it: 'Side plank',
  }),

  // ----- Lower back -------------------------------------------------------
  seedStrength('exercise:deadlift', 'lower_back', 'kg', {
    en: 'Deadlift',
    es: 'Peso muerto',
    'pt-BR': 'Levantamento terra',
    de: 'Kreuzheben',
    fr: 'Soulevé de terre',
    ja: 'デッドリフト',
    ko: '데드리프트',
    it: 'Stacco da terra',
  }),
  seedStrength('exercise:sumo_deadlift', 'lower_back', 'kg', {
    en: 'Sumo deadlift',
    es: 'Peso muerto sumo',
    'pt-BR': 'Levantamento terra sumô',
    de: 'Sumo-Kreuzheben',
    fr: 'Soulevé de terre sumo',
    ja: 'スモウデッドリフト',
    ko: '스모 데드리프트',
    it: 'Stacco da terra sumo',
  }),
  seedStrength('exercise:good_morning', 'lower_back', 'kg', {
    en: 'Good morning',
    es: 'Buenos días',
    'pt-BR': 'Good morning',
    de: 'Good Morning',
    fr: 'Good morning',
    ja: 'グッドモーニング',
    ko: '굿모닝',
    it: 'Buongiorno',
  }),
  seedStrength('exercise:hyperextension', 'lower_back', 'kg', {
    en: 'Hyperextension',
    es: 'Hiperextensión',
    'pt-BR': 'Hiperextensão',
    de: 'Hyperextension',
    fr: 'Hyperextension',
    ja: 'ハイパーエクステンション',
    ko: '하이퍼 익스텐션',
    it: 'Iperestensione',
  }),

  // ----- Full body --------------------------------------------------------
  seedStrength('exercise:clean_and_press', 'full_body', 'kg', {
    en: 'Clean and press',
    es: 'Cargada y press',
    'pt-BR': 'Clean and press',
    de: 'Umsetzen und Drücken',
    fr: 'Clean and press',
    ja: 'クリーンアンドプレス',
    ko: '클린 앤 프레스',
    it: 'Clean and press',
  }),
  seedStrength('exercise:kettlebell_swing', 'full_body', 'kg', {
    en: 'Kettlebell swing',
    es: 'Swing con kettlebell',
    'pt-BR': 'Swing com kettlebell',
    de: 'Kettlebell-Schwingen',
    fr: 'Swing kettlebell',
    ja: 'ケトルベルスイング',
    ko: '케틀벨 스윙',
    it: 'Swing con kettlebell',
  }),
  seedStrength('exercise:burpee', 'full_body', 'bodyweight', {
    en: 'Burpee',
    es: 'Burpee',
    'pt-BR': 'Burpee',
    de: 'Burpee',
    fr: 'Burpee',
    ja: 'バーピー',
    ko: '버피',
    it: 'Burpee',
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

const SORTED_ROWS: OfficialStrengthExerciseSeed[] = [...STRENGTH_ROWS].sort((a, b) =>
  compareIds(a.exercise.id, b.exercise.id),
);

/**
 * Bundled official strength exercise catalog. Sorted alphabetically by
 * `exercise.id` so structural diffs are easy to read across changes.
 *
 * The exported array is the canonical input for `applySeed` and is also
 * re-imported by structural tests under `src/seed/__tests__/`.
 */
export const OFFICIAL_STRENGTH_EXERCISES: readonly OfficialStrengthExerciseSeed[] = SORTED_ROWS;
