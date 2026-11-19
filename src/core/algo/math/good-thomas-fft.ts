/**
 * good-thomas-fft.ts - Good-Thomas FFT (Prime Factor Algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When the transform length N factors as N = n1*n2 with n1 and n2 coprime,
 * the Good-Thomas algorithm reindexes the input by the Chinese Remainder
 * Theorem so that the discrete Fourier transform separates into a set of
 * n1-point transforms followed by a set of n2-point transforms. Unlike
 * Cooley-Tukey, no twiddle factors are needed: the CRT index map absorbs them.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n1^2 + n2^2) with a naive inner DFT, O(N log N) with an FFT inner
 *   Space: O(N) for the transposed array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per stage shows the current complex values as magnitudes.
 *   - The active stage is highlighted; the final frame shows output magnitudes.
 *   - The meta field carries the full complex spectrum as re:im pairs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type C = [number, number];

function cAdd(a: C, b: C): C {
    return [a[0] + b[0], a[1] + b[1]];
}
function cScale(a: C, k: number): C {
    return [a[0] * k, a[1] * k];
}
function cis(theta: number): C {
    return [Math.cos(theta), Math.sin(theta)];
}
function cMul(a: C, b: C): C {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}
function mag(a: C): number {
    return Math.hypot(a[0], a[1]);
}

function egcd(a: number, b: number): { g: number; x: number; y: number } {
    if (b === 0) return { g: a, x: 1, y: 0 };
    const r = egcd(b, a % b);
    return { g: r.g, x: r.y, y: r.x - Math.trunc(a / b) * r.y };
}
function invMod(a: number, m: number): number {
    const { x } = egcd(((a % m) + m) % m, m);
    return ((x % m) + m) % m;
}

/** Naive DFT of a complex sequence; sign -1 is forward, +1 is inverse (unnormalized). */
function dft(values: C[], sign: number): C[] {
    const n = values.length;
    const out: C[] = [];
    for (let k = 0; k < n; k += 1) {
        let re = 0;
        let im = 0;
        for (let i = 0; i < n; i += 1) {
            const w = cis((sign * 2 * Math.PI * k * i) / n);
            re += values[i]![0] * w[0] - values[i]![1] * w[1];
            im += values[i]![0] * w[1] + values[i]![1] * w[0];
        }
        out.push([re, im]);
    }
    return out;
}

function stageTransform(series: C[], size: number, step: number): C[] {
    const out = new Array<C>(size).fill([0, 0]);
    for (let k = 0; k < size; k += 1) {
        let acc: C = [0, 0];
        for (let a = 0; a < size; a += 1) {
            const w = cis((-2 * Math.PI * k * a * step) / size);
            acc = cAdd(acc, cMul(series[a]!, w));
        }
        out[k] = acc;
    }
    return out;
}

function makeCells(values: C[], active: boolean): VisualEntity[] {
    return values.map((v, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: mag(v).toFixed(2),
        value: Math.round(mag(v) * 100) / 100,
        state: (active ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, magnitude: mag(v), real: v[0], imaginary: v[1] },
    }));
}

function encodeSpectrum(values: C[]): string {
    return values.map((v) => `${v[0].toFixed(6)}:${v[1].toFixed(6)}`).join(";");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; n1?: number; n2?: number } | null) ?? {};
    const values = task.values ?? [1, 2, 3, 4, 5, 6];
    const n1 = task.n1 ?? 2;
    const n2 = task.n2 ?? 3;
    const N = values.length;
    let step = 0;

    if (n1 * n2 !== N || Math.abs(n1 * n2 - N) > 0 || N === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Transform length must equal n1 times n2 for the Good-Thomas algorithm.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { length: N, n1, n2, valid: false },
        };
        return;
    }

    const invN2 = invMod(n2 % n1, n1);
    const invN1 = invMod(n1 % n2, n2);
    const A = (n2 * invN2) % N;
    const B = (n1 * invN1) % N;
    const grid: C[][] = Array.from({ length: n1 }, () => new Array<C>(n2).fill([0, 0]));
    for (let n = 0; n < N; n += 1) {
        const a = n % n1;
        const b = n % n2;
        grid[a]![b] = [values[n] ?? 0, 0];
    }

    yield {
        stepNumber: step,
        entities: makeCells(values.map((v): C => [v, 0]), true),
        edges: [],
        description: `Loading ${N} samples into a ${n1} by ${n2} CRT-indexed array.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { length: N, n1, n2, invN2, invN1, stage: 0 },
    };
    step += 1;

    const stage1: C[][] = Array.from({ length: n1 }, () => new Array<C>(n2).fill([0, 0]));
    for (let b = 0; b < n2; b += 1) {
        const series = grid.map((row) => row[b]!);
        const transformed = stageTransform(series, n1, invN2);
        for (let c = 0; c < n1; c += 1) stage1[c]![b] = transformed[c]!;
    }
    yield {
        stepNumber: step,
        entities: makeCells(stage1.flat(), true),
        edges: [],
        description: `First stage: ${n2} transforms of length ${n1} along the CRT first coordinate.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { length: N, n1, n2, stage: 1, stage1: encodeSpectrum(stage1.flat()) },
    };
    step += 1;

    const stage2: C[][] = Array.from({ length: n1 }, () => new Array<C>(n2).fill([0, 0]));
    for (let c = 0; c < n1; c += 1) {
        const transformed = stageTransform(stage1[c]!, n2, invN1);
        for (let d = 0; d < n2; d += 1) stage2[c]![d] = transformed[d]!;
    }
    const spectrum = new Array<C>(N).fill([0, 0]);
    for (let c = 0; c < n1; c += 1) {
        for (let d = 0; d < n2; d += 1) {
            const k = (c * A + d * B) % N;
            spectrum[k] = stage2[c]![d]!;
        }
    }
    const reference = dft(values.map((v): C => [v, 0]), -1);
    const maxError = spectrum.reduce((err, v, i) => {
        const expected = reference[i]!;
        return Math.max(err, mag(cAdd(v, cScale(expected, -1))));
    }, 0);

    yield {
        stepNumber: step,
        entities: makeCells(spectrum, false),
        edges: [],
        description: `Good-Thomas transform complete; ${N} spectrum values computed without twiddle factors.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            length: N,
            n1,
            n2,
            stage: 2,
            spectrum: encodeSpectrum(spectrum),
            maxError: Math.round(maxError * 1e9) / 1e9,
            matchesNaiveDft: maxError < 1e-6,
        },
    };
}

/** The Good-Thomas prime-factor FFT module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Cooley-Tukey FFT needs twiddle factors because its two factors are not independent. Good-Thomas picks lengths that share no common factor, then uses the Chinese Remainder Theorem to relabel each input index by a pair of coordinates. In these coordinates the Fourier kernel splits into a product of a small transform in the first coordinate and a small transform in the second, so the twiddle factors disappear entirely.",
        invariants: [
            "The CRT map n to (n mod n1, n mod n2) is a bijection because n1 and n2 are coprime.",
            "A* is congruent to one modulo n1 and zero modulo n2, and B is the reverse.",
            "The exponent n*k reduces to a*c*A plus b*d*B modulo N.",
            "The kernel therefore factors into a grevlex-free product of two smaller roots of unity.",
        ],
        correctness:
            "Write each index with the CRT coefficients A and B. Because A squared is congruent to A modulo N, B squared to B, and A times B to zero modulo N, the product n*k modulo N collapses to a*c*A + b*d*B. The complex exponential of a sum is the product of exponentials, so the full DFT is exactly the nested pair of smaller DFTs. Reindexing the outputs with the same CRT map shows the algorithm returns the standard DFT in the original order.",
        complexityRationale:
            "A naive implementation performs two small direct DFTs per row and column, costing O(n1^2 + n2^2). Replacing each inner stage with an ordinary FFT gives the textbook O(N log N) bound, all without the extra multiplications that Cooley-Tukey spends on twiddle factors.",
        uses: [
            "Fast convolution and polynomial multiplication when the length factors into coprime parts",
            "Digital signal processing pipelines with fixed transform sizes such as six or fifteen",
            "Teaching the connection between the Fourier transform and the Chinese Remainder Theorem",
        ],
        references: [
            "Good, The Interaction Algorithm and Practical Fourier Analysis, 1958",
            "Thomas, A Version of the Fast Fourier Transform for Machine Computation, 1963",
        ],
        workedExample:
            "For N=6 with n1=2 and n2=3, the constants are A=3 and B=4. Sample n=5 has coordinates a=1 and b=2. A length-two transform along a and a length-three transform along b are combined, then output k = (3c + 4d) mod 6 places each spectrum value in its original slot. The result matches a direct six-point DFT exactly.",
    },
    id: "good-thomas-fft",
    name: "Good-Thomas FFT",
    category: "math",
    complexity: { time: "O(n1^2 + n2^2)", space: "O(N)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6], n1: 2, n2: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "let N equal n1 times n2 with n1 and n2 coprime",
        "compute A and B by the Chinese Remainder Theorem constants",
        "place each sample n at coordinates n modulo n1 and n modulo n2",
        "for each column run a length n1 DFT along the first coordinate",
        "for each row run a length n2 DFT along the second coordinate",
        "read output k from coordinates c and d using k equals c A plus d B modulo N",
        "done: return the complex spectrum",
    ],
};

export default module;
