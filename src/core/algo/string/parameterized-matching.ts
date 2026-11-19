/**
 * parameterized-matching.ts - Parameterized (p-Matching) Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two strings parameterized-match when one can be turned into the other by a
 * one-to-one renaming of its symbols: "aba" matches "xyx" but not "xxy". The
 * predecessor encoding replaces each symbol by the distance back to its most
 * recent earlier occurrence, using zero for a first occurrence. Two strings
 * p-match exactly when their predecessor encodings are equal. Sliding that
 * encoding over the text finds every p-match of the pattern.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m) for text length n and pattern length m
 *   Space: O(n + m) for the displayed characters and encodings
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The text is drawn as a row of character boxes.
 *   - The current window is highlighted; a p-match turns green.
 *   - Metadata shows the pattern encoding and each window encoding.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface ParameterizedInput {
    text?: string;
    pattern?: string;
}

/** Predecessor encoding: distance to the previous identical symbol, or zero. */
function predecessorEncoding(s: string): number[] {
    const last = new Map<string, number>();
    const encoding: number[] = [];
    for (let i = 0; i < s.length; i += 1) {
        const char = s[i] as string;
        const previous = last.get(char);
        encoding.push(previous === undefined ? 0 : i - previous);
        last.set(char, i);
    }
    return encoding;
}

/** The text characters with the current window colored. */
function makeText(
    text: string,
    start: number,
    length: number,
    matched: boolean,
    allMatches: number[],
): VisualEntity[] {
    return makeCharacters(text).map((entity) => {
        const index = Number(entity.metadata["index"]);
        let state: EntityState = "idle";
        if (allMatches.some((m) => index >= m && index < m + length)) {
            state = "sorted";
        }
        if (index >= start && index < start + length) {
            state = matched ? "sorted" : "comparing";
        }
        return { ...entity, state };
    });
}

/** The parameterized matching generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ParameterizedInput | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "abacaba";
    const pattern = typeof task.pattern === "string" ? task.pattern : "aba";
    const n = text.length;
    const m = pattern.length;
    const patternEncoding = predecessorEncoding(pattern);
    const matches: number[] = [];
    let comparisons = 0;

    yield {
        stepNumber: 0,
        entities: makeText(text, -1, m, false, []),
        edges: [],
        description: `Parameterized search for "${pattern}" in "${text}" using predecessor encoding.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {
            matches: [] as number[],
            comparisons: 0,
            patternEncoding,
            windowEncoding: [] as number[],
            start: -1,
            pattern,
        },
    };

    let step = 1;
    if (m === 0) {
        for (let start = 0; start <= n; start += 1) {
            matches.push(start);
        }
        yield {
            stepNumber: step,
            entities: makeText(text, -1, 0, false, []),
            edges: [],
            description: `Empty pattern p-matches at all ${matches.length} boundaries.`,
            codeLineNumber: 4,
            layout: "text",
            meta: { matches, comparisons, patternEncoding, windowEncoding: [], start: -1, pattern },
        };
        return;
    }

    for (let start = 0; start <= n - m; start += 1) {
        const window = text.slice(start, start + m);
        const windowEncoding = predecessorEncoding(window);
        comparisons += 1;
        const matched = patternEncoding.every((value, i) => value === windowEncoding[i]);
        if (matched) {
            matches.push(start);
        }
        yield {
            stepNumber: step,
            entities: makeText(text, start, m, matched, []),
            edges: [],
            description:
                `Window ${start} "${window}" encodes [${windowEncoding.join(", ")}]` +
                `${matched ? " - p-matches the pattern" : " - no p-match"}.`,
            codeLineNumber: matched ? 4 : 2,
            layout: "text",
            meta: { matches: [...matches], comparisons, patternEncoding, windowEncoding, start, pattern },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeText(text, -1, m, false, matches),
        edges: [],
        description:
            matches.length === 0
                ? `No substring of "${text}" p-matches "${pattern}".`
                : `"${pattern}" p-matches at ${matches.join(", ")}.`,
        codeLineNumber: 5,
        layout: "text",
        meta: { matches, comparisons, patternEncoding, windowEncoding: [], start: -1, pattern },
    };
}

/** The parameterized matching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Parameterized matching ignores the actual names of symbols and cares only about which positions repeat. It is the right notion of equality when comparing code fragments that differ only by renamed variables. Replacing each symbol by how far back its previous equal symbol sits turns this equality question into ordinary string comparison.",
        invariants: [
            "A zero in the predecessor encoding marks a symbol whose first occurrence is at that position.",
            "Two equal positive encoding values mean the two positions hold the same symbol in that string.",
            "A window p-matches the pattern exactly when their predecessor encodings are identical.",
        ],
        correctness:
            "If two strings have the same predecessor encoding, then whenever one position repeats an earlier symbol, the corresponding position in the other repeats its earlier symbol at the same distance, so the equality relation between positions is identical. An equality-preserving bijection between the alphabets therefore exists, which is precisely a parameterized match. Conversely a renaming preserves the equality relation and hence the encoding, so the encoding test is both necessary and sufficient. Sliding the window enumerates every substring, so all matches are found.",
        complexityRationale:
            "Encoding the pattern costs O(m). Each of the O(n) windows builds its encoding in O(m) and compares in O(m), giving O(nm) time. The text, pattern encoding, and one window encoding occupy O(n + m) space.",
        uses: [
            "Detecting duplicated code that differs only in variable names",
            "Comparing structured queries and XML tag sequences up to renaming",
            "Bioinformatics motif discovery over renamed alphabets",
        ],
        references: [
            "Baker, Parameterized Pattern Matching: Algorithms and Applications, 1993",
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 11",
        ],
        workedExample:
            'The pattern "aba" encodes to [0, 0, 2]. In "abacaba" the window at position zero is "aba" with encoding [0, 0, 2] and matches; the window at position two is "aca", also [0, 0, 2] and matches; the window "bac" encodes [0, 0, 0] and does not.',
    },
    id: "parameterized-matching",
    name: "Parameterized Matching",
    category: "string",
    complexity: { time: "O(n * m)", space: "O(n + m)" },
    defaultInput: { text: "abacaba", pattern: "aba" },
    visualType: "text",
    run,
    pseudocode: [
        "encode the pattern with predecessor distances",
        "slide a window of pattern length across the text",
        "build the predecessor encoding of the current window",
        "compare the window encoding with the pattern encoding",
        "record a match when every encoded value agrees",
        "advance the window by one position",
        "done: report all parameterized match positions",
    ],
};

export default module;
