export const GLOBAL_LIVE_LAYER_ATTRIBUTE = 'data-global-live-layer';
export const GLOBAL_LIVE_LAYER_SELECTOR = `[${GLOBAL_LIVE_LAYER_ATTRIBUTE}="true"]`;

export function isInGlobalLiveLayer(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(GLOBAL_LIVE_LAYER_SELECTOR) !== null
  );
}
