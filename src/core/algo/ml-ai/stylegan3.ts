/**
 * stylegan3.ts - StyleGAN3 Alias-Free Upsampling Core
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * StyleGAN3 removes aliasing from the generator so features stay equivariant
 * to translation and rotation. Its synthesis network upsamples with an ideal
 * low-pass filter in the frequency domain instead of a strided convolution:
 * take the discrete Fourier transform of a feature map, zero every frequency
 * outside a radial cutoff, embed the surviving spectrum in a larger grid,
 * and invert the transform. The result is a bandlimited signal whose shifted
 * version equals the upsampled output shifted by the scale factor.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(M^2 * N^2) for an N-by-N map upsampled to M-by-M (naive DFT)
 *   Space: O(M^2) for the output spectrum and signal
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The input feature map, radial filter mask, and upsampled map are cells.
 *   - Kept frequencies are GREEN; discarded frequencies are IDLE.
 *   - The final frame reports the measured translation-equivariance residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Complex {
    re: number;
    im: number;
}

interface UpsampleResult {
    n: number;
    m: number;
    mask: boolean[][];
    output: number[][];
    kept: number;
}

/** Frequency index i of an even length-n DFT, in [-n/2, n/2). */
function freqOf(index: number, n: number): number {
    return index <= n / 2 ? index : index - n;
}

function zeros(n: number, m: number): number[][] {
    return Array.from({ length: n }, () => Array.from({ length: m }, () => 0));
}

/** Naive two-dimensional discrete Fourier transform of a real signal. */
function dft2(signal: number[][], n: number): Complex[][] {
    const spectrum: Complex[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => ({ re: 0, im: 0 })),
    );
    for (let k1 = 0; k1 < n; k1 += 1) {
        for (let k2 = 0; k2 < n; k2 += 1) {
            const f1 = freqOf(k1, n);
            const f2 = freqOf(k2, n);
            let re = 0;
            let im = 0;
            for (let x1 = 0; x1 < n; x1 += 1) {
                for (let x2 = 0; x2 < n; x2 += 1) {
                    const value = signal[x1]?.[x2] ?? 0;
                    if (value === 0) {
                        continue;
                    }
                    const angle = (-2 * Math.PI * (f1 * x1 + f2 * x2)) / n;
                    re += value * Math.cos(angle);
                    im += value * Math.sin(angle);
                }
            }
            spectrum[k1] = spectrum[k1] ?? [];
            spectrum[k1][k2] = { re, im };
        }
    }
    return spectrum;
}

/** Naive inverse two-dimensional DFT of a full complex spectrum. */
function idft2(spectrum: Complex[][], m: number): number[][] {
    const out = zeros(m, m);
    const scale = 1 / (m * m);
    for (let x1 = 0; x1 < m; x1 += 1) {
        for (let x2 = 0; x2 < m; x2 += 1) {
            let re = 0;
            for (let k1 = 0; k1 < m; k1 += 1) {
                for (let k2 = 0; k2 < m; k2 += 1) {
                    const c = spectrum[k1]?.[k2];
                    if (!c || (c.re === 0 && c.im === 0)) {
                        continue;
                    }
                    const f1 = freqOf(k1, m);
                    const f2 = freqOf(k2, m);
                    const angle = (2 * Math.PI * (f1 * x1 + f2 * x2)) / m;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    re += c.re * cos - c.im * sin;
                }
            }
            out[x1] = out[x1] ?? [];
            out[x1][x2] = re * scale;
        }
    }
    return out;
}

/** Alias-free 2x upsampling through a radial Fourier low-pass filter. */
function upsample(signal: number[][], cutoff: number): UpsampleResult {
    const n = signal.length;
    const m = 2 * n;
    const spectrum = dft2(signal, n);
    const outputSpectrum: Complex[][] = Array.from({ length: m }, () =>
        Array.from({ length: m }, () => ({ re: 0, im: 0 })),
    );
    const mask: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => false),
    );
    const amplitudeScale = (m * m) / (n * n);
    const radius = cutoff * (n / 2);
    let kept = 0;

    for (let k1 = 0; k1 < n; k1 += 1) {
        for (let k2 = 0; k2 < n; k2 += 1) {
            const f1 = freqOf(k1, n);
            const f2 = freqOf(k2, n);
            if (Math.hypot(f1, f2) > radius) {
                continue;
            }
            mask[k1] = mask[k1] ?? [];
            mask[k1][k2] = true;
            kept += 1;
            const c = spectrum[k1]?.[k2];
            if (!c) {
                continue;
            }
            const l1 = f1 >= 0 ? f1 : m + f1;
            const l2 = f2 >= 0 ? f2 : m + f2;
            outputSpectrum[l1] = outputSpectrum[l1] ?? [];
            outputSpectrum[l1][l2] = {
                re: c.re * amplitudeScale,
                im: c.im * amplitudeScale,
            };
        }
    }
    return { n, m, mask, output: idft2(outputSpectrum, m), kept };
}

/** Circularly shift each row of a signal left by one column. */
function shiftRows(signal: number[][], n: number): number[][] {
    return signal.map((row) => {
        const shifted = Array.from({ length: n }, () => 0);
        for (let x = 0; x < n; x += 1) {
            shifted[x] = row[(x - 1 + n) % n] ?? 0;
        }
        return shifted;
    });
}

/** Build a deterministic feature map for the default demo. */
function makeSignal(n: number, mode: "cosine" | "impulse"): number[][] {
    const signal = zeros(n, n);
    if (mode === "impulse") {
        signal[0] = signal[0] ?? [];
        signal[0][0] = 1;
        return signal;
    }
    for (let x1 = 0; x1 < n; x1 += 1) {
        for (let x2 = 0; x2 < n; x2 += 1) {
            signal[x1] = signal[x1] ?? [];
            signal[x1][x2] =
                Math.cos((2 * Math.PI * x1) / n) + 0.5 * Math.cos((2 * Math.PI * x2) / n);
        }
    }
    return signal;
}

function cell(
    id: string,
    label: string,
    row: number,
    col: number,
    state: EntityState,
    metadata: Record<string, number | string | boolean>,
): VisualEntity {
    return {
        id,
        type: "cell",
        label,
        value: label,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col, ...metadata },
    };
}

function gridCells(
    prefix: string,
    values: number[][],
    state: EntityState,
    labeler: (value: number) => string,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < values.length; row += 1) {
        for (let col = 0; col < (values[row]?.length ?? 0); col += 1) {
            const value = values[row]?.[col] ?? 0;
            cells.push(
                cell(`${prefix}-${row}-${col}`, labeler(value), row, col, state, { value }),
            );
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        signal?: number[][];
        size?: number;
        cutoff?: number;
        mode?: "cosine" | "impulse";
    } | null) ?? {};
    const n = Math.max(2, Math.min(16, Math.floor(task.size ?? 8)));
    const provided = Array.isArray(task.signal) && task.signal.length > 0 ? task.signal : null;
    const signal = provided ?? makeSignal(n, task.mode === "impulse" ? "impulse" : "cosine");
    const size = signal.length;
    const cutoff = Math.max(0.05, Math.min(1, task.cutoff ?? 0.5));
    const result = upsample(signal, cutoff);

    yield {
        stepNumber: 0,
        entities: gridCells("in", signal, "idle", (value) => value.toFixed(2)),
        edges: [],
        description: `Input feature map of ${size} by ${size} samples before alias-free upsampling.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: size, cols: size, phase: "input", size },
    };

    yield {
        stepNumber: 1,
        entities: gridCells(
            "mask",
            result.mask.map((row) => row.map((kept) => (kept ? 1 : 0))),
            "sorted",
            (value) => (value === 1 ? "keep" : "zero"),
        ),
        edges: [],
        description: `Radial low-pass mask keeps ${result.kept} frequencies inside the cutoff radius.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {
            rows: size,
            cols: size,
            phase: "mask",
            kept: result.kept,
            cutoff,
            radius: cutoff * (size / 2),
            totalBands: size * size,
        },
    };

    const shifted = shiftRows(signal, size);
    const shiftedResult = upsample(shifted, cutoff);
    let residual = 0;
    for (let row = 0; row < result.m; row += 1) {
        for (let col = 0; col < result.m; col += 1) {
            const upshifted = shiftedResult.output[row]?.[col] ?? 0;
            const expected = result.output[row]?.[(col - 2 + result.m) % result.m] ?? 0;
            residual = Math.max(residual, Math.abs(upshifted - expected));
        }
    }

    yield {
        stepNumber: 2,
        entities: gridCells("out", result.output, "active", (value) => value.toFixed(2)),
        edges: [],
        description: `Upsampled to ${result.m} by ${result.m}; shift equivariance residual is ${residual.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: result.m,
            cols: result.m,
            phase: "result",
            inputSize: size,
            outputSize: result.m,
            kept: result.kept,
            cutoff,
            equivarianceResidual: residual,
            equivariant: residual < 1e-6,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A strided convolution can fold high frequencies back into low ones, so a feature moves differently depending on where it sits in the image. StyleGAN3 instead upsamples by keeping only frequencies inside a radial disk of the Fourier spectrum and inverting the transform. Since a shift in the image is just a phase ramp in frequency space, filtering before shifting gives the same result as filtering after shifting.",
        invariants: [
            "The radial mask is symmetric, so the inverse transform stays real-valued.",
            "Frequencies outside the cutoff are exactly zero in the output spectrum.",
            "Amplitude is scaled by the output-to-input area ratio so the signal does not fade.",
            "For a bandlimited input, shifting by one input sample shifts the output by two samples.",
        ],
        correctness:
            "Let the input have discrete Fourier transform X. Circular shifting the input by one sample multiplies X by a phase factor exp(-2 pi i k / N). The radial mask and the real amplitude scaling commute with that phase factor, so upsampling the shifted signal equals shifting the upsampled signal by two output samples, up to floating-point error. Because every retained frequency lies below the cutoff, no aliasing term is introduced by the resampling.",
        complexityRationale:
            "The naive two-dimensional DFT costs O(N^4) for an N-by-N map and the inverse transform on the M-by-M grid costs O(M^4) with M = 2N; the mask pass is O(N^2). Only the spectra and signals are stored, so space is O(M^2).",
        uses: [
            "Equivariant image synthesis in unconditional GAN generators",
            "Alias-free feature pyramid upsampling in vision models",
            "Teaching ideal bandlimited interpolation and the sampling theorem",
        ],
        references: [
            "Karras et al., Alias-Free Generative Adversarial Networks, NeurIPS 2021",
            "Oppenheim and Schafer, Discrete-Time Signal Processing, chapter on multirate systems",
        ],
        workedExample:
            "An 8-by-8 map holding cos(2 pi x / 8) plus half cos(2 pi y / 8) has energy only at frequency magnitudes 1, below a cutoff radius of 2. Upsampling to 16-by-16 preserves those two pure waves; shifting the input left by one column produces exactly the output shifted left by two columns.",
    },
    id: "stylegan3",
    name: "StyleGAN3 Alias-Free Upsampling",
    category: "ml-ai",
    complexity: { time: "O(M^2 * N^2)", space: "O(M^2)" },
    defaultInput: { size: 8, cutoff: 0.5, mode: "cosine" },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the discrete Fourier transform of the input map",
        "build a radial low-pass mask in frequency space",
        "zero every frequency outside the cutoff radius",
        "embed the surviving bins in a larger zero-padded grid",
        "scale the spectrum by the output-to-input area ratio",
        "apply the inverse transform to obtain the upsampled map",
        "the result is bandlimited and equivariant to spatial shifts",
    ],
};

export default module;
