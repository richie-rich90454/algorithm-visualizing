/**
 * pissa.ts - PiSSA: Principal Singular values and Singular vectors Adaptation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PiSSA initializes LoRA's low-rank factors from the truncated SVD of the
 * pretrained weight W instead of from random noise. It splits W into U S V^T,
 * keeps the largest r singular triplets, and sets A = sqrt(S_r) V_r^T and
 * B = U_r sqrt(S_r), so B A is the best rank-r approximation of W. Training
 * then fine-tunes only this principal component, which converges faster than a
 * random initialization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m n min(m, n)) for the one-time SVD of an m by n weight
 *   Space: O((m + n) r) for the two low-rank factors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current matrix (W, A, B, the reconstruction, or the residual) is
 *     drawn as a grid of cells.
 *   - Frames walk through the factorization, the two factors, and the result.
 *   - Meta exposes the singular values and every factor as flattened arrays.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface PissaInput {
    W?: number[][];
    rank?: number;
}

/** Multiply two matrices. */
function matMul(a: number[][], b: number[][]): number[][] {
    const m = a.length;
    const k = b.length;
    const n = k > 0 ? (b[0]?.length ?? 0) : 0;
    const out = Array.from({ length: m }, () => Array(n).fill(0) as number[]);
    for (let i = 0; i < m; i += 1) {
        for (let p = 0; p < k; p += 1) {
            const aip = a[i]?.[p] ?? 0;
            for (let j = 0; j < n; j += 1) {
                out[i]![j] = (out[i]![j] ?? 0) + aip * (b[p]?.[j] ?? 0);
            }
        }
    }
    return out;
}

/** One-sided Jacobi SVD: columns of A become mutually orthogonal. */
function jacobiSVD(input: number[][]): { U: number[][]; S: number[]; V: number[][] } {
    const m = input.length;
    const n = m > 0 ? (input[0]?.length ?? 0) : 0;
    const a = input.map((row) => [...row]);
    let V: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let sweep = 0; sweep < 60; sweep += 1) {
        let rotated = false;
        for (let p = 0; p < n; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                let alpha = 0;
                let beta = 0;
                let gamma = 0;
                for (let i = 0; i < m; i += 1) {
                    const ap = a[i]?.[p] ?? 0;
                    const aq = a[i]?.[q] ?? 0;
                    alpha += ap * ap;
                    beta += aq * aq;
                    gamma += ap * aq;
                }
                if (alpha * beta === 0 || Math.abs(gamma) <= 1e-13 * Math.sqrt(alpha * beta)) {
                    continue;
                }
                const zeta = (beta - alpha) / (2 * gamma);
                const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
                const c = 1 / Math.sqrt(1 + t * t);
                const s = c * t;
                for (let i = 0; i < m; i += 1) {
                    const ap = a[i]?.[p] ?? 0;
                    const aq = a[i]?.[q] ?? 0;
                    a[i]![p] = c * ap - s * aq;
                    a[i]![q] = s * ap + c * aq;
                }
                for (let i = 0; i < n; i += 1) {
                    const vp = V[i]?.[p] ?? 0;
                    const vq = V[i]?.[q] ?? 0;
                    V[i]![p] = c * vp - s * vq;
                    V[i]![q] = s * vp + c * vq;
                }
                rotated = true;
            }
        }
        if (!rotated) {
            break;
        }
    }
    const norms = Array.from({ length: n }, (_, j) =>
        Math.sqrt(Array.from({ length: m }, (_, i) => (a[i]?.[j] ?? 0) ** 2).reduce((x, y) => x + y, 0)),
    );
    const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => (norms[q] ?? 0) - (norms[p] ?? 0));
    const S = order.map((j) => norms[j] ?? 0);
    const U = order.map((j) =>
        Array.from({ length: m }, (_, i) => ((norms[j] ?? 0) > 1e-12 ? (a[i]?.[j] ?? 0) / (norms[j] ?? 1) : 0)),
    );
    const Vout = order.map((j) => Array.from({ length: n }, (_, i) => V[i]?.[j] ?? 0));
    return { U, S, V: Vout };
}

function flatten(matrix: number[][]): number[] {
    return matrix.reduce<number[]>((acc, row) => acc.concat(row), []);
}

function cells(matrix: number[][], state: "idle" | "active" | "sorted" | "comparing"): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value.toFixed(3),
                value,
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
    const task = (input as PissaInput | null) ?? {};
    const W = Array.isArray(task.W) && task.W.length > 0
        ? task.W.map((row) => [...row])
        : [
              [3, 1, 0],
              [1, 2, 1],
              [0, 1, 2],
          ];
    const m = W.length;
    const n = m > 0 ? (W[0]?.length ?? 0) : 0;
    const r = Math.max(1, Math.min(task.rank ?? 2, Math.min(m, n) || 1));

    if (m === 0 || n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty weight matrix: no factorization to display.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: m, cols: n, rank: 0, singularValues: [], residualNorm: 0 },
        };
        return;
    }

    const { U, S, V } = jacobiSVD(W);
    const sq = S.map((s) => Math.sqrt(s));
    const A: number[][] = Array.from({ length: r }, (_, k) =>
        Array.from({ length: n }, (_, j) => (sq[k] ?? 0) * (V[k]?.[j] ?? 0)),
    );
    const B: number[][] = Array.from({ length: m }, (_, i) =>
        Array.from({ length: r }, (_, k) => (U[k]?.[i] ?? 0) * (sq[k] ?? 0)),
    );
    const reconstruction = matMul(B, A);
    const residual = W.map((row, i) => row.map((v, j) => v - (reconstruction[i]?.[j] ?? 0)));
    const residualNorm = Math.sqrt(residual.reduce((sum, row) => sum + row.reduce((s, v) => s + v * v, 0), 0));

    const baseMeta = {
        rows: m,
        cols: n,
        rank: r,
        singularValues: S,
        U: flatten(U),
        V: flatten(V),
        A: flatten(A),
        B: flatten(B),
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(W, "idle"),
        edges: [],
        description: `Pretrained weight ${m} by ${n}; computing its principal singular triplets for rank ${r}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, singularValues: S, residualNorm },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: S.map((s, i) => ({
            id: `singular-${i}`,
            type: "bar" as const,
            label: `s${i}=${s.toFixed(3)}`,
            value: s,
            state: (i < r ? "active" : "idle") as "active" | "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kept: i < r },
        })),
        edges: [],
        description: `Singular values sorted descending; the top ${r} are kept for the LoRA factors.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...baseMeta, singularValues: S, residualNorm },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(A, "active"),
        edges: [],
        description: `Factor A = sqrt(S_r) times V_r transpose, shape ${r} by ${n}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...baseMeta, singularValues: S, residualNorm },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(B, "active"),
        edges: [],
        description: `Factor B = U_r times sqrt(S_r), shape ${m} by ${r}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...baseMeta, singularValues: S, residualNorm },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(reconstruction, "sorted"),
        edges: [],
        description: `Reconstruction B times A equals the best rank-${r} approximation of W.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...baseMeta, reconstruction: flatten(reconstruction), singularValues: S, residualNorm },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(residual, "comparing"),
        edges: [],
        description: `Done: residual frozen at zero; W equals (W - B A) plus B A with residual norm ${residualNorm.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            ...baseMeta,
            reconstruction: flatten(reconstruction),
            residual: flatten(residual),
            singularValues: S,
            residualNorm,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LoRA normally starts its two small factors from random noise, so early training steps partly undo one another. PiSSA instead looks at the pretrained weight matrix, finds its principal directions with a singular value decomposition, and gives those directions to the LoRA factors. The remaining part of the weight is frozen, so training begins already representing the model and only has to refine the most important component.",
        invariants: [
            "U and V have orthonormal columns and the singular values are nonnegative and sorted descending.",
            "The product B A equals the rank-r truncated SVD reconstruction of W.",
            "The residual W minus B A is exactly the part left out of the top r triplets.",
        ],
        correctness:
            "A rank-r truncated SVD is the closest rank-r matrix to W in both the Frobenius and spectral norms by the Eckart-Young theorem. Setting A to sqrt(S_r) V_r transpose and B to U_r sqrt(S_r) makes B A equal U_r S_r V_r transpose, that closest matrix. The discarded Frobenius energy equals the square root of the sum of squared omitted singular values, which the test verifies alongside the defining SVD equations W v_k = s_k u_k and W transpose u_k = s_k v_k.",
        complexityRationale:
            "One-sided Jacobi orthogonalizes the n columns of an m by n matrix with O(m n) work per rotation and a constant number of sweeps, giving about O(m n min(m, n)) time for the one-time factorization. Only the r columns of U and V are kept, so the trainable factors use O((m + n) r) space.",
        uses: [
            "Parameter-efficient fine-tuning of large language models",
            "Faster early convergence than random LoRA initialization",
            "Low-rank adaptation of diffusion and vision backbones",
        ],
        references: [
            "Meng et al., PiSSA: Principal Singular Values and Singular Vectors Adaptation, NeurIPS 2024",
            "Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, ICLR 2022",
            "Golub and Van Loan, Matrix Computations, chapter on the SVD",
        ],
        workedExample:
            "For a 3 by 3 symmetric weight with singular values near 4.4, 2.2, and 0.4 and rank 2, the first two triplets are kept. A is 2 by 3 and B is 3 by 2, and their product matches W except for the smallest direction, whose energy about 0.4 appears as the residual norm.",
    },
    id: "pissa",
    name: "PiSSA: Principal Singular values and Singular vectors Adaptation",
    category: "ml-ai",
    complexity: { time: "O(m n min(m, n))", space: "O((m + n) r)" },
    defaultInput: {
        W: [
            [3, 1, 0],
            [1, 2, 1],
            [0, 1, 2],
        ],
        rank: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the pretrained weight matrix W and the target rank r",
        "compute the thin singular value decomposition W = U S V transpose",
        "keep the top r singular values and their vectors",
        "set A to sqrt(S_r) times V_r transpose",
        "set B to U_r times sqrt(S_r)",
        "form the reconstruction B times A",
        "freeze the residual W minus B A at zero and fine-tune A and B",
        "done: report the factors, reconstruction, and residual energy",
    ],
};

export default module;
