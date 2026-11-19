/**
 * strassen-matrix-multiplication.ts - Strassen's Fast Matrix Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Strassen's algorithm multiplies two matrices by splitting each into four
 * blocks and forming seven products instead of the eight a direct block
 * multiplication would need. The saved multiplication is traded for extra
 * additions, reducing the exponent from 3 to about 2.807.
 *
 * This teaching version recurses down to one-by-one blocks and pads the input
 * to a power of two. Matrices are limited to 8 by 8 so every intermediate
 * value stays exactly representable as a JavaScript number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^log2(7)) ≈ O(n^2.807)
 *   Space: O(n^2) for the blocks at each recursion level
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The result matrix is drawn as a grid of cells.
 *   - Seven intermediate products are reported, then each output quadrant.
 *   - The final frame shows the completed product matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface StrassenInput {
    a?: Matrix;
    b?: Matrix;
}

const MAX_SIZE = 8;

/** Return the next power of two at least n, capped at MAX_SIZE. */
function paddedSize(n: number): number {
    let size = 2;
    while (size < n) size *= 2;
    return Math.min(MAX_SIZE, size);
}

/** Build a size by size zero matrix. */
function zeros(size: number): Matrix {
    return Array.from({ length: size }, () => new Array<number>(size).fill(0));
}

/** Add two matrices. */
function add(a: Matrix, b: Matrix): Matrix {
    return a.map((row, i) => row.map((value, j) => value + (b[i]?.[j] ?? 0)));
}

/** Subtract matrix b from matrix a. */
function sub(a: Matrix, b: Matrix): Matrix {
    return a.map((row, i) => row.map((value, j) => value - (b[i]?.[j] ?? 0)));
}

/** Split a matrix into four equal blocks. */
function split(m: Matrix): [Matrix, Matrix, Matrix, Matrix] {
    const h = Math.floor(m.length / 2);
    const block = (r0: number, c0: number): Matrix =>
        Array.from({ length: h }, (_, i) => m[r0 + i]!.slice(c0, c0 + h));
    return [block(0, 0), block(0, h), block(h, 0), block(h, h)];
}

/** Join four blocks into one matrix. */
function join(a11: Matrix, a12: Matrix, a21: Matrix, a22: Matrix): Matrix {
    const h = a11.length;
    const n = 2 * h;
    const out = zeros(n);
    for (let i = 0; i < h; i += 1) {
        for (let j = 0; j < h; j += 1) {
            out[i]![j] = a11[i]![j]!;
            out[i]![j + h] = a12[i]![j]!;
            out[i + h]![j] = a21[i]![j]!;
            out[i + h]![j + h] = a22[i]![j]!;
        }
    }
    return out;
}

/** Compute the seven Strassen products of two block matrices. */
function products(a: Matrix, b: Matrix): number[] {
    const [a11, a12, a21, a22] = split(a);
    const [b11, b12, b21, b22] = split(b);
    const m1 = multiply(add(a11!, a22!), add(b11!, b22!));
    const m2 = multiply(add(a21!, a22!), b11!);
    const m3 = multiply(a11!, sub(b12!, b22!));
    const m4 = multiply(a22!, sub(b21!, b11!));
    const m5 = multiply(add(a11!, a12!), b22!);
    const m6 = multiply(sub(a21!, a11!), add(b11!, b12!));
    const m7 = multiply(sub(a12!, a22!), add(b21!, b22!));
    return [m1[0]![0]!, m2[0]![0]!, m3[0]![0]!, m4[0]![0]!, m5[0]![0]!, m6[0]![0]!, m7[0]![0]!];
}

/** Recursive Strassen multiplication for square power-of-two matrices. */
function multiply(a: Matrix, b: Matrix): Matrix {
    const n = a.length;
    if (n === 1) return [[a[0]![0]! * b[0]![0]!]];
    const [a11, a12, a21, a22] = split(a);
    const [b11, b12, b21, b22] = split(b);
    const m1 = multiply(add(a11!, a22!), add(b11!, b22!));
    const m2 = multiply(add(a21!, a22!), b11!);
    const m3 = multiply(a11!, sub(b12!, b22!));
    const m4 = multiply(a22!, sub(b21!, b11!));
    const m5 = multiply(add(a11!, a12!), b22!);
    const m6 = multiply(sub(a21!, a11!), add(b11!, b12!));
    const m7 = multiply(sub(a12!, a22!), add(b21!, b22!));
    return join(
        add(sub(add(m1, m4), m5), m7),
        add(m3, m5),
        add(m2, m4),
        add(sub(add(m1, m3), m2), m6),
    );
}

/** Grid cells for a square matrix. */
function makeCells(m: Matrix, states: Map<string, EntityState> = new Map()): VisualEntity[] {
    const n = m.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const id = `c-${i}-${j}`;
            entities.push({
                id,
                type: "cell",
                label: String(m[i]![j]!),
                value: m[i]![j]!,
                state: states.get(id) ?? "idle",
                x: j,
                y: i,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

/** Flatten a matrix for the meta field (which allows only flat arrays). */
function flat(m: Matrix): number[] {
    return m.flat();
}

/** The Strassen multiplication generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as StrassenInput | null) ?? {};
    const rawA = Array.isArray(task.a) ? task.a : [[1, 2], [3, 4]];
    const rawB = Array.isArray(task.b) ? task.b : [[5, 6], [7, 8]];
    let maxDim = Math.max(rawA.length, rawB.length);
    for (const row of [...rawA, ...rawB]) maxDim = Math.max(maxDim, row?.length ?? 0);
    const original = Math.min(maxDim, MAX_SIZE);
    const size = paddedSize(original);

    const a = zeros(size);
    const b = zeros(size);
    for (let i = 0; i < original; i += 1) {
        for (let j = 0; j < original; j += 1) {
            a[i]![j] = Number(rawA[i]?.[j] ?? 0);
            b[i]![j] = Number(rawB[i]?.[j] ?? 0);
        }
    }

    const result = multiply(a, b);
    const seven = products(a, b);
    const quadrants = [
        { name: "C11", rows: [0, size / 2], cols: [0, size / 2] },
        { name: "C12", rows: [0, size / 2], cols: [size / 2, size] },
        { name: "C21", rows: [size / 2, size], cols: [0, size / 2] },
        { name: "C22", rows: [size / 2, size], cols: [size / 2, size] },
    ];

    const metaBase = {
        n: size,
        original,
        padded: size !== original,
        flatA: flat(a),
        flatB: flat(b),
        flatC: flat(result),
        products: seven,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(a),
        edges: [],
        description: `Loaded the first ${original} by ${original} matrix; padding to ${size} by ${size} for recursion.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, phase: "load-a" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(b),
        edges: [],
        description: `Loaded the second matrix. Strassen will use seven block products at every level.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...metaBase, phase: "load-b" },
    };
    step += 1;

    const prodStates = new Map<string, EntityState>();
    for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) prodStates.set(`c-${i}-${j}`, "comparing");
    }
    yield {
        stepNumber: step,
        entities: makeCells(zeros(size), prodStates),
        edges: [],
        description: `Computed the seven top-level products M1 through M7 = ${seven.join(", ")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...metaBase, phase: "products" },
    };
    step += 1;

    for (let q = 0; q < quadrants.length; q += 1) {
        const quadrant = quadrants[q]!;
        const states = new Map<string, EntityState>();
        for (let i = quadrant.rows[0]!; i < quadrant.rows[1]!; i += 1) {
            for (let j = quadrant.cols[0]!; j < quadrant.cols[1]!; j += 1) {
                states.set(`c-${i}-${j}`, "active");
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(result, states),
            edges: [],
            description: `Assembled output quadrant ${quadrant.name} from the seven products.`,
            codeLineNumber: 3 + q,
            layout: "grid",
            meta: { ...metaBase, phase: "combine", quadrant: quadrant.name },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result),
        edges: [],
        description: `Product complete: the ${size} by ${size} result matrix is shown with all ${seven.length} products combined.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...metaBase, phase: "done" },
    };
}

/** The Strassen multiplication module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Divide each matrix into four blocks. A direct block multiplication needs eight block products, but Strassen combines the blocks into seven cleverly chosen sums and differences whose products can be added back into the answer. One fewer multiplication at every level of recursion compounds into a better asymptotic exponent.",
        invariants: [
            "Every recursive call multiplies two square matrices of the same size.",
            "The seven products are combined so that the final blocks equal the ordinary dot-product result.",
            "Padding with zeros does not change the product of the original matrices.",
        ],
        correctness:
            "For two by two blocks the seven products are linear combinations of the entries of A and B. Expanding C11 = M1 + M4 - M5 + M7 and the other three quadrants cancels the extra terms and leaves exactly the sums a11 b11 + a12 b21 and so on, which are the entries of AB. Because the identity holds symbolically for any block values, recursion applies it at every level until one-by-one blocks, so the result is the ordinary matrix product.",
        complexityRationale:
            "Each level performs seven recursive multiplications of half-sized matrices plus a constant number of block additions, giving T(n) = 7T(n/2) + O(n^2) and therefore O(n^log2 7), about O(n^2.807). Storing the blocks along one recursion path uses O(n^2) space.",
        uses: [
            "Accelerating dense linear algebra kernels",
            "A building block for faster Gaussian elimination and inversion",
            "A canonical example of divide-and-conquer beating the obvious exponent",
        ],
        references: [
            "Strassen, Gaussian Elimination is not Optimal, 1969",
            "Cormen et al., Introduction to Algorithms, Chapter 28",
        ],
        workedExample:
            "For two by two matrices, M1 = (a11+a22)(b11+b22) and M2 = (a21+a22)b11. After all seven products, C11 = M1+M4-M5+M7 and C12 = M3+M5. Substituting the definitions recovers a11 b11 + a12 b21 and a11 b12 + a12 b22, the ordinary dot products.",
    },
    id: "strassen-matrix-multiplication",
    name: "Strassen Matrix Multiplication",
    category: "math",
    complexity: { time: "O(n^2.807)", space: "O(n^2)" },
    defaultInput: {
        a: [[1, 2], [3, 4]],
        b: [[5, 6], [7, 8]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "pad both matrices to a power-of-two size",
        "if the block size is one, return the scalar product",
        "split A and B into four equal blocks",
        "form the seven products M1 through M7",
        "set C11 to M1 + M4 - M5 + M7",
        "set C12 to M3 + M5",
        "set C21 to M2 + M4",
        "set C22 to M1 - M2 + M3 + M6",
        "done: return the assembled product matrix",
    ],
};

export default module;
