/**
 * boyer-moore.ts – Boyer-Moore Pattern Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Boyer-Moore searches for a pattern in a text by scanning *right to left*
 * and skipping ahead using two precomputed tables:
 *
 *   - The "bad character" rule: on a mismatch at pattern position j with text
 *     character c, shift the pattern so the rightmost occurrence of c aligns
 *     with that position (or shift past it if c is absent).
 *   - The "good suffix" rule: shift so the matched suffix reappears correctly.
 *
 * Right-to-left scanning plus large skip jumps make Boyer-Moore very fast in
 * practice, especially for long patterns.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·m) worst, O(n/m) typical (sub-linear in practice)
 *   Space: O(alphabet + m)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The aligned window of the text is PINK (highlight).
 *   - The pattern character being compared is YELLOW (comparing).
 *   - A mismatch causes a skip (announced).
 *   - A match is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Right-to-left comparison is its distinctive feature.
 *   - The two skip rules are the heart to teach.
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
 * The Boyer-Moore generator.
 *
 * @param input `{ text, pattern }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "ababcabababcab";
    const pattern = task.pattern ?? "abcab";

    const n = text.length;
    const m = pattern.length;
    const matches: number[] = [];
    let step = 0;

    // Frame 0: the untouched text.
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Boyer-Moore: searching for "${pattern}" right-to-left with skip tables.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Precompute the bad-character table: for each character, the rightmost
    // position where it occurs in the pattern (default -1).
    // ------------------------------------------------------------------
    const badChar = new Map<string, number>();
    for (let i = 0; i < m; i += 1) {
        badChar.set(pattern[i] as string, i);
    }

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Bad-character table built.`,
        codeLineNumber: 1,
        layout: "text",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Scan with right-to-left comparisons and skip jumps.
    // ------------------------------------------------------------------
    let shift = 0;

    while (shift <= n - m) {
        // Compare from the rightmost pattern character leftward.
        let j = m - 1;

        // Highlight the aligned window.
        const windowStates = new Map<number, EntityState>();
        for (let k = shift; k < shift + m; k += 1) {
            windowStates.set(k, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeText(text, windowStates),
            edges: [],
            description: `Window at ${shift} – comparing from the right.`,
            codeLineNumber: 2,
            layout: "text",
            meta: { matches: matches.length },
        };
        step += 1;

        // Move j left while the pattern and text characters agree.
        while (j >= 0 && pattern[j] === text[shift + j]) {
            const cmpStates = new Map<number, EntityState>();
            for (let k = shift; k < shift + m; k += 1) {
                cmpStates.set(k, "highlight");
            }
            cmpStates.set(shift + j, "comparing");
            yield {
                stepNumber: step,
                entities: makeText(text, cmpStates),
                edges: [],
                description: `Matched "${pattern[j]}" at text[${shift + j}].`,
                codeLineNumber: 3,
                layout: "text",
                meta: { matches: matches.length },
            };
            step += 1;
            j -= 1;
        }

        if (j < 0) {
            // Full match at `shift`.
            matches.push(shift);
            const foundStates = new Map<number, EntityState>();
            for (let k = shift; k < shift + m; k += 1) {
                foundStates.set(k, "sorted");
            }
            yield {
                stepNumber: step,
                entities: makeText(text, foundStates),
                edges: [],
                description: `Pattern found at index ${shift}!`,
                codeLineNumber: 4,
                layout: "text",
                meta: { matches: matches.length },
            };
            step += 1;

            // Skip by the whole pattern length (simplified good-suffix rule).
            shift += m;
        } else {
            // Bad-character rule: how far can we shift?
            const mismatchChar = text[shift + j] as string;
            const rightmost = badChar.get(mismatchChar) ?? -1;
            // Shift so the rightmost occurrence aligns with j (at least 1).
            const skip = Math.max(1, j - rightmost);

            yield {
                stepNumber: step,
                entities: makeText(text),
                edges: [],
                description: `Mismatch on "${mismatchChar}" at pattern position ${j} – shifting by ${skip}.`,
                codeLineNumber: 5,
                layout: "text",
                meta: { matches: matches.length },
            };
            step += 1;

            shift += skip;
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

/** The Boyer-Moore module, registered with the engine. */
const module: AlgorithmModule = {
    id: "boyer-moore",
    name: "Boyer-Moore",
    category: "string",
    complexity: { time: "O(n·m)", space: "O(σ + m)" },
    // A pattern with repeated letters exercises the bad-character rule.
    defaultInput: { text: "ababcabababcab", pattern: "abcab" },
    visualType: "text",
    run,
};

export default module;
