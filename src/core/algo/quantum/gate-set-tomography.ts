/**
 * gate-set-tomography.ts - Gate Set Tomography of a Single-Qubit Gate (Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gate set tomography characterizes a gate together with the state preparation
 * and measurement that surround it, instead of assuming those are known as in
 * ordinary process tomography. The experiment applies repeated powers of the
 * gate to a fixed prepared state and records the readout probability after each
 * sequence. Linear inversion then solves for the unknown state-preparation and
 * measurement scale and for the gate's own contraction and rotation angle. The
 * reconstructed gate is checked by predicting longer sequences that were not
 * used in the fit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(K) for K gate sequences, each a constant-size formula
 *   Space: O(K) for the measured and predicted probability tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Grid rows are gate-sequence lengths k; columns are measured and predicted.
 *   - The row currently being measured is yellow, finished rows are green.
 *   - meta carries the reconstructed gate parameters and the prediction error.
 *
 * LIMITS: this is an exact state-vector model for one qubit restricted to the
 * x-z Bloch plane. The gate is a rotation about y with a uniform contraction;
 * SPAM is a single scale factor. The sign of the sine of the angle is not
 * identifiable from readout probabilities, so it is reported as positive. No
 * sampling noise, gate-set gauge optimization, or full three-dimensional SPAM
 * is modeled.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    theta?: number;
    noise?: number;
    spamScale?: number;
    sequences?: number;
}

const DEFAULTS = { theta: 0.6, noise: 0.95, spamScale: 0.8, sequences: 6 };

/** Probability of the plus outcome after k applications of the gate. */
function measurement(k: number, theta: number, noise: number, spamScale: number): number {
    return 0.5 + 0.5 * spamScale * Math.pow(noise, k) * Math.cos(k * theta);
}

/** Build the two-column measured versus predicted probability grid. */
function makeCells(measured: number[], predicted: number[], filled: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < measured.length; r += 1) {
        for (let c = 0; c < 2; c += 1) {
            const value = c === 0 ? (measured[r] ?? 0) : (predicted[r] ?? 0);
            const state: EntityState = r === active && r >= filled
                ? "comparing"
                : r < filled || r === filled - 1
                    ? "sorted"
                    : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: value.toFixed(5),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, sequence: r, kind: c === 0 ? "measured" : "predicted" },
            });
        }
    }
    return entities;
}

/** Reconstruct SPAM scale, contraction, and angle from the first three probabilities. */
function invert(p0: number, p1: number, p2: number): { spam: number; noise: number; cos: number } {
    const spam = 2 * (p0 - 0.5);
    if (Math.abs(spam) < 1e-12) {
        return { spam: 0, noise: 1, cos: 1 };
    }
    const q1 = (p1 - 0.5) / (0.5 * spam);
    const q2 = (p2 - 0.5) / (0.5 * spam);
    const squaredNoise = 2 * q1 * q1 - q2;
    const noise = Math.sqrt(Math.max(0, squaredNoise));
    const cos = noise > 1e-12 ? Math.max(-1, Math.min(1, q1 / noise)) : 1;
    return { spam, noise, cos };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const theta = typeof task.theta === "number" && Number.isFinite(task.theta)
        ? Math.max(-Math.PI, Math.min(Math.PI, task.theta))
        : DEFAULTS.theta;
    const noise = typeof task.noise === "number" && Number.isFinite(task.noise)
        ? Math.max(0.05, Math.min(1, task.noise))
        : DEFAULTS.noise;
    const spamScale = typeof task.spamScale === "number" && Number.isFinite(task.spamScale)
        ? Math.max(0.05, Math.min(1, task.spamScale))
        : DEFAULTS.spamScale;
    const count = typeof task.sequences === "number" && Number.isFinite(task.sequences)
        ? Math.max(3, Math.min(10, Math.round(task.sequences)))
        : DEFAULTS.sequences;

    const measured = Array.from({ length: count }, (_, k) => measurement(k, theta, noise, spamScale));
    const fit = invert(measured[0] ?? 0.5, measured[1] ?? 0.5, measured[2] ?? 0.5);
    const predicted = measured.map((_, k) =>
        0.5 + 0.5 * fit.spam * Math.pow(fit.noise, k) * Math.cos(k * Math.acos(fit.cos)));
    const maxError = Math.max(...measured.map((value, k) => Math.abs(value - (predicted[k] ?? 0))));

    const meta = (filled: number, active: number, done: boolean) => ({
        theta,
        noise,
        spamScale,
        rows: count,
        cols: 2,
        sequences: count,
        measured: [...measured],
        predicted: [...predicted],
        reconstructedSpam: fit.spam,
        reconstructedNoise: fit.noise,
        reconstructedCos: fit.cos,
        reconstructedAngleSignless: Math.acos(fit.cos),
        maxPredictionError: maxError,
        filled,
        active,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(measured, predicted, 0, -1),
        edges: [],
        description: `Gate set tomography on a y-rotation gate with ${count} sequences of repeated application.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, -1, false),
    };

    let step = 1;
    for (let k = 0; k < count; k += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(measured, predicted, k + 1, k),
            edges: [],
            description: `Sequence G^${k}: measured plus probability ${(measured[k] ?? 0).toFixed(6)}; predicted ${(predicted[k] ?? 0).toFixed(6)}.`,
            codeLineNumber: k === 0 ? 1 : k === 1 ? 2 : k === 2 ? 3 : 4,
            layout: "grid",
            meta: meta(k + 1, k, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(measured, predicted, count, -1),
        edges: [],
        description: `Reconstructed contraction ${fit.noise.toFixed(6)} and angle ${Math.acos(fit.cos).toFixed(6)}; largest prediction error ${maxError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(count, -1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary tomography assumes you can prepare perfect known states and measure perfect known observables. Gate set tomography drops that assumption. It repeatedly applies the gate under test, so the unknown preparation and measurement effects are entangled with the gate's own action, and a short linear inversion untangles them. The proof of success is that the recovered gate predicts sequences longer than the ones used to fit it.",
        invariants: [
            "The readout probability after k applications is one half plus one half times the SPAM scale times the contraction to the k times cosine of k theta.",
            "The SPAM scale is recovered exactly from the sequence of length zero.",
            "The contraction and the cosine of the angle follow from the lengths one and two by a closed-form inversion.",
        ],
        correctness:
            "Write the measured probability for sequence k as one half plus one half A n to the k times cos k theta, where A is the combined SPAM scale and n is the contraction. The k equals zero datum gives A exactly. Dividing the k equals one and k equals two data by A yields q one equal n cos theta and q two equal n squared cos two theta. Since cos two theta is two cos squared theta minus one, q two equals two q one squared minus n squared, so n is the square root of two q one squared minus q two and cos theta is q one over n. By induction cos k theta is the Chebyshev polynomial T_k of cos theta, so the reconstructed parameters reproduce every measured sequence and generalize to longer ones.",
        complexityRationale:
            "Collecting K sequences needs K constant-size probability evaluations, and the linear inversion uses only the first three, so time is O(K). Storing the measured and predicted tables uses O(K) space.",
        uses: [
            "Calibrating gates on a quantum processor without trusted state preparation",
            "Detecting drift in a qubit rotation between calibration runs",
            "Teaching the difference between SPAM errors and gate errors",
        ],
        references: [
            "Blume-Kohout et al., Robust, Self-Consistent, Arbitrary-Accuracy Quantum Gate Set Tomography, 2013",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, chapter on quantum tomography",
        ],
        workedExample:
            "With true angle 0.6, contraction 0.95, and SPAM scale 0.8, the length-zero probability is 0.9, giving A equals 0.8. The next two probabilities give q one about 0.7832 and q two about 0.3257, so n is the square root of two times q one squared minus q two, about 0.95, and cos theta about 0.8253. The reconstruction predicts all six sequences to floating precision.",
    },
    id: "gate-set-tomography",
    name: "Gate Set Tomography (Teaching Core)",
    category: "quantum",
    complexity: { time: "O(K)", space: "O(K)" },
    defaultInput: { theta: 0.6, noise: 0.95, spamScale: 0.8, sequences: 6 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the gate angle, contraction, and SPAM scale",
        "for k from 0 to K-1 prepare the state and apply the gate k times",
        "record the plus-outcome probability for each sequence",
        "set the SPAM scale from the k = 0 probability",
        "set q1 and q2 from the k = 1 and k = 2 probabilities",
        "recover contraction as sqrt(2*q1^2 - q2) and cos(angle) as q1/contraction",
        "predict all sequence probabilities from the recovered gate",
        "done: report the reconstructed parameters and prediction error",
    ],
};

export default module;
