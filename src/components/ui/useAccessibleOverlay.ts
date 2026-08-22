import { useEffect, useRef, type RefObject } from 'react';
import {
  GLOBAL_LIVE_LAYER_SELECTOR,
  isInGlobalLiveLayer,
} from './globalLiveLayer';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface OverlayRegistration {
  id: symbol;
}

interface IsolatedElement {
  count: number;
  ariaHidden: string | null;
  inert: boolean;
}

const overlayStack: OverlayRegistration[] = [];
const isolatedElements = new Map<HTMLElement, IsolatedElement>();
let originalBodyOverflow: string | null = null;

function isTopmost(registration: OverlayRegistration) {
  return overlayStack[overlayStack.length - 1] === registration;
}

function registerOverlay(registration: OverlayRegistration) {
  if (overlayStack.length === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  overlayStack.push(registration);
}

function unregisterOverlay(registration: OverlayRegistration) {
  const index = overlayStack.indexOf(registration);
  if (index !== -1) overlayStack.splice(index, 1);
  if (overlayStack.length === 0) {
    document.body.style.overflow = originalBodyOverflow ?? '';
    originalBodyOverflow = null;
  }
}

function isolateBackground(overlayRoot: HTMLElement | null) {
  if (!overlayRoot || overlayRoot.parentElement !== document.body) return () => undefined;

  const isolated: HTMLElement[] = [];
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement) || child === overlayRoot) continue;
    if (child.matches(GLOBAL_LIVE_LAYER_SELECTOR)) continue;
    const existing = isolatedElements.get(child);
    if (existing) {
      existing.count += 1;
      isolated.push(child);
      continue;
    }
    isolatedElements.set(child, {
      count: 1,
      ariaHidden: child.getAttribute('aria-hidden'),
      inert: child.inert,
    });
    isolated.push(child);
    child.setAttribute('aria-hidden', 'true');
    child.inert = true;
  }

  return () => {
    for (const element of isolated) {
      const state = isolatedElements.get(element);
      if (!state) continue;
      state.count -= 1;
      if (state.count > 0) continue;
      if (state.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', state.ariaHidden);
      element.inert = state.inert;
      isolatedElements.delete(element);
    }
  };
}

export function useAccessibleOverlay(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement>,
  initialFocusRef?: RefObject<HTMLElement>,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const registration: OverlayRegistration = { id: Symbol('overlay') };
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const restoreBackground = isolateBackground(container?.parentElement ?? null);
    registerOverlay(registration);

    const initialTarget =
      initialFocusRef?.current ??
      (container?.querySelector(focusableSelector) as HTMLElement | null) ??
      container;
    initialTarget?.focus();

    function handleFocusIn(event: FocusEvent) {
      if (
        isTopmost(registration) &&
        container &&
        !container.contains(event.target as Node) &&
        !isInGlobalLiveLayer(event.target)
      ) {
        initialTarget?.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isTopmost(registration)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !container) return;

      const dialogFocusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const liveLayerFocusable = Array.from(
        document.querySelectorAll<HTMLElement>(GLOBAL_LIVE_LAYER_SELECTOR),
      ).flatMap((layer) =>
        Array.from(layer.querySelectorAll<HTMLElement>(focusableSelector)),
      );
      const focusable = [...dialogFocusable, ...liveLayerFocusable].filter(
        (element) => !element.hasAttribute('disabled'),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      event.preventDefault();
      const currentIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      const offset = event.shiftKey ? -1 : 1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + offset + focusable.length) % focusable.length;
      focusable[nextIndex]?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      unregisterOverlay(registration);
      restoreBackground();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [containerRef, initialFocusRef, open]);
}
