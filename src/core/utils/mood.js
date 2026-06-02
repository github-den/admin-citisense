export const MOOD_KEYS = ['grateful', 'satisfied', 'sad', 'angry'];
export const PREDICTION_PUBLIC_THRESHOLD = 0.0;
export const PREDICTION_INTERNAL_THRESHOLD = 0.0;

export const MOOD_LABELS = {
  grateful: 'Grateful',
  satisfied: 'Satisfied',
  sad: 'Sad',
  angry: 'Angry',
};

export const MOOD_EMOJIS = {
  grateful: '\u{1F970}',
  satisfied: '\u{1F642}',
  sad: '\u{1F622}',
  angry: '\u{1F621}',
};

const REACTION_TO_MOOD = {
  '\u{1F970}': 'grateful',
  '\u{2764}': 'grateful',
  '\u{1F642}': 'satisfied',
  '\u{1F622}': 'sad',
  '\u{1F621}': 'angry',
};

function toTimestamp(value) {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function normalizeMood(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return MOOD_KEYS.includes(normalized) ? normalized : null;
}

export function formatMoodLabel(value) {
  const mood = normalizeMood(value);
  return mood ? MOOD_LABELS[mood] : null;
}

export function getMoodEmoji(value) {
  const mood = normalizeMood(value);
  return mood ? MOOD_EMOJIS[mood] : '\u{1F636}';
}

export function normalizeReactionMood(value) {
  const normalized = String(value ?? '').replace(/\uFE0F/g, '').trim();
  return REACTION_TO_MOOD[normalized] ?? null;
}

export function createEmptyMoodBreakdown() {
  return {
    grateful: 0,
    satisfied: 0,
    sad: 0,
    angry: 0,
  };
}

export function normalizeMoodBreakdown(value) {
  const breakdown = createEmptyMoodBreakdown();
  if (!value || typeof value !== 'object') return breakdown;

  MOOD_KEYS.forEach((key) => {
    const amount = Number(value[key] ?? 0);
    breakdown[key] = Number.isFinite(amount) ? amount : 0;
  });

  return breakdown;
}

function resolveTopMood(breakdown, latestByMood = {}) {
  const topCount = Math.max(...MOOD_KEYS.map((key) => breakdown[key] ?? 0), 0);
  if (topCount <= 0) return { mood: null, hasTie: false };

  const topMoods = MOOD_KEYS.filter((key) => (breakdown[key] ?? 0) === topCount);
  if (topMoods.length === 1) return { mood: topMoods[0], hasTie: false };

  // Strict priority tie-breaker: angry, sad, grateful, satisfied
  const PRIORITY = ['angry', 'sad', 'grateful', 'satisfied'];
  const bestMood = topMoods.reduce((best, current) => 
    PRIORITY.indexOf(current) < PRIORITY.indexOf(best) ? current : best
  );

  return { mood: bestMood, hasTie: false };
}

export function finalizeMoodSummary(breakdownInput, latestByMood = {}, options = {}) {
  const breakdown = normalizeMoodBreakdown(breakdownInput);
  const total = MOOD_KEYS.reduce((sum, key) => sum + breakdown[key], 0);

  if (!total) {
    return {
      mood: null,
      dominantMood: null,
      label: null,
      emoji: '\u{1F636}',
      total: 0,
      breakdown,
      confidence: 0,
      isStrong: false,
      hasTie: false,
      source: 'none',
    };
  }

  const minTotal = Number.isFinite(options.minTotal) ? options.minTotal : 4;
  const minShare = Number.isFinite(options.minShare) ? options.minShare : 0.6;
  const { mood: dominantMood, hasTie } = resolveTopMood(breakdown, latestByMood);
  const confidence = dominantMood ? breakdown[dominantMood] / total : 0;
  const isStrong = Boolean(dominantMood) && total >= minTotal && confidence >= minShare;
  const mood = isStrong ? dominantMood : null;

  return {
    mood,
    dominantMood,
    label: formatMoodLabel(mood),
    emoji: getMoodEmoji(mood),
    total,
    breakdown,
    confidence,
    isStrong,
    hasTie,
    source: isStrong ? 'reactions' : 'none',
  };
}

export function buildReactionSummaryMap(rows = [], idKey = 'post_id') {
  const grouped = new Map();

  rows.forEach((row) => {
    const id = row?.[idKey];
    const mood = normalizeReactionMood(row?.emoji);
    if (!id || !mood) return;

    const current = grouped.get(id) ?? {
      breakdown: createEmptyMoodBreakdown(),
      latestByMood: {},
    };

    current.breakdown[mood] += 1;
    const timestamp = toTimestamp(row?.created_at);
    if (timestamp != null) {
      current.latestByMood[mood] = Math.max(current.latestByMood[mood] ?? -1, timestamp);
    }

    grouped.set(id, current);
  });

  return new Map(
    [...grouped.entries()].map(([id, value]) => [
      id,
      finalizeMoodSummary(value.breakdown, value.latestByMood),
    ]),
  );
}

export function summarizeMoodFromReactionRows(rows = []) {
  const breakdown = createEmptyMoodBreakdown();
  const latestByMood = {};

  rows.forEach((row) => {
    const mood = normalizeReactionMood(row?.emoji);
    if (!mood) return;

    breakdown[mood] += 1;
    const timestamp = toTimestamp(row?.created_at);
    if (timestamp != null) {
      latestByMood[mood] = Math.max(latestByMood[mood] ?? -1, timestamp);
    }
  });

  return finalizeMoodSummary(breakdown, latestByMood);
}

export function summarizeMoodFromStoredMoodRows(rows = [], options = {}) {
  const moodField = options.moodField ?? 'final_mood';
  const timeField = options.timeField ?? 'created_at';
  const breakdown = createEmptyMoodBreakdown();
  const latestByMood = {};

  rows.forEach((row) => {
    const mood = normalizeMood(row?.[moodField]);
    if (!mood) return;

    breakdown[mood] += 1;
    const timestamp = toTimestamp(row?.[timeField]);
    if (timestamp != null) {
      latestByMood[mood] = Math.max(latestByMood[mood] ?? -1, timestamp);
    }
  });

  return finalizeMoodSummary(breakdown, latestByMood, {
    minTotal: options.minTotal,
    minShare: options.minShare,
  });
}

export function summarizeMoodFromPosts(posts = [], options = {}) {
  const allowPrediction = options.allowPrediction !== false;
  const finalBreakdown = createEmptyMoodBreakdown();
  const finalLatestByMood = {};
  const predictedBreakdown = createEmptyMoodBreakdown();
  const predictedLatestByMood = {};

  posts.forEach((post) => {
    const timestamp = toTimestamp(post?.updated_at ?? post?.created_at);
    const finalSummary = getFinalMoodSummary(post);
    if (finalSummary?.mood) {
      const mood = finalSummary.mood;
      finalBreakdown[mood] += 1;
      if (mood && timestamp != null) {
        finalLatestByMood[mood] = Math.max(finalLatestByMood[mood] ?? -1, timestamp);
      }
      return;
    }

    const predicted = getPredictedMoodSummary(post);
    if (!predicted) return;

    predictedBreakdown[predicted.mood] += 1;
    if (timestamp != null) {
      predictedLatestByMood[predicted.mood] = Math.max(predictedLatestByMood[predicted.mood] ?? -1, timestamp);
    }
  });

  const finalSummary = finalizeMoodSummary(finalBreakdown, finalLatestByMood, {
    minTotal: options.minTotal,
    minShare: options.minShare,
  });
  if (finalSummary.mood || finalSummary.total > 0) {
    return finalSummary;
  }

  if (!allowPrediction) {
    return finalSummary;
  }

  const predictedSummary = finalizeMoodSummary(predictedBreakdown, predictedLatestByMood, {
    minTotal: 1,
    minShare: PREDICTION_PUBLIC_THRESHOLD,
  });

  if (predictedSummary.mood) {
    return {
      ...predictedSummary,
      source: 'prediction',
    };
  }

  return finalSummary;
}

export function normalizeCityMoodResult(row) {
  if (!row) return finalizeMoodSummary(createEmptyMoodBreakdown());

  const breakdown = normalizeMoodBreakdown(row.breakdown);
  const summary = finalizeMoodSummary(breakdown, {}, { minTotal: 1, minShare: 0 });
  const fallbackMood = normalizeMood(row.mood);
  const total = Number(row.total ?? summary.total ?? 0);
  const mood = fallbackMood ?? summary.mood ?? summary.dominantMood ?? null;

  return {
    mood,
    label: formatMoodLabel(mood),
    emoji: getMoodEmoji(mood),
    total,
    breakdown,
    confidence: mood ? Math.max(summary.confidence, Number(row.confidence ?? 0)) : 0,
    source: total > 0 ? String(row.source ?? 'posts') : 'none',
  };
}

function getPredictedFields(post) {
  return {
    mood: post?.predictedMood ?? post?.predicted_mood ?? post?.raw?.predicted_mood ?? null,
    confidence: Number(
      post?.predictedMoodConfidence
      ?? post?.predicted_mood_confidence
      ?? post?.raw?.predicted_mood_confidence
      ?? 0,
    ),
    modelVersion: post?.predictionModelVersion ?? post?.prediction_model_version ?? post?.raw?.prediction_model_version ?? null,
  };
}

export function getFinalMoodSummary(post) {
  const mood = normalizeMood(post?.finalMood ?? post?.final_mood ?? post?.raw?.final_mood ?? null);
  if (!mood) return null;

  return {
    mood,
    label: formatMoodLabel(mood),
    emoji: getMoodEmoji(mood),
    confidence: Number(
      post?.moodConfidence
      ?? post?.mood_confidence
      ?? post?.raw?.mood_confidence
      ?? 0,
    ),
    source: post?.moodSource ?? post?.mood_source ?? post?.raw?.mood_source ?? 'none',
  };
}

export function getPredictedMoodSummary(post, minimumConfidence = PREDICTION_PUBLIC_THRESHOLD) {
  const predicted = getPredictedFields(post);
  const mood = normalizeMood(predicted.mood);
  if (!mood) return null;
  if (!Number.isFinite(predicted.confidence) || predicted.confidence < minimumConfidence) return null;

  return {
    mood,
    label: formatMoodLabel(mood),
    emoji: getMoodEmoji(mood),
    confidence: predicted.confidence,
    modelVersion: predicted.modelVersion,
    source: 'prediction',
  };
}

export function resolveFeedbackMood(post, options = {}) {
  const minimumConfidence = Number.isFinite(options.minimumConfidence)
    ? options.minimumConfidence
    : PREDICTION_PUBLIC_THRESHOLD;
  const finalSummary = getFinalMoodSummary(post);
  if (finalSummary) return finalSummary;

  if (options.allowPrediction === false) return null;
  return getPredictedMoodSummary(post, minimumConfidence);
}

