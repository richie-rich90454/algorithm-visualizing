/**
 * knuth-morris-pratt.ts – Knuth-Morris-Pratt (KMP) Pattern Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * KMP finds all occurrences of a pattern in a text in linear time. Its key
 * idea is a *prefix function* (failure function) that records, for each prefix
 * of the pattern, the length of its longest proper prefix that is also a
 * suffix. When a character mismatch occurs, instead of restarting the search
 * at the next text position, KMP falls back to the best previously-matched
 * prefix, never re-scanning text characters.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) where n = |text|, m = |pattern|
 *   Space: O(m) for the prefix function
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The text is a row of character boxes.
 *   - The character currently compared is YELLOW (comparing).
 *   - A matched run is GREEN (sorted); a full match is highlighted.
 *   - On mismatch, the failed position is RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The failure function is the conceptual heart to teach.
 *   - No backtracking over the text – the reason it is linear.
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
 * The KMP generator.
 *
 * @param input `{ text, pattern }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "ababcabababcab";
    const pattern = task.pattern ?? "ababcab";

    let step = 0;
    const matches: number[] = [];

    // Frame 0: the untouched text.
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Searching for "${pattern}" in "${text}".`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Phase 1: build the prefix (failure) function of the pattern.
    // pi[i] = length of the longest proper prefix of pattern[0..i] that is
    // also a suffix of pattern[0..i].
    // ------------------------------------------------------------------
    const m = pattern.length;
    const pi = new Array<number>(m).fill(0);

    for (let i = 1; i < m; i += 1) {
        let j = pi[i - 1] ?? 0;
        // Fall back while the current prefix cannot be extended.
        while (j > 0 && pattern[i] !== pattern[j]) {
            j = pi[j - 1] ?? 0;
        }
        // Extend the matched prefix by one.
        if (pattern[i] === pattern[j]) {
            j += 1;
        }
        pi[i] = j;
    }

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Prefix function built: [${pi.join(", ")}].`,
        codeLineNumber: 1,
        layout: "text",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Phase 2: scan the text using the failure function to skip ahead.
    // ------------------------------------------------------------------
    let j = 0;

    for (let i = 0; i < text.length; i += 1) {
        // While characters mismatch, fall back along the failure function.
        while (j > 0 && text[i] !== pattern[j]) {
            j = pi[j - 1] ?? 0;

            // Show the mismatch and the fallback.
            const failStates = new Map<number, EntityState>([[i, "swapped"]]);
            yield {
                stepNumber: step,
                entities: makeText(text, failStates),
                edges: [],
                description: `Mismatch at text[${i}] – falling back to prefix length ${j}.`,
                codeLineNumber: 3,
                layout: "text",
                meta: { matches: matches.length },
            };
            step += 1;
        }

        // A matching character extends the current matched prefix.
        if (text[i] === pattern[j]) {
            j += 1;
        }

        // Highlight the matched region so far.
        const matchStates = new Map<number, EntityState>();
        for (let k = i - j + 1; k <= i; k += 1) {
            matchStates.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeText(text, matchStates),
            edges: [],
            description: `Matched prefix length ${j} ending at text[${i}].`,
            codeLineNumber: 4,
            layout: "text",
            meta: { matches: matches.length },
        };
        step += 1;

        // A full match was found.
        if (j === m) {
            const start = i - m + 1;
            matches.push(start);

            const foundStates = new Map<number, EntityState>();
            for (let k = start; k <= i; k += 1) {
                foundStates.set(k, "path");
            }
            yield {
                stepNumber: step,
                entities: makeText(text, foundStates),
                edges: [],
                description: `Pattern found at index ${start}!`,
                codeLineNumber: 5,
                layout: "text",
                meta: { matches: matches.length },
            };
            step += 1;

            // Continue searching using the failure function.
            j = pi[j - 1] ?? 0;
        }
    }

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description:
            matches.length === 0
                ? `"${pattern}" does not occur in the text.`
                : `"${pattern}" occurs at ${matches.join(", ")}.`,
        codeLineNumber: 6,
        layout: "text",
        meta: { matches: matches.length },
    };
}

/** The KMP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "knuth-morris-pratt",
    name: "KMP",
    category: "string",
    complexity: { time: "O(n + m)", space: "O(m)" },
    // The pattern "ababcab" occurs twice in this text.
    defaultInput: { text: "ababcabababcab", pattern: "ababcab" },
    visualType: "text",
    run,
};

export default module;
