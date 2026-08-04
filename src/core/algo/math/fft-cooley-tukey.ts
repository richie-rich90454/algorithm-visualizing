/**
 * fft-cooley-tukey.ts – Fast Fourier Transform (Cooley-Tukey, iterative)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The FFT evaluates a polynomial at the complex roots of unity in O(n log n),
 * versus O(n²) for naive evaluation. Cooley-Tukey splits the polynomial into
 * even- and odd-indexed halves, recurses on each, and combines with twiddle
 * factors. The iterative implementation uses a bit-reversal permutation first,
 * then log n "butterfly" stages.
 *
 * This educational version works over real numbers with a complex-number
 * stand-in (pairs of reals) so the transform is visible without a full
 * complex-number library.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The input coefficients are shown as bars.
 *   - Each butterfly stage is narrated.
 *   - The final transformed values are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The divide-and-conquer on parity is the heart to teach.
 *   - FFT powers convolution, polynomial multiplication, and more.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a set of bar entities for an array of values.
 *
 * @param values The values to show.
 * @param states Optional index → state overrides.
 * @returns Bar entities.
 */
function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(1),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The FFT (Cooley-Tukey) generator.
 *
 * @param input `{ values }` – the polynomial coefficients.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [1, 2, 3, 4];

    // Pad to the next power of two.
    let n = 1;
    while (n < values.length) {
        n *= 2;
    }
    const real: number[] = [...values];
    const imag: number[] = new Array(n).fill(0);
    while (real.length < n) {
        real.push(0);
    }

    let step = 0;

    // Frame 0: the input coefficients.
    yield {
        stepNumber: step,
        entities: makeBars(real.slice(0, n)),
        edges: [],
        description: `FFT of the ${values.length} coefficients (padded to ${n}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Bit-reversal permutation.
    // ------------------------------------------------------------------
    const reverseBits = (x: number, bits: number): number => {
        let result = 0;
        for (let i = 0; i < bits; i += 1) {
            result = (result << 1) | (x & 1);
            x >>= 1;
        }
        return result;
    };
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i += 1) {
        const j = reverseBits(i, bits);
        if (j > i) {
            const tmpR = real[i];
            real[i] = real[j] ?? 0;
            real[j] = tmpR ?? 0;
            const tmpI = imag[i];
            imag[i] = imag[j] ?? 0;
            imag[j] = tmpI ?? 0;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(real),
        edges: [],
        description: "Applied the bit-reversal permutation.",
        codeLineNumber: 2,
        layout: "array",
        meta: { n },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Butterfly stages.
    // ------------------------------------------------------------------
    for (let len = 2; len <= n; len *= 2) {
        const angle = (-2 * Math.PI) / len;
        for (let i = 0; i < n; i += len) {
            for (let j = 0; j < len / 2; j += 1) {
                const wAngle = angle * j;
                const wR = Math.cos(wAngle);
                const wI = Math.sin(wAngle);

                const uR = real[i + j] ?? 0;
                const uI = imag[i + j] ?? 0;
                const vR = (real[i + j + len / 2] ?? 0) * wR - (imag[i + j + len / 2] ?? 0) * wI;
                const vI = (real[i + j + len / 2] ?? 0) * wI + (imag[i + j + len / 2] ?? 0) * wR;

                real[i + j] = uR + vR;
                imag[i + j] = uI + vI;
                real[i + j + len / 2] = uR - vR;
                imag[i + j + len / 2] = uI - vI;
            }
        }

        const states = new Map<number, EntityState>();
        for (let i = 0; i < n; i += 1) {
            states.set(i, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(real, states),
            edges: [],
            description: `Butterfly stage of width ${len} complete.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n },
        };
        step += 1;
    }

    // Show the magnitude of each frequency component.
    const magnitudes = real.map((r, i) => Math.hypot(r, imag[i] ?? 0));

    yield {
        stepNumber: step,
        entities: makeBars(magnitudes),
        edges: [],
        description: "FFT complete – frequency magnitudes (from the real/imag parts).",
        codeLineNumber: 4,
        layout: "array",
        meta: { n },
    };
}

/** The FFT (Cooley-Tukey) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "fft-cooley-tukey",
    name: "FFT (Cooley-Tukey)",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Four coefficients pad to a neat size-4 transform.
    defaultInput: { values: [1, 2, 3, 4] },
    visualType: "array",
    run,
};

export default module;
