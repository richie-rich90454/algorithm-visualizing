/**
 * coppersmith-winograd-multiplication.ts - FFT Polynomial Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Coppersmith-Winograd approach multiplies two degree-d polynomials in
 * O(d log d) operations by evaluating both at the complex roots of unity with
 * a fast Fourier transform, multiplying pointwise, and interpolating with the
 * inverse transform. Integer coefficients are recovered by rounding.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for n the next power of two above the output degree
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the magnitude of each frequency bin after each stage.
 *   - The final frame reports the rounded coefficients in meta.result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

function makeCells(values: number[], labels: string[], active = -1): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: labels[i] ?? String(value),
        value,
        state: (i === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

/** In-place iterative radix-2 FFT. inverse = false for forward. */
function fft(re: number[], im: number[], inverse: boolean): void {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i += 1) {
        let bit = n >> 1;
        while (j & bit) {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j]!, re[i]!];
            [im[i], im[j]] = [im[j]!, im[i]!];
        }
    }
    for (let len = 2; len <= n; len *= 2) {
        const angle = ((inverse ? 2 : -2) * Math.PI) / len;
        const wLen: Complex = [Math.cos(angle), Math.sin(angle)];
        for (let i = 0; i < n; i += len) {
            let w: Complex = [1, 0];
            for (let k = 0; k < len / 2; k += 1) {
                const ur = re[i + k]!;
                const ui = im[i + k]!;
                const vr = re[i + k + len / 2]! * w[0] - im[i + k + len / 2]! * w[1];
                const vi = re[i + k + len / 2]! * w[1] + im[i + k + len / 2]! * w[0];
                re[i + k] = ur + vr;
                im[i + k] = ui + vi;
                re[i + k + len / 2] = ur - vr;
                im[i + k + len / 2] = ui - vi;
                w = [w[0] * wLen[0] - w[1] * wLen[1], w[0] * wLen[1] + w[1] * wLen[0]];
            }
        }
    }
    if (inverse) {
        for (let i = 0; i < n; i += 1) {
            re[i] = re[i]! / n;
            im[i] = im[i]! / n;
        }
    }
}

function magnitudes(re: number[], im: number[]): number[] {
    return re.map((v, i) => Math.round(Math.hypot(v, im[i]!) * 1000) / 1000);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[]; b?: number[] } | null) ?? {};
    const a: number[] = task.a ?? [1, 2, 3];
    const b: number[] = task.b ?? [4, 5, 6];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(
            [...a, ...b],
            [...a.map((v) => `a=${v}`), ...b.map((v) => `b=${v}`)],
        ),
        edges: [],
        description: `Multiplying two polynomials of lengths ${a.length} and ${b.length} with an FFT.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, lenA: a.length, lenB: b.length },
    };
    step += 1;

    if (a.length === 0 || b.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([0], ["0"]),
            edges: [],
            description: "An empty factor gives the zero polynomial.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { step, result: [] },
        };
        return;
    }

    let n = 1;
    while (n < a.length + b.length - 1) n *= 2;
    const reA = Array(n).fill(0);
    const imA = Array(n).fill(0);
    const reB = Array(n).fill(0);
    const imB = Array(n).fill(0);
    for (let i = 0; i < a.length; i += 1) reA[i] = a[i]!;
    for (let i = 0; i < b.length; i += 1) reB[i] = b[i]!;

    fft(reA, imA, false);
    fft(reB, imB, false);
    yield {
        stepNumber: step,
        entities: makeCells(magnitudes(reA, imA), reA.map((_, i) => `A(w^${i})`), 0),
        edges: [],
        description: `Forward FFT of A completed at ${n} roots of unity.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { step, n },
    };
    step += 1;

    const reProd = Array(n).fill(0);
    const imProd = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        reProd[i] = reA[i]! * reB[i]! - imA[i]! * imB[i]!;
        imProd[i] = reA[i]! * imB[i]! + imA[i]! * reB[i]!;
    }
    yield {
        stepNumber: step,
        entities: makeCells(magnitudes(reProd, imProd), reProd.map((_, i) => `P(w^${i})`), 0),
        edges: [],
        description: "Pointwise product of the two spectra computed.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { step, n },
    };
    step += 1;

    fft(reProd, imProd, true);
    const result: number[] = [];
    for (let i = 0; i < a.length + b.length - 1; i += 1) {
        const coeff = Math.round(reProd[i]!);
        result.push(coeff === 0 ? 0 : coeff);
    }

    yield {
        stepNumber: step,
        entities: makeCells(result, result.map((v, i) => `c${i}=${v}`), 0),
        edges: [],
        description: `Product coefficients: [${result.join(", ")}].`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { step, result, n },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A polynomial is determined by its values at enough distinct points, and the roots of unity are points where those values can be computed very quickly. The fast Fourier transform evaluates both input polynomials at all n roots of unity in O(n log n) time, multiplication becomes a single pointwise product, and the inverse transform recovers the coefficient representation of the product.",
        invariants: [
            "The transform length n is a power of two at least the product degree plus one.",
            "The forward and inverse transforms use opposite rotation signs and the inverse divides by n.",
            "Each butterfly combines two bins without changing the represented polynomial.",
        ],
        correctness:
            "The DFT maps coefficient vectors to evaluations at the n-th roots of unity, and the convolution theorem says the DFT of a convolution equals the pointwise product of the DFTs. Because n exceeds the product degree, no aliasing occurs, so the inverse DFT returns the exact convolution coefficients. Rounding removes only floating-point error, recovering the integer answer.",
        complexityRationale:
            "Each FFT level touches every one of n bins once and there are log n levels, so each transform is O(n log n) and the whole product is O(n log n) time. The two spectra and working arrays use O(n) space.",
        uses: [
            "Fast large-integer and polynomial multiplication",
            "Convolution in signal processing and image filtering",
            "The core of subquadratic algebraic algorithms such as Schoenhage-Strassen",
        ],
        references: [
            "Cooley and Tukey, An Algorithm for the Machine Calculation of Complex Fourier Series, 1965",
            "Coppersmith and Winograd, Matrix multiplication via arithmetic progressions, 1990",
        ],
        workedExample:
            "Multiplying 1 + 2x + 3x^2 by 4 + 5x + 6x^2 needs 5 output coefficients, so n = 8. After both forward FFTs, pointwise multiplication, and the inverse FFT, rounding gives 4, 13, 28, 27, 18, which is the ordinary product 4 + 13x + 28x^2 + 27x^3 + 18x^4.",
    },
    id: "coppersmith-winograd-multiplication",
    name: "Coppersmith-Winograd Multiplication",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { a: [1, 2, 3], b: [4, 5, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "input coefficient arrays a and b",
        "choose power-of-two transform length n",
        "zero-pad a and b to length n",
        "compute the forward FFT of each array",
        "multiply the two spectra pointwise",
        "compute the inverse FFT of the product",
        "round the first deg(a)+deg(b)+1 coefficients",
        "done: the product polynomial coefficients",
    ],
};

export default module;
