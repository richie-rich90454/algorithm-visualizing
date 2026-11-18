/**
 * useTheme.ts – Light/dark theme state shared across the application.
 *
 * The chosen theme is persisted in localStorage. On a first visit the system
 * preference (`prefers-color-scheme`) decides, and later system changes are
 * followed only while the user has not made an explicit choice. Applying a
 * theme sets `data-theme` on <html>, updates the CSS `color-scheme` property so
 * native controls match, and refreshes the theme-color meta tag.
 */

import { readonly, ref, watch } from "vue";

export type ThemeName = "light" | "dark";

const STORAGE_KEY = "algoviz-theme";

/** Read a stored value without letting a blocked storage API break the app. */
function storedValue(): string | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/** Persist a value; storage failure only means the choice is session-local. */
function persist(value: string): void {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, value);
        }
    } catch {
        // Storage can be disabled in private browsing; the theme still applies.
    }
}

/** @returns The system's preferred theme, defaulting to light. */
function systemTheme(): ThemeName {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
}

/** @returns The persisted theme, or the system preference on a first visit. */
function initialTheme(): ThemeName {
    const saved = storedValue();
    return saved === "light" || saved === "dark" ? saved : systemTheme();
}

/** Module-level singleton so every component sees the same theme. */
const theme = ref<ThemeName>(initialTheme());

/** Push the current theme into the document. */
function apply(value: ThemeName): void {
    if (typeof document === "undefined") {
        return;
    }
    const root = document.documentElement;
    root.dataset.theme = value;
    root.style.colorScheme = value;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
        meta.content = value === "dark" ? "#0f172a" : "#ffffff";
    }
}

watch(theme, apply, { immediate: true });

// Follow the OS only until the user expresses a preference of their own.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", (event: MediaQueryListEvent) => {
        if (storedValue() === null) {
            theme.value = event.matches ? "dark" : "light";
        }
    });
}

export function useTheme() {
    /** Set an explicit theme and remember it for the next visit. */
    function setTheme(value: ThemeName): void {
        theme.value = value;
        persist(value);
    }

    /** Flip between the two themes. */
    function toggleTheme(): void {
        setTheme(theme.value === "dark" ? "light" : "dark");
    }

    return { theme: readonly(theme), setTheme, toggleTheme };
}
