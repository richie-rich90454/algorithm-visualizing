/**
 * bluestein-fft.ts - Bluestein Chirp-Z FFT for Arbitrary Length
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bluestein's algorithm computes a discrete Fourier transform of any length N,
 * even when N is not a power of two. It rewrites the exponent nk using the
 * identity 2nk = n^2 + k^2 - (n-k)^2, which turns the DFT into a convolution of
 * the input with a complex chirp sequence. That convolution is padded to a
 * power of two and evaluated with a radix-2 FFT, then multiplied by a final
 * chirp to obtain the spectrum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(M log M) where M is the next power of two at least 2N-1
 *   Space: O(M) for the padded convolution buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input magnitudes and, finally, the spectrum magnitudes.
 *   - Preprocessing chirps and the padded convolution get their own frames.
 *   - Spectrum bars are GREEN; the tallest bin is highlighted separately.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

function add(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

function multiply(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function chirp(angle: number): Complex {
    return [Math.cos(angle), Math.sin(angle)];
}

function magnitude(v: Complex): number {
    return Math.hypot(v[0], v[1]);
}

function bitReverse(value: number, bits: number): number {
    let result = 0;
    let x = value;
    for (let i = 0; i < bits; i += 1) {
        result = (result << 1) | (x & 1);
        x >>= 1;
    }
    return result;
}

/** Iterative radix-2 Cooley-Tukey FFT used as the convolution engine. */
function fft(input: Complex[], inverse: boolean): Complex[] {
    const n = input.length;
    const bits = Math.log2(n);
    const output = new Array<Complex>(n);
    for (let i = 0; i < n; i += 1) {
        output[bitReverse(i, bits)] = [input[i]![0], input[i]![1]];
    }
    for (let size = 2; size <= n; size *= 2) {
        const angle = ((inverse ? 2 : -2) * Math.PI) / size;
        const step: Complex = [Math.cos(angle), Math.sin(angle)];
        for (let start = 0; start < n; start += size) {
            let w: Complex = [1, 0];
            for (let j = 0; j < size / 2; j += 1) {
                const u = output[start + j]!;
                const v = multiply(output[start + j + size / 2]!, w);
                output[start + j] = add(u, v);
                output[start + j + size / 2] = [u[0] - v[0], u[1] - v[1]];
                w = multiply(w, step);
            }
        }
    }
    if (inverse) {
        for (let i = 0; i < n; i += 1) {
            output[i] = [output[i]![0] / n, output[i]![1] / n];
        }
    }
    return output;
}

function convolve(a: Complex[], b: Complex[]): { result: Complex[]; paddedLength: number } {
    const needed = a.length + b.length - 1;
    let size = 1;
    while (size < needed) size *= 2;
    const fa: Complex[] = Array.from({ length: size }, (_, i) => a[i] ?? [0, 0]);
    const fb: Complex[] = Array.from({ length: size }, (_, i) => b[i] ?? [0, 0]);
    const faFFT = fft(fa, false);
    const fbFFT = fft(fb, false);
    const product = faFFT.map((v, i) => multiply(v, fbFFT[i]!));
    const time = fft(product, true);
    return { result: time.slice(0, needed), paddedLength: size };
}

/** Bluestein transform for a real or complex input signal. */
function bluestein(signal: Complex[]): {
    spectrum: Complex[];
    paddedLength: number;
    chirpedInput: Complex[];
} {
    const n = signal.length;
    const chirpedInput = signal.map((value, index) =>
        multiply(value, chirp((-Math.PI * index * index) / n)),
    );
    const kernel: Complex[] = Array.from({ length: 2 * n - 1 }, (_, j) =>
        chirp((Math.PI * (j - (n - 1)) ** 2) / n),
    );
    const { result, paddedLength } = convolve(chirpedInput, kernel);
    const spectrum = result
        .slice(n - 1, 2 * n - 1)
        .map((value, k) => multiply(value, chirp((-Math.PI * k * k) / n)));
    return { spectrum, paddedLength, chirpedInput };
}

function bars(values: number[], state: EntityState, highlight = -1): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: (index === highlight ? "highlight" : state) as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { signal?: number[]; splitRealImag?: boolean } | null) ?? {};
    const raw = task.signal ?? [1, 1, 1, 1, 0, 0, 0, 0, 0];
    const signal: Complex[] = raw.map((value) => [value, 0]);
    const n = signal.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(signal.map(magnitude), "idle"),
        edges: [],
        description: `Computing a length-${n} DFT with Bluestein's chirp-z convolution, which works for non-power-of-two sizes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step, length: n },
    };
    step += 1;

    const result = bluestein(signal);
    yield {
        stepNumber: step,
        entities: bars(result.chirpedInput.map(magnitude), "comparing"),
        edges: [],
        description: `Multiply the signal by the chirp exp(-i*pi*n^2/N) to form the convolution input.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { step, phase: "chirp" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(signal.map(magnitude), "unvisited"),
        edges: [],
        description: `Build the symmetric chirp kernel and pad the convolution to length ${result.paddedLength}, a power of two.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { step, paddedLength: result.paddedLength, kernelLength: 2 * n - 1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(signal.map(magnitude), "active"),
        edges: [],
        description: `Evaluate the padded convolution with a radix-2 FFT, multiply pointwise, and invert.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { step, phase: "convolution" },
    };
    step += 1;

    const magnitudes = result.spectrum.map(magnitude);
    const peak = magnitudes.indexOf(Math.max(...magnitudes));
    yield {
        stepNumber: step,
        entities: bars(magnitudes, "sorted", peak),
        edges: [],
        description: `Spectrum ready: ${n} bins from the ${result.paddedLength}-point convolution, peak at bin ${peak}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            step,
            real: result.spectrum.map((v) => v[0]),
            imag: result.spectrum.map((v) => v[1]),
            magnitudes,
            peak,
            paddedLength: result.paddedLength,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A convolution in time becomes a multiplication in frequency, and Bluestein exploits that to compute a Fourier transform of any length. The trick is an algebraic identity that turns each exponent n times k into a sum and difference of squares. One chirp multiplies the signal, another forms a kernel, and after a power-of-two convolution a final chirp restores the ordinary Fourier spectrum.",
        invariants: [
            "The identity 2nk = n^2 + k^2 - (n-k)^2 holds for every pair of indices.",
            "The padded convolution length is a power of two at least 2N-1.",
            "Multiplying the convolution output by the final chirp yields the exact DFT bin.",
        ],
        correctness:
            "Substituting the square identity gives X_k = exp(-i*pi*k^2/N) times the sum over n of x_n exp(-i*pi*n^2/N) exp(i*pi*(n-k)^2/N). The inner sum is exactly the convolution of the chirped input with the symmetric chirp kernel evaluated at k, and the convolution theorem makes the radix-2 FFT compute it exactly up to floating-point rounding. The outer chirp then cancels the remaining k-squared factor, giving the standard DFT definition for every bin.",
        complexityRationale:
            "The chirp multiplications are O(N). The convolution is padded to M, the next power of two at least 2N-1, so the radix-2 FFTs cost O(M log M), which dominates; since M is less than 4N the time is O(N log N). All padded complex buffers use O(M) space.",
        uses: [
            "Fourier analysis at prime or otherwise awkward lengths",
            "Convolution and correlation for arbitrary-size signals",
            "Number-theoretic transforms and chirp-z spectral analysis",
        ],
        references: [
            "Bluestein, A Linear Filtering Approach to the Computation of the Discrete Fourier Transform, 1970",
            "Oppenheim and Schafer, Discrete-Time Signal Processing, Chapter 8",
        ],
        workedExample:
            "For a length-five impulse signal 1, 0, 0, 0, 0, the DFT is all ones. Bluestein multiplies the single nonzero sample by chirp(0) = 1, convolves with the nine-term chirp kernel padded to length sixteen, and multiplies bin k by exp(-i*pi*k^2/5); the result is one in every bin, matching the direct transform.",
    },
    id: "bluestein-fft",
    name: "Bluestein FFT",
    category: "math",
    complexity: { time: "O(M log M), M = next power of two >= 2N-1", space: "O(M)" },
    defaultInput: { signal: [1, 1, 1, 1, 0, 0, 0, 0, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "input a signal of arbitrary length N",
        "multiply sample n by exp(-i*pi*n^2/N)",
        "build chirp kernel exp(i*pi*m^2/N) for m from -(N-1) to N-1",
        "pad input and kernel to a power of two at least 2N-1",
        "FFT both, multiply pointwise, and inverse FFT",
        "take the first N convolution samples",
        "multiply bin k by exp(-i*pi*k^2/N)",
        "done: the length-N discrete Fourier spectrum",
    ],
};

export default module;
