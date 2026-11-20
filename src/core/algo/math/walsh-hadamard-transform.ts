/**
 * walsh-hadamard-transform.ts - Fast Walsh-Hadamard Transform
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Walsh-Hadamard transform multiplies a vector by the Hadamard matrix,
 * whose entry at (i, j) is (-1) raised to the number of set bits in i AND j.
 * The fast version is a sequence of butterfly stages: pairs (u, v) become
 * (u+v, u-v). It is its own inverse up to a factor of n, and it turns XOR
 * convolution into pointwise multiplication. Unlike the subset zeta transform,
 * this is the character transform of the group (Z_2)^n.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the working vector after each butterfly stage.
 *   - meta carries the stage width and the transform length.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nextPowerOfTwo(length: number): number {
    let n = 1;
    while (n < length) n *= 2;
    return n;
}

/** In-place-style fast Walsh-Hadamard transform (returns a new array). */
export function walshHadamard(values: number[]): number[] {
    const n = nextPowerOfTwo(values.length);
    const a = new Array<number>(n).fill(0);
    for (let i = 0; i < values.length; i += 1) a[i] = values[i] ?? 0;
    for (let len = 1; len < n; len *= 2) {
        for (let i = 0; i < n; i += 2 * len) {
            for (let j = 0; j < len; j += 1) {
                const u = a[i + j] ?? 0;
                const v = a[i + j + len] ?? 0;
                a[i + j] = u + v;
                a[i + j + len] = u - v;
            }
        }
    }
    return a;
}

/** XOR convolution: c[k] = sum of a[i]*b[j] with i XOR j = k. */
export function xorConvolution(a: number[], b: number[]): number[] {
    const n = nextPowerOfTwo(Math.max(a.length, b.length));
    const fa = walshHadamard(a);
    const fb = walshHadamard(b);
    const product = fa.map((value, i) => value * (fb[i] ?? 0));
    return walshHadamard(product).map((value) => {
        const quotient = value / n;
        return quotient === 0 ? 0 : quotient;
    });
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === active ? "active" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; valuesB?: number[] } | null) ?? {};
    const values = task.values ?? [1, 2, 3, 4];
    const second = task.valuesB ?? [5, 6, 7, 8];
    const n = nextPowerOfTwo(Math.max(values.length, second.length));
    const a = new Array<number>(n).fill(0);
    const b = new Array<number>(n).fill(0);
    for (let i = 0; i < values.length; i += 1) a[i] = values[i] ?? 0;
    for (let i = 0; i < second.length; i += 1) b[i] = second[i] ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(a, -1),
        edges: [],
        description: `Walsh-Hadamard transform of a length-${n} vector.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;

    for (let len = 1; len < n; len *= 2) {
        for (let i = 0; i < n; i += 2 * len) {
            for (let j = 0; j < len; j += 1) {
                const u = a[i + j] ?? 0;
                const v = a[i + j + len] ?? 0;
                a[i + j] = u + v;
                a[i + j + len] = u - v;
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(a, len),
            edges: [],
            description: `Butterfly stage of width ${len}: pairs combined as (u+v, u-v).`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, len },
        };
        step += 1;
    }

    const fb = walshHadamard(b);
    const product = a.map((value, i) => value * (fb[i] ?? 0));
    yield {
        stepNumber: step,
        entities: makeBars(product, -1),
        edges: [],
        description: "Pointwise product of the two transformed vectors.",
        codeLineNumber: 2,
        layout: "array",
        meta: { n },
    };
    step += 1;

    const restored = [...product];
    for (let len = 1; len < n; len *= 2) {
        for (let i = 0; i < n; i += 2 * len) {
            for (let j = 0; j < len; j += 1) {
                const u = restored[i + j] ?? 0;
                const v = restored[i + j + len] ?? 0;
                restored[i + j] = u + v;
                restored[i + j + len] = u - v;
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(restored, len),
            edges: [],
            description: `Inverse butterfly stage of width ${len}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, len },
        };
        step += 1;
    }

    const result = restored.map((value) => value / n);
    yield {
        stepNumber: step,
        entities: makeBars(result, -1),
        edges: [],
        description: "Done: the vector holds the XOR convolution of the two inputs.",
        codeLineNumber: 4,
        layout: "array",
        meta: { n, result },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Hadamard matrix uses only plus and minus ones, so multiplying by it can be done with additions and subtractions alone. Each stage pairs entries that differ in one bit and replaces them with their sum and difference. After log n stages the vector is transformed; applying the same stages again and dividing by n returns to the start, and multiplying two transformed vectors before reversing gives XOR convolution.",
        invariants: [
            "Each butterfly touches a disjoint pair for the bit currently being processed.",
            "Applying the transform twice scales every entry by the vector length.",
            "The transform of an XOR convolution is the product of the transforms.",
        ],
        correctness:
            "The Hadamard matrix factors into n/2 independent two-by-two blocks at each bit, and the butterfly is exactly multiplication by one factor; composing all factors yields the full matrix product. Since each factor squared is the identity up to a factor of two, the whole transform is an involution up to n. The convolution identity holds because the XOR character of a product is the product of characters, making the transform a homomorphism from XOR convolution to pointwise multiplication.",
        complexityRationale:
            "There are log n stages and each performs n/2 butterflies with constant work, so time is O(n log n); the single working vector uses O(n) space.",
        uses: [
            "Fast XOR convolution on bitmask arrays",
            "Signal processing with Walsh functions",
            "Error-correcting codes and fast Hadamard transforms in decoding",
        ],
        references: [
            "Hadamard, Sur les matrices dont les termes sont des fonctions sinusoidales, 1893",
            "R. K. Yarlagadda and J. E. Hershey, Hadamard Matrix Analysis and Synthesis, 1997",
        ],
        workedExample:
            "For [1, 2] the first stage gives [3, -1]. Transforming [5, 6] gives [11, -1]. Multiplying gives [33, 1]; transforming again gives [34, 32] and dividing by two gives [17, 16], which is the XOR convolution of the two vectors.",
    },
    id: "walsh-hadamard-transform",
    name: "Walsh-Hadamard Transform",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4], valuesB: [5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "pad both vectors to a power-of-two length n",
        "for each stage width len doubling from one",
        "replace each pair (u, v) with (u+v, u-v)",
        "multiply the two transformed vectors pointwise",
        "apply the same butterfly stages to the product",
        "divide by n and report the XOR convolution",
    ],
};

export default module;
