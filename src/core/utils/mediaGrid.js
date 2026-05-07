export function inferMediaType(src = '', fallback = 'image') {
  if (typeof src !== 'string') return fallback;
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src) ? 'video' : 'image';
}

function getMediaSrc(item) {
  return typeof item === 'string' ? item : item?.src;
}

export function dedupeMediaItems(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const src = getMediaSrc(item);
    if (!src || seen.has(src)) return false;
    seen.add(src);
    return true;
  });
}

export function normalizeMediaItems(items = [], maxItems = 10) {
  return dedupeMediaItems(items)
    .slice(0, maxItems)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `media-${index}-${item}`,
          src: item,
          type: inferMediaType(item),
        };
      }

      return {
        id: item.id ?? `media-${index}-${item.src ?? ''}`,
        src: item.src,
        type: item.type ?? inferMediaType(item.src),
        file: item.file ?? null,
        label: item.label ?? '',
        isLocal: !!item.isLocal,
      };
    })
    .filter((item) => !!item.src);
}

export function getMediaGridModel(items = [], maxItems = 10) {
  const normalized = normalizeMediaItems(items, maxItems);
  const total = normalized.length;
  const hasOverflow = total > 4;
  const layout = total <= 0 ? 0 : Math.min(total, 4);
  const visibleItems = hasOverflow ? normalized.slice(0, 4) : normalized;
  const overlayCount = hasOverflow ? total - 3 : 0;

  return {
    total,
    layout,
    hasOverflow,
    overlayCount,
    visibleItems,
  };
}
