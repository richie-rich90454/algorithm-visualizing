/**
 * ntt.ts – Number Theoretic Transform
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The NTT is the FFT over a finite field Z_p instead of the complex numbers.
 * It replaces the complex roots of unity with a primitive n-th root of unity
 * modulo p (which exists when p = c·2^k + 1 is a prime with a large power of
 * two). All arithmetic is integer modular arithmetic, which avoids the
 * floating-point error of the complex FFT – essential for exact convolution.
 *
 * This educational version implements the iterative Cooley-Tukey layout with
 * modular arithmetic under a small prime.
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
 *   - The transformed values are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - NTT powers exact polynomial multiplication mod p.
 *   - The modular root-of-unity is the conceptual parallel to the FFT.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A prime with p = c·2^3 + 1, giving roots of unity up to order 8. */
const P = 257;

/** Modular exponentiation. */
function modPow(a: number, e: number, m: number): number {
    let result = 1;
    let base = a % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = (result * base) % m;
        }
        base = (base * base) % m;
        exp = Math.floor(exp / 2);
    }
    return result;
}

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
        label: String(value),
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
 * The NTT generator.
 *
 * @param input `{ values }` – the coefficients (mod P).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [1, 2, 3, 4];

    // Pad to the next power of two (≤ 8 here).
    let n = 1;
    while (n < values.length) {
        n *= 2;
    }
    const a: number[] = [...values];
    while (a.length < n) {
        a.push(0);
    }

    let step = 0;

    // Frame 0: the input coefficients.
    yield {
        stepNumber: step,
        entities: makeBars(a),
        edges: [],
        description: `NTT of ${values.length} coefficients (padded to ${n}) under mod ${P}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;

    // Bit-reversal permutation.
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
            const tmp = a[i];
            a[i] = a[j] ?? 0;
            a[j] = tmp ?? 0;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(a),
        edges: [],
        description: "Applied the bit-reversal permutation.",
        codeLineNumber: 2,
        layout: "array",
        meta: { n },
    };
    step += 1;

    // Butterfly stages with a primitive root of unity.
    // g = 3 is a primitive root mod 257; w_len = g^((p-1)/len).
    const G = 3;

    for (let len = 2; len <= n; len *= 2) {
        const wLen = modPow(G, (P - 1) / len, P);

        for (let i = 0; i < n; i += len) {
            let w = 1;
            for (let j = 0; j < len / 2; j += 1) {
                const u = a[i + j] ?? 0;
                const v = ((a[i + j + len / 2] ?? 0) * w) % P;

                a[i + j] = (u + v) % P;
                a[i + j + len / 2] = (((u - v) % P) + P) % P;

                w = (w * wLen) % P;
            }
        }

        const states = new Map<number, EntityState>();
        for (let i = 0; i < n; i += 1) {
            states.set(i, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(a, states),
            edges: [],
            description: `Butterfly stage of width ${len} complete.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(a),
        edges: [],
        description: "NTT complete – exact integer transform mod 257.",
        codeLineNumber: 4,
        layout: "array",
        meta: { n },
    };
}

/** The NTT module, registered with the engine. */
const module: AlgorithmModule = {
    id: "ntt",
    name: "Number Theoretic Transform",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Same input as the FFT for a direct comparison.
    defaultInput: { values: [1, 2, 3, 4] },
    visualType: "array",
    run,
};

export default module;
