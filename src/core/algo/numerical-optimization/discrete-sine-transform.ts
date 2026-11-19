/**
 * discrete-sine-transform.ts - Discrete Sine Transform, Type I
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The type-I discrete sine transform expands a length-N signal in the basis
 * sin(pi (n+1)(k+1)/(N+1)). That basis is orthogonal, so the coefficients are
 * obtained by inner products and the signal is recovered by the same basis
 * scaled by 2/(N+1). It is the transform for problems with homogeneous Dirichlet
 * endpoints, complementing the cosine transform used for Neumann endpoints.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^2) for the direct basis expansion of N coefficients
 *   Space: O(N^2) for the displayed basis grid and O(N) for the coefficients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the sine basis matrix; row k is the basis for coefficient k.
 *   - The row being accumulated is yellow; finished rows are green.
 *   - The final frame reports the coefficients and the inverse-reconstruction error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const DEFAULT_SIGNAL = [1, 2, 3, 4, 3, 2, 1, 0];

/** Basis entry S[k][n] = sin(pi (n+1)(k+1)/(N+1)). */
function basis(n: number): number[][] {
    return Array.from({ length: n }, (_, k) =>
        Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 1) * (k + 1)) / (n + 1))),
    );
}

/** Forward DST-I coefficients by direct basis projection. */
function forward(signal: number[], s: number[][]): number[] {
    return s.map((row) => row.reduce((sum, value, i) => sum + value * (signal[i] ?? 0), 0));
}

/** Inverse DST-I reconstruction. */
function inverse(coefficients: number[], s: number[][]): number[] {
    const n = coefficients.length;
    return Array.from({ length: n }, (_, i) =>
        (2 / (n + 1)) * coefficients.reduce((sum, value, k) => sum + value * (s[k]?.[i] ?? 0), 0),
    );
}

function makeCells(s: number[][], active: number, finished: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let k = 0; k < s.length; k += 1) {
        for (let n = 0; n < (s[k]?.length ?? 0); n += 1) {
            const value = s[k]![n]!;
            const state: EntityState = finished
                ? "sorted"
                : k === active
                    ? "comparing"
                    : k < active
                        ? "sorted"
                        : "idle";
            entities.push({
                id: `cell-${k}-${n}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: k, col: n },
            });
        }
    }
    return entities;
}

/** Discrete sine transform generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { signal?: number[] } | null) ?? {};
    const provided = Array.isArray(task.signal) && task.signal.length >= 2 ? task.signal : DEFAULT_SIGNAL;
    const signal = provided.slice(0, 12).map((v) => (Number.isFinite(v) ? v : 0));
    const n = signal.length;
    const s = basis(n);
    const coefficients = forward(signal, s);
    const reconstructed = inverse(coefficients, s);

    const meta = (step: number, k: number, done: boolean) => ({
        rows: n,
        cols: n,
        n,
        k,
        coefficients: [...coefficients.slice(0, Math.max(0, k + 1))],
        signal: [...signal],
        reconstructed: done ? reconstructed : [],
        reconstructionError: done
            ? Math.sqrt(reconstructed.reduce((sum, v, i) => sum + (v - (signal[i] ?? 0)) ** 2, 0))
            : 0,
        done,
        step,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(s, -1, false),
        edges: [],
        description: `Build the type-I sine basis for a length-${n} signal and project onto each row.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(step, -1, false),
    };
    step += 1;

    for (let k = 0; k < n; k += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(s, k, false),
            edges: [],
            description: `Coefficient ${k}: dot the signal with basis row ${k}; value is ${(coefficients[k] ?? 0).toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(step, k, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(s, -1, true),
        edges: [],
        description: `All ${n} coefficients computed; inverse transform reproduces the signal with error ${meta(step, n - 1, true).reconstructionError.toExponential(2)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: meta(step, n - 1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sine wave that is zero at both endpoints forms an orthogonal basis for a finite signal. Project the signal onto each sine row to get a coefficient, and add the rows back with a fixed scale to rebuild the signal exactly. The cosine transform uses similar waves with a different endpoint behavior, while the sine transform is the natural choice when the boundaries are pinned at zero.",
        invariants: [
            "Distinct sine basis rows have inner product zero, and each row has squared length (N+1)/2.",
            "Every coefficient is the plain inner product of the signal with one basis row.",
            "Applying the same basis with scale 2/(N+1) inverts the transform exactly.",
        ],
        correctness:
            "The discrete sine functions sin(pi(n+1)(k+1)/(N+1)) are orthogonal over n equals 0 through N-1, with squared norm (N+1)/2. Therefore the projection coefficients isolate each component and the scaled inverse sum recovers every sample; orthogonality makes the reconstruction identity hold term by term. Parseval's relation also holds because the transform matrix, after scaling by the square root of 2/(N+1), is orthonormal.",
        complexityRationale:
            "Computing each of the N coefficients multiplies N signal samples by N basis entries, so the direct method costs O(N squared) time and stores the N by N basis grid, O(N squared) space. Fast sine transforms using a real FFT reduce the time to O(N log N) but are not used in this direct teaching implementation.",
        uses: [
            "Solving Poisson and heat equations with zero boundary conditions by spectral methods",
            "Orthogonal signal transforms in image and audio coding",
            "JPEG-like transform stages where a Dirichlet basis is preferred",
        ],
        references: [
            "Rao and Yip, Discrete Cosine and Sine Transforms: Algorithms, Advantages, Applications",
            "Ahmed, Natarajan, and Rao, On Discrete Sine Transforms, 1974",
        ],
        workedExample:
            "For the two-sample signal (1, 0) with N = 2, the basis entries sin(pi/3) and sin(2pi/3) are both about 0.866, so both coefficients are about 0.866. Reconstruction scales by 2 over N+1, which is 2/3: the first sample becomes 2/3 times (0.75 + 0.75) = 1, and the second becomes 2/3 times (0.75 minus 0.75) = 0, recovering the original signal.",
    },
    id: "discrete-sine-transform",
    name: "Discrete Sine Transform (DST-I)",
    category: "numerical-optimization",
    complexity: { time: "O(N^2)", space: "O(N^2)" },
    defaultInput: { signal: DEFAULT_SIGNAL },
    visualType: "grid",
    run,
    pseudocode: [
        "read the length-N input signal",
        "build the sine basis with entry sin of pi times (n+1)(k+1) over (N+1)",
        "for each frequency k take the dot product of signal with basis row k",
        "store that value as coefficient k",
        "reconstruct by summing coefficients times basis scaled by 2 over (N+1)",
        "done: report the coefficients and the reconstruction error",
    ],
};

export default module;
