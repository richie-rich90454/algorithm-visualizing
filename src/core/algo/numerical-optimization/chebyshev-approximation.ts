/**
 * chebyshev-approximation.ts - Discrete Chebyshev Least-Squares Approximation
 *
 * Projects a sampled function onto the Chebyshev polynomial basis using the
 * discrete orthogonality of T_k on the Chebyshev-Gauss nodes. Unlike the Remez
 * minimax algorithm, this minimizes the mean-square error and is a least-
 * squares approximation. For a target already in the span it reconstructs the
 * function exactly.
 *
 * Time: O(samples * degree); Space: O(samples + degree).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function evalPoly(coefficients: number[], x: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
        result = result * x + (coefficients[i] ?? 0);
    }
    return result;
}

/** Chebyshev polynomial T_k(x) evaluated by the three-term recurrence. */
function chebyshev(k: number, x: number): number {
    if (k === 0) {
        return 1;
    }
    if (k === 1) {
        return x;
    }
    let previous = 1;
    let current = x;
    for (let n = 2; n <= k; n += 1) {
        const next = 2 * x * current - previous;
        previous = current;
        current = next;
    }
    return current;
}

function makeEntities(coefficients: number[], active: number): VisualEntity[] {
    return coefficients.map((c, index) => ({
        id: `cheb-${index}`,
        type: "bar" as const,
        label: `${Number(c.toFixed(4))}`,
        value: c,
        state: index === active ? "active" : index < active ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { order: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        degree?: number;
        targetCoefficients?: number[];
        samples?: number;
    } | null) ?? {};
    const target = task.targetCoefficients ?? [-1, 0, 2];
    const degree = Math.max(0, Math.floor(task.degree ?? target.length - 1));
    const samples = Math.max(degree + 2, Math.floor(task.samples ?? 32));

    const nodes: number[] = [];
    const values: number[] = [];
    for (let j = 0; j < samples; j += 1) {
        const x = Math.cos(((j + 0.5) * Math.PI) / samples);
        nodes.push(x);
        values.push(evalPoly(target, x));
    }

    const coefficients: number[] = new Array(degree + 1).fill(0);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(coefficients, -1),
        edges: [],
        description: `Projecting ${samples} samples of the target onto Chebyshev polynomials up to degree ${degree}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { degree, samples, coefficients: [...coefficients], maxError: null },
    };
    step += 1;

    for (let k = 0; k <= degree; k += 1) {
        let numerator = 0;
        let denominator = 0;
        for (let j = 0; j < samples; j += 1) {
            const x = nodes[j] ?? 0;
            const basis = chebyshev(k, x);
            numerator += (values[j] ?? 0) * basis;
            denominator += basis * basis;
        }
        coefficients[k] = denominator === 0 ? 0 : numerator / denominator;
        yield {
            stepNumber: step,
            entities: makeEntities(coefficients, k),
            edges: [],
            description: `Basis order ${k}: Chebyshev coefficient ${(coefficients[k] ?? 0).toFixed(5)} computed by discrete orthogonality.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { degree, samples, coefficients: [...coefficients], order: k, maxError: null },
        };
        step += 1;
    }

    let maxError = 0;
    for (let j = 0; j < samples; j += 1) {
        const x = nodes[j] ?? 0;
        let approximation = 0;
        for (let k = 0; k <= degree; k += 1) {
            approximation += (coefficients[k] ?? 0) * chebyshev(k, x);
        }
        maxError = Math.max(maxError, Math.abs(approximation - (values[j] ?? 0)));
    }

    yield {
        stepNumber: step,
        entities: makeEntities(coefficients, -1),
        edges: [],
        description: `Approximation complete; maximum sampled error ${maxError.toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { degree, samples, coefficients: [...coefficients], maxError },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Chebyshev polynomials are nearly orthogonal on the interval minus one to one. Projecting a function onto them is like taking a Fourier transform with polynomials instead of sine waves. Because the basis is well conditioned, a small number of coefficients often captures the function to high accuracy.",
        invariants: [
            "T zero of x is one and T one of x is x; higher orders obey T(n+1) = 2xT(n) minus T(n-1).",
            "On the Chebyshev-Gauss nodes the discrete inner products of distinct basis polynomials vanish.",
            "Each coefficient equals the inner product of the target with its basis divided by that basis's squared norm.",
        ],
        correctness:
            "Discrete orthogonality makes the normal equations diagonal, so each coefficient independently minimizes the squared error over the sample nodes. If the target lies in the span of the retained basis, the residual is zero at every node and the approximation reproduces the target exactly.",
        complexityRationale:
            "For each of degree plus one coefficients we evaluate a basis polynomial at every sample, costing O(samples times degree) overall, and the same order to evaluate the final error. Storage is linear in the samples plus the degree.",
        uses: [
            "Building fast and accurate polynomial approximations of special functions",
            "Spectral methods for numerical solution of differential equations",
            "Function approximation in computer graphics and numerical libraries",
        ],
        references: [
            "Trefethen, Approximation Theory and Approximation Practice, 2013",
            "Press et al., Numerical Recipes, chapter on Chebyshev approximation",
        ],
        workedExample:
            "Approximating the quadratic 2x squared minus 1 with degree two on thirty-two Chebyshev nodes recovers coefficients that reconstruct the polynomial to within roughly ten to the minus fourteen at every node.",
    },
    id: "chebyshev-approximation",
    name: "Chebyshev Least-Squares Approximation",
    category: "numerical-optimization",
    complexity: { time: "O(samples * degree)", space: "O(samples + degree)" },
    defaultInput: { degree: 4, targetCoefficients: [-1, 0, 2], samples: 32 },
    visualType: "array",
    run,
    pseudocode: [
        "read target samples, degree, and sample count",
        "place nodes at Chebyshev-Gauss points on minus one to one",
        "for each basis order k from zero to degree",
        "compute coefficient as the projected inner product divided by the norm",
        "store the coefficient in the approximation",
        "evaluate the approximation at every node",
        "report coefficients and the maximum sampled error",
    ],
};

export default module;
