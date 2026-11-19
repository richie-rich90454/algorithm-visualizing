/**
 * fm-index-locate.ts - FM-Index Occurrence Location
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * While FM-index search counts how many times a pattern occurs, locating asks
 * where those occurrences begin in the original text. The module builds the
 * Burrows-Wheeler transform and its LF mapping, uses backward search to find
 * the row range of the pattern, then walks LF from each row until it reaches a
 * sampled suffix array entry. The recovered suffix array value is the starting
 * position of an occurrence.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n + m + k * s) for text size n, pattern size m, k hits and
 *          sampling period s
 *   Space: O(n) for the index, sampled rows, and displayed characters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Text characters are shown above the pattern characters.
 *   - The pattern character under backward search is YELLOW.
 *   - Each located occurrence is GREEN in the text row.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface Index {
    text: string;
    n: number;
    bwt: string;
    lf: number[];
    occ: Map<string, number[]>;
    first: Map<string, number>;
    sampled: Map<number, number>;
}

function buildIndex(text: string, sentinel: string, sampling: number): Index {
    const terminated = text.endsWith(sentinel) ? text : `${text}${sentinel}`;
    const n = terminated.length;
    const sa = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
        const aSuffix = terminated.slice(a);
        const bSuffix = terminated.slice(b);
        return aSuffix < bSuffix ? -1 : aSuffix > bSuffix ? 1 : 0;
    });
    const bwt = sa.map((i) => terminated[(i - 1 + n) % n] ?? "").join("");

    const counts = new Map<string, number>();
    for (const char of terminated) counts.set(char, (counts.get(char) ?? 0) + 1);
    const first = new Map<string, number>();
    let offset = 0;
    for (const char of [...counts.keys()].sort()) {
        first.set(char, offset);
        offset += counts.get(char) ?? 0;
    }

    const occ = new Map<string, number[]>();
    for (const char of counts.keys()) occ.set(char, Array<number>(n + 1).fill(0));
    for (let i = 0; i < n; i += 1) {
        const char = bwt[i] ?? "";
        for (const [key, array] of occ) array[i + 1] = (array[i] ?? 0) + (key === char ? 1 : 0);
    }

    const lf: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const char = bwt[i] ?? "";
        lf.push((first.get(char) ?? 0) + (occ.get(char)?.[i] ?? 0));
    }

    const sampled = new Map<number, number>();
    for (let row = 0; row < n; row += 1) {
        const value = sa[row] ?? 0;
        if (value % sampling === 0) sampled.set(row, value);
    }
    return { text: terminated, n, bwt, lf, occ, first, sampled };
}

function makeEntities(text: string, pattern: string, highlight: Set<number>, activePattern: number | null): VisualEntity[] {
    const textChars = makeCharacters(text, "text").map((entity) => {
        const index = Number(entity.metadata["index"]);
        return { ...entity, state: (highlight.has(index) ? "sorted" : "idle") as EntityState };
    });
    const patternChars = makeCharacters(pattern, "pattern").map((entity) => {
        const index = Number(entity.metadata["index"]);
        return { ...entity, state: (activePattern === index ? "comparing" : "idle") as EntityState };
    });
    return [...textChars, ...patternChars];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string; sampling?: number } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "banana";
    const pattern = typeof task.pattern === "string" ? task.pattern : "ana";
    const sampling = Math.max(1, Math.floor(typeof task.sampling === "number" ? task.sampling : 4));
    const index = buildIndex(text, "$", sampling);
    const highlight = new Set<number>();
    const positions: number[] = [];
    let step = 0;

    const frame = (
        activePattern: number | null,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeEntities(index.text, pattern, highlight, activePattern),
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { comparisons: 0, matches: [], count: 0, positions: [...positions], ...extra },
    });

    yield frame(null, `Locating all occurrences of "${pattern}" in "${text}" with an FM-index.`, 0, { bwt: index.bwt });
    step += 1;

    let sp = 0;
    let ep = index.n - 1;
    let found = true;
    for (let j = pattern.length - 1; j >= 0; j -= 1) {
        const char = pattern[j] ?? "";
        const array = index.occ.get(char);
        if (!array) {
            found = false;
            sp = 1;
            ep = 0;
            yield frame(j, `Character "${char}" never appears in the text, so the pattern cannot occur.`, 3, { bwt: index.bwt, sp, ep, found });
            step += 1;
            break;
        }
        sp = (index.first.get(char) ?? 0) + (array[sp] ?? 0);
        ep = (index.first.get(char) ?? 0) + (array[ep + 1] ?? 0) - 1;
        yield frame(j, `Prepending "${char}" narrows the backward-search range to rows ${sp} through ${ep}.`, 2, { bwt: index.bwt, sp, ep, found: sp <= ep });
        step += 1;
        if (sp > ep) {
            found = false;
            break;
        }
    }

    if (pattern.length === 0) {
        sp = 0;
        ep = index.n - 1;
        found = true;
    }
    yield frame(null, `Backward search settled on ${found && sp <= ep ? ep - sp + 1 : 0} candidate row(s).`, 4, { bwt: index.bwt, sp, ep, found: found && sp <= ep });
    step += 1;

    if (found && sp <= ep) {
        for (let row = sp; row <= ep; row += 1) {
            let current = row;
            let steps = 0;
            while (!index.sampled.has(current) && steps <= index.n) {
                current = index.lf[current] ?? 0;
                steps += 1;
            }
            const base = index.sampled.get(current);
            if (base === undefined) continue;
            const position = (base + steps) % index.n;
            if (position < text.length && !positions.includes(position)) {
                positions.push(position);
                highlight.add(position);
                yield frame(null, `Row ${row} walked ${steps} LF step(s) to a sampled suffix; occurrence starts at position ${position}.`, 5, { bwt: index.bwt, sp, ep, position, count: positions.length });
                step += 1;
            }
        }
    }
    positions.sort((a, b) => a - b);

    yield frame(null, `Located ${positions.length} occurrence(s) of "${pattern}" at positions ${positions.join(", ") || "none"}.`, 7, { bwt: index.bwt, sp, ep, positions, count: positions.length });
}

/** The FM-index locate module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A suffix array can tell us where a pattern occurs, but storing all of it defeats the point of a compact index. An FM-index keeps the Burrows-Wheeler transform plus occasional sampled suffix array values. Backward search finds a small range of rows for the pattern, and a short walk on the LF mapping reaches a sampled row whose stored value reveals the occurrence position.",
        invariants: [
            "Each LF step moves to the row of a suffix one character shorter.",
            "A sampled row always stores the exact suffix array value for that row.",
            "After k LF steps, the original row's suffix value is the sampled value plus k, modulo the text length.",
        ],
        correctness:
            "The LF mapping sends row i to the row whose rotation starts one character earlier, so stepping LF k times from row i reaches a suffix starting k characters earlier. If that row was sampled with suffix array value b, the original row's value is b plus k modulo the text length, which is exactly the occurrence start. Backward search guarantees rows in the range correspond precisely to suffixes prefixed by the pattern, so every recovered position is a true occurrence and none are missed.",
        complexityRationale:
            "Building the suffix array and BWT takes O(n log n) for a short text. Backward search is O(m), and each of the k located rows walks at most the sampling period s steps to a sampled row, giving O(k * s) for location and O(n) space for the index and display.",
        uses: [
            "Mapping sequencing reads to a reference genome",
            "Finding all occurrences of a term in a compressed text index",
            "Supporting substring search in memory-constrained full-text indexes",
        ],
        references: [
            "Ferragina and Manzini, Indexing Compressed Text, 2005",
            "Navarro and Makinen, Compressed Full-Text Indexes, 2007",
        ],
        workedExample:
            "In the text banana, the pattern ana occurs at positions 1 and 3. Backward search narrows to two BWT rows; walking LF from each row reaches a sampled suffix array entry, and adding the number of steps taken yields the two starting positions 1 and 3.",
    },
    id: "fm-index-locate",
    name: "FM-Index Locate",
    category: "string",
    complexity: { time: "O(n log n + m + k * s)", space: "O(n)" },
    defaultInput: { text: "banana", pattern: "ana", sampling: 4 },
    visualType: "text",
    run,
    pseudocode: [
        "append a sentinel and build the suffix array of the text",
        "form the Burrows-Wheeler last column and sample every s-th suffix array row",
        "backward search the pattern one character at a time",
        "if a character is absent report that the pattern cannot occur",
        "the resulting row range lists exactly the suffixes prefixed by the pattern",
        "for each row follow LF until a sampled suffix array row is reached",
        "recover the position as the sampled value plus the steps taken",
        "done: report the sorted occurrence positions",
    ],
};

export default module;
