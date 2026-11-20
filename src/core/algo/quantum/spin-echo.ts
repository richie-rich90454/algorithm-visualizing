/**
 * spin-echo.ts - Hahn Spin Echo Refocusing of Static Dephasing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An ensemble of spins with slightly different frequencies loses its ensemble
 * coherence because each spin accumulates a different phase. A Hahn echo uses
 * a pi pulse halfway through the evolution to reverse the sign of that
 * accumulated phase. For a purely static frequency offset the second half
 * exactly undoes the first, so the echo at time two tau recovers full
 * coherence while free induction stays decayed.
 *
 * This is an exact small simulation over a fixed ensemble of detunings. It
 * assumes instantaneous pulses, static offsets, and no relaxation, pulse
 * imperfection, or time-dependent noise. Real echo experiments must contend
 * with all of those effects.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k detunings in the ensemble
 *   Space: O(k) for the ensemble phases and coherences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per detuning shows the real part of that spin's coherence.
 *   - Bars are yellow during the refocusing interval.
 *   - The final frame is green and compares free induction with the echo.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface EchoInput {
    tau?: number;
    detunings?: number[];
}

function defaultDetunings(): number[] {
    return [-4, -3, -2, -1, 0, 1, 2, 3, 4];
}

function makeBars(values: number[], phase: string): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `spin ${index}: ${value.toFixed(3)}`,
        value,
        state: phase === "echo" || phase === "done" ? "sorted" : phase === "free" ? "comparing" : "idle",
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, coherence: value },
    }));
}

/** Ensemble coherence from a list of accumulated phases. */
function ensembleCoherence(phases: number[]): { re: number; im: number; magnitude: number } {
    const re = phases.reduce((sum, phase) => sum + Math.cos(phase), 0) / (phases.length || 1);
    const im = phases.reduce((sum, phase) => sum + Math.sin(phase), 0) / (phases.length || 1);
    return { re, im, magnitude: Math.hypot(re, im) };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EchoInput | null) ?? {};
    const tau = Math.max(0.01, Number(task.tau ?? 1));
    const detunings = Array.isArray(task.detunings) && task.detunings.length > 0
        ? task.detunings.slice(0, 16).map((value) => Number(value ?? 0))
        : defaultDetunings();

    // A static offset accumulates phase 2 * delta * t; the pi pulse flips its sign.
    const freePhases = detunings.map((delta) => 4 * delta * tau);
    const echoPhases = detunings.map((delta) => 2 * delta * tau - 2 * delta * tau);
    const free = ensembleCoherence(freePhases);
    const echo = ensembleCoherence(echoPhases);

    const metaBase = {
        tau,
        detunings: [...detunings],
        freeMagnitude: free.magnitude,
        echoMagnitude: echo.magnitude,
    };

    yield {
        stepNumber: 0,
        entities: makeBars(detunings.map(() => 0), "idle"),
        edges: [],
        description: `Preparing ${detunings.length} spins with different static frequency offsets.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, phases: detunings.map(() => 0) },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(freePhases.map((phase) => Math.cos(phase)), "free"),
        edges: [],
        description: `After the first interval tau each spin has accumulated phase 2 delta tau, so free induction decays to ${free.magnitude.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase, phases: [...freePhases], free: [free.re, free.im, free.magnitude] },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(freePhases.map((phase) => Math.cos(phase)), "free"),
        edges: [],
        description: "A pi pulse flips the sign of the detuning, reversing the direction of phase accumulation.",
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, phases: [...freePhases], free: [free.re, free.im, free.magnitude] },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(echoPhases.map((phase) => Math.cos(phase)), "echo"),
        edges: [],
        description: `The second interval cancels the first exactly for every static detuning, restoring coherence to ${echo.magnitude.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...metaBase, phases: [...echoPhases], echo: [echo.re, echo.im, echo.magnitude] },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(echoPhases.map((phase) => Math.cos(phase)), "done"),
        edges: [],
        description: `Hahn echo at time 2 tau recovers ${echo.magnitude.toFixed(4)} of coherence versus ${free.magnitude.toFixed(4)} without refocusing.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...metaBase, phases: [...echoPhases], free: [free.re, free.im, free.magnitude], echo: [echo.re, echo.im, echo.magnitude], exact: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Spins running at slightly different speeds drift out of step, which makes the ensemble signal fade. Flip each spin halfway through, and the faster ones keep going in the opposite direction in the rotating frame. At the echo time they are back in step, so the signal reappears even though each spin never slowed down.",
        invariants: [
            "A static detuning contributes phase 2 delta t to the off-diagonal coherence.",
            "The pi pulse reverses the sign of the accumulated phase rate.",
            "For a static offset the two equal intervals cancel exactly, giving phase zero at the echo.",
        ],
        correctness:
            "Coherence for one spin is the complex exponential of its accumulated phase. With two equal intervals and a sign flip between them the total phase is 2 delta tau minus 2 delta tau, which is zero for every delta, so every spin contributes one and the ensemble average is one. Without the pulse the phase is 4 delta tau and the average is the mean of those exponentials, whose magnitude is below one whenever the detunings differ.",
        complexityRationale:
            "Each of the k ensemble members needs a constant number of arithmetic operations for each of the two intervals, giving O(k) time and O(k) space for the stored phases.",
        uses: [
            "Measuring T2 coherence times in magnetic resonance",
            "Refocusing static inhomogeneity in spin-based qubits",
            "A building block of dynamical decoupling sequences",
        ],
        references: [
            "Hahn, Spin Echoes, Physical Review 80, 1950",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 7",
        ],
        workedExample:
            "With detunings minus two, zero, and plus two, and tau equal to one, free induction averages exp(minus 8i), one, and exp(8i), giving a magnitude near one third. The echo gives phase zero for all three spins, so the ensemble coherence is exactly one.",
    },
    id: "spin-echo",
    name: "Hahn Spin Echo",
    category: "quantum",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { tau: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "define the ensemble of static frequency offsets",
        "let each spin accumulate phase 2 delta tau",
        "apply an instantaneous pi pulse at time tau",
        "let each spin accumulate phase minus 2 delta tau",
        "average the complex coherences over the ensemble",
        "compare echo coherence with free induction",
        "done: report refocused ensemble coherence",
    ],
};

export default module;
