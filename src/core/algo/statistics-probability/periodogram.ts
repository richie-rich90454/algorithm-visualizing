/**
 * periodogram.ts - Periodogram Spectral Estimate
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A periodogram estimates how the variance of a signal is distributed across
 * frequencies. It computes the discrete Fourier coefficient at each frequency
 * and squares its magnitude, normalized by the sample size. For a real-valued
 * signal the resulting spectrum is symmetric, so only frequencies up to the
 * Nyquist limit are displayed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * maxFrequency) for the direct Fourier sums
 *   Space: O(maxFrequency) for the power spectrum
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per frequency shows its estimated power.
 *   - The frequency currently being evaluated is highlighted.
 *   - The final frame reports the dominant frequency and total power.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, frequency: index, power: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { signal?: number[]; maxFrequency?: number } | null) ?? {};
    const signal = task.signal ?? Array.from({ length: 32 }, (_, t) => Math.cos((2 * Math.PI * 5 * t) / 32));
    const n = signal.length;
    const limit = Math.floor(n / 2);
    const maxFrequency = typeof task.maxFrequency === "number" ? Math.max(1, Math.min(limit, Math.floor(task.maxFrequency))) : limit;
    const frequencies = Array.from({ length: maxFrequency + 1 }, (_, k) => k / n);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(maxFrequency + 1).fill(0), -1, false),
        edges: [],
        description: `Estimating the periodogram of ${n} samples over ${maxFrequency + 1} frequencies.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, maxFrequency, frequencies, power: [], dominant: 0, totalPower: 0, complete: false },
    };
    let step = 1;
    const power: number[] = [];
    for (let k = 0; k <= maxFrequency; k += 1) {
        let re = 0;
        let im = 0;
        for (let t = 0; t < n; t += 1) {
            const angle = (-2 * Math.PI * k * t) / n;
            const value = signal[t] as number;
            re += value * Math.cos(angle);
            im += value * Math.sin(angle);
        }
        const value = (re * re + im * im) / n;
        power.push(value);
        yield {
            stepNumber: step,
            entities: makeBars([...power, ...new Array<number>(maxFrequency - k).fill(0)], k, false),
            edges: [],
            description: `Frequency ${k}/${n}: periodogram power ${value.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, maxFrequency, frequencies, power: [...power], dominant: 0, totalPower: 0, complete: false },
        };
        step += 1;
    }

    let dominant = 0;
    for (let k = 1; k < power.length; k += 1) {
        if ((power[k] as number) > (power[dominant] as number)) dominant = k;
    }
    const totalPower = signal.reduce((a, value) => a + value * value, 0);
    yield {
        stepNumber: step,
        entities: makeBars(power, maxFrequency + 1, true),
        edges: [],
        description: `Periodogram complete: dominant frequency bin ${dominant}, signal power ${totalPower.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, maxFrequency, frequencies, power, dominant, totalPower, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A periodogram answers which rhythms are present in a signal by projecting the data onto sine and cosine waves at a range of frequencies. The squared length of each projection is the power at that frequency. Large peaks reveal periodic components, and the values across all frequencies add up to the total energy in the signal.",
        invariants: [
            "Every power value is nonnegative because it is a squared magnitude.",
            "For a real signal the spectrum is symmetric about zero frequency.",
            "The sum of power over all Fourier bins equals the sum of squared observations.",
        ],
        correctness:
            "The discrete Fourier coefficient at bin k is the sum over t of x_t times exp of minus 2 pi i k t over n. Squaring its magnitude and dividing by n gives the periodogram. Parseval's theorem states that the sum of these values over all n bins equals the total squared magnitude of the signal; for real data the bins pair up symmetrically, so doubling the one-sided sum and adding the endpoints recovers the same total.",
        complexityRationale:
            "Each frequency requires a full pass over the n samples with a sine and cosine evaluation, so the direct transform costs O(n times maxFrequency) time. Only the displayed spectrum is stored, giving O(maxFrequency) space.",
        uses: [
            "Finding dominant cycles in sensor and astronomical time series",
            "Checking for periodic structure in residuals",
            "Introducing spectral analysis before the fast Fourier transform",
        ],
        references: [
            "Priestley, Spectral Analysis and Time Series, Chapter 4",
            "Oppenheim and Schafer, Discrete-Time Signal Processing, Chapter 8",
        ],
        workedExample:
            "For a cosine of frequency 5 cycles per 32 samples, the periodogram has a sharp peak at bin 5 with power near 16, while other bins are nearly zero. The total power aggregated over all bins equals the sum of the squared cosine samples, about 16 for 32 samples.",
    },
    id: "periodogram",
    name: "Periodogram Spectral Estimate",
    category: "statistics-probability",
    complexity: { time: "O(n * maxFrequency)", space: "O(maxFrequency)" },
    defaultInput: { signal: Array.from({ length: 32 }, (_, t) => Math.cos((2 * Math.PI * 5 * t) / 32)) },
    visualType: "array",
    run,
    pseudocode: [
        "read the real-valued signal and the number of samples n",
        "for each frequency bin k from zero to the Nyquist limit",
        "accumulate real and imaginary Fourier sums over all samples",
        "set the power to the squared magnitude divided by n",
        "record the bin with the largest power",
        "set the total power to the sum of squared samples",
        "done: report the one-sided periodogram and the dominant frequency",
    ],
};

export default module;
