/**
 * manacher.ts – Manacher's Algorithm (longest palindromic substring)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Manacher's algorithm finds the longest palindromic substring in linear
 * time. It inserts sentinel characters (#) between every pair of characters
 * (and at the ends) so every palindrome becomes odd-length, then computes
 * `arm[i]` – the radius of the palindrome centred at i – using the symmetric
 * mirror property of palindromes to reuse previously computed radii.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – each centre is visited a constant number of times
 *   Space: O(n) for the arm array
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The palindrome centre being processed is YELLOW (comparing).
 *   - The palindrome arm is PINK (highlight).
 *   - The longest palindrome found is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The mirror-reuse trick is the heart to teach.
 *   - Handles even palindromes cleanly thanks to the sentinel characters.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

/**
 * Build a frame's character entities with per-character states.
 *
 * @param text The processed (sentinel-padded) string.
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
 * The Manacher generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "babadcdabab";

    let step = 0;

    // Frame 0: the untouched text.
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Finding the longest palindromic substring of "${text}".`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // Build the sentinel-padded string.
    const padded = `#${text.split("").join("#")}#`;
    const n = padded.length;
    const arm = new Array<number>(n).fill(0);

    let center = 0;
    let right = 0;

    for (let i = 0; i < n; i += 1) {
        // Initialise the arm from the mirror property.
        if (i < right) {
            const mirror = 2 * center - i;
            arm[i] = Math.min(right - i, arm[mirror] ?? 0);
        }

        // Expand the palindrome centred at i.
        while (
            i - (arm[i] ?? 0) - 1 >= 0 &&
            i + (arm[i] ?? 0) + 1 < n &&
            padded[i - (arm[i] ?? 0) - 1] === padded[i + (arm[i] ?? 0) + 1]
        ) {
            arm[i] = (arm[i] ?? 0) + 1;
        }

        // Extend the window when this palindrome reaches beyond `right`.
        if (i + (arm[i] ?? 0) > right) {
            center = i;
            right = i + (arm[i] ?? 0);
        }

        // Highlight the palindrome arm around the current centre.
        const states = new Map<number, EntityState>();
        for (let k = i - (arm[i] ?? 0); k <= i + (arm[i] ?? 0); k += 1) {
            states.set(k, "highlight");
        }
        states.set(i, "comparing");

        yield {
            stepNumber: step,
            entities: makeText(padded, states),
            edges: [],
            description: `Centre ${i}: palindrome radius ${arm[i]} (centred on "${padded[i]}").`,
            codeLineNumber: 2,
            layout: "text",
            meta: {},
        };
        step += 1;
    }

    // Find the centre with the largest arm; convert back to the original string.
    let bestCenter = 0;
    let bestArm = 0;
    for (let i = 0; i < n; i += 1) {
        if ((arm[i] ?? 0) > bestArm) {
            bestArm = arm[i] ?? 0;
            bestCenter = i;
        }
    }

    // Reconstruct the longest palindrome in the padded string.
    const startPadded = bestCenter - bestArm;
    const endPadded = bestCenter + bestArm;
    const longest = padded
        .slice(startPadded, endPadded + 1)
        .split("")
        .filter((c) => c !== "#")
        .join("");

    // Highlight the longest palindrome.
    const finalStates = new Map<number, EntityState>();
    for (let k = startPadded; k <= endPadded; k += 1) {
        finalStates.set(k, "sorted");
    }

    yield {
        stepNumber: step,
        entities: makeText(padded, finalStates),
        edges: [],
        description: `Longest palindromic substring: "${longest}".`,
        codeLineNumber: 4,
        layout: "text",
        meta: { longest, length: longest.length },
    };
}

/** The Manacher module, registered with the engine. */
const module: AlgorithmModule = {
    id: "manacher",
    name: "Manacher",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    // Contains several palindromes; the longest is "bcdcb".
    defaultInput: { text: "babadcdabab" },
    visualType: "text",
    run,
};

export default module;
