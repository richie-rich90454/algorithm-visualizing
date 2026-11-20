/**
 * savitzky-golay-filter.ts - Savitzky-Golay Smoothing Coefficients
 *
 * A Savitzky-Golay filter smooths a signal by fitting a low-degree polynomial
 * to a sliding window by least squares and taking the fitted value at the
 * center. Because the fit is linear in the data, the whole operation collapses
 * to a fixed set of convolution coefficients. This module derives those
 * coefficients by solving the normal equations and displays them as bars.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SGInput {
    window?: number;
    order?: number;
}

/** Solve A x = b by Gauss-Jordan elimination with partial pivoting. */
function solve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const a = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
        }
        const temp = a[col]!;
        a[col] = a[pivot]!;
        a[pivot] = temp;
        const factor = a[col]![col]! || 1e-300;
        for (let j = col; j <= n; j += 1) a[col]![j]! /= factor;
        for (let row = 0; row < n; row += 1) {
            if (row === col) continue;
            const scale = a[row]![col]!;
            if (scale === 0) continue;
            for (let j = col; j <= n; j += 1) a[row]![j]! -= scale * a[col]![j]!;
        }
    }
    return a.map((row) => row[n] ?? 0);
}

/** Least-squares convolution coefficients for the center point. */
function coefficients(window: number, order: number): number[] {
    const m = (window - 1) / 2;
    const degree = Math.min(order, window - 1);
    const size = degree + 1;
    const matrix = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    for (let j = 0; j < size; j += 1) {
        for (let k = 0; k < size; k += 1) {
            let sum = 0;
            for (let i = -m; i <= m; i += 1) sum += i ** (j + k);
            matrix[j]![k] = sum;
        }
    }
    // Row zero of (A^T A)^-1 A^T gives the smoothing weights.
    const inverseFirstRow: number[] = [];
    for (let k = 0; k < size; k += 1) {
        const e = new Array<number>(size).fill(0);
        e[k] = 1;
        inverseFirstRow.push(solve(matrix, e)[0] ?? 0);
    }
    const result: number[] = [];
    for (let i = -m; i <= m; i += 1) {
        let value = 0;
        for (let j = 0; j < size; j += 1) value += (inverseFirstRow[j] ?? 0) * i ** j;
        result.push(value);
    }
    return result;
}

function makeBars(values: number[], center: number, active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) state = index === center ? "sorted" : "visited";
        else if (index === active) state = "comparing";
        else if (index === center) state = "highlight";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(4),
            value,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, coefficient: value, offset: index - center },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SGInput | null) ?? {};
    let window = Math.floor(Number(task.window ?? 7));
    if (window % 2 === 0) window += 1;
    window = Math.min(25, Math.max(3, window || 7));
    const order = Math.min(window - 1, Math.max(0, Math.floor(Number(task.order ?? 3)) || 0));
    const center = (window - 1) / 2;
    const values = coefficients(window, order);
    const sum = values.reduce((a, b) => a + b, 0);
    const moments = Array.from({ length: order + 1 }, (_, t) =>
        values.reduce((acc, c, i) => acc + c * (i - center) ** t, 0));

    yield {
        stepNumber: 0,
        entities: makeBars(values.map(() => 0), center, -1, false),
        edges: [],
        description: `Savitzky-Golay: fit a degree ${order} polynomial in a window of ${window} points and keep the fitted center.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { window, order, center, sum: 0, coefficients: values.map(() => 0), moments: [] },
    };

    let step = 1;
    for (let i = 0; i < values.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(values, center, i, false),
            edges: [],
            description: `Coefficient at offset ${i - center} is ${values[i]!.toFixed(5)}; the filter is a fixed convolution of the window.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { window, order, center, sum, coefficients: values.slice(0, i + 1), moments },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, center, -1, true),
        edges: [],
        description: `Coefficients sum to ${sum.toFixed(9)} and reproduce every polynomial up to degree ${order} exactly.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { window, order, center, sum, coefficients: [...values], moments, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A moving average flattens peaks. Savitzky-Golay smoothing instead fits a small polynomial to each window of samples by least squares and keeps the fitted value in the middle. Since least squares is linear, the fit at the center can be written once and for all as a weighted sum of the window values, giving a ready-made convolution kernel.",
        invariants: [
            "The coefficients are symmetric about the center of the window.",
            "They sum to one, so a constant signal is unchanged.",
            "Their moments reproduce every polynomial of degree at most the fit order exactly.",
        ],
        correctness:
            "Let A have entries i to the j for window offsets i and polynomial powers j. The least-squares solution is (A transpose A) inverse A transpose y, and the smoothed center is row zero of that matrix times y, which is the coefficient vector. Because the normal equations solve the least-squares minimization exactly, any signal that is a polynomial of degree at most the fit order is reproduced without error, giving the moment conditions used to verify the kernel.",
        complexityRationale:
            "Building and solving the degree plus one normal equations takes O(order cubed) time, and evaluating the window coefficients is O(window times order squared). Storage is O(window) for the displayed kernel.",
        uses: [
            "Smoothing noisy spectra and chromatograms without broadening peaks",
            "Preprocessing sensor and biomedical signals",
            "Estimating derivatives from noisy sampled data",
        ],
        references: [
            "Savitzky and Golay, Smoothing and Differentiation of Data by Simplified Least Squares Procedures, 1964",
            "Press et al., Numerical Recipes, Section on Savitzky-Golay Filters",
        ],
        workedExample:
            "For a window of five and a quadratic fit the coefficients are minus three, twelve, seventeen, twelve and minus three, all divided by thirty-five. They sum to one and their second moment matches the center exactly, so a pure parabola passes through unchanged.",
    },
    id: "savitzky-golay-filter",
    name: "Savitzky-Golay Filter",
    category: "statistics-probability",
    complexity: { time: "O(w * d^2)", space: "O(w)" },
    defaultInput: { window: 7, order: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the odd window width and polynomial order",
        "build the Vandermonde matrix of window offsets and polynomial powers",
        "form the normal equations A transpose A",
        "solve for the first row of the least squares operator",
        "multiply by each offset power to obtain one convolution coefficient",
        "check that the coefficients sum to one",
        "done: report the smoothing kernel",
    ],
};

export default module;
