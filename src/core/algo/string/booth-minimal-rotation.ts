/**
 * booth-minimal-rotation.ts – Booth's Algorithm (lexicographically minimal rotation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a string, Booth's algorithm finds the rotation (cyclic shift) that is
 * lexicographically smallest in O(n) time. It conceptually doubles the string
 * and walks a single index `i` while maintaining the best-known rotation start
 * `k`. When comparing rotation k against rotation i, a mismatch or a
 * better-worse result tells the algorithm how far to advance `i`, so no
 * character pair is compared more than a constant number of times.
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

    // Failure lengths: fail[i] = longest proper prefix of rotation 0 that is
    // also a suffix of rotation i (used to skip redundant comparisons).
    const fail = new Array<number>(n).fill(-1);

    let best = 0; // start of the best rotation found so far

    // Scan every possible rotation start i.
    for (let i = 1; i < n; i += 1) {
        let j = 0; // comparison offset within the rotation
        let bestRotation = best;

        // Compare rotation `bestRotation` with rotation `i` character by
        // character, using the failure table to skip when possible.
        while (j < n) {
            const a = doubled[bestRotation + j] as string;
            const b = doubled[i + j] as string;

            if (a === b) {
                // Same character – advance; use the failure table to jump.
                const f = fail[j];
                if (f !== undefined && f !== -1) {
                    j = f;
                } else {
                    j += 1;
                }
                continue;
            }

            if (a > b) {
                // Rotation i is lexicographically smaller: it becomes the new
                // best, and we can skip ahead by the failure length + 1.
                bestRotation = i;
                best = i;
                if (j !== 0) {
                    fail[i - best + j] = j + 1;
                }
                break;
            }

            // Rotation `best` is smaller here: rotation i is dominated. Skip
            // ahead using the failure length.
            if (j !== 0) {
                fail[i - best + j] = j + 1;
            }
            break;
        }

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
