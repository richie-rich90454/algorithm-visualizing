/**
 * discrete-cosine-transform.ts - Direct Discrete Cosine Transform (Type II)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The type II discrete cosine transform maps N real samples to N real
 * coefficients using only cosine basis functions: X[k] is the sum over n of
 * x[n] times cos(pi (n + 1/2) k / N). It is the transform behind JPEG and MPEG
 * compression because a smooth signal concentrates its energy in a few low
 * frequency coefficients. Its inverse is the type III transform, so applying
 * DCT-III to DCT-II recovers the original samples. This module implements the
 * direct O(N squared) definition; fast factorization algorithms are separate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^2) for the direct definition
 *   Space: O(N) for the coefficient vector and inverse buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The first N bars are the input samples; the next N are coefficients.
 *   - The coefficient being computed is yellow; finished ones are green.
 *   - The final frame reports the reconstruction error of the inverse transform.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function basis(n: number, k: number, size: number): number {
    return Math.cos((Math.PI * (n + 0.5) * k) / size);
}

function forward(x: number[]): number[] {
    const size = x.length;
    const out: number[] = [];
    for (let k = 0; k < size; k += 1) {
        let sum = 0;
        for (let n = 0; n < size; n += 1) {
            sum += (x[n] ?? 0) * basis(n, k, size);
        }
        out.push(sum);
    }
    return out;
}

function inverse(coefficients: number[]): number[] {
    const size = coefficients.length;
    const out: number[] = [];
    for (let n = 0; n < size; n += 1) {
        let sum = (coefficients[0] ?? 0) / 2;
        for (let k = 1; k < size; k += 1) {
            sum += (coefficients[k] ?? 0) * basis(n, k, size);
        }
        out.push((2 / size) * sum);
    }
    return out;
}

function makeBars(x: number[], coefficients: number[], active: number, finished: boolean): VisualEntity[] {
    const size = x.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < size; i += 1) {
        entities.push({
            id: `bar-x-${i}`,
            type: "bar",
            label: `x${i}`,
            value: x[i] ?? 0,
            state: "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, role: "sample" },
        });
    }
    for (let k = 0; k < size; k += 1) {
        const state: EntityState = finished
            ? "sorted"
            : k === active
              ? "comparing"
              : k < active
                ? "active"
                : "idle";
        entities.push({
            id: `bar-k-${k}`,
            type: "bar",
            label: `X${k}`,
            value: coefficients[k] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: k, role: "coefficient" },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x?: number[] } | null) ?? {};
    const fallback = [1, 2, 3, 4, 4, 3, 2, 1];
    const x = Array.isArray(task.x) && task.x.length >= 2 && task.x.length <= 32
        ? task.x.slice(0, 32).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0))
        : fallback;
    const size = x.length;
    const coefficients = Array.from({ length: size }, () => 0);
    const meta = (computed: number, done: boolean) => {
        const reconstructed = inverse(coefficients);
        const error = Math.max(...reconstructed.map((v, i) => Math.abs(v - (x[i] ?? 0))));
        return {
            n: size,
            inputs: [...x],
            coefficients: [...coefficients],
            reconstructed,
            roundTripError: error,
            computed,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars(x, coefficients, -1, false),
        edges: [],
        description: `Computing the type II DCT of ${size} samples by the direct cosine sum.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, false),
    };

    let step = 1;
    for (let k = 0; k < size; k += 1) {
        let sum = 0;
        for (let n = 0; n < size; n += 1) {
            sum += (x[n] ?? 0) * basis(n, k, size);
        }
        coefficients[k] = sum;
        yield {
            stepNumber: step,
            entities: makeBars(x, coefficients, k, false),
            edges: [],
            description: `Coefficient ${k}: sum over all samples of x[n] times cos(pi (n + 1/2) ${k} / ${size}) = ${sum.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(k + 1, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, coefficients, -1, true),
        edges: [],
        description: `Inverse DCT-III reconstructs the samples with maximum error ${meta(size, true).roundTripError.toExponential(2)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: meta(size, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cosine wave of each allowed frequency is used as a measuring stick. The k-th coefficient says how much of the input lines up with the k-th cosine. Low coefficients describe broad trends and high coefficients describe fine detail, so a smooth signal is captured well by only a few numbers. The inverse transform adds the same cosines back with those weights.",
        invariants: [
            "The cosine basis functions are mutually orthogonal over the N sample positions.",
            "The zero-th coefficient equals the ordinary sum of all input samples.",
            "Applying DCT-III to the DCT-II coefficients returns the original samples up to floating point roundoff.",
        ],
        correctness:
            "The N by N matrix whose entry at row k and column n is cos(pi (n + 1/2) k / N) has orthogonal rows: the inner product of rows k and j is zero when k differs from j, and is N/2 when k equals j and both are positive, with N for the zero-th row. The inverse formula compensates for those row norms, so DCT-III is exactly the matrix inverse of DCT-II and the composition is the identity. Parseval's identity then gives the energy relation between the samples and the coefficients.",
        complexityRationale:
            "Each of the N coefficients is an inner product of length N, giving O(N squared) time. Only the input, the coefficient vector, and the reconstructed buffer are stored, so space is O(N).",
        uses: [
            "Lossy image and video compression in JPEG, MPEG, and H.264",
            "Spectral analysis of real-valued signals with strong low-frequency content",
            "Fast convolution and partial differential equation solvers that need cosine diagonals",
        ],
        references: [
            "Rao and Yip, Discrete Cosine Transform: Algorithms, Advantages, Applications",
            "Ahmed, Natarajan, and Rao, Discrete Cosine Transform, IEEE Transactions on Computers, 1974",
        ],
        workedExample:
            "For the two samples [1, 2] the coefficients are X0 = 3 and X1 = cos(pi/4) - 2 cos(pi/4) = -0.7071. The inverse computes x0 = 3/2 + (-0.7071) cos(pi/4) = 1 and x1 = 3/2 + (-0.7071) cos(3pi/4) = 2, recovering the input exactly.",
    },
    id: "discrete-cosine-transform",
    name: "Discrete Cosine Transform",
    category: "numerical-optimization",
    complexity: { time: "O(N^2)", space: "O(N)" },
    defaultInput: { x: [1, 2, 3, 4, 4, 3, 2, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "let N be the number of input samples",
        "for each output index k from zero to N minus one",
        "sum x[n] times cosine of pi (n + 1/2) k over N for all n",
        "store the sum as coefficient X[k]",
        "after all coefficients, apply the type III inverse",
        "weight X[0] by one half and every other coefficient by two over N",
        "done: report the coefficients and reconstruction error",
    ],
};

export default module;
