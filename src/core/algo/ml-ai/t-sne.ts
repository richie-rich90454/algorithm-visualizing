/**
 * t-sne.ts - t-SNE Gradient Step
 *
 * Scope: t-SNE is a full embedding algorithm with early exaggeration, momentum
 * schedules, and Barnes-Hut approximation. This teaches one exact gradient
 * step: Gaussian affinities in the high-dimensional space, Student-t affinities
 * in the low-dimensional map, and the Kullback-Leibler gradient. It does NOT
 * implement the approximations or the full optimization schedule.
 *
 * Time:  O(n^2 * d + iterations * n^2) for n points in d dimensions
 * Space: O(n^2)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface TsneInput {
    points?: number[][];
    perplexity?: number;
    iterations?: number;
    seed?: number;
}

/** Seeded small perturbations in [-0.5, 0.5]. */
function jitterStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296 - 0.5;
    };
}

/** Squared Euclidean distance between two vectors. */
function dist2(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        total += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
    }
    return total;
}

/** Binary-search the Gaussian bandwidth so each row has the target entropy. */
function computeP(points: number[][], perplexity: number): number[][] {
    const n = points.length;
    const d2 = Array.from({ length: n }, (_v, i) =>
        Array.from({ length: n }, (_x, j) => dist2(points[i] ?? [], points[j] ?? [])),
    );
    const target = Math.log(perplexity);
    const conditional: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i += 1) {
        let beta = 1;
        let betaMin = 0;
        let betaMax = Infinity;
        const row = d2[i] ?? [];
        for (let attempt = 0; attempt < 60; attempt += 1) {
            let sum = 0;
            const weights = row.map((value, j) => {
                if (j === i) {
                    return 0;
                }
                const w = Math.exp(-beta * value);
                sum += w;
                return w;
            });
            const probs = weights.map((w) => (sum > 0 ? w / sum : 0));
            let entropy = 0;
            for (const p of probs) {
                if (p > 0) {
                    entropy -= p * Math.log(p);
                }
            }
            if (Math.abs(entropy - target) < 1e-6) {
                conditional[i] = probs;
                break;
            }
            if (entropy > target) {
                betaMin = beta;
                beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2;
            } else {
                betaMax = beta;
                beta = (beta + betaMin) / 2;
            }
            if (!Number.isFinite(beta) || beta <= 0) {
                beta = betaMin > 0 ? betaMin * 2 : 1;
            }
            conditional[i] = probs;
        }
    }

    const P: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (i === j) {
                continue;
            }
            const value = ((conditional[i]?.[j] ?? 0) + (conditional[j]?.[i] ?? 0)) / (2 * n);
            P[i][j] = Math.max(value, 1e-12);
        }
    }
    return P;
}

/** Student-t joint probabilities and pairwise numerators. */
function computeQ(Y: number[][]): { q: number[][]; numerators: number[][] } {
    const n = Y.length;
    const numerators: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    let total = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (i === j) {
                continue;
            }
            const num = 1 / (1 + dist2(Y[i] ?? [], Y[j] ?? []));
            numerators[i][j] = num;
            total += num;
        }
    }
    const q: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            q[i][j] = total > 0 ? (numerators[i]?.[j] ?? 0) / total : 0;
        }
    }
    return { q, numerators };
}

/** KL divergence from fixed P to the current Q. */
function kl(P: number[][], q: number[][]): number {
    let total = 0;
    for (let i = 0; i < P.length; i += 1) {
        for (let j = 0; j < P.length; j += 1) {
            if (i === j || !q[i]?.[j]) {
                continue;
            }
            total += (P[i]?.[j] ?? 0) * Math.log((P[i]?.[j] ?? 0) / (q[i]?.[j] ?? 1));
        }
    }
    return total;
}

/** Analytic KL gradient with respect to the low-dimensional coordinates. */
function gradient(P: number[][], Y: number[][], numerators: number[][]): number[][] {
    const n = Y.length;
    const q = computeQ(Y).q;
    const grad: number[][] = Array.from({ length: n }, () => Array(2).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (i === j) {
                continue;
            }
            const factor = 4 * ((P[i]?.[j] ?? 0) - (q[i]?.[j] ?? 0)) * (numerators[i]?.[j] ?? 0);
            for (let d = 0; d < 2; d += 1) {
                grad[i][d] += factor * ((Y[i]?.[d] ?? 0) - (Y[j]?.[d] ?? 0));
            }
        }
    }
    return grad;
}

/** Point entities positioned by the current low-dimensional coordinates. */
function makePoints(Y: number[][]): VisualEntity[] {
    return Y.map((coords, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: String(index),
        value: index,
        state: "active" as const,
        x: coords[0] ?? 0,
        y: coords[1] ?? 0,
        width: 0,
        height: 0,
        metadata: { index, originalX: coords[0] ?? 0, originalY: coords[1] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TsneInput | null) ?? {};
    const points = Array.isArray(task.points) && task.points.length >= 2
        ? task.points.map((row) => [...row])
        : [
              [0, 0],
              [0.1, 0.2],
              [0.2, -0.1],
              [5, 5],
              [5.1, 4.8],
              [4.9, 5.2],
          ];
    const n = points.length;
    const perplexity = Math.max(1, Math.min(Math.trunc(task.perplexity ?? 2), Math.floor(n / 2) || 1));
    const iterations = Math.max(1, Math.min(Math.trunc(task.iterations ?? 4), 12));
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 3;
    const next = jitterStream(seed);

    const P = computeP(points, perplexity);
    const Y: number[][] = Array.from({ length: n }, () => [next() * 2, next() * 2]);
    const learningRate = 50;

    let step = 0;
    const initialQ = computeQ(Y);
    yield {
        stepNumber: step,
        entities: makePoints(Y),
        edges: [],
        description: `Computed Gaussian affinities at perplexity ${perplexity}; initial KL = ${kl(P, initialQ.q).toFixed(5)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {
            n,
            perplexity,
            points: points.flat(),
            Y: Y.flat(),
            P: P.flat(),
            grad: [],
            KL: kl(P, initialQ.q),
            iteration: 0,
        },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const { q, numerators } = computeQ(Y);
        const currentKL = kl(P, q);
        const grad = gradient(P, Y, numerators);
        for (let i = 0; i < n; i += 1) {
            Y[i][0] = (Y[i][0] ?? 0) - learningRate * (grad[i]?.[0] ?? 0);
            Y[i][1] = (Y[i][1] ?? 0) - learningRate * (grad[i]?.[1] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: makePoints(Y),
            edges: [],
            description: `Iteration ${iteration + 1}: KL gradient step applied; KL before step = ${currentKL.toFixed(5)}.`,
            codeLineNumber: iteration + 1 === iterations ? 6 : 4,
            layout: "point",
            meta: {
                n,
                perplexity,
                points: points.flat(),
                Y: Y.flat(),
                P: P.flat(),
                grad: grad.flat(),
                KL: currentKL,
                iteration: iteration + 1,
            },
        };
        step += 1;
    }

    const finalQ = computeQ(Y);
    yield {
        stepNumber: step,
        entities: makePoints(Y),
        edges: [],
        description: `Done: after ${iterations} exact gradient step(s), KL = ${kl(P, finalQ.q).toFixed(5)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            n,
            perplexity,
            points: points.flat(),
            Y: Y.flat(),
            P: P.flat(),
            grad: [],
            KL: kl(P, finalQ.q),
            iteration: iterations,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "t-SNE places points on a two-dimensional map so that points close in the original space stay close on the map. It turns each neighborhood into a probability: a Gaussian around each point in the high-dimensional space and a heavier-tailed Student-t in the map. Gradient descent moves the map points to reduce the mismatch between the two probability distributions.",
        invariants: [
            "High-dimensional affinities P are fixed during the gradient steps.",
            "Low-dimensional affinities q are normalized over all distinct point pairs.",
            "The reported gradient is the derivative of KL(P || Q) with respect to the map coordinates.",
        ],
        correctness:
            "Writing KL as a constant minus the log-likelihood under q splits the gradient into an attractive term from the Gaussian affinities and a repulsive term from the Student-t normalization. Both terms combine into 4 times the sum over j of (p_ij - q_ij) times the Student-t numerator times (y_i - y_j). Central finite differences of the KL reproduce this gradient, which is the brute-force check used in the tests.",
        complexityRationale:
            "The affinity matrix has n squared entries, and each gradient step scans all of them, so the time is O(n^2) per step plus O(n^2 d) to build the high-dimensional affinities. Storing the affinity matrices uses O(n^2) space.",
        uses: [
            "Visualizing high-dimensional data in two or three dimensions",
            "Exploring clusters in single-cell and embedding data",
            "Teaching probability-based dimensionality reduction",
        ],
        references: [
            "van der Maaten and Hinton, Visualizing Data using t-SNE, 2008",
            "van der Maaten, Accelerating t-SNE using Tree-Based Algorithms, 2014",
        ],
        workedExample:
            "For six points in two tight clusters with perplexity 2, the Gaussian affinities link each point to its nearest neighbors. The initial random map has large KL; one gradient step pulls neighbors together and pushes distant points apart, lowering the KL while the affinities stay fixed.",
    },
    id: "t-sne",
    name: "t-SNE (KL Gradient Step)",
    category: "ml-ai",
    complexity: { time: "O(n^2 * d + iterations * n^2)", space: "O(n^2)" },
    defaultInput: {
        points: [
            [0, 0],
            [0.1, 0.2],
            [0.2, -0.1],
            [5, 5],
            [5.1, 4.8],
            [4.9, 5.2],
        ],
        perplexity: 2,
        iterations: 4,
        seed: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute Gaussian affinities P with binary search for the bandwidth",
        "initialize low-dimensional coordinates Y",
        "compute Student-t affinities Q from Y",
        "measure KL divergence between P and Q",
        "compute the analytic KL gradient with respect to Y",
        "move Y down the gradient by the learning rate",
        "repeat for the chosen number of iterations",
        "done: report the final map and KL",
    ],
};

export default module;
