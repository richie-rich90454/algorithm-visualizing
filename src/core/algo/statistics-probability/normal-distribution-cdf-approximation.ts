/**
 * normal-distribution-cdf-approximation.ts - Normal CDF Polynomial Approximation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The standard normal cumulative distribution function Phi(z) has no closed
 * form in elementary functions. The Abramowitz and Stegun formula approximates
 * the upper tail with a fifth-degree polynomial in t, where t depends on the
 * absolute value of z. Symmetry handles negative z. The maximum absolute error
 * is below 7.5 times ten to the minus eight, which is ample for hand
 * calculation and quick numeric work.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) to tabulate Phi across a grid
 *   Space: O(samples) for the displayed grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per sampled z shows Phi(z) on a grid from -4 to 4.
 *   - The bar closest to the queried z is highlighted.
 *   - Intermediate frames show t, the density, and each polynomial term.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 0.2316419;
const B1 = 0.31938153;
const B2 = -0.356563782;
const B3 = 1.781477937;
const B4 = -1.821255978;
const B5 = 1.330274429;
const INV_SQRT_2PI = 0.3989422804014327;

interface Approx {
    phi: number;
    pdf: number;
    t: number;
    terms: number[];
    poly: number;
}

/** Abramowitz and Stegun 26.2.17 evaluated at a single z. */
function approximate(z: number): Approx {
    const ax = Math.abs(z);
    const t = 1 / (1 + P * ax);
    const pdf = INV_SQRT_2PI * Math.exp((-ax * ax) / 2);
    const terms = [B1 * t, B2 * t ** 2, B3 * t ** 3, B4 * t ** 4, B5 * t ** 5];
    const poly = terms.reduce((sum, term) => sum + term, 0);
    const tail = pdf * poly;
    const phi = z >= 0 ? 1 - tail : tail;
    return { phi, pdf, t, terms, poly };
}

/** Build the CDF grid bars. */
function makeBars(
    grid: number[],
    values: number[],
    highlight: number,
    phase: string,
): VisualEntity[] {
    return grid.map((z, index) => {
        let state: EntityState = "idle";
        if (index === highlight) {
            state = phase === "done" ? "sorted" : "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `z=${z.toFixed(2)}:${(values[index] ?? 0).toFixed(3)}`,
            value: values[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, z, phi: values[index] ?? 0 },
        };
    });
}

/** The normal CDF approximation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { z?: number; samples?: number } | null) ?? {};
    const z = Number.isFinite(Number(task.z)) ? Number(task.z) : 1;
    const samples = Math.min(81, Math.max(5, Math.floor(Number(task.samples ?? 41)) || 41));
    const odd = samples % 2 === 1 ? samples : samples + 1;

    const grid: number[] = [];
    for (let i = 0; i < odd; i += 1) {
        grid.push(-4 + (8 * i) / (odd - 1));
    }
    const values = grid.map((value) => approximate(value).phi);
    let highlight = 0;
    for (let i = 1; i < grid.length; i += 1) {
        if (Math.abs((grid[i] ?? 0) - z) < Math.abs((grid[highlight] ?? 0) - z)) {
            highlight = i;
        }
    }
    const result = approximate(z);

    const base = { z, samples: odd, pdf: result.pdf, t: result.t, phi: result.phi, terms: result.terms, poly: result.poly, grid: [...grid], values: [...values] };

    yield {
        stepNumber: 0,
        entities: makeBars(grid, values, highlight, "setup"),
        edges: [],
        description: `Approximating Phi(${z.toFixed(3)}) with a fifth-degree polynomial tabulated over ${odd} points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: "setup" },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(grid, values, highlight, "t"),
        edges: [],
        description: `With x = |z| = ${Math.abs(z).toFixed(3)}, compute t = 1 / (1 + 0.2316419 x) = ${result.t.toFixed(6)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...base, phase: "t" },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(grid, values, highlight, "pdf"),
        edges: [],
        description: `The standard normal density at x is exp(-x squared / 2) / sqrt(2 pi) = ${result.pdf.toFixed(6)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...base, phase: "pdf" },
    };

    let running = 0;
    for (let i = 0; i < result.terms.length; i += 1) {
        running += result.terms[i] ?? 0;
        yield {
            stepNumber: 3 + i,
            entities: makeBars(grid, values, highlight, "poly"),
            edges: [],
            description: `Polynomial term ${i + 1} of 5: b${i + 1} t^${i + 1} = ${(result.terms[i] ?? 0).toFixed(6)}; partial sum ${running.toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { ...base, phase: "poly", termIndex: i, term: result.terms[i] ?? 0, running },
        };
    }

    yield {
        stepNumber: 3 + result.terms.length,
        entities: makeBars(grid, values, highlight, "done"),
        edges: [],
        description: `Phi(${z.toFixed(3)}) is approximately ${result.phi.toFixed(7)}; symmetry handles negative z. Maximum formula error is below 7.5 times ten to the minus eight.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, phase: "done", tail: result.pdf * result.poly },
    };
}

/** The normal CDF approximation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The bell curve has no simple antiderivative, so we approximate its tail with a polynomial. Substitute t equals one over one plus a constant times the absolute value of z, then add five weighted powers of t and multiply by the bell height. For negative z, mirror the answer across zero.",
        invariants: [
            "Phi is symmetric in the sense Phi(-z) equals one minus Phi(z).",
            "The approximation is monotone increasing in z.",
            "Phi(z) stays within zero and one for every z.",
        ],
        correctness:
            "The Abramowitz and Stegun 26.2.17 rational-polynomial fit to the standard normal tail was derived by minimizing the maximum absolute error over z at least zero, and its published bound is 7.5 times ten to the minus eight. Applying Phi(-z) equals one minus Phi(z) extends the bound symmetrically to negative z, so the returned value is within that bound of the true CDF everywhere.",
        complexityRationale:
            "Evaluating one z takes a fixed number of multiplications and one exponential, so it is constant time. Tabulating the visualization across s sample points costs O(s) time and O(s) space.",
        uses: [
            "Hand calculation of normal probabilities",
            "Fast CDF evaluation in performance-sensitive code",
            "A fallback where a math library has no error function",
        ],
        references: [
            "Abramowitz and Stegun, Handbook of Mathematical Functions, formula 26.2.17, 1964",
            "National Institute of Standards and Technology, Digital Library of Mathematical Functions",
        ],
        workedExample:
            "For z = 1, x = 1 and t is about 0.8118. The polynomial in t is about 0.8556, the density at 1 is about 0.2420, and the tail is about 0.2070, giving Phi(1) about 0.8413, matching the standard table entry.",
    },
    id: "normal-distribution-cdf-approximation",
    name: "Normal Distribution CDF Approximation",
    category: "statistics-probability",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { z: 1, samples: 41 },
    visualType: "array",
    run,
    pseudocode: [
        "tabulate Phi(z) on a grid from minus four to four",
        "set x to the absolute value of z",
        "compute t equals one over one plus p times x",
        "compute the density exp(-x squared / 2) over sqrt(2 pi)",
        "sum the five weighted powers of t",
        "multiply the density by the polynomial for the tail",
        "return one minus the tail when z is nonnegative, else the tail",
        "done: report the approximated cumulative probability",
    ],
};

export default module;
