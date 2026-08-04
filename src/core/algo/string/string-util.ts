/**
 * string-util.ts – Shared helpers for string algorithm visualizations.
 *
 * String algorithms (KMP, Z, Rabin-Karp, …) all render the text as a row of
 * character boxes (the `text` layout). This helper builds those character
 * entities so every module produces consistent visuals with stable ids.
 */

import type { VisualEntity } from "@/types";

/**
 * Build one `character` entity per character of the string.
 *
 * @param text The string to display.
 * @param kind A short prefix for the ids, so several strings (e.g. text +
 *        pattern) can coexist in one frame without id collisions.
 * @returns Character entities with ids like `char-text-3`.
 */
export function makeCharacters(text: string, kind = "text"): VisualEntity[] {
    return text.split("").map((char, index) => ({
        id: `char-${kind}-${index}`,
        type: "character" as const,
        label: char,
        value: char,
        state: "idle" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, char },
    }));
}
