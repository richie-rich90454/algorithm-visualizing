/**
 * booth-minimal-rotation.ts – Booth's Algorithm (lexicographically minimal rotation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a string, Booth's algorithm finds the rotation (cyclic shift) that is
 * lexicographically smallest in O(n) time. It conceptually doubles the string
 * and races two candidate starts `i` and `j`: comparing the rotations offset
 * by offset, the loser is skipped past the mismatch, so every round eliminates
 * at least one candidate and no pair is compared more than O(n) times total.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The doubled string is shown as character boxes.
 *   - The current rotation candidate is YELLOW (comparing).
 *   - The best-known minimal rotation is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "advance by failure" idea is the same spirit as KMP.
 *   - Minimal rotations matter in string periodicity and necklace problems.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

/**
 * Build a frame's character entities with per-character states.
 *
 * @param text The (doubled) string.
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
 * The Booth Minimal Rotation generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "cbbbaaa";

    const n = text.length;
    const doubled = text + text;
    let step = 0;

    // Frame 0: the doubled string.
    yield {
        stepNumber: step,
        entities: makeText(doubled),
        edges: [],
        description: `Finding the minimal rotation of "${text}" using the doubled string.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // Textbook Booth: two candidate starts i and j. Compare the rotations
    // offset by offset; the loser is skipped past the mismatch, so each
    // round eliminates at least one candidate in O(n) total.
    let i = 0;
    let j = 1;
    let best = 0; // start of the best rotation found so far

    while (i < n && j < n) {
        let k = 0; // comparison offset within the rotations
        while (k < n && doubled[i + k] === doubled[j + k]) {
            k += 1;
        }
        if (k >= n) {
            break;
        }

        if ((doubled[i + k] as string) > (doubled[j + k] as string)) {
            // Rotation j is smaller – rotation i is eliminated.
            i = i + k + 1;
            if (i === j) {
                i += 1;
            }
        } else {
            // Rotation i is smaller – rotation j is eliminated.
            j = j + k + 1;
            if (j === i) {
                j += 1;
            }
        }
        best = Math.min(i, j);

        // Highlight the best rotation window.
        const states = new Map<number, EntityState>();
        for (let t = 0; t < n; t += 1) {
            states.set(best + t, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeText(doubled, states),
            edges: [],
            description: `Best minimal rotation so far starts at index ${best}.`,
            codeLineNumber: 2,
            layout: "text",
            meta: { best },
        };
        step += 1;
    }

    const minimal = text.slice(best) + text.slice(0, best);

    yield {
        stepNumber: step,
        entities: makeText(doubled),
        edges: [],
        description: `Minimal rotation: "${minimal}" (starting at index ${best}).`,
        codeLineNumber: 4,
        layout: "text",
        meta: { best, minimalLen: minimal.length },
    };
}

/** The Booth Minimal Rotation module, registered with the engine. */
const module: AlgorithmModule = {
    id: "booth-minimal-rotation",
    name: "Booth's Minimal Rotation",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    // Rotating "cbbbaaa" minimizes to "aaacbbb"-ish order.
    defaultInput: { text: "cbbbaaa" },
    visualType: "text",
    run,
};

export default module;
