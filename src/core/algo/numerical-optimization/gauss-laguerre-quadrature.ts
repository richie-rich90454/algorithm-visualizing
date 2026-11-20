/**
 * gauss-laguerre-quadrature.ts - Gauss-Laguerre Quadrature via the Jacobi Matrix
 *
 * Approximates the improper integral of exp(-x) f(x) over [0, infinity) by a
 * weighted sum of function values at n Gauss nodes. The nodes are the eigenvalues
 * of the symmetric tridiagonal Jacobi matrix with diagonal 1,3,5,...,2n-1 and
 * off-diagonal 1,2,...,n-1; each weight is the squared first component of the
 * corresponding normalized eigenvector. An n-point rule integrates every
 * polynomial of degree at most 2n-1 exactly.
 *
 * Limits of the demo: the weight function is fixed to exp(-x), the interval is
 * fixed to [0, infinity), the integrand is a polynomial given by coefficients,
 * the rule order is at most 12, and the small symmetric eigenproblem is solved
 * by cyclic Jacobi rotations. No adaptive or multivariate quadrature is used.
 *
 * Time: O(n^3) for the eigensolve. Space: O(n^2).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Eigen-decomposition of a small real symmetric matrix by cyclic Jacobi rotations. */
export function symmetricEigen(matrix: number[][]): { values: number[]; vectors: number[][] } {
    const n = matrix.length;
    const A = matrix.map((row) => row.slice());
    const V: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let sweep = 0; sweep < 200; sweep += 1) {
        let off = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                off += ((A[i] as number[])[j] as number) ** 2;
            }
        }
        if (off < 1e-28) {
            break;
        }
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const aij = (A[i] as number[])[j] as number;
                if (Math.abs(aij) < 1e-18) {
                    continue;
                }
                const aii = (A[i] as number[])[i] as number;
                const ajj = (A[j] as number[])[j] as number;
                const angle = 0.5 * Math.atan2(2 * aij, ajj - aii);
                const c = Math.cos(angle);
                const s = Math.sin(angle);
                for (let k = 0; k < n; k += 1) {
                    const aki = (A[k] as number[])[i] as number;
                    const akj = (A[k] as number[])[j] as number;
                    (A[k] as number[])[i] = c * aki - s * akj;
                    (A[k] as number[])[j] = s * aki + c * akj;
                    const vki = (V[k] as number[])[i] as number;
                    const vkj = (V[k] as number[])[j] as number;
                    (V[k] as number[])[i] = c * vki - s * vkj;
                    (V[k] as number[])[j] = s * vki + c * vkj;
                }
                for (let k = 0; k < n; k += 1) {
                    const aik = (A[i] as number[])[k] as number;
                    const ajk = (A[j] as number[])[k] as number;
                    (A[i] as number[])[k] = c * aik - s * ajk;
                    (A[j] as number[])[k] = s * aik + c * ajk;
                }
            }
        }
    }
    const indexed = Array.from({ length: n }, (_, i) => ({
        value: (A[i] as number[])[i] as number,
        column: Array.from({ length: n }, (_, k) => (V[k] as number[])[i] as number),
    })).sort((a, b) => a.value - b.value);
    return {
        values: indexed.map((entry) => entry.value),
        vectors: indexed.map((entry) => entry.column),
    };
}

/** Nodes and weights of the n-point Gauss-Laguerre rule. */
export function gaussLaguerre(n: number): { nodes: number[]; weights: number[] } {
    const size = Math.max(1, Math.floor(n));
    const matrix: number[][] = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => {
            if (i === j) {
                return 2 * i + 1;
            }
            if (Math.abs(i - j) === 1) {
                return Math.max(i, j);
            }
            return 0;
        }),
    );
    const eigen = symmetricEigen(matrix);
    const nodes = eigen.values;
    const weights = eigen.vectors.map((column) => (column[0] as number) ** 2);
    return { nodes, weights };
}

/** Evaluate a polynomial given by ascending coefficients at x. */
function evaluate(coefficients: number[], x: number): number {
    let sum = 0;
    let power = 1;
    for (const coefficient of coefficients) {
        sum += coefficient * power;
        power *= x;
    }
    return sum;
}

/** Analytic integral of exp(-x) times the polynomial: sum c_k * k!. */
function exactLaguerreIntegral(coefficients: number[]): number {
    let factorial = 1;
    let sum = 0;
    for (let k = 0; k < coefficients.length; k += 1) {
        if (k > 0) {
            factorial *= k;
        }
        sum += (coefficients[k] as number) * factorial;
    }
    return sum;
}

function makeBars(nodes: number[], weights: number[], active: number): VisualEntity[] {
    const values = [...nodes, ...weights];
    const labels = [
        ...nodes.map((node, i) => `node ${i + 1}=${node.toFixed(4)}`),
        ...weights.map((weight, i) => `weight ${i + 1}=${weight.toFixed(4)}`),
    ];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? "value",
        value,
        state: index === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index < nodes.length ? "node" : "weight" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { order?: number; coefficients?: number[] } | null) ?? {};
    const order = Math.min(12, Math.max(1, Math.floor(Number(task.order ?? 3)) || 3));
    const coefficients = Array.isArray(task.coefficients) && task.coefficients.length > 0
        ? task.coefficients.map(Number)
        : [1, 1, 1, 1];
    const { nodes, weights } = gaussLaguerre(order);
    const exact = exactLaguerreIntegral(coefficients);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(nodes, weights, -1),
        edges: [],
        description: `Build a ${order}-point Gauss-Laguerre rule for exp(-x) times a degree-${coefficients.length - 1} polynomial.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { order, nodes: [...nodes], weights: [...weights], estimate: 0, exact, error: Math.abs(exact) },
    };
    step += 1;

    let estimate = 0;
    for (let i = 0; i < nodes.length; i += 1) {
        const term = (weights[i] as number) * evaluate(coefficients, nodes[i] as number);
        estimate += term;
        yield {
            stepNumber: step,
            entities: makeBars(nodes, weights, i),
            edges: [],
            description: `Node ${i + 1}: x=${(nodes[i] as number).toFixed(6)}, weight=${(weights[i] as number).toFixed(6)} contributes ${term.toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                order,
                nodes: [...nodes],
                weights: [...weights],
                activeNode: i,
                terms: nodes.slice(0, i + 1).map((node, k) => (weights[k] as number) * evaluate(coefficients, node)),
                estimate,
                exact,
                error: Math.abs(estimate - exact),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(nodes, weights, -1),
        edges: [],
        description: `Rule gives ${estimate.toFixed(10)}; analytic integral is ${exact.toFixed(10)}; absolute error ${Math.abs(estimate - exact).toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            order,
            nodes: [...nodes],
            weights: [...weights],
            estimate,
            exact,
            error: Math.abs(estimate - exact),
            exactForDegree: 2 * order - 1,
            polynomialDegree: coefficients.length - 1,
            converged: Math.abs(estimate - exact) < 1e-8,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Gaussian quadrature chooses both the sample points and their weights so that a small number of function evaluations integrates polynomials surprisingly well. For the exponential weight on the half-line the sample points are the eigenvalues of a short tridiagonal matrix, and the weights come from its eigenvectors. This converts an improper integral into a short finite sum.",
        invariants: [
            "Nodes are the sorted eigenvalues of the symmetric Jacobi matrix for Laguerre polynomials.",
            "The weights are nonnegative and sum to one, the integral of exp(-x) over the half-line.",
            "An n-point rule is exact for every polynomial whose degree is at most 2n - 1.",
        ],
        correctness:
            "The three-term recurrence for the monic Laguerre polynomials defines a symmetric Jacobi matrix whose characteristic polynomial is the degree-n Laguerre polynomial. Its zeros are the Gauss nodes. The Christoffel-Darboux formula gives each weight as the squared first component of the normalized eigenvector divided by the squared norm of the constant polynomial, which is one here. Gaussian quadrature is exact through degree 2n - 1 because the interpolation error is orthogonal to every polynomial of that degree under the weight exp(-x).",
        complexityRationale:
            "Cyclic Jacobi rotations reduce the n by n tridiagonal matrix in a constant number of sweeps in practice, giving O(n^3) time in the worst case and O(n^2) space for the matrix and its eigenvectors. Evaluating the polynomial at each node adds O(n * degree).",
        uses: [
            "Computing expectation values under exponential distributions",
            "Radial integrals in quantum chemistry and physics",
            "Evaluating Laplace transforms and relaxation kernels",
        ],
        references: [
            "Gautschi, Orthogonal Polynomials: Computation and Approximation, 2004",
            "Golub and Welsch, Calculation of Gauss Quadrature Rules, 1969",
        ],
        workedExample:
            "For order three the Jacobi matrix has diagonal 1, 3, 5 and off-diagonal 1, 2. Its nodes are about 0.4158, 2.2943 and 6.2899 with weights about 0.7111, 0.2785 and 0.0104. Applied to the polynomial 1 + x + x^2 + x^3 the rule returns 10, which equals 0! + 1! + 2! + 3!.",
    },
    id: "gauss-laguerre-quadrature",
    name: "Gauss-Laguerre Quadrature",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { order: 3, coefficients: [1, 1, 1, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "choose the rule order n and polynomial coefficients",
        "build the Jacobi matrix with diagonal 2k-1 and off-diagonal k",
        "compute eigenvalues and normalized eigenvectors",
        "set each node to an eigenvalue",
        "set each weight to the squared first eigenvector component",
        "sum weight times polynomial value at each node",
        "compare the sum with the analytic polynomial integral",
        "done: report nodes, weights, estimate and error",
    ],
};

export default module;
