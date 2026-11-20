/**
 * raita-search.ts - Raita String Searching Algorithm.
 *
 * Raita (1992) tunes Boyer-Moore-Horspool with a cheap three-character
 * pre-check. Before comparing the whole window it tests the last character,
 * the first character, and the middle character of the pattern, in that order.
 * Only when all three agree does it verify the entire window. A mismatch at
 * any stage uses the Horspool bad-character table (keyed by the rightmost text
 * character of the window) to shift the pattern.
 *
 * Time O(n*m) worst case, O(n) typical; space O(sigma + m).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "../string/string-util";

function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((entity) => {
        const index = Number(entity.metadata["index"]);
        return { ...entity, state: states.get(index) ?? "idle" };
    });
}

/** Horspool shift table: rightmost m-i-1 for each pattern char except the last. */
function badCharacterTable(pattern: string): Map<string, number> {
    const m = pattern.length;
    const table = new Map<string, number>();
    for (let i = 0; i < m - 1; i += 1) {
        table.set(pattern[i] as string, m - i - 1);
    }
    return table;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "abbaabaabddbabadbb";
    const pattern = task.pattern ?? "abddb";

    const n = text.length;
    const m = pattern.length;
    const matches: number[] = [];
    let comparisons = 0;
    let step = 0;

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | null> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeText(text, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: {
            comparisons,
            matches: [...matches],
            matchCount: matches.length,
            ...extra,
        },
    });

    yield frame(new Map(), `Raita search for "${pattern}" in a text of length ${n}.`, 0);
    step += 1;

    const table = badCharacterTable(pattern);
    yield frame(new Map(), `Horspool shift table built over ${table.size} pattern character(s).`, 1);
    step += 1;

    if (m === 0 || m > n) {
        yield frame(
            new Map(),
            m === 0 ? "Empty pattern: no window to check." : "Pattern longer than text: no matches possible.",
            6,
        );
        return;
    }

    const firstCh = pattern[0] as string;
    const middleIndex = Math.floor(m / 2);
    const middleCh = pattern[middleIndex] as string;
    const lastCh = pattern[m - 1] as string;

    let shift = 0;
    while (shift <= n - m) {
        const rightCh = text[shift + m - 1] as string;
        const windowStates = new Map<number, EntityState>();
        for (let k = shift; k < shift + m; k += 1) {
            windowStates.set(k, "highlight");
        }
        yield frame(windowStates, `Window at ${shift}: pre-check last, first, then middle character.`, 2, {
            shift,
        });
        step += 1;

        checks: {
            comparisons += 1;
            if (rightCh !== lastCh) {
                break checks;
            }
            comparisons += 1;
            if (text[shift] !== firstCh) {
                break checks;
            }
            comparisons += 1;
            if (text[shift + middleIndex] !== middleCh) {
                break checks;
            }
            const compareStates = new Map(windowStates);
            compareStates.set(shift + m - 1, "comparing");
            compareStates.set(shift, "comparing");
            compareStates.set(shift + middleIndex, "comparing");
            yield frame(compareStates, `Pre-check passed at ${shift}; verifying the whole window.`, 3, {
                shift,
            });
            step += 1;
            for (let k = 0; k < m; k += 1) {
                comparisons += 1;
                if (pattern[k] !== text[shift + k]) {
                    break checks;
                }
            }
            matches.push(shift);
            const foundStates = new Map<number, EntityState>();
            for (let k = shift; k < shift + m; k += 1) {
                foundStates.set(k, "sorted");
            }
            yield frame(foundStates, `Pattern found at index ${shift}.`, 4, { shift });
            step += 1;
        }

        const delta = table.get(rightCh) ?? m;
        yield frame(new Map(), `Shift by ${delta} using the Horspool table for "${rightCh}".`, 5, {
            shift,
            delta,
        });
        step += 1;
        shift += delta;
    }

    const finalStates = new Map<number, EntityState>();
    for (const start of matches) {
        for (let k = start; k < start + m; k += 1) {
            finalStates.set(k, "sorted");
        }
    }
    yield frame(
        finalStates,
        matches.length === 0
            ? `Done: "${pattern}" does not occur in the text.`
            : `Done: "${pattern}" found at ${matches.join(", ")}.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Raita makes Horspool faster by rejecting most alignments after only three character checks. It looks at the pattern's last character against the window's right edge, then the pattern's first character against the window's left edge, then the middle characters. Only if those agree does it compare the rest. The skip distance still comes from the Horspool bad-character table.",
        invariants: [
            "Every shift is at least one, so the search always makes progress.",
            "The shift depends only on the rightmost character of the current window.",
            "A reported match passes a full window comparison, not just the pre-check.",
        ],
        correctness:
            "The Horspool shift table is safe: after aligning on the rightmost text character, no earlier start can match, because such a match would require that character to align with a different pattern position than its rightmost one. The three-character pre-check only decides whether to do the full comparison; it never causes a window to be accepted without verification or rejected when it truly matches. Hence every occurrence is reported and no false positive is emitted.",
        complexityRationale:
            "Preprocessing scans the pattern once for O(m) time and O(sigma) table space. Most windows are rejected after three comparisons, giving O(n) typical time, but the full verification and worst-case shift of one give O(n*m) in the worst case.",
        uses: [
            "Fast substring search in text editors and search tools",
            "A practical optimization over Boyer-Moore-Horspool for long patterns",
            "A case study in reordering comparisons for cache-friendly matching",
        ],
        references: [
            "Raita, Tuning the Boyer-Moore-Horspool String Searching Algorithm, Software: Practice and Experience 22 (1992)",
            "Wikipedia, Raita algorithm, overview article",
        ],
        workedExample:
            'For pattern "abddb" in text "abbaabaabddbabadbb", the first window ends in "a" and the last-character pre-check fails, shifting by 4. A later window ends in "b" and passes all three pre-checks, and the full comparison confirms the match at index 9.',
    },
    id: "raita-search",
    name: "Raita Search",
    category: "searching",
    complexity: { time: "O(n·m)", space: "O(σ + m)" },
    defaultInput: { text: "abbaabaabddbabadbb", pattern: "abddb" },
    visualType: "text",
    run,
    pseudocode: [
        "build Horspool bad-character shift table over the pattern",
        "record pattern first, middle, and last characters",
        "align pattern at current shift inside the text",
        "pre-check last, then first, then middle pattern character",
        "if pre-check passes, compare the whole window and record matches",
        "shift by the bad-character value for the window's rightmost character",
        "done: report every occurrence found",
    ],
};

export default module;
