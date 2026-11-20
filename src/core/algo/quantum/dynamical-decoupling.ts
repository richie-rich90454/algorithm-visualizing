/**
 * dynamical-decoupling.ts - CPMG Pulse Train Suppressing Slow Dephasing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dynamical decoupling inserts a train of pi pulses into an evolution so that
 * the sign of the accumulated phase alternates. Slow noise that is nearly
 * constant between pulses then cancels to high order. This module evaluates
 * the Carr-Purcell-Meiboom-Gill sequence for several pulse counts by
 * integrating the phase 2 times the detuning times a toggling sign, then
 * averaging exp(i phase) over a small ensemble to get a coherence magnitude.
 *
 * This is an exact small numerical simulation over a deterministic slow
 * detuning delta(t) = delta0 + amplitude cos(omega t) and a fixed ensemble of
 * amplitude scales. It assumes instantaneous pi pulses, no relaxation, and a
 * single noise tone. It does not simulate a full noise spectrum, pulse errors,
 * or higher-order sequences such as XY4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P * M * K) for P pulse counts, M steps, K ensemble members
 *   Space: O(P + K) for the results and one ensemble member's phases
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per pulse count shows the surviving ensemble coherence.
 *   - A bar is yellow while that count is being evaluated.
 *   - The final frame highlights the largest coherence across pulse counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DecouplingInput {
    delta0?: number;
    amplitude?: number;
    omega?: number;
    totalTime?: number;
}

const COUNTS = [0, 1, 2, 4, 8];
const STEPS = 512;
const SCALES = [0.5, 0.75, 1, 1.25, 1.5];

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `n=${COUNTS[index] ?? 0}: C=${value.toFixed(4)}`,
        value,
        state: done ? "sorted" : index === active ? "comparing" : "idle",
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, pulses: COUNTS[index] ?? 0, coherence: value },
    }));
}

/** Trapezoidal integral of 2 delta(t) s(t); s flips at each CPMG pulse midpoint window. */
function phaseFor(n: number, delta0: number, amplitude: number, omega: number, total: number): number {
    const dt = total / STEPS;
    const pulseTimes = Array.from({ length: n }, (_, k) => ((k + 0.5) * total) / n);
    let phase = 0;
    for (let step = 0; step < STEPS; step += 1) {
        const t0 = step * dt;
        const t1 = (step + 1) * dt;
        const mid = (t0 + t1) / 2;
        const flips = pulseTimes.reduce((count, time) => count + (mid >= time ? 1 : 0), 0);
        const sign = flips % 2 === 0 ? 1 : -1;
        const delta = (t: number) => delta0 + amplitude * Math.cos(omega * t);
        const average = (delta(t0) + 2 * delta(mid) + delta(t1)) / 4;
        phase += 2 * sign * average * dt;
    }
    return phase;
}

/** Ensemble coherence magnitude for a pulse count. */
function coherenceFor(n: number, delta0: number, amplitude: number, omega: number, total: number): number {
    let re = 0;
    let im = 0;
    for (const scale of SCALES) {
        const phase = phaseFor(n, delta0, amplitude * scale, omega, total);
        re += Math.cos(phase);
        im += Math.sin(phase);
    }
    return Math.hypot(re / SCALES.length, im / SCALES.length);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DecouplingInput | null) ?? {};
    const delta0 = Number(task.delta0 ?? 0.4);
    const amplitude = Number(task.amplitude ?? 1);
    const omega = Number(task.omega ?? (2 * Math.PI));
    const total = Math.max(0.01, Number(task.totalTime ?? 1));
    const coherence: number[] = [];
    const phases: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(COUNTS.map(() => 0), -1, false),
        edges: [],
        description: `Comparing CPMG pulse trains under detuning delta0 + amplitude cos(omega t) over time ${total.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { delta0, amplitude, omega, total, coherences: [...coherence], bestCount: 0, ensembleSize: SCALES.length },
    };

    for (let i = 0; i < COUNTS.length; i += 1) {
        const n = COUNTS[i] ?? 0;
        const phase = phaseFor(n, delta0, amplitude, omega, total);
        const value = coherenceFor(n, delta0, amplitude, omega, total);
        phases.push(phase);
        coherence.push(value);
        yield {
            stepNumber: i + 1,
            entities: makeBars([...coherence, ...COUNTS.slice(coherence.length).map(() => 0)], i, false),
            edges: [],
            description: `With ${n} pi pulses the central phase is ${phase.toFixed(4)} and ensemble coherence is ${value.toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { delta0, amplitude, omega, total, coherences: [...coherence], phases: [...phases], currentCount: n },
        };
    }

    let bestIndex = 0;
    for (let i = 1; i < coherence.length; i += 1) {
        if ((coherence[i] ?? 0) > (coherence[bestIndex] ?? 0)) bestIndex = i;
    }

    yield {
        stepNumber: COUNTS.length + 1,
        entities: makeBars(coherence, -1, true),
        edges: [],
        description: `Best coherence ${(coherence[bestIndex] ?? 0).toFixed(4)} occurs with ${COUNTS[bestIndex] ?? 0} pulses; central phases are ${phases.map((value) => value.toFixed(3)).join(", ")}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            delta0,
            amplitude,
            omega,
            total,
            coherences: [...coherence],
            phases: [...phases],
            bestCount: COUNTS[bestIndex] ?? 0,
            ensembleSize: SCALES.length,
            steps: STEPS,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A pi pulse flips the sign of the phase a qubit keeps accumulating. If you space pulses evenly through an evolution, a slow wander in the qubit frequency contributes one sign before a pulse and the opposite sign after it, so the contributions mostly cancel. More pulses mean shorter windows for the noise to act and better cancellation.",
        invariants: [
            "The toggling sign alternates between plus one and minus one at each pi pulse.",
            "For a purely static detuning, any positive number of pulses gives zero net phase.",
            "The accumulated phase is the time integral of twice the detuning times the toggling sign.",
        ],
        correctness:
            "The phase of a qubit coherence is the integral of twice its frequency offset. Multiplying the integrand by a sign that flips at each pi pulse makes consecutive windows subtract. For a constant offset, equal windows cancel pairwise so the integral vanishes. Averaging exp(i phase) over the fixed amplitude ensemble then gives a real coherence magnitude in the unit interval; the test checks the integrator against an analytic zero-pulse integral and against pairwise cancellation.",
        complexityRationale:
            "Each pulse count integrates M time slices for K ensemble members, so P counts cost O(P times M times K) time and O(P plus K) space.",
        uses: [
            "Extending coherence times in solid-state qubits",
            "Suppressing low-frequency noise in magnetic resonance",
            "A primitive for quantum sensing and clock stabilization",
        ],
        references: [
            "Carr and Purcell, Effects of Diffusion on Free Precession, 1954",
            "Meiboom and Gill, Modified Spin-Echo Method, 1958",
        ],
        workedExample:
            "With delta0 = 0 and a single slow cosine tone over one full period, free evolution accumulates a residual phase. Placing pulses at the midpoints of equal windows makes those windows enter with opposite signs, leaving a phase closer to zero and a coherence closer to one.",
    },
    id: "dynamical-decoupling",
    name: "Dynamical Decoupling (CPMG Train)",
    category: "quantum",
    complexity: { time: "O(P * M * K)", space: "O(P + K)" },
    defaultInput: { delta0: 0.4, amplitude: 1, omega: 6.283185307179586, totalTime: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "define the slow deterministic detuning function",
        "choose the set of CPMG pulse counts",
        "divide the evolution into uniform time slices",
        "integrate twice the detuning times the toggling sign",
        "flip the sign at each scheduled pi pulse",
        "average exp of i phase over the amplitude ensemble",
        "done: report coherence for every pulse count",
    ],
};

export default module;
