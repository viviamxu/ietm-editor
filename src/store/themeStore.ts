import { create } from "zustand";

import {
  applyIetmThemeAttribute,
  resolveIetmTheme,
} from "../lib/theme/ietmTheme";
import type { IETMResolvedTheme, IETMThemeMode } from "../types/ietmTheme";

type ThemeListener = () => void;

type ThemeState = {
  mode: IETMThemeMode;
  resolved: IETMResolvedTheme;
  mountEl: HTMLElement | null;
  portalRoot: HTMLElement | null;
  onThemeChange?: (theme: IETMResolvedTheme) => void;
  initialize: (options: {
    mode?: IETMThemeMode;
    mountEl: HTMLElement;
    onThemeChange?: (theme: IETMResolvedTheme) => void;
  }) => void;
  setMode: (mode: IETMThemeMode) => void;
  setPortalRoot: (root: HTMLElement | null) => void;
  recomputeResolved: () => void;
  reset: () => void;
};

let autoObserver: MutationObserver | null = null;
let mediaQuery: MediaQueryList | null = null;
let mediaQueryHandler: ((ev: MediaQueryListEvent) => void) | null = null;
let themeListeners: ThemeListener[] = [];

function detachAutoObserver(): void {
  autoObserver?.disconnect();
  autoObserver = null;
  if (mediaQuery && mediaQueryHandler) {
    mediaQuery.removeEventListener("change", mediaQueryHandler);
  }
  mediaQuery = null;
  mediaQueryHandler = null;
}

function attachAutoObserver(getState: () => ThemeState): void {
  detachAutoObserver();
  if (typeof document === "undefined") return;

  autoObserver = new MutationObserver(() => {
    getState().recomputeResolved();
  });
  autoObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["arco-theme", "class"],
  });
  autoObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["arco-theme", "data-theme", "class"],
  });

  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQueryHandler = () => {
    getState().recomputeResolved();
  };
  mediaQuery.addEventListener("change", mediaQueryHandler);
}

function emitResolved(
  prev: IETMResolvedTheme,
  next: IETMResolvedTheme,
  callback?: (theme: IETMResolvedTheme) => void,
): void {
  if (prev === next) return;
  callback?.(next);
  themeListeners.forEach((fn) => fn());
}

const DEFAULT_MODE: IETMThemeMode = "light";

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: DEFAULT_MODE,
  resolved: "light",
  mountEl: null,
  portalRoot: null,
  onThemeChange: undefined,

  initialize: ({ mode = DEFAULT_MODE, mountEl, onThemeChange }) => {
    detachAutoObserver();
    const resolved = resolveIetmTheme(mode, mountEl);
    set({
      mode,
      mountEl,
      onThemeChange,
      resolved,
      portalRoot: get().portalRoot,
    });
    applyIetmThemeAttribute(get().portalRoot, resolved);
    if (mode === "auto") {
      attachAutoObserver(get);
    }
  },

  setMode: (mode) => {
    const prev = get().resolved;
    detachAutoObserver();
    const resolved = resolveIetmTheme(mode, get().mountEl);
    set({ mode, resolved });
    applyIetmThemeAttribute(get().portalRoot, resolved);
    if (mode === "auto") {
      attachAutoObserver(get);
    }
    emitResolved(prev, resolved, get().onThemeChange);
  },

  setPortalRoot: (portalRoot) => {
    set({ portalRoot });
    applyIetmThemeAttribute(portalRoot, get().resolved);
  },

  recomputeResolved: () => {
    if (get().mode !== "auto") return;
    const prev = get().resolved;
    const resolved = resolveIetmTheme("auto", get().mountEl);
    if (resolved === prev) return;
    set({ resolved });
    applyIetmThemeAttribute(get().portalRoot, resolved);
    emitResolved(prev, resolved, get().onThemeChange);
  },

  reset: () => {
    detachAutoObserver();
    themeListeners = [];
    set({
      mode: DEFAULT_MODE,
      resolved: "light",
      mountEl: null,
      portalRoot: null,
      onThemeChange: undefined,
    });
  },
}));

/** React 订阅 resolved 主题变化（`IETMEditorRoot` 用）。 */
export function subscribeThemeResolved(listener: ThemeListener): () => void {
  themeListeners.push(listener);
  return () => {
    themeListeners = themeListeners.filter((fn) => fn !== listener);
  };
}
