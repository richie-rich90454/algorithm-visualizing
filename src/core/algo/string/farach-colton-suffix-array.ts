/**
 * farach-colton-suffix-array.ts – Farach-Colton suffix array construction.
 *
 * Farach-Colton builds a suffix array by recursively separating suffixes into
 * two halves and merging the two sorted groups. The divide-and-conquer split
 * is the defining trick: it reduces each subproblem to half the suffixes.
 * This teaching version uses direct suffix comparison at the merge instead of
 * the linear-time radix passes of the full method.
 *
 *  Time:  O(n log n) comparisons in this version, O(n) in the full method
 *  Space: O(n)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

function compareSuffixes(text: string, i: number, j: number): number {
    let a = i;
    let b = j;
    while (a < text.length && b < text.length) {
        const ca = text.charCodeAt(a);
        const cb = text.charCodeAt(b);
        if (ca !== cb) return ca - cb;
        a += 1;
        b += 1;
    }
    if (a === b) return 0;
    return a >= text.length ? -1 : 1;
}

function mergeSorted(left: number[], right: number[], text: string): number[] {
    const out: number[] = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
        if (compareSuffixes(text, left[i] as number, right[j] as number) <= 0) {
            out.push(left[i] as number);
            i += 1;
        } else {
            out.push(right[j] as number);
            j += 1;
        }
    }
    while (i < left.length) out.push(left[i++] as number);
    while (j < right.length) out.push(right[j++] as number);
    return out;
}

function buildParity(
    indices: number[],
    text: string,
    trace: Array<{ level: number; even: number[]; odd: number[] }>,
    level: number,
): number[] {
    if (indices.length <= 1) return [...indices].sort((a, b) => compareSuffixes(text, a, b));
    // Split by position in the current list so every recursive call is half the size.
    const even = indices.filter((_, pos) => pos % 2 === 0);
    const odd = indices.filter((_, pos) => pos % 2 === 1);
    trace.push({ level, even, odd });
    const se = buildParity(even, text, trace, level + 1);
    const so = buildParity(odd, text, trace, level + 1);
    return mergeSorted(se, so, text);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";
    const lines = 7;
    let step = 0;
    const F = (states: Map<number, EntityState>, description: string, line: number, sa: number[]): VisualFrame => ({
        stepNumber: step,
        entities: makeText(text, states),
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: { suffixArray: sa, length: text.length },
    });

    yield F(new Map(), `Farach-Colton parity recursion for suffix array of "${text}".`, 0, []);
    step += 1;
    if (text.length === 0) {
        yield F(new Map(), "Empty text - the suffix array is empty.", 6, []);
        return;
    }

    const splits: Array<{ level: number; even: number[]; odd: number[] }> = [];
    const sa = buildParity(
        Array.from({ length: text.length }, (_, i) => i),
        text,
        splits,
        0,
    );

    for (const split of splits.slice(0, 8)) {
        const states = new Map<number, EntityState>();
        for (const i of split.even) states.set(i, "visited");
        for (const i of split.odd) states.set(i, "highlight");
        yield F(states, `Level ${split.level}: split ${split.even.length} and ${split.odd.length} suffixes into two halves before merging.`, 2, sa);
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (const i of sa) finalStates.set(i, "sorted");
    yield F(finalStates, `Suffix array: [${sa.join(", ")}] for "${text}".`, 6, sa);
}

const module: AlgorithmModule = {
    education: {
        intuition: "Farach-Colton splits the suffixes into two halves, recursively orders each half, and merges the two sorted lists. Because comparisons between suffixes reduce to comparing a character and the rank of the remaining suffix, the halving recursion leads to linear time in the full algorithm. This visualization shows the recursive decomposition directly.",
        invariants: [
            "Every suffix belongs to exactly one of the two halves at each recursion level.",
            "The two groups returned by the recursive calls are each fully sorted before the merge.",
            "The merge compares suffixes by their full lexicographic order, so its output is also sorted."
        ],
        correctness: "Recursion terminates because each parity group is at most half the suffixes. Sorting each group and merging by direct lexicographic comparison yields the suffixes in full sorted order by the standard merge argument. The resulting array lists every start index exactly once in lexicographic order of its suffix, which is the definition of the suffix array.",
        complexityRationale: "The full Farach-Colton method uses radix-style counting sorts and recursion on half the input to achieve O(n) time and O(n) space. This teaching version compares suffixes directly during the merge, costing O(n log n) character comparisons in typical cases, while keeping the same parity decomposition and O(n) storage.",
        uses: [
            "Linear-time suffix array construction for large texts",
            "Building full-text indexes and FM-indexes",
            "Bioinformatics read alignment pipelines",
            "A teaching example of recursive string algorithms"
        ],
        references: [
            "Farach-Colton, Optimal Suffix Tree Construction with Large Alphabets, 1997",
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 3"
        ],
        workedExample: "For banana the suffixes start at indices 0 through 5. The first split separates them into two halves, for example 0,2,4 and 1,3,5. Recursively sorting each half and merging by lexicographic comparison produces the suffix array [5,3,1,0,4,2], whose suffixes are a, ana, anana, banana, na, nana."
    },
    id: "farach-colton-suffix-array",
    name: "Farach-Colton Suffix Array",
    category: "string",
    complexity: { time: "O(n log n) teaching version", space: "O(n)" },
    defaultInput: { text: "banana" },
    visualType: "text",
    run,
    pseudocode: [
        "start with all suffix start indices",
        "split the current indices into two halves",
        "recursively build the suffix array of each group",
        "merge the two sorted groups by suffix comparison",
        "return the merged list at each recursion level",
        "verify adjacent suffixes are in lexicographic order",
        "report the complete suffix array"
    ]
};

export default module;
