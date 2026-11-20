/**
 * wiener-filter.ts - Wiener Filter (Frequency-Domain MMSE)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a signal observed through additive noise, the Wiener filter chooses a
 * per-frequency gain that minimizes the mean-squared error between the filter
 * output and the clean signal. When the signal and noise spectra are Sxx and
 * Snn, the optimal real gain is H = Sxx / (Sxx + Snn): pass frequencies where
 * signal dominates, attenuate frequencies where noise dominates. The resulting
 * minimum error spectrum is Sxx times Snn over Sxx plus Snn.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(bins) to evaluate one gain per frequency bin
 *   Space: O(bins) for the gain and error spectra
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the Wiener gain at each frequency bin.
 *   - The bin being evaluated is yellow; the final spectrum is green.
 *   - meta carries the gain, output power, and error power spectra.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface WienerInput {
    signalPower?: number[];
    noisePower?: number[];
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = done ? "sorted" : index === active ? "active" : "idle";
        return {
            id: `bin-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, bin: index, gain: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WienerInput | null) ?? {};
    const signalPower: number[] = Array.isArray(task.signalPower) && task.signalPower.length > 0
        ? task.signalPower.map((value) => Math.max(0, Number(value) || 0))
        : [9, 6, 3, 1, 0.5, 0.2, 0.1, 0.05];
    const noisePower: number[] = Array.isArray(task.noisePower) && task.noisePower.length === signalPower.length
        ? task.noisePower.map((value) => Math.max(0, Number(value) || 0))
        : [0.1, 0.2, 0.5, 1, 2, 4, 8, 16];
    const bins = Math.min(signalPower.length, 32);
    const gain: number[] = [];
    const outputPower: number[] = [];
    const errorPower: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(signalPower.slice(0, bins), -1, false),
        edges: [],
        description: `Starting with ${bins} frequency bins; signal and noise spectra are given.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { bins, signalPower: signalPower.slice(0, bins), noisePower: noisePower.slice(0, bins), gain: [], outputPower: [], errorPower: [], done: false },
    };
    step += 1;

    for (let index = 0; index < bins; index += 1) {
        const s = signalPower[index] ?? 0;
        const n = noisePower[index] ?? 0;
        const denominator = s + n;
        const h = denominator > 1e-14 ? s / denominator : 0;
        gain.push(h);
        outputPower.push(h * h * denominator);
        errorPower.push(denominator > 1e-14 ? (s * n) / denominator : 0);
        const paddedGain = [...gain, ...Array.from({ length: bins - gain.length }, () => 0)];
        yield {
            stepNumber: step,
            entities: makeBars(paddedGain, index, false),
            edges: [],
            description: `Bin ${index}: Sxx ${s.toFixed(3)}, Snn ${n.toFixed(3)}, gain H = Sxx / (Sxx + Snn) = ${h.toFixed(4)}.`,
            codeLineNumber: s < n ? 4 : 3,
            layout: "array",
            meta: {
                bins,
                signalPower: signalPower.slice(0, bins),
                noisePower: noisePower.slice(0, bins),
                gain: [...gain],
                outputPower: [...outputPower],
                errorPower: [...errorPower],
                done: false,
                bin: index,
            },
        };
        step += 1;
    }

    const totalError = errorPower.reduce((sum, value) => sum + value, 0);
    yield {
        stepNumber: step,
        entities: makeBars(gain, -1, true),
        edges: [],
        description: `Wiener gains computed for all ${bins} bins; total minimum mean-squared error is ${totalError.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            bins,
            signalPower: signalPower.slice(0, bins),
            noisePower: noisePower.slice(0, bins),
            gain,
            outputPower,
            errorPower,
            totalError,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Noise corrupts some frequencies more than others. The Wiener filter looks at each frequency independently and asks what fraction of the observed power is real signal. If a band is mostly signal it passes it almost unchanged; if it is mostly noise it attenuates it. That per-band gain is the one that minimizes average squared error.",
        invariants: [
            "Every gain lies between zero and one because signal and noise power are nonnegative.",
            "A bin with zero signal gets gain zero; a bin with zero noise gets gain one.",
            "The reported error spectrum equals signal power minus the gain times signal power.",
        ],
        correctness:
            "For each frequency, minimizing the mean-squared error of a linear gain h gives h = Sxx / (Sxx + Snn) by differentiating the quadratic error with respect to h and setting it to zero. Substituting this gain back gives the minimum error Sxx*Snn/(Sxx+Snn). Because the frequencies are independent for a stationary additive-noise model, choosing each gain separately is globally optimal.",
        complexityRationale:
            "The algorithm evaluates a constant-time formula once for each of the bins frequency bins, so it is O(bins) time. Storing the gain, output, and error spectra is O(bins) space.",
        uses: [
            "Speech enhancement and audio denoising",
            "Image restoration when the blur and noise spectra are known",
            "Baseline signal-estimation stage in communication receivers",
        ],
        references: [
            "Wiener, Extrapolation, Interpolation, and Smoothing of Stationary Time Series, 1949",
            "Oppenheim and Schafer, Discrete-Time Signal Processing, 3rd edition, chapter on Wiener filtering",
        ],
        workedExample:
            "At a bin with signal power 9 and noise power 1, the gain is 9 over 10, or 0.9, so most of the band passes. At a bin with signal power 0.1 and noise power 8, the gain is 0.1 over 8.1, about 0.012, so the band is almost removed. The first bin contributes 9 times 1 over 10 to the minimum error.",
    },
    id: "wiener-filter",
    name: "Wiener Filter",
    category: "numerical-optimization",
    complexity: { time: "O(bins)", space: "O(bins)" },
    defaultInput: {
        signalPower: [9, 6, 3, 1, 0.5, 0.2, 0.1, 0.05],
        noisePower: [0.1, 0.2, 0.5, 1, 2, 4, 8, 16],
    },
    visualType: "array",
    run,
    pseudocode: [
        "for each frequency bin read the signal and noise power",
        "form the denominator as signal power plus noise power",
        "set the gain to signal power divided by the denominator",
        "pass high signal bins with a gain near one",
        "attenuate high noise bins with a gain near zero",
        "record the output and minimum error power for the bin",
        "done: report all gains and the total minimum error",
    ],
};

export default module;
