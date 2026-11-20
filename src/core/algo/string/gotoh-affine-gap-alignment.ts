/**
 * gotoh-affine-gap-alignment.ts - Gotoh's global alignment with affine gaps.
 *
 * Score maximization with three matrices: M ends in a match or mismatch, X
 * ends in a gap in the second sequence, and Y ends in a gap in the first.
 * A gap of length k costs open + k * extend, so consecutive gaps are cheaper
 * than k separate single-character gaps.
 *
 *   Time:  O(nm)
 *   Space: O(nm)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

const NEG = -1e9;

function fmt(value: number): string {
    return value <= NEG / 2 ? "-inf" : String(value);
}

function makeGrid(matrix: Matrix, activeRows: number[] = []): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        const row = matrix[r] ?? [];
        for (let c = 0; c < row.length; c += 1) {
            out.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: fmt(row[c] ?? NEG),
                value: row[c] ?? NEG,
                state: (activeRows.includes(r) ? "comparing" : r + c <= 1 ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return out;
}

function best3(a: number, b: number, c: number): number {
    return Math.max(a, b, c);
}

function gotoh(
    a: string,
    b: string,
    open: number,
    extend: number,
): { M: Matrix; X: Matrix; Y: Matrix; score: number; alignedA: string; alignedB: string } {
    const n = a.length;
    const m = b.length;
    const M: Matrix = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
    const X: Matrix = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
    const Y: Matrix = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
    const openExtend = open + extend;
    M[0]![0] = 0;
    for (let i = 1; i <= n; i += 1) X[i]![0] = -(open + i * extend);
    for (let j = 1; j <= m; j += 1) Y[0]![j] = -(open + j * extend);
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            const sub = a[i - 1] === b[j - 1] ? 1 : -1;
            M[i]![j] = best3(M[i - 1]![j - 1]!, X[i - 1]![j - 1]!, Y[i - 1]![j - 1]!) + sub;
            X[i]![j] = best3(
                M[i - 1]![j]! - openExtend,
                X[i - 1]![j]! - extend,
                Y[i - 1]![j]! - openExtend,
            );
            Y[i]![j] = best3(
                M[i]![j - 1]! - openExtend,
                X[i]![j - 1]! - openExtend,
                Y[i]![j - 1]! - extend,
            );
        }
    }
    const finals: Array<[number, string]> = [
        [M[n]![m]!, "M"],
        [X[n]![m]!, "X"],
        [Y[n]![m]!, "Y"],
    ];
    finals.sort((p, q) => q[0] - p[0]);
    const score = finals[0]![0];
    let state = finals[0]![1] as string;
    let i = n;
    let j = m;
    let alignedA = "";
    let alignedB = "";
    let guard = 0;
    while ((i > 0 || j > 0) && guard++ < 10000) {
        if (state === "M") {
            alignedA = a[i - 1] + alignedA;
            alignedB = b[j - 1] + alignedB;
            const cand: Array<[number, string]> = [
                [M[i - 1]![j - 1]!, "M"],
                [X[i - 1]![j - 1]!, "X"],
                [Y[i - 1]![j - 1]!, "Y"],
            ];
            cand.sort((p, q) => q[0] - p[0]);
            state = cand[0]![1];
            i -= 1;
            j -= 1;
        } else if (state === "X") {
            alignedA = a[i - 1] + alignedA;
            alignedB = "-" + alignedB;
            const cand: Array<[number, string]> = [
                [M[i - 1]![j]! - openExtend, "M"],
                [X[i - 1]![j]! - extend, "X"],
                [Y[i - 1]![j]! - openExtend, "Y"],
            ];
            cand.sort((p, q) => q[0] - p[0]);
            state = cand[0]![1];
            i -= 1;
        } else {
            alignedA = "-" + alignedA;
            alignedB = b[j - 1] + alignedB;
            const cand: Array<[number, string]> = [
                [M[i]![j - 1]! - openExtend, "M"],
                [X[i]![j - 1]! - openExtend, "X"],
                [Y[i]![j - 1]! - extend, "Y"],
            ];
            cand.sort((p, q) => q[0] - p[0]);
            state = cand[0]![1];
            j -= 1;
        }
    }
    return { M, X, Y, score, alignedA, alignedB };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string; open?: number; extend?: number } | null) ?? {};
    const a = task.a ?? "GATTACA";
    const b = task.b ?? "GCATGCU";
    const open = typeof task.open === "number" ? task.open : 5;
    const extend = typeof task.extend === "number" ? task.extend : 1;
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
        meta: { rows: a.length + 1, cols: b.length + 1, open, extend, ...meta },
    });

    yield frame(makeGrid([[0]]), `Global alignment of "${a}" and "${b}" with affine gaps.`, 0);
    step += 1;
    const { M, X, Y, score, alignedA, alignedB } = gotoh(a, b, open, extend);
    yield frame(makeGrid(M, [0, 1]), "Boundary row and column seeded with cumulative gap penalties.", 1);
    step += 1;
    const rows = Math.min(a.length, 4);
    for (let r = 1; r <= rows; r += 1) {
        yield frame(makeGrid(M, [r]), `Row ${r} of the match matrix filled from three predecessors.`, 2, {
            lastRow: r,
        });
        step += 1;
    }
    yield frame(
        makeGrid(M, [a.length]),
        `Gap matrices agree at the last cell; best score ${score}.`,
        3,
        { score, X: X[a.length]?.[b.length] ?? NEG, Y: Y[a.length]?.[b.length] ?? NEG },
    );
    step += 1;
    yield frame(
        makeGrid(M, [a.length]),
        `Traceback gives ${alignedA} / ${alignedB} with score ${score}.`,
        4,
        { score, alignedA, alignedB },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Gotoh's algorithm aligns two sequences when a long gap should cost less than the same number of separate one-character gaps. It keeps three score matrices at each cell: one for ending in a match or mismatch, one for ending in a gap in the second string, and one for ending in a gap in the first. Switching from a match to a gap pays an opening cost, while staying in the same gap pays only a small extension cost.",
        invariants: [
            "M[i][j], X[i][j], and Y[i][j] are the best scores for prefixes ending in the three possible states.",
            "A gap of length k costs open plus k times extend, so extending a gap is cheaper than opening a new one.",
            "Every cell is computed only from cells above, left, or up-left, so filling row by row is valid.",
        ],
        correctness:
            "The last operation of any alignment is a substitution or a gap in one of the two strings, which correspond exactly to the M, X, and Y states. Each recurrence takes the maximum over all ways to enter that state from a valid predecessor, so induction over the grid gives the optimal score for every prefix. The maximum at the bottom-right cell is therefore the global optimum, and following the maximizing predecessors reconstructs an alignment achieving it.",
        complexityRationale:
            "The (n+1) by (m+1) table has three matrices and each cell takes the maximum of three values, a constant amount of work, so time is O(nm). Holding the three matrices for traceback uses O(nm) space, reducible to O(m) when only the score is needed.",
        uses: [
            "Protein and DNA alignment where gaps occur in runs",
            "Sequence comparison in bioinformatics suites",
            "Speech and handwriting matching with insertion and deletion costs",
        ],
        references: [
            "Gotoh, An Improved Algorithm for Matching Biological Sequences, Journal of Molecular Biology 162 (1982)",
            "Durbin et al., Biological Sequence Analysis, Chapter 2",
        ],
        workedExample:
            'Aligning "AC" with "A" using match +1, mismatch -1, open 5, and extend 1 gives a best score of -4 by matching the A and deleting the C as a single gap, which is cheaper than paying a second gap opening cost.',
    },
    id: "gotoh-affine-gap-alignment",
    name: "Gotoh Affine Gap Alignment",
    category: "string",
    complexity: { time: "O(nm)", space: "O(nm)" },
    defaultInput: { a: "GATTACA", b: "GCATGCU", open: 5, extend: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize M X and Y score matrices to negative infinity",
        "seed boundary cells with cumulative affine gap costs",
        "for each cell set M from substitution of the best predecessor",
        "set X from closing a gap in the second sequence",
        "set Y from closing a gap in the first sequence",
        "take the maximum of M X and Y at the last cell",
        "trace back through the chosen states to build the alignment",
        "report the aligned strings and optimal score",
    ],
};

export default module;
