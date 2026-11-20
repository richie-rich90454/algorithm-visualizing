/**
 * useReducedMotion.ts – Tracks the user's reduced-motion preference.
 *
 * Components can branch on `reducedMotion` to skip optional visual motion.
 * CSS also disables transitions and animations under the same media query, so
 * the preference is honored even for effects driven purely by stylesheets.
 */

import { readonly, ref } from "vue";

const reduced = ref(false);

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.value = query.matches;
    query.addEventListener("change", (event: MediaQueryListEvent) => {
        reduced.value = event.matches;
    });
}

export function useReducedMotion() {
    return { reducedMotion: readonly(reduced) };
}
