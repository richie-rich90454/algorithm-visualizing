/**
 * sa-is-suffix-array.ts - Suffix Array by Induced Sorting (SA-IS).
 *
 * SA-IS classifies positions as S-type or L-type, sorts the LMS substrings
 * with two induced-sort passes, renames them, solves the reduced problem
 * recursively, and induces the full suffix array from the sorted LMS order.
 * It builds a suffix array in linear time over a constant alphabet.
 *
 *   Time:  O(n)
 *   Space: O(n)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeSuffixGrid(text: string, activeRows: number[] = []): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const n = text.length;
    for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
            const char = text[row + col] ?? "";
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: char,
                value: char,
                state: (activeRows.includes(row) ? "comparing" : "unvisited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

/**
 * Core SA-IS on a sequence whose implicit trailing sentinel is the unique
 * minimum. Returns the full suffix array, including the empty suffix at index
 * zero, so a recursive call can reuse it directly.
 */
function saisCore(data: number[], alphabetSize: number): number[] {
    const n = data.length;
    const isS = new Array<boolean>(n + 1).fill(false);
    isS[n] = true;
    if (n === 0) return [n];
    isS[n - 1] = false;
    for (let i = n - 2; i >= 0; i -= 1) {
        if (data[i]! > data[i + 1]!) isS[i] = false;
        else if (data[i] === data[i + 1] && !isS[i + 1]!) isS[i] = false;
        else isS[i] = true;
    }
    const isLms = (i: number): boolean => i > 0 && isS[i]! && !isS[i - 1]!;

    const sizes = new Array<number>(alphabetSize).fill(0);
    for (const v of data) sizes[v]! += 1;
    const heads: number[] = [];
    const tails: number[] = [];
    let offset = 1;
    for (const size of sizes) {
        heads.push(offset);
        offset += size;
    }
    offset = 1;
    for (const size of sizes) {
        offset += size;
        tails.push(offset - 1);
    }

    const guessLms = (): number[] => {
        const sa = new Array<number>(n + 1).fill(-1);
        const tail = tails.slice();
        for (let i = 0; i < n; i += 1) {
            if (!isLms(i)) continue;
            const c = data[i]!;
            sa[tail[c]!] = i;
            tail[c] = tail[c]! - 1;
        }
        sa[0] = n;
        return sa;
    };
    const induceL = (sa: number[]): void => {
        const head = heads.slice();
        for (let i = 0; i < sa.length; i += 1) {
            const v = sa[i]!;
            if (v < 0) continue;
            const j = v - 1;
            if (j < 0 || isS[j]) continue;
            const c = data[j]!;
            sa[head[c]!] = j;
            head[c] = head[c]! + 1;
        }
    };
    const induceS = (sa: number[]): void => {
        const tail = tails.slice();
        for (let i = sa.length - 1; i >= 0; i -= 1) {
            const v = sa[i]!;
            if (v < 0) continue;
            const j = v - 1;
            if (j < 0 || !isS[j]) continue;
            const c = data[j]!;
            sa[tail[c]!] = j;
            tail[c] = tail[c]! - 1;
        }
    };
    const lmsEqual = (a: number, b: number): boolean => {
        if (a === n || b === n) return false;
        let k = 0;
        for (;;) {
            const ai = k + a;
            const bi = k + b;
            const aLms = isLms(ai);
            const bLms = isLms(bi);
            if (k > 0 && aLms && bLms) return true;
            if (aLms !== bLms) return false;
            if (data[ai] !== data[bi]) return false;
            k += 1;
        }
    };
    const summarise = (sa: number[]): { summary: number[]; offsets: number[]; alphabet: number } => {
        const names = new Array<number>(n + 1).fill(-1);
        let name = 0;
        names[sa[0]!] = 0;
        let previous = sa[0]!;
        for (let i = 1; i < sa.length; i += 1) {
            const v = sa[i]!;
            if (!isLms(v)) continue;
            if (!lmsEqual(previous, v)) name += 1;
            previous = v;
            names[v] = name;
        }
        const summary: number[] = [];
        const offsets: number[] = [];
        for (let i = 0; i < names.length; i += 1) {
            if (names[i] === -1) continue;
            offsets.push(i);
            summary.push(names[i]!);
        }
        return { summary, offsets, alphabet: name + 1 };
    };
    const summarySa = (summary: number[], alphabet: number): number[] => {
        const len = summary.length;
        if (alphabet === len) {
            const sa = new Array<number>(len + 1).fill(-1);
            sa[0] = len;
            for (let x = 0; x < len; x += 1) sa[summary[x]! + 1] = x;
            return sa;
        }
        return saisCore(summary, alphabet);
    };
    const placeLms = (summaryArray: number[], offsets: number[]): number[] => {
        const sa = new Array<number>(n + 1).fill(-1);
        const tail = tails.slice();
        for (let i = summaryArray.length - 1; i >= 2; i -= 1) {
            const index = offsets[summaryArray[i]!]!;
            const c = data[index]!;
            sa[tail[c]!] = index;
            tail[c] = tail[c]! - 1;
        }
        sa[0] = n;
        return sa;
    };

    const guessed = guessLms();
    induceL(guessed);
    induceS(guessed);
    const { summary, offsets, alphabet } = summarise(guessed);
    const real = placeLms(summarySa(summary, alphabet), offsets);
    induceL(real);
    induceS(real);
    return real;
}

/** Build the suffix array without the trailing empty suffix. */
function sais(data: number[], alphabetSize: number): number[] {
    return saisCore(data, alphabetSize).slice(1);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";
    let step = 0;
    const frame = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { rows: Math.max(1, text.length), cols: Math.max(1, text.length), ...meta },
    });

    if (text.length === 0) {
        yield frame([], "Empty text has an empty suffix array.", 0, { suffixArray: [] });
        return;
    }
    const codes = [...text].map((c) => c.charCodeAt(0) + 1);
    const alphabet = Math.max(0, ...codes) + 1;
    const suffixArray = sais(codes, alphabet);
    yield frame(makeSuffixGrid(text), `Building the suffix array of "${text}" by induced sorting.`, 0);
    step += 1;
    const isS = new Array<boolean>(codes.length + 1).fill(false);
    isS[codes.length] = true;
    if (codes.length > 0) isS[codes.length - 1] = false;
    for (let i = codes.length - 2; i >= 0; i -= 1) {
        if (codes[i]! > codes[i + 1]!) isS[i] = false;
        else if (codes[i] === codes[i + 1] && !isS[i + 1]!) isS[i] = false;
        else isS[i] = true;
    }
    const types = isS.slice(0, text.length).map((s) => (s ? "S" : "L")).join("");
    yield frame(makeSuffixGrid(text), `Classified positions as ${types} with a sentinel at the end.`, 1, {
        types,
    });
    step += 1;
    yield frame(
        makeSuffixGrid(text),
        "Induced sorting placed the LMS substrings into their buckets.",
        2,
        { suffixArray: [...suffixArray] },
    );
    step += 1;
    yield frame(
        makeSuffixGrid(text),
        "Recursive renaming of LMS substrings produced a reduced problem.",
        3,
        { suffixArray: [...suffixArray] },
    );
    step += 1;
    yield frame(
        makeSuffixGrid(text),
        `Final suffix array: [${suffixArray.join(", ")}].`,
        4,
        { suffixArray: [...suffixArray], suffixes: suffixArray.map((i) => text.slice(i)) },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SA-IS sorts suffixes without comparing them one character at a time. It marks each position as small or large depending on whether its suffix is smaller than its neighbor, then focuses on the special positions where a small suffix follows a large one. Sorting just those positions and induces the order of all the others by two cheap scans of the array, and a recursive call on a shortened string finishes the job.",
        invariants: [
            "The sentinel is the unique smallest symbol and its suffix is first in the final array.",
            "During induced sorting, placing a left neighbor in its bucket is valid because the suffix starting there is smaller.",
            "Renaming LMS substrings preserves their lexicographic order.",
        ],
        correctness:
            "An S-type suffix is smaller than its right neighbor while an L-type suffix is larger, so once the LMS suffixes are ordered, a left-to-right scan can insert every L-type position into the correct bucket and a right-to-left scan can insert every S-type position. Two LMS substrings have the same name exactly when they are equal, so solving the reduced problem gives their true order. Inducing once more from that order therefore yields the full lexicographic order of all suffixes.",
        complexityRationale:
            "Each induced-sort pass scans the array a constant number of times, and the recursive problem is at most half the length of the original because it contains only LMS positions. The recurrence T(n) = T(n/2) plus linear work gives O(n) time and O(n) space.",
        uses: [
            "Building full-text indexes for large document collections",
            "Underlying engine for FM-index and BWT-based search tools",
            "Genome indexing in bioinformatics pipelines",
        ],
        references: [
            "Nong, Zhang, and Chan, Two Linear Time Algorithms for Suffix Array Construction, SODA 2009",
            "Gusfield, Algorithms on Strings, Trees, and Sequences",
        ],
        workedExample:
            'For "banana", SA-IS classifies the positions, sorts the LMS substrings, and recursively resolves ties. The resulting suffix array is [5, 3, 1, 0, 4, 2], listing the suffixes a, ana, anana, banana, na, and nana in lexicographic order.',
    },
    id: "sa-is-suffix-array",
    name: "SA-IS Suffix Array",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "banana" },
    visualType: "grid",
    run,
    pseudocode: [
        "append a unique smallest sentinel to the symbol sequence",
        "classify each position as small type or large type",
        "collect left-to-small transition positions",
        "induce sort those positions with bucket scans",
        "rename the transition substrings and solve recursively",
        "induce the full suffix array from the sorted order",
        "drop the sentinel and report the suffix array",
    ],
};

export default module;
