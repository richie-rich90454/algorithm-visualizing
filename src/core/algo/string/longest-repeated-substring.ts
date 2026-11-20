/**
 * longest-repeated-substring.ts - Longest Repeated Substring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds the longest substring of a text that occurs at least twice. The text's
 * suffixes are sorted lexicographically into a suffix array. Equal substrings
 * are prefixes of suffixes that sit near each other in that order, so the
 * longest repeated substring is the maximum longest-common-prefix of two
 * adjacent suffixes in the array.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 log n) with direct suffix comparisons for a readable demo
 *   Space: O(n) for the suffix array and helpers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The text is a row of character boxes.
 *   - The two suffix starts being compared are YELLOW (comparing).
 *   - A new longest repeat is highlighted in GREEN (sorted) on the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

function lcpLength(text: string, a: number, b: number): number {
    let length = 0;
    while (a + length < text.length && b + length < text.length && text[a + length] === text[b + length]) {
        length += 1;
    }
    return length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";
    const n = text.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Finding the longest substring of "${text}" that occurs at least twice.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { textLength: n, bestLength: 0 },
    };
    step += 1;

    if (n < 2) {
        yield {
            stepNumber: step,
            entities: makeText(text),
            edges: [],
            description: "A string shorter than two characters has no repeated substring.",
            codeLineNumber: 6,
            layout: "text",
            meta: { longestRepeated: "", bestLength: 0, occurrences: [] },
        };
        return;
    }

    const suffixArray = Array.from({ length: n }, (_, i) => i).sort((x, y) => {
        const sx = text.slice(x);
        const sy = text.slice(y);
        return sx < sy ? -1 : sx > sy ? 1 : 0;
    });

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Suffix array built: [${suffixArray.join(", ")}]. Adjacent suffixes share the longest prefixes.`,
        codeLineNumber: 1,
        layout: "text",
        meta: { suffixArray: [...suffixArray], bestLength: 0 },
    };
    step += 1;

    let bestLength = 0;
    let bestStart = -1;

    for (let j = 1; j < suffixArray.length; j += 1) {
        const a = suffixArray[j - 1] as number;
        const b = suffixArray[j] as number;
        const length = lcpLength(text, a, b);
        const states = new Map<number, EntityState>([
            [a, "comparing"],
            [b, "comparing"],
        ]);
        yield {
            stepNumber: step,
            entities: makeText(text, states),
            edges: [],
            description: `Comparing suffixes at ${a} and ${b}: their common prefix has length ${length}.`,
            codeLineNumber: 3,
            layout: "text",
            meta: { suffixA: a, suffixB: b, lcp: length, bestLength },
        };
        step += 1;

        if (length > bestLength) {
            bestLength = length;
            bestStart = a;
            const spanStates = new Map<number, EntityState>();
            for (let k = a; k < a + length; k += 1) {
                spanStates.set(k, "highlight");
            }
            yield {
                stepNumber: step,
                entities: makeText(text, spanStates),
                edges: [],
                description: `New longest repeat of length ${length}: "${text.slice(a, a + length)}".`,
                codeLineNumber: 4,
                layout: "text",
                meta: { bestLength, candidate: text.slice(a, a + length), bestStart: a },
            };
            step += 1;
        }
    }

    const longest = bestStart < 0 ? "" : text.slice(bestStart, bestStart + bestLength);
    const occurrences: number[] = [];
    if (longest.length > 0) {
        for (let i = 0; i + longest.length <= n; i += 1) {
            if (text.slice(i, i + longest.length) === longest) {
                occurrences.push(i);
            }
        }
    }
    const finalStates = new Map<number, EntityState>();
    for (const pos of occurrences) {
        for (let k = pos; k < pos + longest.length; k += 1) {
            finalStates.set(k, "sorted");
        }
    }
    yield {
        stepNumber: step,
        entities: makeText(text, finalStates),
        edges: [],
        description:
            longest.length > 0
                ? `Done: longest repeated substring is "${longest}" at positions [${occurrences.join(", ")}].`
                : "Done: no character repeats in this string.",
        codeLineNumber: 6,
        layout: "text",
        meta: { longestRepeated: longest, bestLength: longest.length, occurrences: [...occurrences] },
    };
}

/** The Longest Repeated Substring module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If a substring appears twice, the two suffixes starting at those positions begin with the same letters. Sorting all suffixes puts equal prefixes next to each other, so comparing only neighboring suffixes is enough to find the longest repeat.",
        invariants: [
            "The suffix array is a permutation of all starting positions of the text.",
            "For any repeated substring, its occurrences occupy consecutive positions in the suffix array.",
            "bestLength is the largest adjacent-suffix common prefix seen so far.",
        ],
        correctness:
            "Consider the longest repeated substring of length L at two positions. The suffixes at those positions share a prefix of length L, and every suffix between them in sorted order also shares that prefix. Hence some adjacent pair in the suffix array shares a prefix of at least L, so scanning adjacent pairs finds a repeat of length at least L and never one longer than the true maximum.",
        complexityRationale:
            "Sorting n suffixes with direct string comparison costs O(n^2 log n) in the worst case, and the adjacent LCP scans cost O(n^2) total; space is O(n) for the suffix array and state maps.",
        uses: [
            "Finding repeated motifs in DNA sequences",
            "Detecting duplicated phrases in documents",
            "Building blocks of suffix-tree and compressed-index algorithms",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 7",
            "Manber and Myers, Suffix Arrays: A New Method for On-Line String Searches, 1990",
        ],
        workedExample:
            'In "banana" the suffixes sort so that "ana" and "anana" are neighbors. Their common prefix is "ana" of length 3, which occurs at positions 1 and 3; no longer substring repeats.',
    },
    id: "longest-repeated-substring",
    name: "Longest Repeated Substring",
    category: "string",
    complexity: { time: "O(n^2 log n)", space: "O(n)" },
    defaultInput: { text: "banana" },
    visualType: "text",
    run,
    pseudocode: [
        "list every starting position of the text",
        "sort the positions by their suffixes to form the suffix array",
        "for each adjacent pair of suffixes in the array",
        "compute the length of their longest common prefix",
        "remember the pair with the largest common prefix",
        "collect all occurrences of that longest substring",
        "done: report the substring and its positions",
    ],
};

export default module;
