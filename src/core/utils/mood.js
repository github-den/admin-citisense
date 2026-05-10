export const MOOD_KEYS = ['grateful', 'satisfied', 'sad', 'angry'];
export const PREDICTION_PUBLIC_THRESHOLD = 0.3;
export const PREDICTION_INTERNAL_THRESHOLD = 0.3;

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

  const ranked = topMoods
    .map((mood) => ({ mood, latest: latestByMood[mood] ?? null }))
    .sort((left, right) => (right.latest ?? -1) - (left.latest ?? -1));

  if (ranked[0]?.latest != null && ranked[0].latest !== ranked[1]?.latest) {
    return { mood: ranked[0].mood, hasTie: false };
  }

  return { mood: null, hasTie: true };
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

  const minTotal = Number.isFinite(options.minTotal) ? options.minTotal : 3;
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

export function summarizeMoodFromPosts(posts = [], options = {}) {
  const allowPrediction = options.allowPrediction !== false;
  const breakdown = createEmptyMoodBreakdown();
  const latestByMood = {};
  const predictedBreakdown = createEmptyMoodBreakdown();
  const predictedLatestByMood = {};

  posts.forEach((post) => {
    const summary = post?.reactionSummary
      ?? post?.raw?.reactionSummary
      ?? (post?.reactBreakdown ? { breakdown: post.reactBreakdown } : null)
      ?? (post?.raw?.reaction_breakdown ? { breakdown: post.raw.reaction_breakdown } : null);

    const timestamp = toTimestamp(post?.updated_at ?? post?.created_at);
    if (summary?.breakdown) {
      const normalizedBreakdown = normalizeMoodBreakdown(summary.breakdown);
      MOOD_KEYS.forEach((key) => {
        breakdown[key] += normalizedBreakdown[key];
      });

      const mood = normalizeMood(summary.dominantMood ?? summary.mood);
      if (mood && timestamp != null) {
        latestByMood[mood] = Math.max(latestByMood[mood] ?? -1, timestamp);
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

  const reactionSummary = finalizeMoodSummary(breakdown, latestByMood);
  if (reactionSummary.mood || reactionSummary.total > 0) {
    return reactionSummary;
  }

  if (!allowPrediction) {
    return reactionSummary;
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

  return reactionSummary;
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
