/**
 * relative-lcp-array.ts - Relative LCP Array
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The relative LCP array of a text T and a pattern P stores, for every start
 * position i in T, the length of the longest common prefix of P and the suffix
 * T[i..]. It is the main preprocessing structure for pattern matching with a
 * suffix array: building the Z-function of P followed by a separator followed
 * by T yields all relative LCP values in linear time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) where n = |text|, m = |pattern|
 *   Space: O(n + m) for the combined string and Z array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The text is a row of character boxes.
 *   - The matching prefix at the current position is GREEN (sorted).
 *   - The current start position is YELLOW (comparing).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

/** Standard Z-function: z[i] is the longest prefix match starting at i. */
function zFunction(s: string): number[] {
    const n = s.length;
    const z = new Array<number>(n).fill(0);
    let left = 0;
    let right = 0;
    for (let i = 1; i < n; i += 1) {
        if (i <= right) {
            z[i] = Math.min(right - i + 1, z[i - left] ?? 0);
        }
        while (i + (z[i] ?? 0) < n && s[z[i] ?? 0] === s[i + (z[i] ?? 0)]) {
            z[i] = (z[i] ?? 0) + 1;
        }
        if (i + (z[i] ?? 0) - 1 > right) {
            left = i;
            right = i + (z[i] ?? 0) - 1;
        }
    }
    return z;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "abababab";
    const pattern = task.pattern ?? "abab";
    const n = text.length;
    const m = pattern.length;
    const separator = "|";
    const combined = `${pattern}${separator}${text}`;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Computing relative LCP values of "${text}" against pattern "${pattern}".`,
        codeLineNumber: 0,
        layout: "text",
        meta: { textLength: n, patternLength: m },
    };
    step += 1;

    if (m === 0 || n === 0) {
        yield {
            stepNumber: step,
            entities: makeText(text),
            edges: [],
            description: "An empty pattern or text gives an empty relative LCP array.",
            codeLineNumber: 5,
            layout: "text",
            meta: { rlcpArray: [], textLength: n, patternLength: m },
        };
        return;
    }

    const z = zFunction(combined);
    const rlcp: number[] = [];
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Built the Z-function over pattern, separator, and text (length ${combined.length}).`,
        codeLineNumber: 1,
        layout: "text",
        meta: { combinedLength: combined.length, textLength: n },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const value = Math.min(z[m + 1 + i] ?? 0, m);
        rlcp.push(value);
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        for (let k = 0; k < value && i + k < n; k += 1) {
            states.set(i + k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeText(text, states),
            edges: [],
            description: `Position ${i}: suffix "${text.slice(i)}" matches ${value} leading character(s) of "${pattern}".`,
            codeLineNumber: 3,
            layout: "text",
            meta: { position: i, rlcp: value, rlcpSoFar: [...rlcp] },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        if ((rlcp[i] ?? 0) > 0) {
            finalStates.set(i, "sorted");
        }
    }
    yield {
        stepNumber: step,
        entities: makeText(text, finalStates),
        edges: [],
        description: `Done: relative LCP array is [${rlcp.join(", ")}].`,
        codeLineNumber: 5,
        layout: "text",
        meta: { rlcpArray: [...rlcp], textLength: n, patternLength: m },
    };
}

/** The Relative LCP Array module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "For each place in the text, ask how many leading characters of the pattern already match. Concatenating the pattern, a separator, and the text turns all those questions into one Z-function computation: the Z value at a text position is exactly that match length, capped by the pattern length.",
        invariants: [
            "The combined string is pattern, then a separator absent from the alphabet, then the text.",
            "z[m + 1 + i] equals the longest prefix match of the combined string starting at text position i.",
            "Each stored value is capped at m, the length of the pattern.",
        ],
        correctness:
            "The Z-function at position m+1+i compares the combined string's prefix (the pattern) with the suffix beginning at text position i. Because the separator cannot appear in the pattern, any match cannot cross into the text beyond the pattern, so the raw Z value already equals the LCP of the pattern and the suffix; taking the minimum with m makes this explicit. Thus every array entry equals the brute-force relative LCP.",
        complexityRationale:
            "The Z-function scans the combined string of length n + m + 1 in linear time using the Z-box window, and extracting n capped values is linear, so time is O(n + m). The combined string and Z array use O(n + m) space.",
        uses: [
            "Preprocessing text for fast suffix-array pattern searches",
            "Computing all exact match lengths of a pattern at once",
            "Indexing genomic reads against a reference sequence",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 7",
            "Manber and Myers, Suffix Arrays: A New Method for On-Line String Searches, 1990",
        ],
        workedExample:
            'With text "abababab" and pattern "abab", position 0 matches all four characters, position 1 matches none, position 6 matches two, giving [4, 0, 4, 0, 4, 0, 2, 0].',
    },
    id: "relative-lcp-array",
    name: "Relative LCP Array",
    category: "string",
    complexity: { time: "O(n + m)", space: "O(n + m)" },
    defaultInput: { text: "abababab", pattern: "abab" },
    visualType: "text",
    run,
    pseudocode: [
        "form the combined string pattern plus separator plus text",
        "compute the Z-function of the combined string",
        "for each text start position from 0 to n minus one",
        "read the Z value at the position after pattern and separator",
        "cap that value at the pattern length and store it",
        "done: report the full relative LCP array",
    ],
};

export default module;
