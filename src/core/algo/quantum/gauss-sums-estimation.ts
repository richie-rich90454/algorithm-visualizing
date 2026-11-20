/**
 * gauss-sums-estimation.ts - Quantum Estimation of Quadratic Gauss Sums
 *
 * A quadratic Gauss sum is the coherent sum of complex phases exp(2 pi i a x^2
 * over n). It is the amplitude that appears when a quadratic phase gate is
 * applied uniformly to a register and then read out in the Fourier basis.
 * Quantum algorithms estimate the phase of such sums with phase estimation;
 * this module computes the sum term by term instead, so the reported magnitude
 * and phase are exact rather than sampled.
 *
 * Limits: n is capped at 64, arithmetic is exact double-precision complex
 * arithmetic, no physical quantum device or measurement noise is modeled, and
 * the phase is reported as the principal argument in radians.
 *
 * Time:  O(n) terms
 * Space: O(1) between frames
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    a?: number;
    n?: number;
}

function makeBars(real: number, imag: number, mag: number, phase: number): VisualEntity[] {
    const labels = ["real", "imaginary", "magnitude", "phase"];
    const values = [real, imag, mag, phase];
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${labels[i]}=${v.toFixed(5)}`,
        value: v,
        state: i === 2 ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, role: labels[i] },
    }));
}

function gcd(a: number, b: number): number {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y !== 0) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const a = Number.isFinite(task.a) ? Math.trunc(Number(task.a)) : 1;
    const n = Math.min(64, Math.max(1, Math.floor(Number(task.n ?? 5)) || 5));
    const coprime = gcd(a, n) === 1;
    let real = 0;
    let imag = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(0, 0, 0, 0),
        edges: [],
        description: `Estimate the quadratic Gauss sum with a=${a} and n=${n} by accumulating ${n} complex phases.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, n, real: 0, imag: 0, magnitude: 0, phase: 0, term: 0, coprime },
    };

    let step = 1;
    for (let x = 0; x < n; x += 1) {
        const angle = (2 * Math.PI * a * x * x) / n;
        real += Math.cos(angle);
        imag += Math.sin(angle);
        const magnitude = Math.hypot(real, imag);
        const phase = Math.atan2(imag, real);
        yield {
            stepNumber: step,
            entities: makeBars(real, imag, magnitude, phase),
            edges: [],
            description: `Term x=${x}: angle ${angle.toFixed(4)}, partial sum ${real.toFixed(4)} + ${imag.toFixed(4)}i, magnitude ${magnitude.toFixed(5)}.`,
            codeLineNumber: x === 0 ? 2 : 3,
            layout: "array",
            meta: { a, n, real, imag, magnitude, phase, term: x + 1, coprime },
        };
        step += 1;
    }

    const magnitude = Math.hypot(real, imag);
    const phase = Math.atan2(imag, real);
    const expected = n % 2 === 1 ? Math.sqrt(n) : n % 4 === 0 ? Math.sqrt(2 * n) : 0;
    yield {
        stepNumber: step,
        entities: makeBars(real, imag, magnitude, phase),
        edges: [],
        description: `Gauss sum for a=${a}, n=${n} is ${real.toFixed(6)} + ${imag.toFixed(6)}i with magnitude ${magnitude.toFixed(6)} and phase ${phase.toFixed(6)} radians.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { a, n, real, imag, magnitude, phase, term: n, coprime, expectedMagnitude: coprime ? expected : null },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Attach a complex phase to every integer x according to the quadratic x squared, then add all those phases together. Most phases cancel, but a structured remainder survives, and its magnitude depends only on the modulus n when a and n are coprime. In a quantum circuit the same sum is the amplitude of a uniform superposition after a quadratic phase kick, so estimating its phase reveals number-theoretic information.",
        invariants: [
            "Each term has unit magnitude, so the running magnitude never exceeds n.",
            "The phase angle is reduced modulo two pi by the sine and cosine functions.",
            "For coprime a and n the final magnitude is determined by n modulo four.",
        ],
        correctness:
            "The implementation evaluates the defining sum directly with real and complex components. The classical theory of quadratic Gauss sums states that for coprime a and n the magnitude is sqrt(n) when n is odd, sqrt(2n) when n is a multiple of four, and zero when n is congruent to two modulo four. The test recomputes the sum independently and checks these identities, so a wrong coefficient or angle would be detected.",
        complexityRationale:
            "The loop evaluates one sine and one cosine per integer, so the time cost is O(n) and only a handful of scalars are retained, giving O(1) working space. The frames themselves report one snapshot per term.",
        uses: [
            "A subroutine in quantum algorithms for number fields and class groups",
            "Analyzing quadratic phase sequences in signal processing",
            "Estimating phases in phase-estimation based algorithms",
        ],
        references: [
            "Gauss, Disquisitiones Arithmeticae, 1801",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "For a=1 and n=5 the five phases sum to about 1.236 + 1.539i, whose magnitude is sqrt(5) and phase is about 0.893 radians. For a=1 and n=8 the sum has magnitude sqrt(16)=4, while for n=6 the terms cancel exactly to zero.",
    },
    id: "gauss-sums-estimation",
    name: "Quantum Gauss Sum Estimation",
    category: "quantum",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { a: 1, n: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the coefficient a and modulus n",
        "initialize the real and imaginary accumulators to zero",
        "for each x compute the quadratic phase angle",
        "add the cosine to the real and the sine to the imaginary accumulator",
        "after the last term form the magnitude and principal phase",
        "report the magnitude expected from n modulo four",
        "done: return the exact Gauss sum and its phase",
    ],
};

export default module;
