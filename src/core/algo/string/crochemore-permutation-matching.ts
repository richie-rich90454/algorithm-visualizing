/**
 * crochemore-permutation-matching.ts - Crochemore Permutation Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds every position where a text window is a permutation (anagram) of a
 * pattern. Instead of re-sorting every window, the algorithm keeps a frequency
 * signature and a counter of how many character counts currently differ from
 * the pattern. Sliding the window changes only two counts, so the signature is
 * updated in constant time per character.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) where n = |text|, m = |pattern|
 *   Space: O(k) for the frequency maps, k = distinct characters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The text is a row of character boxes.
 *   - The current window is YELLOW (comparing) while its signature is checked.
 *   - A window whose signature matches becomes GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function makeText(
    text: string,
    windowStart: number,
    windowLength: number,
    matched: Set<number>,
): VisualEntity[] {
    const inWindow = (i: number): boolean => i >= windowStart && i < windowStart + windowLength;
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        let state: EntityState = "idle";
        if (inWindow(index)) {
            state = "comparing";
        }
        if (matched.has(index)) {
            state = "sorted";
        }
        return { ...char, state };
    });
}

function buildCounts(chars: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const c of chars) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
}

function differenceCount(a: Map<string, number>, b: Map<string, number>): number {
    let diff = 0;
    for (const key of new Set([...a.keys(), ...b.keys()])) {
        if ((a.get(key) ?? 0) !== (b.get(key) ?? 0)) {
            diff += 1;
        }
    }
    return diff;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "abcbacabccbaabc";
    const pattern = task.pattern ?? "abc";
    const n = text.length;
    const m = pattern.length;
    const target = buildCounts(pattern.split(""));
    const matches: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeText(text, -1, 0, new Set()),
        edges: [],
        description: `Searching every window of "${text}" for a permutation of "${pattern}".`,
        codeLineNumber: 0,
        layout: "text",
        meta: { textLength: n, patternLength: m, matches: [] },
    };
    step += 1;

    if (m === 0 || m > n) {
        yield {
            stepNumber: step,
            entities: makeText(text, -1, 0, new Set()),
            edges: [],
            description: "Pattern is empty or longer than the text, so there are no windows to check.",
            codeLineNumber: 6,
            layout: "text",
            meta: { matches: [], textLength: n, patternLength: m },
        };
        return;
    }

    const window = buildCounts(text.slice(0, m).split(""));
    let diff = differenceCount(window, target);

    for (let i = 0; i <= n - m; i += 1) {
        yield {
            stepNumber: step,
            entities: makeText(text, i, m, new Set()),
            edges: [],
            description: `Window ${i}: "${text.slice(i, i + m)}" has signature difference ${diff}.`,
            codeLineNumber: 2,
            layout: "text",
            meta: { position: i, difference: diff, window: text.slice(i, i + m), matches: [...matches] },
        };
        step += 1;

        if (diff === 0) {
            matches.push(i);
            const matchedChars = new Set<number>();
            for (let k = i; k < i + m; k += 1) {
                matchedChars.add(k);
            }
            yield {
                stepNumber: step,
                entities: makeText(text, i, m, matchedChars),
                edges: [],
                description: `Anagram found at position ${i}: "${text.slice(i, i + m)}" is a permutation of "${pattern}".`,
                codeLineNumber: 4,
                layout: "text",
                meta: { position: i, matched: true, matches: [...matches] },
            };
            step += 1;
        }

        if (i + m < n) {
            const outgoing = text[i] as string;
            const incoming = text[i + m] as string;
            const outCount = window.get(outgoing) ?? 0;
            if (outCount === (target.get(outgoing) ?? 0)) {
                diff += 1;
            }
            if (outCount - 1 === (target.get(outgoing) ?? 0)) {
                diff -= 1;
            }
            window.set(outgoing, outCount - 1);
            const inCount = window.get(incoming) ?? 0;
            if (inCount === (target.get(incoming) ?? 0)) {
                diff += 1;
            }
            if (inCount + 1 === (target.get(incoming) ?? 0)) {
                diff -= 1;
            }
            window.set(incoming, inCount + 1);
        }
    }

    const allMatched = new Set<number>();
    for (const pos of matches) {
        for (let k = pos; k < pos + m; k += 1) {
            allMatched.add(k);
        }
    }
    yield {
        stepNumber: step,
        entities: makeText(text, -1, 0, allMatched),
        edges: [],
        description: `Done: found ${matches.length} permutation match(es) at positions [${matches.join(", ")}].`,
        codeLineNumber: 6,
        layout: "text",
        meta: { matches: [...matches], matchCount: matches.length },
    };
}

/** The Crochemore permutation matching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two strings are permutations of each other exactly when every character occurs the same number of times in both. Slide a window across the text and keep a small table of how many times each character appears. Only two counts change when the window moves one step, so the check is cheap.",
        invariants: [
            "The window frequency table always describes exactly the current m text characters.",
            "The difference counter equals the number of characters whose window count differs from the pattern count.",
            "The difference counter is zero if and only if the window is a permutation of the pattern.",
        ],
        correctness:
            "After initialization the difference counter is computed from the full frequency tables, so it is correct. Sliding the window removes one character and adds one; the updates adjust the counter by exactly the sign changes of those two counts. Therefore at every position diff is zero precisely when all frequency counts agree, which is the definition of a permutation match.",
        complexityRationale:
            "Building the two frequency tables costs O(n + m). Each of the n - m + 1 slides touches two characters and O(1) counter updates, so total time is linear. The frequency maps hold only the distinct characters, giving O(k) space.",
        uses: [
            "Detecting anagrams of a keyword inside a document",
            "Finding rearranged signature patterns in network packets",
            "Teaching constant-space sliding-window signature updates",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 7",
            "Crochemore and Rytter, Text Algorithms, Section on permutation matching",
        ],
        workedExample:
            "For text abcbacabccbaabc and pattern abc, the pattern counts are a=1, b=1, c=1. The window abc at position 0 has a difference of zero and is a match; the window bcb has b=2 and c=1, so its difference is nonzero. Sliding updates only the outgoing and incoming letters.",
    },
    id: "crochemore-permutation-matching",
    name: "Crochemore Permutation Matching",
    category: "string",
    complexity: { time: "O(n + m)", space: "O(k)" },
    defaultInput: { text: "abcbacabccbaabc", pattern: "abc" },
    visualType: "text",
    run,
    pseudocode: [
        "build the target frequency table of the pattern",
        "build the frequency table of the first text window",
        "for each window position from 0 to n minus m",
        "compare the two tables and count differing characters",
        "report a match when the difference count is zero",
        "remove the outgoing character from the window table",
        "add the incoming character to the window table",
        "update the difference count for those two changes",
        "done: report every matching start position",
    ],
};

export default module;
