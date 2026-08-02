/**
 * z-algorithm.ts – Z-Algorithm (linear pattern matching)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Z-algorithm computes, for every position i in a string, the Z-value
 * Z[i] = length of the longest substring starting at i that matches a prefix
 * of the whole string. It does so in O(n) using a clever invariant: a window
 * [l, r] covering the currently known rightmost match is maintained, letting
 * later positions reuse earlier computations instead of re-comparing.
 *
 * Pattern matching falls out by building the concatenation `pattern + "$" +
 * text` and reading off Z-values equal to the pattern length.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – every character is compared at most a constant number of
 *          times
 *   Space: O(n) for the Z array
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The character being inspected is YELLOW (comparing).
 *   - The active [l, r] window is PINK (highlight).
 *   - Positions with a full pattern match are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The [l, r] box-reuse trick is the heart to teach.
 *   - Very similar in spirit to KMP but often easier to reason about.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

/**
 * Build a frame's character entities with per-character states.
 *
 * @param text The text string.
 * @param states Optional index → state overrides.
 * @returns Character entities for the text layout.
 */
function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

/**
 * The Z-Algorithm generator.
 *
 * @param input `{ text, pattern }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "ababcabababcab";
    const pattern = task.pattern ?? "ababcab";

    // The classic trick: pattern + separator + text.
    const combined = `${pattern}$${text}`;
    const n = combined.length;

    let step = 0;
    const matches: number[] = [];

    // Frame 0: the untouched combined string.
    yield {
        stepNumber: step,
        entities: makeText(combined),
        edges: [],
        description: `Z-algorithm on "${combined}" (pattern + $ + text).`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Compute the Z-array.
    // ------------------------------------------------------------------
    const z = new Array<number>(n).fill(0);
    let l = 0;
    let r = 0;

    for (let i = 1; i < n; i += 1) {
        // Initialise Z[i] from the window when i is inside [l, r].
        if (i <= r) {
            z[i] = Math.min(r - i + 1, z[i - l] ?? 0);
        }

        // Extend Z[i] by direct character comparison.
        while (i + (z[i] ?? 0) < n && combined[z[i] ?? 0] === combined[i + (z[i] ?? 0)]) {
            z[i] = (z[i] ?? 0) + 1;
        }

        // Update the window when the match extends beyond r.
        if (i + (z[i] ?? 0) - 1 > r) {
            l = i;
            r = i + (z[i] ?? 0) - 1;
        }

        // Build the frame: highlight i and the [l, r] window.
        const states = new Map<number, EntityState>();
        for (let k = l; k <= r; k += 1) {
            states.set(k, "highlight");
        }
        states.set(i, "comparing");

        yield {
            stepNumber: step,
            entities: makeText(combined, states),
            edges: [],
            description: `Z[${i}] = ${z[i]} – window [${l}, ${r}].`,
            codeLineNumber: 2,
            layout: "text",
            meta: { matches: matches.length },
        };
        step += 1;

        // A Z-value equal to the pattern length means a match in the text part.
        if (i > pattern.length && (z[i] ?? 0) === pattern.length) {
            const start = i - pattern.length - 1;
            matches.push(start);
        }
    }

    // Colour the found matches green.
    const finalStates = new Map<number, EntityState>();
    for (const start of matches) {
        for (
            let k = pattern.length + 1 + start;
            k < pattern.length + 1 + start + pattern.length;
            k += 1
        ) {
            finalStates.set(k, "sorted");
        }
    }

    yield {
        stepNumber: step,
        entities: makeText(combined, finalStates),
        edges: [],
        description:
            matches.length === 0
                ? `"${pattern}" does not occur in the text.`
                : `"${pattern}" occurs at ${matches.join(", ")}.`,
        codeLineNumber: 4,
        layout: "text",
        meta: { matches: matches.length },
    };
}

/** The Z-Algorithm module, registered with the engine. */
const module: AlgorithmModule = {
    id: "z-algorithm",
    name: "Z-Algorithm",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    // Same input as KMP for a direct comparison.
    defaultInput: { text: "ababcabababcab", pattern: "ababcab" },
    visualType: "text",
    run,
};

export default module;
