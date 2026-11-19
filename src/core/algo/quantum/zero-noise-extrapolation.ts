/**
 * zero-noise-extrapolation.ts - Zero-Noise Extrapolation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Zero-noise extrapolation estimates the noise-free value of a quantum
 * observable by deliberately making the circuit noisier, measuring at several
 * noise scale factors, and fitting a curve back to zero noise. This simulation
 * uses an exactly solvable single-qubit model: a rotation by theta followed by
 * m depolarizing layers. At scale lambda the depolarizing strength is lambda
 * times the base strength, so the measured Z expectation is cos(theta) times
 * (1 - lambda q)^m, a polynomial of degree m. Three scale factors 1, 2, 3 and
 * a quadratic extrapolation remove the error exactly for m = 2.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k noise scale factors with a closed-form expectation
 *   Space: O(k) for the collected expectation values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the three noisy expectations, the extrapolated value, and
 *     the exact ideal value.
 *   - Each scale factor fills one bar in yellow.
 *   - The final bars are green when the extrapolation matches the ideal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const SCALES = [1, 2, 3];

function expectation(theta: number, noise: number, gates: number, scale: number): number {
    return Math.cos(theta) * (1 - scale * noise) ** gates;
}

/** Quadratic Lagrange interpolation at zero through the three measured points. */
function extrapolate(values: number[]): number {
    return 3 * (values[0] ?? 0) - 3 * (values[1] ?? 0) + (values[2] ?? 0);
}

function makeBars(values: number[], filled: number, finished: boolean): VisualEntity[] {
    const labels = ["lambda=1", "lambda=2", "lambda=3", "extrapolated", "ideal"];
    return labels.map((label, i) => {
        const state: EntityState = finished
            ? "sorted"
            : i < filled
              ? "active"
              : i === filled
                ? "comparing"
                : "idle";
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label,
            value: values[i] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, scale: SCALES[i] ?? 0, role: labels[i] },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { theta?: number; noise?: number; gates?: number } | null) ?? {};
    const theta = typeof task.theta === "number" && Number.isFinite(task.theta) ? task.theta : 0.6;
    const noise = typeof task.noise === "number" && Number.isFinite(task.noise)
        ? Math.max(0, Math.min(0.3, task.noise))
        : 0.05;
    const gates = typeof task.gates === "number" && Number.isFinite(task.gates)
        ? Math.max(1, Math.min(4, Math.floor(task.gates)))
        : 2;
    const values: number[] = [0, 0, 0, 0, 0];
    const ideal = Math.cos(theta);
    const meta = (filled: number, done: boolean) => {
        const estimated = values[3] ?? 0;
        return {
            theta,
            noise,
            gates,
            scales: [...SCALES],
            expectations: values.slice(0, 3),
            extrapolated: estimated,
            ideal,
            error: Math.abs(estimated - ideal),
            rawError: Math.abs((values[0] ?? 0) - ideal),
            filled,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Estimating the noise-free Z expectation for theta ${theta.toFixed(3)} with ${gates} depolarizing layer(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, false),
    };

    let step = 1;
    for (let i = 0; i < SCALES.length; i += 1) {
        const scale = SCALES[i] ?? 1;
        values[i] = expectation(theta, noise, gates, scale);
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false),
            edges: [],
            description: `Scale lambda ${scale}: noise strength ${(scale * noise).toFixed(4)}, measured Z expectation ${(values[i] ?? 0).toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(i + 1, false),
        };
        step += 1;
    }

    values[3] = extrapolate(values.slice(0, 3));
    yield {
        stepNumber: step,
        entities: makeBars(values, 3, false),
        edges: [],
        description: `Quadratic extrapolation to zero noise gives ${(values[3] ?? 0).toFixed(8)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: meta(4, false),
    };
    step += 1;

    values[4] = ideal;
    yield {
        stepNumber: step,
        entities: makeBars(values, 4, true),
        edges: [],
        description: `Ideal value ${ideal.toFixed(8)}; extrapolation error ${meta(5, true).error.toExponential(2)} versus raw error ${meta(5, true).rawError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(5, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A noisy quantum computer returns a biased answer. Measure the same circuit with the noise intentionally amplified by known factors, then trace a curve through those biased answers and read where the curve crosses zero noise. It is the same idea as extrapolating a stopping distance from several faster trials back to the desired speed.",
        invariants: [
            "At scale lambda each depolarizing layer has strength lambda times the base noise.",
            "The expectation at any scale is cos(theta) times (1 - lambda q) to the number of layers.",
            "With two noise layers the dependence on lambda is quadratic, so three scale factors determine the zero-noise limit exactly.",
        ],
        correctness:
            "Depolarizing a Bloch vector by strength q multiplies it by one minus q, and applying m layers multiplies it by (1 - q)^m. Folding each gate into lambda copies makes the effective strength lambda q, so the measured value is a degree m polynomial in lambda. Lagrange interpolation through three points reproduces any quadratic exactly; evaluating it at lambda zero returns cos(theta), the noise-free expectation. The method is exact here only because the polynomial degree does not exceed two.",
        complexityRationale:
            "Each of the k scale factors needs one closed-form expectation, so the work is O(k). The algorithm stores k measured values and a small result record, O(k) space. Real hardware replaces the closed form with many circuit shots, multiplying the measurement cost.",
        uses: [
            "Estimating expectation values on noisy intermediate-scale quantum processors",
            "Improving variational algorithm energy estimates without extra qubits",
            "Benchmarking the effect of gate and readout errors",
        ],
        references: [
            "Temme, Bravyi, and Gambetta, Error Mitigation for Short-Depth Quantum Circuits, 2017",
            "Li and Benjamin, Efficient Variational Quantum Simulator Incorporating Active Error Minimization, 2017",
        ],
        workedExample:
            "With theta = 0.6, noise 0.05, and two layers, the ideal value is cos(0.6) = 0.8253. The three noisy values are 0.8253 times 0.95 squared, 0.90 squared, and 0.85 squared. The combination 3 E1 minus 3 E2 plus E3 cancels every lambda-dependent term and returns 0.8253 exactly.",
    },
    id: "zero-noise-extrapolation",
    name: "Zero-Noise Extrapolation",
    category: "quantum",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { theta: 0.6, noise: 0.05, gates: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose three noise scale factors one, two, and three",
        "for each scale factor fold the gates to amplify noise",
        "compute the expectation as cos theta times (1 - lambda q) to the gate count",
        "record the noise-scaled expectation",
        "fit a quadratic through the three recorded values",
        "evaluate the fitted polynomial at zero noise",
        "done: report the extrapolated and ideal expectations",
    ],
};

export default module;
