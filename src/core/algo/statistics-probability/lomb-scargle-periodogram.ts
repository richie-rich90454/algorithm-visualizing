/**
 * lomb-scargle-periodogram.ts - Lomb-Scargle Periodogram
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Lomb-Scargle periodogram finds dominant frequencies in a signal sampled
 * at uneven times, where a plain Fourier transform does not apply. For each
 * angular frequency omega it fits a cosine and sine plus a constant by least
 * squares. The time offset tau makes the cosine and sine basis orthogonal even
 * with irregular samples, so the power reduces to two simple ratios. The
 * frequency with the largest power is the estimated cycle frequency.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(frequencyCount * n)
 *   Space: O(frequencyCount + n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per trial frequency shows the spectral power.
 *   - The bar being evaluated is yellow; the finished spectrum is green.
 *   - The final frame reports the peak frequency and its power.
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
        metadata: { index, power: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { times?: number[]; values?: number[]; frequencyCount?: number; fMax?: number } | null) ?? {};
    let times: number[] = Array.isArray(task.times) ? task.times.filter((value) => Number.isFinite(value)) : [];
    let values: number[] = Array.isArray(task.values) ? task.values.filter((value) => Number.isFinite(value)) : [];
    if (times.length < 3 || times.length !== values.length) {
        times = Array.from({ length: 60 }, (_, i) => (20 * (i + 0.3 * Math.sin(i * 1.7))) / 60);
        values = times.map((time) => Math.sin(2 * Math.PI * 0.3 * time) + 0.2 * Math.cos(2 * Math.PI * 0.07 * time));
    }
    const count = typeof task.frequencyCount === "number" ? Math.max(10, Math.min(1000, Math.floor(task.frequencyCount))) : 300;
    const fMax = typeof task.fMax === "number" && task.fMax > 0 ? task.fMax : 0.8;
    const n = times.length;
    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    const centered = values.map((value) => value - mean);
    const variance = centered.reduce((sum, value) => sum + value * value, 0) / n || 1;

    const frequencies = Array.from({ length: count }, (_, index) => (fMax * (index + 1)) / count);
    const power: number[] = [];
    let peakPower = -1;
    let peakFrequency = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(count).fill(0), -1, false),
        edges: [],
        description: `Scanning ${count} frequency bin(s) over ${n} unevenly sampled observation(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, frequencyCount: count, fMax, frequencies, power: [], peakFrequency: 0, peakPower: 0, signalMean: mean, signalVariance: variance, complete: false },
    };
    let step = 1;

    for (const frequency of frequencies) {
        const omega = 2 * Math.PI * frequency;
        let twoOmegaSin = 0;
        let twoOmegaCos = 0;
        for (const time of times) {
            twoOmegaSin += Math.sin(2 * omega * time);
            twoOmegaCos += Math.cos(2 * omega * time);
        }
        const tau = Math.atan2(twoOmegaSin, twoOmegaCos) / (2 * omega);
        let yc = 0;
        let ys = 0;
        let cc = 0;
        let ss = 0;
        for (let i = 0; i < n; i += 1) {
            const angle = omega * ((times[i] as number) - tau);
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            const y = centered[i] as number;
            yc += y * c;
            ys += y * s;
            cc += c * c;
            ss += s * s;
        }
        const value = 0.5 * (cc > 1e-12 ? (yc * yc) / cc : 0) + (ss > 1e-12 ? (ys * ys) / ss : 0);
        const spectralPower = value / variance;
        power.push(spectralPower);
        if (spectralPower > peakPower) {
            peakPower = spectralPower;
            peakFrequency = frequency;
        }
        yield {
            stepNumber: step,
            entities: makeBars([...power, ...new Array<number>(count - power.length).fill(0)], power.length - 1, false),
            edges: [],
            description: `At f = ${frequency.toFixed(4)}: spectral power ${spectralPower.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, frequencyCount: count, fMax, frequencies, power: [...power], peakFrequency, peakPower, signalMean: mean, signalVariance: variance, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(power, count, true),
        edges: [],
        description: `Periodogram complete: peak frequency ${peakFrequency.toFixed(4)} with power ${peakPower.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, frequencyCount: count, fMax, frequencies, power, peakFrequency, peakPower, signalMean: mean, signalVariance: variance, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A periodogram asks which sinusoidal frequency best explains the data. With evenly spaced samples a Fourier transform answers this directly, but uneven samples need a least-squares fit at each trial frequency. Lomb and Scargle showed that choosing a frequency-dependent time offset makes the sine and cosine terms independent, so each trial needs only a few sums instead of a full matrix solve.",
        invariants: [
            "Spectral power is nonnegative and finite at every trial frequency.",
            "The reported peak frequency is the frequency with the largest power.",
            "The fitted constant removes the sample mean before power is computed.",
        ],
        correctness:
            "At a fixed omega the least-squares fit of y = a cos(omega(t-tau)) + b sin(omega(t-tau)) + c has coefficient sums that collapse to a = sum(Y cos)/sum(cos^2) and b = sum(Y sin)/sum(sin^2) when tau satisfies tan(2 omega tau) = sum(sin 2 omega t)/sum(cos 2 omega t). The explained sum of squares is then half of a squared numerator over its denominator plus the analogous sine term. Dividing by the variance of Y gives the normalized Lomb-Scargle power, and the maximum over frequencies is the standard periodogram peak.",
        complexityRationale:
            "Each trial frequency makes two passes over the n samples, one for the offset and one for the power sums, so the scan costs O(frequencyCount times n). Storing the frequency and power arrays uses O(frequencyCount plus n) space.",
        uses: [
            "Detecting periodic signals in uneven astronomical observations",
            "Analyzing irregularly sampled physiological time series",
            "Finding dominant cycles in climate and economic records",
        ],
        references: [
            "Lomb, Least-Squares Frequency Analysis of Unequally Spaced Data, 1976",
            "Scargle, Studies in Astronomical Time Series Analysis II, 1982",
            "Press et al., Numerical Recipes, Section 13.8",
        ],
        workedExample:
            "Sampling a sine wave of frequency 0.3 cycles per unit at irregular times and scanning frequencies from 0 to 0.8 produces a sharp power peak near 0.3. A pure constant series has zero variance in the signal and therefore no meaningful peak, which the implementation handles by guarding the variance divisor.",
    },
    id: "lomb-scargle-periodogram",
    name: "Lomb-Scargle Periodogram",
    category: "statistics-probability",
    complexity: { time: "O(frequencyCount * n)", space: "O(frequencyCount + n)" },
    defaultInput: { frequencyCount: 300, fMax: 0.8 },
    visualType: "array",
    run,
    pseudocode: [
        "read observation times and values, or build a deterministic uneven sample",
        "center the values and compute their variance",
        "build a grid of trial frequencies up to the maximum",
        "for each frequency compute the offset tau from doubled-angle sums",
        "sum mean-centered values against cosine and sine at shifted times",
        "set power to half of the cosine and sine ratios divided by variance",
        "done: report the spectrum and the frequency with the largest power",
    ],
};

export default module;
