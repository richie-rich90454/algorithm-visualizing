/**
 * matrix-multiplication-block.ts - Blocked Matrix Multiplication
 *
 * Multiplies two square matrices by partitioning them into square blocks and
 * accumulating each output block as a sum of block products. Reusing whole
 * blocks improves cache locality compared with the naive row-column loop while
 * keeping the same O(n^3) arithmetic.
 *
 *   Time:  O(n^3), Space: O(n^2)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BlockMatrixInput {
    a?: number[][];
    b?: number[][];
    block?: number;
}

function makeEntities(matrix: number[][], activeBlock: number, rows: number, cols: number): VisualEntity[] {
    return matrix.map((row, r) =>
        row.map((value, c) => ({
            id: `cell-${r}-${c}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (activeBlock >= 0 && Math.floor(r / rows) + Math.floor(c / cols) === activeBlock
                ? "active"
                : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: r, col: c },
        })),
    ).flat();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BlockMatrixInput | null) ?? {};
    const a = Array.isArray(task.a) && task.a.length > 0 && task.a.every((row) => Array.isArray(row) && row.length === task.a!.length)
        ? task.a.map((row) => row.slice())
        : [
              [1, 2, 3, 4],
              [5, 6, 7, 8],
              [9, 10, 11, 12],
              [13, 14, 15, 16],
          ];
    const b = Array.isArray(task.b) && task.b.length === a.length && task.b.every((row) => Array.isArray(row) && row.length === a.length)
        ? task.b.map((row) => row.slice())
        : [
              [1, 0, 0, 0],
              [0, 1, 0, 0],
              [0, 0, 1, 0],
              [0, 0, 0, 1],
          ];
    const n = a.length;
    const block = typeof task.block === "number" && task.block >= 1 ? Math.trunc(task.block) : 2;
    const c = Array.from({ length: n }, () => new Array<number>(n).fill(0));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(c, -1, block, block),
        edges: [],
        description: `Multiply two ${n} by ${n} matrices in ${block} by ${block} blocks.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, block, product: c.flat(), blockIndex: -1 },
    };
    step += 1;

    let blockIndex = 0;
    for (let ib = 0; ib < n; ib += block) {
        for (let jb = 0; jb < n; jb += block) {
            for (let kb = 0; kb < n; kb += block) {
                for (let i = ib; i < Math.min(ib + block, n); i += 1) {
                    for (let j = jb; j < Math.min(jb + block, n); j += 1) {
                        let sum = c[i]![j]!;
                        for (let k = kb; k < Math.min(kb + block, n); k += 1) {
                            sum += a[i]![k]! * b[k]![j]!;
                        }
                        c[i]![j] = sum;
                    }
                }
                yield {
                    stepNumber: step,
                    entities: makeEntities(c, blockIndex, block, block),
                    edges: [],
                    description: `Accumulate output block (${Math.floor(ib / block)}, ${Math.floor(jb / block)}) using k-block ${Math.floor(kb / block)}.`,
                    codeLineNumber: 1,
                    layout: "grid",
                    meta: { rows: n, cols: n, n, block, product: c.flat(), blockIndex, ib, jb, kb },
                };
                step += 1;
                blockIndex += 1;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(c, -1, block, block),
        edges: [],
        description: `Done: the blocked product of the two ${n} by ${n} matrices is complete.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: n, n, block, product: c.flat(), blocks: blockIndex },
    };
}

const module: AlgorithmModule = {
    id: "matrix-multiplication-block",
    name: "Blocked Matrix Multiplication",
    category: "math",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        a: [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 16],
        ],
        b: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ],
        block: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "zero the output matrix C",
        "for each output block row and column",
        "for each k block accumulate the product of the A and B blocks",
        "within a block use the ordinary triple loop",
        "advance to the next output block",
        "done: report the completed product matrix C",
    ],
    education: {
        intuition:
            "Matrix multiplication is a long sequence of multiply-adds. Grouping the work into square blocks lets a whole tile of A and B stay in fast cache while many products are accumulated into a tile of C. The arithmetic is identical to the textbook triple loop; only the loop order changes.",
        invariants: [
            "Before a k block is processed, C holds contributions from earlier k blocks only.",
            "After all k blocks for an output block, that block equals the exact row-column product.",
            "Every output entry is accumulated from the same k range as in the naive algorithm.",
        ],
        correctness:
            "For a fixed output block and a fixed k block the inner loops add exactly A[i][k] times B[k][j] for every i and j in the block, which is a subset of the terms in the definition of matrix product. Summing over all k blocks covers every k from zero to n minus one exactly once, so each C[i][j] equals the full sum over k. The blocked and naive algorithms therefore compute the same result.",
        complexityRationale:
            "Each ordered pair of entries is multiplied once for each k, so the total arithmetic is O(n^3) regardless of block size. Besides the input and output matrices only loop indices are stored, giving O(n^2) space.",
        uses: [
            "High-performance linear algebra kernels in BLAS libraries",
            "Cache-aware multiplication in graphics and machine learning",
            "A bridge to recursive algorithms such as Strassen multiplication",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Matrix Multiplication chapter",
            "Goto and van de Geijn, Anatomy of High-Performance Matrix Multiplication, 2008",
        ],
        workedExample:
            "Multiplying a four by four matrix by the identity with block size two visits four output tiles. Each diagonal tile picks up the matching ones from B while off-diagonal tiles stay zero, and the final product equals the original matrix.",
    },
};

export default module;
