/**
 * split-radix-fft.ts - Split-Radix Fast Fourier Transform
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The split-radix FFT decomposes a length-N transform into one even-indexed
 * transform of length N/2 and two odd-indexed transforms of length N/4. This
 * mixes radix-2 and radix-4 butterflies and uses fewer multiplications than a
 * pure radix-2 Cooley-Tukey FFT, while keeping the same O(n log n) behavior.
 *
 * The simulation is exact small arithmetic on complex number pairs; it is
 * limited to power-of-two lengths up to 64 and reports ideal spectra with no
 * floating-point rounding model beyond ordinary double precision.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
 *   Space: O(n log n) across recursion levels, O(n) per level
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input samples and the resulting magnitude spectrum.
 *   - Intermediate frames expose the even and odd sub-transforms.
 *   - The final frame highlights the computed spectrum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface FftInput {
    values?: number[];
}

const MAX_N = 64;

/** Complex multiplication. */
function cmul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

/** Root of unity exp(-2*pi*i*k/N). */
function twiddle(k: number, n: number): Complex {
    const angle = (-2 * Math.PI * k) / n;
    return [Math.cos(angle), Math.sin(angle)];
}

/** Real power-of-two length, at least 2 and at most MAX_N. */
function normalizeLength(length: number): number {
    let n = 2;
    while (n < length) n *= 2;
    return Math.min(MAX_N, n);
}

/** Split-radix DFT for a power-of-two length. */
function srfft(x: Complex[]): Complex[] {
    const n = x.length;
    if (n === 1) return [[x[0]![0], x[0]![1]]];
    if (n === 2) {
        return [
            [x[0]![0] + x[1]![0], x[0]![1] + x[1]![1]],
            [x[0]![0] - x[1]![0], x[0]![1] - x[1]![1]],
        ];
    }
    const m = Math.floor(n / 4);
    const even: Complex[] = [];
    const odd1: Complex[] = [];
    const odd3: Complex[] = [];
    for (let i = 0; i < 2 * m; i += 1) {
        even.push(x[2 * i]!);
    }
    for (let i = 0; i < m; i += 1) {
        odd1.push(x[4 * i + 1]!);
        odd3.push(x[4 * i + 3]!);
    }
    const e = srfft(even);
    const o1 = srfft(odd1);
    const o3 = srfft(odd3);
    const out: Complex[] = new Array(n);
    for (let k = 0; k < n; k += 1) {
        const ek = e[k % (2 * m)]!;
        const ok1 = o1[k % m]!;
        const ok3 = o3[k % m]!;
        const t1 = cmul(twiddle(k, n), ok1);
        const t3 = cmul(twiddle(3 * k, n), ok3);
        out[k] = [ek[0] + t1[0] + t3[0], ek[1] + t1[1] + t3[1]];
    }
    return out;
}

/** Bars for a real-valued display. */
function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Flatten complex pairs into a meta-compatible real array. */
function flatComplex(amps: Complex[]): number[] {
    return amps.flatMap((z) => [z[0], z[1]]);
}

/** The split-radix FFT generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FftInput | null) ?? {};
    const raw = Array.isArray(task.values) && task.values.length > 0 ? task.values : [1, 2, 3, 4];
    const n = normalizeLength(raw.length);
    const x: Complex[] = Array.from({ length: n }, (_, i) => [Number(raw[i] ?? 0), 0]);

    const evenSamples: number[] = [];
    const odd1Samples: number[] = [];
    const odd3Samples: number[] = [];
    const m = Math.max(1, Math.floor(n / 4));
    for (let i = 0; i < m; i += 1) {
        if (n > 2) {
            odd1Samples.push(x[4 * i + 1]![0]);
            odd3Samples.push(x[4 * i + 3]![0]);
        }
    }
    if (n > 2) {
        for (let i = 0; i < n / 2; i += 1) evenSamples.push(x[2 * i]![0]);
    }

    const evenTransform = srfft(x.filter((_, i) => i % 2 === 0).map((z) => [...z] as Complex));
    const spectrum = srfft(x);
    const magnitudes = spectrum.map((z) => Math.hypot(z[0], z[1]));
    const energies = magnitudes.map((v) => v * v);
    const displayEven = evenSamples.length > 0 ? evenSamples : raw.slice(0, n);
    const displayOdd = odd1Samples.length > 0 ? [...odd1Samples, ...odd3Samples] : raw.slice(0, n);

    const metaBase = {
        n,
        real: spectrum.map((z) => z[0]),
        imag: spectrum.map((z) => z[1]),
        flatSpectrum: flatComplex(spectrum),
        magnitudes,
        energy: energies.reduce((sum, v) => sum + v, 0),
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(raw.slice(0, n)),
        edges: [],
        description: `Loaded ${Math.min(raw.length, n)} real samples; split-radix transform of length ${n}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, phase: "input" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(displayEven),
        edges: [],
        description: `The even-indexed subsequence has length ${n / 2}; its transform supplies every other output bin.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase, phase: "even", evenTransform: flatComplex(evenTransform), odd1: odd1Samples, odd3: odd3Samples },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(displayOdd),
        edges: [],
        description: `The odd samples split into two length-${m} subsequences, one for indices 1 mod 4 and one for 3 mod 4.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, phase: "odd", odd1: odd1Samples, odd3: odd3Samples },
    };
    step += 1;

    const active = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) active.set(i, "comparing");
    yield {
        stepNumber: step,
        entities: makeBars(magnitudes, active),
        edges: [],
        description: `Twiddle factors recombine the even and odd transforms into the ${n} frequency bins.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...metaBase, phase: "combine" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(magnitudes),
        edges: [],
        description: `Spectrum complete: ${n} magnitude bins, total energy ${metaBase.energy.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...metaBase, phase: "done" },
    };
}

/** The split-radix FFT module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A fast Fourier transform splits a signal into smaller transforms and recombines them. Split-radix uses two kinds of split at once: an even half of length N/2 and two quarter-length odd pieces. The three results are stitched together with twiddle factors, which saves multiplications compared with splitting purely in half at every level.",
        invariants: [
            "The transform length is a power of two, so each recursion divides evenly.",
            "The even and odd subsequences together contain every input sample exactly once.",
            "Parseval's identity holds: the sum of squared magnitudes equals N times the sum of squared input samples.",
        ],
        correctness:
            "Separating the DFT sum by index parity gives the N/2-point transform of the even samples. Separating the odd samples by index modulo four gives two N/4-point transforms whose outputs appear with twiddle factors W^k and W^{3k}. Recombining E[k mod N/2] with those two terms reconstructs the original DFT definition term by term, so the output equals the naive transform exactly (up to floating-point rounding).",
        complexityRationale:
            "Each level splits one transform into one half-size and two quarter-size transforms, so T(n) = T(n/2) + 2T(n/4) + O(n), giving O(n log n). The recursive arrays occupy O(n log n) total allocations, with O(n) live at any one level.",
        uses: [
            "Spectral analysis with a lower multiplication count than radix-2",
            "Fast convolution and polynomial multiplication",
            "Digital signal processing libraries and FFTW-style kernels",
        ],
        references: [
            "Duhamel and Vetterli, Fast Fourier Transforms: A Tutorial Review and a State of the Art, 1990",
            "Oppenheim and Schafer, Discrete-Time Signal Processing, Chapter 8",
        ],
        workedExample:
            "For N equals four, the even subsequence (x0, x2) has a two-point transform and the odd subsequences are the single samples x1 and x3. The output bins are E0 plus W^0 x1 plus W^0 x3, E1 plus W^1 x1 plus W^3 x3, E0 minus those odd terms, and E1 with the odd terms scaled by i and minus i.",
    },
    id: "split-radix-fft",
    name: "Split-Radix FFT",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n log n)" },
    defaultInput: { values: [1, 2, 3, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "pad the samples to a power-of-two length n",
        "if n is one or two, return the direct transform",
        "split the even samples into a transform of length n/2",
        "split odd samples into two transforms of length n/4",
        "multiply the odd results by the twiddle factors",
        "combine even and odd terms into the output bins",
        "done: report the magnitude spectrum",
    ],
};

export default module;
