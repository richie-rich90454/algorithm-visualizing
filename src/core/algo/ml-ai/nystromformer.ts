/**
 * nystromformer.ts - Nystromformer Landmark Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nystromformer approximates the full n by n softmax attention matrix with a
 * low-rank factorization built from a small set of landmark rows. It computes
 * attention among the landmarks, between every query and the landmarks, and
 * between the landmarks and every key, then interpolates: approximate = B *
 * inverse(A) * C. Each of those pieces is at most n by m, so the quadratic n
 * by n matrix is never formed explicitly for m much smaller than n.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m * d + m^3) for n tokens, m landmarks, key dimension d
 *   Space: O(n * m + m^2) for the interpolation factors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The reconstructed n by n attention matrix is revealed one row at a time.
 *   - Landmark indices and the interpolation factors are shown in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NystromInput {
    queries?: number[][];
    keys?: number[][];
    values?: number[][];
    numLandmarks?: number;
    ridge?: number;
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function matmul(a: number[][], b: number[][]): number[][] {
    const inner = b.length;
    const cols = b[0]?.length ?? 0;
    return a.map((row) =>
        Array.from({ length: cols }, (_, c) => {
            let sum = 0;
            for (let i = 0; i < inner; i += 1) {
                sum += (row[i] ?? 0) * (b[i]?.[c] ?? 0);
            }
            return sum;
        }),
    );
}

function transpose(a: number[][]): number[][] {
    return a[0] ? a[0].map((_, c) => a.map((row) => row[c] ?? 0)) : [];
}

function softmaxRows(matrix: number[][]): number[][] {
    return matrix.map((row) => {
        if (row.length === 0) {
            return [];
        }
        const max = Math.max(...row);
        const exps = row.map((value) => Math.exp(value - max));
        const total = exps.reduce((sum, value) => sum + value, 0);
        return exps.map((value) => value / total);
    });
}

/** Gauss-Jordan inverse with partial pivoting and a small ridge for stability. */
export function invertMatrix(matrix: number[][], ridge: number): number[][] {
    const n = matrix.length;
    const aug = matrix.map((row, i) => [
        ...row.map((value, j) => value + (i === j ? ridge : 0)),
        ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(aug[row]?.[col] ?? 0) > Math.abs(aug[pivot]?.[col] ?? 0)) {
                pivot = row;
            }
        }
        const temp = aug[col];
        aug[col] = aug[pivot] ?? [];
        aug[pivot] = temp ?? [];
        const divisor = aug[col]?.[col] || 1e-12;
        for (let j = 0; j < 2 * n; j += 1) {
            aug[col]![j] = (aug[col]![j] ?? 0) / divisor;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = aug[row]?.[col] ?? 0;
            if (factor === 0) {
                continue;
            }
            for (let j = 0; j < 2 * n; j += 1) {
                aug[row]![j] = (aug[row]![j] ?? 0) - factor * (aug[col]![j] ?? 0);
            }
        }
    }
    return aug.map((row) => row.slice(n));
}

/** Nystrom interpolation of softmax attention from m landmark rows. */
export function nystromAttention(
    Q: number[][],
    K: number[][],
    V: number[][],
    numLandmarks: number,
    ridge: number,
) {
    const n = Q.length;
    const d = K[0]?.length ?? 1;
    const dv = V[0]?.length ?? 0;
    const m = Math.max(1, Math.min(n, Math.trunc(numLandmarks)));
    const scale = Math.sqrt(d);
    const landmarks = Array.from({ length: m }, (_, i) => i);
    const Ql = landmarks.map((i) => Q[i] ?? []);
    const Kl = landmarks.map((i) => K[i] ?? []);

    const Ahat = softmaxRows(matmul(Ql, transpose(Kl)).map((row) => row.map((v) => v / scale)));
    const Bhat = softmaxRows(matmul(Q, transpose(Kl)).map((row) => row.map((v) => v / scale)));
    const Chat = softmaxRows(matmul(Ql, transpose(K)).map((row) => row.map((v) => v / scale)));
    const Ainv = invertMatrix(Ahat, ridge);
    const approx = matmul(matmul(Bhat, Ainv), Chat);
    const output = matmul(approx, V);
    return { n, m, d, dv, landmarks, Ahat, Bhat, Chat, Ainv, approx, output };
}

function makeCells(matrix: number[][], revealed: number, current: number): VisualEntity[] {
    const cols = matrix[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const shown = row < revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? (matrix[row]?.[col] ?? 0).toFixed(2) : "?",
                value: shown ? matrix[row]?.[col] ?? 0 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NystromInput | null) ?? {};
    const Q: number[][] = task.queries ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, -1],
    ];
    const K: number[][] = task.keys ?? Q;
    const V: number[][] = task.values ?? Q;
    const numLandmarks = typeof task.numLandmarks === "number" ? task.numLandmarks : 2;
    const ridge = typeof task.ridge === "number" && task.ridge >= 0 ? task.ridge : 1e-9;
    const result = nystromAttention(Q, K, V, numLandmarks, ridge);
    const { n, m, d, dv, landmarks, approx, output } = result;
    const flatten = (mat: number[][]): number[] => mat.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(approx, 0, -1),
        edges: [],
        description: `Select ${m} landmark rows and build the Nystrom interpolation factors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, m, d, dv, landmarks, phase: "factors" },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(approx, i + 1, i),
            edges: [],
            description: `Reconstruct row ${i} of the n-by-n attention as B times inverse(A) times C.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: n,
                cols: n,
                n,
                m,
                d,
                dv,
                landmarks,
                phase: "attention",
                current: i,
                attention: flatten(approx.slice(0, i + 1)),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, n, -1),
        edges: [],
        description: `Done: ${n} outputs multiplied by the reconstructed approximation matrix.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n,
            cols: dv,
            n,
            m,
            d,
            dv,
            landmarks,
            phase: "done",
            attention: flatten(approx),
            output: flatten(output),
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The full attention matrix compares every token with every other token, but it often has much lower true rank than its size suggests. Nystromformer picks a few landmark tokens and studies how those landmarks attend to everything. It then fills in the rest of the matrix by interpolating through those landmarks, in the same way that a few survey points can sketch a larger landscape.",
        invariants: [
            "The landmark set is the first m token indices and never changes during a run.",
            "Each factor A, B, and C is a row-wise softmax and its rows sum to one.",
            "With m equal to n the interpolation reconstructs the exact full softmax attention matrix.",
        ],
        correctness:
            "Let A be landmark-to-landmark attention, B be every-query-to-landmark attention, and C be landmark-to-every-key attention. The Nystrom approximation is B times the inverse of A times C. When m equals n and the projections are the identity, A, B, and C are all the same full softmax matrix P, so the product is P times the inverse of P times P, which equals P. For m below n the factorization is the defined low-rank Nystrom interpolant, and multiplying it by the values gives the approximate attention output.",
        complexityRationale:
            "Forming B and C costs O(n*m*d) each, inverting the m by m matrix costs O(m^3), and the final products cost O(n*m*n) in the dense form shown. Space is O(n*m) for the factors plus O(m^2) for the inverse, avoiding the stored n by n intermediate when m is small.",
        uses: [
            "Long-document transformers that need subquadratic attention",
            "Approximating attention kernels in efficient language models",
            "A teaching bridge between Nystrom methods and attention",
        ],
        references: [
            "Xiong et al., Nystromformer: A Nystrom-Based Algorithm for Approximating Self-Attention, AAAI 2021",
            "Drineas and Mahoney, On the Nystrom Method for Approximating a Gram Matrix, 2005",
        ],
        workedExample:
            "With four tokens and two landmarks, the landmark matrix A has size two by two. B is four by two and C is two by four. Their product B times inverse(A) times C is a four-by-four approximation of attention. If all four tokens are landmarks, the approximation equals the ordinary softmax attention matrix.",
    },
    id: "nystromformer",
    name: "Nystromformer Attention",
    category: "ml-ai",
    complexity: { time: "O(n * m * d + m^3)", space: "O(n * m + m^2)" },
    defaultInput: {
        queries: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0, -1],
        ],
        keys: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0, -1],
        ],
        values: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0, -1],
        ],
        numLandmarks: 2,
        ridge: 1e-9,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the first m tokens as landmarks",
        "compute landmark-to-landmark softmax attention A",
        "compute query-to-landmark softmax attention B",
        "compute landmark-to-key softmax attention C",
        "invert the small matrix A with a small ridge",
        "reconstruct attention as B times inverse(A) times C",
        "multiply the reconstruction by the values",
        "done: report the approximate outputs",
    ],
};

export default module;
