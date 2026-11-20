/**
 * zhu-takaoka.ts - Zhu-Takaoka String Search
 *
 * An improvement on Boyer-Moore-Horspool that bases the skip distance on the
 * last two characters of the current window instead of just one. A table maps
 * each ordered pair of characters to the distance to the rightmost occurrence
 * of that pair inside the pattern, so a mismatch can usually skip farther.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "../string/string-util";

function makeText(text: string, states: Map<number, EntityState> = new Map(), matches: number[] = []): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        let state = states.get(index) ?? "idle";
        if (matches.some((start) => index >= start && index < start + 1)) state = "sorted";
        return { ...char, state };
    });
}

function pairKey(a: string, b: string): string {
    return `${a}\u0000${b}`;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "ababababcababab";
    const pattern = task.pattern ?? "abab";
    const n = text.length;
    const m = pattern.length;
    const frames: VisualFrame[] = [];
    const found: number[] = [];
    let comparisons = 0;
    let shifts = 0;

    const push = (states: Map<number, EntityState>, desc: string, line: number): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeText(text, states, found),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "text",
            meta: { comparisons, shifts, matches: found.length, positions: [...found] },
        });
    };

    push(new Map(), `Zhu-Takaoka search for "${pattern}" in "${text}".`, 0);
    if (m === 0 || m > n) {
        push(new Map(), m === 0 ? "Empty pattern - no search performed." : "Pattern longer than text - no matches.", 6);
        for (const frame of frames) yield frame;
        return;
    }

    const shift = new Map<string, number>();
    for (let j = 0; j <= m - 3; j += 1) {
        shift.set(pairKey(pattern[j]!, pattern[j + 1]!), m - 2 - j);
    }
    push(new Map(), `Built a two-character shift table with ${shift.size} pair(s).`, 1);

    let i = 0;
    while (i + m <= n) {
        const states = new Map<number, EntityState>();
        for (let k = 0; k < m; k += 1) states.set(i + k, "comparing");
        let j = 0;
        while (j < m && text[i + j] === pattern[j]) {
            comparisons += 1;
            j += 1;
        }
        if (j === m) {
            found.push(i);
            push(states, `Match of "${pattern}" at index ${i}.`, 3);
        } else {
            push(states, `Mismatch at alignment ${i} after ${j} character match(es).`, 2);
        }
        let skip: number;
        if (m < 3) {
            skip = 1;
        } else {
            const a = text[i + m - 2]!;
            const b = text[i + m - 1]!;
            skip = shift.get(pairKey(a, b)) ?? m - 1;
        }
        shifts += 1;
        i += skip;
    }

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeText(text, new Map(), found),
        edges: [],
        description: `Done: found ${found.length} match(es) at ${found.join(", ") || "no position"}.`,
        codeLineNumber: 7,
        layout: "text",
        meta: { comparisons, shifts, matches: found.length, positions: [...found] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a comparison fails, a single bad character often understates how far the pattern can move. Pairing the last two characters of the window gives a more selective signal: the pattern only needs to shift to the next place where that same ordered pair appears inside it.",
        invariants: [
            "Every stored pair shift equals the distance to the rightmost occurrence of that pair inside the pattern.",
            "The shift is always at least one, so the alignment index strictly increases.",
            "No alignment that could contain a full match is ever skipped.",
        ],
        correctness:
            "After an alignment at i fails, the next alignment that could match must place the window's final two characters against an occurrence of that same pair in the pattern. The rightmost such occurrence gives the smallest safe shift, which is exactly the precomputed table value; if the pair never occurs in the pattern, no earlier alignment could match and a full pattern-length shift is safe.",
        complexityRationale:
            "Preprocessing scans the m-1 adjacent pairs of the pattern once, O(m) time and space. Search advances by at least one each step over n-m+1 alignments, so the worst case is O(n*m) and the typical case on large alphabets is close to O(n).",
        uses: [
            "Fast substring search in text editors and search tools",
            "Scanning network payloads for known byte signatures",
            "A teaching example of two-character bad-pair heuristics",
        ],
        references: [
            "Zhu and Takaoka, On Improving the Fastest String Matching Algorithm, 1989",
            "Crochemore and Rytter, Text Algorithms, chapter on Boyer-Moore variants",
        ],
        workedExample:
            "Searching for abab in ababababcababab, the pair ab occurs at pattern index 0 so a mismatch can skip by 2. Matches are reported at indices 0, 2, 4, 9 and 11.",
    },
    id: "zhu-takaoka",
    name: "Zhu-Takaoka String Search",
    category: "searching",
    complexity: { time: "O(n*m) worst case", space: "O(m)" },
    defaultInput: { text: "ababababcababab", pattern: "abab" },
    visualType: "text",
    run,
    pseudocode: [
        "read text and pattern",
        "build a shift table for every adjacent pattern pair",
        "align the pattern at the start of the text",
        "compare left to right until a mismatch or a full match",
        "on a match, record the starting index",
        "shift by the pair table value for the window's last two characters",
        "repeat until the window passes the end of the text",
        "done: report every match position",
    ],
};

export default module;
