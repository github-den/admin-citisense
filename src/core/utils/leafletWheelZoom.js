const MOUSE_WHEEL_DELTA = 40;
const PINCH_GESTURE_RESET_MS = 180;

export function attachIntentionalWheelZoom(map, container) {
  if (!map || !container) return () => {};

  map.scrollWheelZoom.disable();
  let pinchGestureActive = false;
  let pinchGestureTimer = null;

  function handleWheel(event) {
    const isPinchZoom = event.ctrlKey;
    const isLikelyMouseWheel = Math.abs(event.deltaY) >= MOUSE_WHEEL_DELTA;

    event.preventDefault();
    event.stopPropagation();

    if (!isPinchZoom && !isLikelyMouseWheel) return;

    if (isPinchZoom) {
      window.clearTimeout(pinchGestureTimer);
      pinchGestureTimer = window.setTimeout(() => {
        pinchGestureActive = false;
      }, PINCH_GESTURE_RESET_MS);

      if (pinchGestureActive) return;
      pinchGestureActive = true;
    }

    const nextZoom = map.getZoom() + (event.deltaY < 0 ? 1 : -1);
    const boundedZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), nextZoom));
    map.setZoomAround(map.mouseEventToContainerPoint(event), boundedZoom);
  }

  container.addEventListener('wheel', handleWheel, { passive: false });

  return () => {
    window.clearTimeout(pinchGestureTimer);
    container.removeEventListener('wheel', handleWheel);
  };
}
