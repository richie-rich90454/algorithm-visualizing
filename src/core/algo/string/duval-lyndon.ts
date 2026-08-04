/**
 * duval-lyndon.ts – Duval's Algorithm (Lyndon factorization)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Lyndon word is a string that is strictly smaller than all its proper
 * rotations. Duval's algorithm factorizes any string into a unique sequence of
 * non-increasing Lyndon words in O(n) time. It scans with three pointers
 * (i, j, k) maintaining an invariant about the current "prime" candidate;
 * whenever a factor completes, it is emitted and the search restarts after it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – each character is visited a constant number of times
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The character at pointer j is YELLOW (comparing).
 *   - The character at pointer k (comparison partner) is PINK (highlight).
 *   - Completed Lyndon factors are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Lyndon words underpin the standard minimal-rotation algorithm.
 *   - The Chen-Fox-Lyndon factorization is the non-increasing split.
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
 * The Duval Lyndon generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";

    const n = text.length;
    const factors: Array<[number, number]> = [];
    let step = 0;

    // Frame 0: the untouched text.
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Duval's algorithm – factorizing "${text}" into Lyndon words.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // The main loop with three pointers.
    let i = 0;
    while (i < n) {
        let j = i + 1;
        let k = i;

        // Extend the current candidate factor.
        while (j < n) {
            const a = text[k] as string;
            const b = text[j] as string;

            const states = new Map<number, EntityState>([
                [j, "comparing"],
                [k, "highlight"],
            ]);
            yield {
                stepNumber: step,
                entities: makeText(text, states),
                edges: [],
                description: `Comparing text[${k}]="${a}" with text[${j}]="${b}".`,
                codeLineNumber: 2,
                layout: "text",
                meta: { factors: factors.length },
            };
            step += 1;

            if (a < b) {
                // The candidate is still Lyndon: restart the k pointer.
                k = i;
                j += 1;
            } else if (a > b) {
                // The candidate ends here – emit a Lyndon factor [i, k].
                const length = k - i + 1;
                while (i <= k) {
                    factors.push([i, i + length - 1]);
                    i += length;
                }
                j = i + 1;
                k = i;
                break;
            } else {
                // Equal: continue comparing with the shifted k.
                k += 1;
                j += 1;
            }
        }

        // Reached the end of the string – the tail is a Lyndon factor.
        if (j >= n) {
            const length = k - i + 1;
            while (i < n) {
                factors.push([i, Math.min(n, i + length) - 1]);
                i += length;
            }
            break;
        }

        // Color the completed factors green.
        const doneStates = new Map<number, EntityState>();
        for (const [start, end] of factors) {
            for (let t = start; t <= end; t += 1) {
                doneStates.set(t, "sorted");
            }
        }
        yield {
            stepNumber: step,
            entities: makeText(text, doneStates),
            edges: [],
            description: `Emitted factor ${factors.length}: "${text.slice(factors[factors.length - 1]?.[0], (factors[factors.length - 1]?.[1] ?? 0) + 1)}".`,
            codeLineNumber: 3,
            layout: "text",
            meta: { factors: factors.length },
        };
        step += 1;
    }

    const factorStrings = factors.map(([s, e]) => `"${text.slice(s, e + 1)}"`);

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Lyndon factorization: ${factorStrings.join(" · ")}.`,
        codeLineNumber: 4,
        layout: "text",
        meta: { factors: factors.length },
    };
}

/** The Duval Lyndon module, registered with the engine. */
const module: AlgorithmModule = {
    id: "duval-lyndon",
    name: "Duval Lyndon Factorisation",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    // "banana" factorizes into "b", "an", "an", "a".
    defaultInput: { text: "banana" },
    visualType: "text",
    run,
};

export default module;
