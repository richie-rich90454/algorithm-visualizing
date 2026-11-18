/**
 * independent-component-analysis.ts - FastICA Fixed-Point Iteration (Core)
 *
 * FastICA separates mixed signals by finding directions whose projections are
 * as non-Gaussian as possible. This module implements the one-unit fixed-point
 * iteration with cubic nonlinearity and symmetric deflation on already
 * whitened data. Whitening and source modeling are out of scope; the focus is
 * the teachable update rule itself.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface IcaResult {
    components: number[][];
    iterations: number[];
    history: number[][][];
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function normalize(w: number[]): number[] {
    const norm = Math.sqrt(dot(w, w)) || 1;
    return w.map((value) => value / norm);
}

/** Run FastICA on whitened samples (rows) with the given number of components. */
export function fastIca(X: number[][], components: number, maxIter: number, tolerance = 1e-6): IcaResult {
    const dim = X[0]?.length ?? 0;
    const result: number[][] = [];
    const iterations: number[] = [];
    const history: number[][][] = [];
    for (let c = 0; c < components; c += 1) {
        let w = normalize(Array.from({ length: dim }, (_, i) => (i === c ? 1 : 0.1)));
        const trace: number[][] = [w.slice()];
        let iter = 0;
        for (; iter < maxIter; iter += 1) {
            const projections = X.map((row) => dot(row, w));
            const cubic = X.reduce<number[]>(
                (acc, row, i) => {
                    const p = projections[i] ?? 0;
                    const factor = p * p * p;
                    row.forEach((value, j) => {
                        acc[j] = (acc[j] ?? 0) + value * factor;
                    });
                    return acc;
                },
                Array(dim).fill(0) as number[],
            ).map((value) => value / (X.length || 1));
            const meanSquare = projections.reduce((sum, p) => sum + p * p, 0) / (X.length || 1);
            let next = cubic.map((value, j) => value - 3 * meanSquare * (w[j] ?? 0));
            for (const prior of result) {
                const overlap = dot(next, prior);
                next = next.map((value, j) => value - overlap * (prior[j] ?? 0));
            }
            next = normalize(next);
            const delta = 1 - Math.abs(dot(next, w));
            w = next;
            trace.push(w.slice());
            if (delta < tolerance) {
                iter += 1;
                break;
            }
        }
        result.push(w);
        iterations.push(iter);
        history.push(trace);
    }
    return { components: result, iterations, history };
}

function makeCells(
    result: IcaResult,
    component: number,
    revealed: number,
): VisualEntity[] {
    const trace = result.history[component] ?? [];
    const entities: VisualEntity[] = [];
    trace.forEach((w, iteration) => {
        w.forEach((value, j) => {
            const shown = iteration <= revealed;
            const state: EntityState = iteration === revealed ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${component}-${iteration}-${j}`,
                type: "cell",
                label: shown ? value.toFixed(3) : "?",
                value: shown ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: iteration, col: j, component },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { samples?: number[][]; components?: number; maxIter?: number } | null
    ) ?? {};
    const samples: number[][] = Array.isArray(task.samples) && task.samples.length > 0
        ? task.samples
        : [[1, 0.2], [-1, -0.3], [0.5, 1], [-0.4, -1.2], [1.2, 0.1], [-1.1, 0.4]];
    const components = typeof task.components === "number" ? Math.max(1, Math.floor(task.components)) : 2;
    const maxIter = typeof task.maxIter === "number" ? Math.max(1, Math.floor(task.maxIter)) : 50;
    const result = fastIca(samples, components, maxIter);
    const dim = samples[0]?.length ?? 0;
    const maxTrace = Math.max(0, ...result.history.map((h) => h.length - 1));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result, 0, -1),
        edges: [],
        description: `FastICA on ${samples.length} whitened samples: ${components} component(s) via the cubic fixed point (teaching core).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: maxTrace + 1, cols: dim, samples: samples.length, components, dim, component: 0 },
    };
    step += 1;

    for (let c = 0; c < components; c += 1) {
        const trace = result.history[c] ?? [];
        for (let i = 0; i < trace.length; i += 1) {
            yield {
                stepNumber: step,
                entities: makeCells(result, c, i),
                edges: [],
                description: `Component ${c}, iteration ${i}: w = [${(trace[i] ?? []).map((v) => v.toFixed(2)).join(", ")}] after the non-Gaussian fixed point and deflation.`,
                codeLineNumber: i === 0 ? 1 : 2,
                layout: "grid",
                meta: {
                    rows: maxTrace + 1,
                    cols: dim,
                    samples: samples.length,
                    components,
                    dim,
                    component: c,
                    weight: trace[i],
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(result, components - 1, (result.history[components - 1]?.length ?? 1) - 1),
        edges: [],
        description: `Done: ${components} component(s) found in ${result.iterations.reduce((a, b) => a + b, 0)} total iterations.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: maxTrace + 1, cols: dim, components, dim, iterations: result.iterations, componentsFound: result.components.map((w) => w.join(", ")), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Independent component analysis unmixes signals by assuming the original sources are statistically independent and non-Gaussian. FastICA searches for a direction whose projection is maximally non-Gaussian: it repeatedly applies a cubic fixed-point update, then normalizes. Deflation removes each found direction before searching for the next.",
        invariants: [
            "The weight vector is normalized to unit length after every update.",
            "The cubic nonlinearity measures non-Gaussianity of the projected samples.",
            "Deflation subtracts the projection onto earlier components before the next update.",
        ],
        correctness:
            "The fixed point of the update E[x*g(w·x)] - E[g'(w·x)]*w matches the stationary points of the negentropy approximation with g(u)=u^3, so a converged vector is an estimated independent direction. Normalization preserves direction only, and deflation enforces decorrelation with previously found components; a step-by-step replay of the same arithmetic reproduces every iterate, which is what the property test checks.",
        complexityRationale:
            "Each iteration touches every one of the n samples across d dimensions, giving O(n*d) work per iteration and O(n*d*iterations*components) overall. The weight vectors use O(components*d) space.",
        uses: [
            "Blind source separation such as the cocktail-party problem",
            "Removing artifacts from electroencephalography signals",
            "Feature extraction from non-Gaussian sensor data",
        ],
        references: [
            "Hyvarinen and Oja, Independent Component Analysis: Algorithms and Applications, Neural Networks 2000",
            "Hyvarinen, Fast and Robust Fixed-Point Algorithms for Independent Component Analysis, 1999",
        ],
        workedExample:
            "With two whitened signals and starting weights near (1, 0.1), one update computes the mean of x times the cube of the projection, subtracts three times the mean squared projection times the old weight, and renormalizes. Repeating this converges to a direction aligned with one original source; deflation then finds the other.",
    },
    id: "independent-component-analysis",
    name: "Independent Component Analysis",
    category: "ml-ai",
    complexity: { time: "O(n*d*iterations*k)", space: "O(k*d)" },
    defaultInput: {
        samples: [[1, 0.2], [-1, -0.3], [0.5, 1], [-0.4, -1.2], [1.2, 0.1], [-1.1, 0.4]],
        components: 2,
        maxIter: 50,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start each component's weight near a coordinate axis",
        "for each iteration compute projections of all samples",
        "form the cubic non-Gaussianity gradient",
        "subtract the scaled old weight and deflate against earlier components",
        "normalize the new weight to unit length",
        "stop when the direction changes less than the tolerance",
        "done: report the separated component directions",
    ],
};

export default module;
