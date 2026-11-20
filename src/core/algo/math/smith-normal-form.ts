/**
 * smith-normal-form.ts - Smith Normal Form via Determinantal Divisors.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Smith normal form of an integer matrix is the diagonal matrix D = U A V
 * whose diagonal entries d_1,...,d_r satisfy d_i divides d_(i+1). The invariant
 * factors are obtained from determinantal divisors: the product d_1*...*d_k
 * equals the gcd of all k-by-k minors of A. This module computes those gcds and
 * derives the diagonal, stopping when the rank is exhausted.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C(m,k)C(n,k) k^3) over k up to the rank
 *   Space: O(C(m,k)C(n,k)) for the minors of the largest size
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row is a minor size k with its determinantal divisor and factor.
 *   - The current k is highlighted and zero divisors are marked as errors.
 *   - The final frame reports the invariant-factor diagonal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SmithInput {
    matrix?: number[][];
}

function gcdBig(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

/** All size-k subsets of 0..n-1. */
function combinations(n: number, k: number): number[][] {
    const result: number[][] = [];
    const current: number[] = [];
    const walk = (start: number): void => {
        if (current.length === k) {
            result.push(current.slice());
            return;
        }
        for (let i = start; i < n; i += 1) {
            current.push(i);
            walk(i + 1);
            current.pop();
        }
    };
    walk(0);
    return result;
}

/** Exact determinant of a small integer matrix via Bareiss fraction-free elimination. */
function determinant(matrix: bigint[][]): bigint {
    const n = matrix.length;
    const a = matrix.map((row) => row.slice());
    let sign = 1n;
    let previous = 1n;
    for (let k = 0; k < n - 1; k += 1) {
        if (a[k]![k] === 0n) {
            let swap = -1;
            for (let r = k + 1; r < n; r += 1) {
                if (a[r]![k] !== 0n) {
                    swap = r;
                    break;
                }
            }
            if (swap === -1) {
                return 0n;
            }
            [a[k], a[swap]] = [a[swap]!, a[k]!];
            sign = -sign;
        }
        const pivot = a[k]![k]!;
        for (let i = k + 1; i < n; i += 1) {
            for (let j = k + 1; j < n; j += 1) {
                a[i]![j] = (pivot * a[i]![j]! - a[i]![k]! * a[k]![j]!) / previous;
            }
            a[i]![k] = 0n;
        }
        previous = pivot;
    }
    return sign * (a[n - 1]![n - 1] ?? 0n);
}

interface DeltaRow {
    k: number;
    delta: bigint;
    factor: bigint;
}

function makeEntities(rows: DeltaRow[], done: boolean, shown: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < shown; i += 1) {
        const row = rows[i]!;
        const values: Array<[string, string]> = [
            ["k", String(row.k)],
            ["delta", row.delta.toString()],
            ["d", row.factor.toString()],
        ];
        values.forEach(([name, value], col) => {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: `${name}=${value}`,
                value,
                state: (done ? "sorted" : row.delta === 0n ? "error" : i === shown - 1 ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SmithInput | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : null;
    const matrix = raw && raw.length > 0 && raw.every((row) => Array.isArray(row) && row.length === raw[0]!.length)
        ? raw.map((row) => row.slice())
        : [[2, 4], [4, 8]];
    const m = matrix.length;
    const n = matrix[0]!.length;
    const big = matrix.map((row) => row.map((value) => BigInt(Math.trunc(value))));
    const maxK = Math.min(m, n);
    const rows: DeltaRow[] = [];
    let previousDelta = 1n;

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Computing Smith invariant factors of a ${m}x${n} integer matrix from its minors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: maxK, cols: 3, m, n, shown: 0 },
    };

    for (let k = 1; k <= maxK; k += 1) {
        const rowSets = combinations(m, k);
        const colSets = combinations(n, k);
        let delta = 0n;
        for (const rowSet of rowSets) {
            for (const colSet of colSets) {
                const sub = rowSet.map((r) => colSet.map((c) => big[r]![c]!));
                const det = determinant(sub);
                if (det !== 0n) {
                    delta = delta === 0n ? (det < 0n ? -det : det) : gcdBig(delta, det);
                }
            }
        }
        if (delta === 0n) {
            rows.push({ k, delta, factor: 0n });
            yield {
                stepNumber: rows.length,
                entities: makeEntities(rows, false, rows.length),
                edges: [],
                description: `No nonzero ${k}-by-${k} minor exists, so the rank is ${k - 1}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows: maxK, cols: 3, m, n, shown: rows.length, rank: k - 1 },
            };
            break;
        }
        const factor = delta / previousDelta;
        previousDelta = delta;
        rows.push({ k, delta, factor });
        yield {
            stepNumber: rows.length,
            entities: makeEntities(rows, false, rows.length),
            edges: [],
            description: `For k=${k} the gcd of minors is ${delta}, giving invariant factor ${factor}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: maxK, cols: 3, m, n, shown: rows.length, delta: delta.toString(), factor: factor.toString() },
        };
    }

    const diagonal = rows.filter((r) => r.factor !== 0n).map((r) => r.factor.toString());
    yield {
        stepNumber: rows.length + 1,
        entities: makeEntities(rows, true, rows.length),
        edges: [],
        description: `Done: the Smith normal form diagonal is [${diagonal.join(", ")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: maxK,
            cols: 3,
            m,
            n,
            shown: rows.length,
            diagonal,
            rank: diagonal.length,
        },
    };
}

const module: AlgorithmModule = {
    id: "smith-normal-form",
    name: "Smith Normal Form",
    category: "math",
    complexity: { time: "O(C(m,k)C(n,k) k^3)", space: "O(C(m,k)C(n,k))" },
    defaultInput: { matrix: [[2, 4], [4, 8]] },
    visualType: "grid",
    run,
    pseudocode: [
        "let the previous determinantal divisor delta_0 be one",
        "for each minor size k up to min(m,n)",
        "compute delta_k as the gcd of all k-by-k minors",
        "if delta_k is zero the rank is k-1, so stop",
        "set invariant factor d_k to delta_k divided by delta_(k-1)",
        "done: report the diagonal d_1 through d_r",
    ],
    education: {
        intuition:
            "The Smith normal form distills an integer matrix down to a diagonal of invariant factors that capture its structural essence. Rather than tracking the unimodular row and column operations, the determinantal-divisor method reads the answer off the gcds of all minors of each size: the product of the first k invariant factors is exactly the gcd of the k-by-k minors.",
        invariants: [
            "delta_k equals the gcd of the absolute values of all k-by-k minors.",
            "Each invariant factor d_k equals delta_k divided by delta_(k-1).",
            "Every d_k divides d_(k+1).",
            "The number of nonzero invariant factors equals the rank of the matrix.",
        ],
        correctness:
            "The existence and uniqueness theorem for Smith normal form guarantees invariant factors with d_i dividing d_(i+1). The determinantal-divisor characterization proves the product d_1*...*d_k equals delta_k, the gcd of all k-by-k minors, so dividing consecutive deltas recovers each factor. Computing minors exactly with fraction-free elimination avoids rounding, so the reported diagonal is the Smith normal form.",
        complexityRationale:
            "For each minor size k there are C(m,k) times C(n,k) submatrices, each with an O(k cubed) determinant, giving the stated combinatorial time bound. Only one size of minors is held at a time, so space scales with their count.",
        uses: [
            "Computing the structure of finitely generated abelian groups",
            "Determining the cokernel of an integer boundary map in topology",
            "Solving systems of linear Diophantine equations",
        ],
        references: [
            "Dummit and Foote, Abstract Algebra, section on Smith normal form",
            "Wikipedia, Smith normal form",
        ],
        workedExample:
            "For the matrix [[2,4],[4,8]] the only nonzero 1-by-1 minors have gcd 2, so d1=2; every 2-by-2 minor is zero, so the rank is 1 and the Smith diagonal is [2, 0].",
    },
};

export default module;
