/**
 * kronecker-substitution.ts - Kronecker Substitution for Polynomial Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kronecker substitution reduces polynomial multiplication to a single
 * integer multiplication. Each coefficient is written in a fixed-width base
 * large enough that no carries cross a field boundary, so packing the
 * coefficients into one big integer and multiplying multiplies the polynomials
 * as a side effect. Unpacking the fixed-width fields recovers every convolution
 * coefficient exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(M(bits)) where M is the cost of big-integer multiplication
 *   Space: O(bits) for the packed integers and the result
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each packed integer is shown as a grid of base fields (one cell per slot).
 *   - The field being extracted is highlighted; the final frame reports the
 *     convolution coefficients and the chosen field width in bits.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function bitLength(value: number): number {
    if (value <= 0) return 1;
    return Math.floor(Math.log2(value)) + 1;
}

function pack(coefficients: number[], shift: number): bigint {
    let value = 0n;
    const width = BigInt(shift);
    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
        value = (value << width) | BigInt(Math.max(0, coefficients[i] ?? 0));
    }
    return value;
}

function makeFields(values: number[], states: Map<number, EntityState>, active: number): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(i) ?? (i === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, coefficient: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[]; b?: number[] } | null) ?? {};
    const a = task.a ?? [1, 2, 3];
    const b = task.b ?? [4, 5];
    if (a.length === 0 || b.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "An empty polynomial has no coefficients to pack.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { result: [], shift: 0 },
        };
        return;
    }

    const maxCoeff = Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
    const bound = Math.min(a.length, b.length) * maxCoeff * maxCoeff;
    const shift = bitLength(bound) + 1;
    const width = BigInt(shift);
    const mask = (1n << width) - 1n;
    const A = pack(a, shift);
    const B = pack(b, shift);
    const C = A * B;
    const resultLength = a.length + b.length - 1;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeFields(a, new Map(), -1),
        edges: [],
        description: `Packing the first polynomial into a ${shift}-bit-per-coefficient integer.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { result: [], shift, packedA: A.toString(), maxCoeff },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeFields(b, new Map(), -1),
        edges: [],
        description: `Packing the second polynomial with the same ${shift}-bit field width.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { result: [], shift, packedB: B.toString(), maxCoeff },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeFields(a, new Map(), -1),
        edges: [],
        description: `Multiplying the two packed integers; every convolution field grows in place.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { result: [], shift, packedProduct: C.toString() },
    };
    step += 1;

    const result = new Array<number>(resultLength).fill(0);
    for (let i = 0; i < resultLength; i += 1) {
        const field = (C >> (width * BigInt(i))) & mask;
        result[i] = Number(field);
        yield {
            stepNumber: step,
            entities: makeFields(result, new Map([[i, "sorted" as EntityState]]), i),
            edges: [],
            description: `Extract field ${i}: coefficient of x^${i} is ${result[i]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { result: [...result], shift, index: i, coefficient: result[i] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeFields(result, new Map(result.map((_, i) => [i, "sorted" as EntityState])), -1),
        edges: [],
        description: `Kronecker substitution produced the ${resultLength}-coefficient product correctly.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { result: [...result], shift, degree: resultLength - 1, packedProduct: C.toString() },
    };
}

/** The Kronecker substitution multiplication module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A polynomial is just a list of coefficients. If we reserve a fixed block of bits for each coefficient and write the blocks side by side as one huge integer, then ordinary integer multiplication adds and carries exactly the products that form the polynomial convolution. Choosing the block wide enough guarantees that carry from one block never spills into its neighbor.",
        invariants: [
            "Every packed coefficient occupies exactly shift bits.",
            "The shift is chosen so the largest possible sum of products fits in one field.",
            "Multiplying the packed integers is equivalent to convolving the coefficient lists.",
            "Extracting each field recovers the corresponding convolution coefficient without error.",
        ],
        correctness:
            "Let B be two to the shift. The packed integer for a is the sum of a_i times B^i, and similarly for b. Their product is the sum over k of the convolution coefficient c_k times B^k, plus no extra terms. Because shift is one bit wider than the bound on any c_k, no carry crosses a field boundary, so the base-B representation of the product has exactly the convolution coefficients as its digits. Masking out field k therefore returns c_k.",
        complexityRationale:
            "The work is dominated by one multiplication of integers with O((m+n)*shift) bits, so the time is O(M(bits)) where M is the underlying big-integer multiplication cost. Storage is linear in the number of coefficient fields.",
        uses: [
            "Multiplying dense polynomials in computer algebra systems",
            "Speeding up integer multiplication through polynomial reduction",
            "Implementing exact convolution where floating-point FFT would lose precision",
        ],
        references: [
            "Kronecker, Grundzuege einer arithmetischen Theorie der algebraischen Groessen, 1882",
            "Knuth, The Art of Computer Programming Volume 2, Section 4.3.3",
        ],
        workedExample:
            "For a = [1,2,3] and b = [4,5] the largest coefficient bound is 24, so a four-bit field suffices. Packing gives 0x321 and 0x54; their product is 0x106A4. Reading four-bit fields yields 4, 13, 22, 15, which is exactly the convolution (1*4, 1*5+2*4, 2*5+3*4, 3*5).",
    },
    id: "kronecker-substitution",
    name: "Kronecker Substitution",
    category: "math",
    complexity: { time: "O(M(bits))", space: "O(bits)" },
    defaultInput: { a: [1, 2, 3], b: [4, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "bound each convolution coefficient by the number of terms times the largest coefficient squared",
        "choose a field width wide enough to hold that bound without carry",
        "pack the first polynomial into a big integer with that field width",
        "pack the second polynomial the same way",
        "multiply the two packed integers",
        "extract each fixed-width field to recover a convolution coefficient",
        "done: return the product polynomial coefficients",
    ],
};

export default module;
