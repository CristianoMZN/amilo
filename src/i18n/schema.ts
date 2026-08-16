// Shared i18n message keys structure. Each locale file must satisfy this
// shape; missing keys will fall back to the `en` locale.

export interface AppMessages {
  app: {
    name: string;
    tagline: string;
  };
  nav: {
    home: string;
    nutrition: string;
    exercise: string;
    workout: string;
    manage: string;
    onboarding: string;
    settings: string;
  };
  common: {
    continue: string;
    back: string;
    next: string;
    finish: string;
    cancel: string;
    save: string;
    skip: string;
    yes: string;
    no: string;
    optional: string;
    required: string;
    loading: string;
    error: string;
    retry: string;
  };
  units: {
    kg: string;
    g: string;
    cm: string;
    km: string;
    m: string;
    ml: string;
    l: string;
    lb: string;
    oz: string;
    ft: string;
    inch: string;
    mi: string;
    flOz: string;
    serving: string;
    set: string;
    sets: string;
    rep: string;
    reps: string;
    min: string;
  };
  onboarding: {
    welcome: {
      title: string;
      subtitle: string;
      cta: string;
    };
    language: {
      title: string;
      subtitle: string;
    };
    measurement: {
      title: string;
      subtitle: string;
      metric: string;
      metricHint: string;
      imperial: string;
      imperialHint: string;
    };
    name: {
      title: string;
      subtitle: string;
      placeholder: string;
    };
    birthDate: {
      title: string;
      subtitle: string;
      placeholder: string;
    };
    sex: {
      title: string;
      subtitle: string;
      male: string;
      female: string;
    };
    height: {
      title: string;
      subtitle: string;
      metricLabel: string;
      imperialLabel: string;
      ftHint: string;
      inHint: string;
    };
    weight: {
      title: string;
      subtitle: string;
      metricLabel: string;
      imperialLabel: string;
    };
    activity: {
      title: string;
      subtitle: string;
      sedentary: string;
      sedentaryDesc: string;
      lightlyActive: string;
      lightlyActiveDesc: string;
      moderatelyActive: string;
      moderatelyActiveDesc: string;
      veryActive: string;
      veryActiveDesc: string;
      extremelyActive: string;
      extremelyActiveDesc: string;
    };
    goal: {
      title: string;
      subtitle: string;
      lose: string;
      maintain: string;
      gain: string;
    };
    summary: {
      title: string;
      subtitle: string;
      bmrLabel: string;
      tdeeLabel: string;
      weightLabel: string;
      goalLabel: string;
      activityLabel: string;
      estimateNotice: string;
      finish: string;
    };
    errors: {
      nameRequired: string;
      birthDateRequired: string;
      birthDateFuture: string;
      birthDateTooOld: string;
      heightRequired: string;
      heightOutOfRange: string;
      weightRequired: string;
      weightOutOfRange: string;
    };
  };
  dashboard: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    greetingNight: string;
    summary: string;
    currentWeight: string;
    basalMetabolism: string;
    dailyExpenditure: string;
    goal: string;
    activity: string;
    placeholderNotice: string;
  };
  theme: {
    light: string;
    dark: string;
    system: string;
  };
  goals: {
    lose: string;
    maintain: string;
    gain: string;
  };
  activityShort: {
    sedentary: string;
    lightly_active: string;
    moderately_active: string;
    very_active: string;
    extremely_active: string;
  };
  nutrition: {
    page: {
      title: string;
      summary: string;
      pickDate: string;
      todayShortcut: string;
      yesterdayShortcut: string;
      pickAnother: string;
      dayPickerLabel: string;
    };
    totals: {
      consumed: string;
      remaining: string;
      kcalShort: string;
      goalLabel: string;
      noGoal: string;
      setGoalCta: string;
    };
    macros: {
      protein: string;
      carbs: string;
      fat: string;
      fiber: string;
      proteinShort: string;
      carbsShort: string;
      fatShort: string;
      fiberShort: string;
    };
    meal: {
      addCta: string;
      empty: string;
      itemsCount: string;
      itemCountOne: string;
      deleteMeal: string;
      deleteMealConfirm: string;
      rename: string;
      renameTitle: string;
      duplicate: string;
      addAgain: string;
      repeatYesterday: string;
      mealNamePlaceholder: string;
      customMealType: string;
    };
    mealTypes: {
      breakfast: string;
      lunch: string;
      snack: string;
      dinner: string;
      supper: string;
      custom: string;
    };
    item: {
      edit: string;
      delete: string;
      deleteConfirm: string;
      deletedToast: string;
      undo: string;
      amount: string;
      amountHint: string;
      perHundred: string;
    };
    food: {
      searchPlaceholder: string;
      searchHint: string;
      noResults: string;
      recent: string;
      favorites: string;
      all: string;
      official: string;
      custom: string;
      originOfficial: string;
      originCustom: string;
      perBase: string;
    };
    addFood: {
      sheetTitle: string;
      sheetSubtitle: string;
      selectFood: string;
      addToMeal: string;
      addButton: string;
      addAnotherButton: string;
      quantity: string;
      unit: string;
      livePreview: string;
      perBase100: string;
      invalidAmount: string;
    };
    customFood: {
      titleNew: string;
      titleEdit: string;
      nameLabel: string;
      namePlaceholder: string;
      baseAmountLabel: string;
      baseUnitLabel: string;
      unitG: string;
      unitMl: string;
      kcalLabel: string;
      proteinLabel: string;
      carbsLabel: string;
      fatLabel: string;
      fiberLabel: string;
      fiberOptional: string;
      save: string;
      delete: string;
      deleteConfirm: string;
      errorNameRequired: string;
      errorInvalidNumbers: string;
    };
    favorites: {
      title: string;
      toggle: string;
      untoggle: string;
      empty: string;
    };
    recents: {
      title: string;
      empty: string;
    };
    savedMeal: {
      saveTitle: string;
      saveCta: string;
      nameLabel: string;
      namePlaceholder: string;
      saved: string;
      titleManager: string;
      empty: string;
      addToMeal: string;
      addToMealConfirm: string;
      delete: string;
      deleteConfirm: string;
      itemsCount: string;
    };
    repeatMeal: {
      title: string;
      confirm: string;
      itemsAdded: string;
    };
    targets: {
      title: string;
      edit: string;
      kcalLabel: string;
      proteinLabel: string;
      carbsLabel: string;
      fatLabel: string;
      fiberLabel: string;
      save: string;
      suggestFromProfile: string;
      appliedSuggestion: string;
      requiredKcal: string;
      requiredNonNegative: string;
    };
    copy: {
      proteinBar: string;
      carbsBar: string;
      fatBar: string;
      ofGoal: string;
      noGoal: string;
      progressTrackAria: string;
      kcalShort: string;
      macroChips: string;
    };
  };
  exercise: {
    page: {
      title: string;
      summary: string;
      todayAerobic: string;
      recordAerobicCta: string;
      noAerobicToday: string;
      manageWorkoutsCta: string;
      noSheetsCta: string;
      noSheetsHint: string;
      recent: string;
      favorites: string;
      searchPlaceholder: string;
      searchHint: string;
      noResults: string;
    };
    tabs: {
      aerobic: string;
      strength: string;
    };
    origin: {
      official: string;
      custom: string;
    };
    aerobic: {
      addSheetTitle: string;
      addSheetSubtitle: string;
      exerciseLabel: string;
      durationLabel: string;
      durationHint: string;
      kcalEstimatedLabel: string;
      notesLabel: string;
      save: string;
      invalidDuration: string;
      invalidKcalPerHour: string;
      emptyHistory: string;
      edit: string;
      delete: string;
      deleteConfirm: string;
      recentTitle: string;
      favoritesTitle: string;
      customCreateTitle: string;
      customCreateNameLabel: string;
      customCreateKcalLabel: string;
      customCreateSave: string;
      customEditTitle: string;
      customDeleteConfirm: string;
    };
    strength: {
      addSheetTitle: string;
      addSheetSubtitle: string;
      searchPlaceholder: string;
      filterAll: string;
      muscleGroups: {
        chest: string;
        back: string;
        shoulders: string;
        biceps: string;
        triceps: string;
        legs: string;
        glutes: string;
        calves: string;
        core: string;
        lowerBack: string;
        fullBody: string;
        other: string;
      };
      customCreateTitle: string;
      customCreateNameLabel: string;
      customCreateMuscleGroupLabel: string;
      customCreateNotesLabel: string;
      customCreateSave: string;
      customEditTitle: string;
      customDeleteConfirm: string;
    };
  };
  workout: {
    page: {
      title: string;
      summary: string;
      manageCta: string;
      startWorkoutCta: string;
      resumeWorkoutCta: string;
      noSheetsHint: string;
      noSheetsCta: string;
    };
    manage: {
      title: string;
      newSheetCta: string;
      noSheetsHint: string;
      noSheetsCta: string;
      newSheetSheetTitle: string;
      newSheetNameLabel: string;
      newSheetNamePlaceholder: string;
      newSheetSave: string;
      renameSheet: string;
      deleteSheet: string;
      deleteSheetConfirm: string;
      sessionsHeader: string;
      addSessionCta: string;
      newSessionTitle: string;
      newSessionNameLabel: string;
      newSessionNamePlaceholder: string;
      newSessionSave: string;
      renameSession: string;
      deleteSession: string;
      deleteSessionConfirm: string;
      exercisesHeader: string;
      addExerciseCta: string;
      emptyExercises: string;
      plannedSetsLabel: string;
      plannedRepsLabel: string;
      plannedWeightLabel: string;
      notesLabel: string;
      exerciseNameFallback: string;
      deleteExerciseConfirm: string;
      moveUp: string;
      moveDown: string;
    };
    session: {
      inProgressBanner: string;
      continueCta: string;
      discardCta: string;
      finishCta: string;
      abandonCta: string;
      abandonConfirm: string;
      finishConfirm: string;
      noExercisesHint: string;
      addSetCta: string;
      deleteSetCta: string;
      setRepsLabel: string;
      setWeightLabel: string;
      markDone: string;
      markUndone: string;
      finishExerciseCta: string;
      finishedBadge: string;
      previousWorkoutLabel: string;
      noPreviousWorkout: string;
      recordLabel: string;
      volumeLabel: string;
      repsDeltaLabel: string;
      weightDeltaLabel: string;
      volumeDeltaLabel: string;
    };
    history: {
      title: string;
      empty: string;
      openMenu: string;
      deleteWorkout: string;
      deleteWorkoutConfirm: string;
      durationLabel: string;
      statusLabel: string;
      statusInProgress: string;
      statusCompleted: string;
      statusAbandoned: string;
    };
    recovery: {
      title: string;
      message: string;
      continueCta: string;
      discardCta: string;
    };
    units: {
      sets: string;
      setsOne: string;
      reps: string;
      repsOne: string;
      min: string;
      minOne: string;
      seconds: string;
      secondsOne: string;
      kgPerLbHint: string;
      lbPerKgHint: string;
    };
    validation: {
      sheetNameRequired: string;
      sessionNameRequired: string;
      invalidReps: string;
      invalidWeight: string;
      invalidSets: string;
    };
  };
}

export type MessageSchema = AppMessages;