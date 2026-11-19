/**
 * preconditioner-ilu.ts - Incomplete LU Factorization with Zero Fill-in, ILU(0)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ILU(0) builds lower and upper triangular factors of a sparse matrix while
 * discarding any entry that was not present in the original sparsity pattern.
 * Where a full LU would create fill-in, ILU(0) simply drops the new value. The
 * product L times U therefore matches A exactly on the original nonzeros and
 * differs only where A was zero. That cheap approximation is widely used as a
 * preconditioner for Krylov solvers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * pattern row length * row length) for the masked elimination
 *   Space: O(pattern size) for the two triangular factors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the working matrix: lower entries become L, upper become U.
 *   - The active pivot column is yellow; completed pivots are green.
 *   - The final frame reports the pattern-match residual and dropped fill count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build a 2D five-point Poisson matrix on a side by side grid. */
function poissonMatrix(side: number): { a: number[][]; pattern: boolean[][] } {
    const n = side * side;
    const a = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const pattern = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
    for (let r = 0; r < side; r += 1) {
        for (let c = 0; c < side; c += 1) {
            const i = r * side + c;
            a[i]![i] = 4;
            pattern[i]![i] = true;
            const neighbors = [
                r > 0 ? (r - 1) * side + c : -1,
                r + 1 < side ? (r + 1) * side + c : -1,
                c > 0 ? r * side + c - 1 : -1,
                c + 1 < side ? r * side + c + 1 : -1,
            ];
            for (const j of neighbors) {
                if (j >= 0) {
                    a[i]![j] = -1;
                    pattern[i]![j] = true;
                }
            }
        }
    }
    return { a, pattern };
}

/** Copy a square matrix into a flat array for the frame metadata. */
function flatten(m: number[][]): number[] {
    return m.reduce<number[]>((all, row) => all.concat(row), []);
}

function makeCells(work: number[][], pattern: boolean[][], pivot: number, finished: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const n = work.length;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const value = work[i]?.[j] ?? 0;
            const state: EntityState = finished
                ? "sorted"
                : i === pivot || j === pivot
                    ? "comparing"
                    : pattern[i]?.[j]
                        ? "idle"
                        : "unvisited";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: Math.abs(value) < 1e-12 ? "0" : value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, inPattern: pattern[i]?.[j] ?? false },
            });
        }
    }
    return entities;
}

/** How far L times U departs from A on the original sparsity pattern. */
function patternResidual(a: number[][], l: number[][], u: number[][], pattern: boolean[][]): number {
    let worst = 0;
    const n = a.length;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (!pattern[i]?.[j]) continue;
            let product = 0;
            for (let k = 0; k < n; k += 1) product += (l[i]![k] ?? 0) * (u[k]![j] ?? 0);
            worst = Math.max(worst, Math.abs(product - (a[i]![j] ?? 0)));
        }
    }
    return worst;
}

/** ILU(0) generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { side?: number } | null) ?? {};
    const side = typeof task.side === "number" && Number.isFinite(task.side)
        ? Math.max(1, Math.min(4, Math.floor(task.side)))
        : 3;
    const { a, pattern } = poissonMatrix(side);
    const n = a.length;
    const work = a.map((row) => [...row]);
    let dropped = 0;

    const factors = () => {
        const l = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => (i === j ? 1 : i > j ? (work[i]![j] ?? 0) : 0)),
        );
        const u = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => (j >= i ? (work[i]![j] ?? 0) : 0)),
        );
        return { l, u };
    };

    const meta = (step: number, pivot: number, done: boolean) => {
        const { l, u } = factors();
        return {
            rows: n,
            cols: n,
            n,
            side,
            pivot,
            patternSize: pattern.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
            patternResidual: done ? patternResidual(a, l, u, pattern) : 0,
            dropped,
            L: flatten(l),
            U: flatten(u),
            A: flatten(a),
            pattern: flatten(pattern.map((row) => row.map((v) => (v ? 1 : 0)))),
            done,
            step,
        };
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(work, pattern, -1, false),
        edges: [],
        description: `Factor a ${n} by ${n} five-point matrix with ILU(0), dropping all fill outside the stencil.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(step, -1, false),
    };
    step += 1;

    for (let k = 0; k < n - 1; k += 1) {
        const pivot = work[k]![k]!;
        for (let i = k + 1; i < n; i += 1) {
            if (!pattern[i]?.[k]) continue;
            const factor = (work[i]![k] ?? 0) / pivot;
            work[i]![k] = factor;
            for (let j = k + 1; j < n; j += 1) {
                if (j !== i && !pattern[i]?.[j]) {
                    // Fill outside the original pattern would appear here; ILU(0) drops it.
                    if (Math.abs(factor * (work[k]![j] ?? 0)) > 1e-15) dropped += 1;
                    continue;
                }
                work[i]![j] = (work[i]![j] ?? 0) - factor * (work[k]![j] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(work, pattern, k, false),
            edges: [],
            description: `Pivot ${k}: eliminate column ${k}, keeping only the original nonzero positions.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(step, k, false),
        };
        step += 1;
    }

    const finalMeta = meta(step, n - 1, true);
    yield {
        stepNumber: step,
        entities: makeCells(work, pattern, -1, true),
        edges: [],
        description: `ILU(0) done: L times U matches A on ${finalMeta.patternSize} pattern entries; ${dropped} fill value(s) dropped.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: finalMeta,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sparse matrix usually fills in when you factor it, turning a cheap banded or stencil pattern into a dense one. ILU(0) refuses to create any new nonzero: during Gaussian elimination it skips every update that would land outside the original pattern. The resulting L and U are cheap to store and apply, and they reproduce the matrix wherever it originally had entries.",
        invariants: [
            "The lower factor has unit diagonal and only nonzeros that were in A's lower pattern.",
            "Updates that would create fill outside the pattern are skipped, never stored.",
            "The product L times U agrees with A exactly on every original nonzero position.",
        ],
        correctness:
            "Consider the elimination update applied to entry (i, j) from pivot k. ILU(0) performs it only when (i, j) belongs to the original pattern; otherwise it drops the term. By induction over pivots, every stored entry equals what Gaussian elimination would produce with dropped terms omitted. For a position in the pattern the accumulated updates are exactly those of full elimination restricted to contributing pattern entries, so L times U reproduces A there; at dropped positions the product is a small residual rather than an exact match. This is precisely the ILU(0) approximation.",
        complexityRationale:
            "For each pivot the inner loops touch rows up to the matrix order n and test the pattern, costing O(n times row length) per pivot and O(n cubed) in the dense worst case. Only pattern positions are stored, so both factors use O(pattern size) space.",
        uses: [
            "Preconditioning conjugate-gradient and GMRES solves of sparse systems",
            "Incomplete-factor smoothers in algebraic multigrid methods",
            "Circuit simulation and CFD solvers with banded or stencil matrices",
        ],
        references: [
            "Saad, Iterative Methods for Sparse Linear Systems, chapter on incomplete factorizations",
            "Golub and Van Loan, Matrix Computations, section on preconditioners",
        ],
        workedExample:
            "On a three by three grid the five-point stencil has at most five entries per row. Factoring with ILU(0) keeps only those positions in L and U. Where full LU would connect diagonal neighbors through fill, ILU(0) drops the term; the reconstructed product still matches the stencil entries exactly, so applying the factors as a preconditioner costs little.",
    },
    id: "preconditioner-ilu",
    name: "Incomplete LU, ILU(0)",
    category: "numerical-optimization",
    complexity: { time: "O(n * row length) per pivot", space: "O(pattern size)" },
    defaultInput: { side: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "copy A into a working matrix and mark the original nonzero pattern",
        "for each pivot k from left to right",
        "divide each pattern entry below the pivot by the pivot value",
        "subtract its product with the pivot row from allowed pattern entries",
        "discard any update that would land outside the original pattern",
        "done: return unit lower L and upper U matching A on the pattern",
    ],
};

export default module;
