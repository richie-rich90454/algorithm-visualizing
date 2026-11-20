/**
 * four-russians-algorithm.ts - Four Russians Boolean Matrix Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Four Russians technique trades multiplication for precomputation. To
 * multiply two Boolean matrices, partition the inner dimension into blocks of
 * t indices where t is about log base two of n. For each block, precompute the
 * column bitmask produced by every possible t-bit selection of inner rows. A
 * row of the product is then assembled by table lookups, one per block,
 * instead of scanning every inner index. This is the classic subroutine used
 * to accelerate transitive closure and Boolean-matrix-based dynamic programs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 / log n) for n by n Boolean matrices
 *   Space: O(n^3 / log n) for the precomputed block tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the product matrix as rows are completed.
 *   - The row being assembled is YELLOW; finished rows are GREEN.
 *   - meta carries the block size and the full product matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(n: number, product: number[][], activeRow: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let state: EntityState = "unvisited";
            if (i < activeRow) {
                state = "sorted";
            } else if (i === activeRow) {
                state = "comparing";
            }
            const value = product[i]?.[j] ?? 0;
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { A?: number[][]; B?: number[][]; blockSize?: number } | null) ?? {};
    const rawA = Array.isArray(task.A) ? task.A : [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
    ];
    const rawB = Array.isArray(task.B) ? task.B : [
        [1, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 1, 1],
        [1, 0, 0, 1],
    ];
    const A = rawA.map((row) => row.map((value) => (value ? 1 : 0)));
    const B = rawB.map((row) => row.map((value) => (value ? 1 : 0)));
    const n = A.length;

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty matrices: the Boolean product is empty.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { n: 0, blockSize: 0, blocks: 0 },
        };
        return;
    }

    const log = Math.floor(Math.log2(n));
    const derived = log < 1 ? 1 : log;
    const t = typeof task.blockSize === "number" && task.blockSize >= 1
        ? Math.min(n, Math.floor(task.blockSize))
        : derived;
    const blocks = Math.ceil(n / t);
    const product: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(n, product, -1),
        edges: [],
        description: `Boolean product of two ${n} by ${n} matrices using blocks of ${t} inner index(es).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, blockSize: t, blocks, c: product.flat() },
    };
    step += 1;

    const tables: Array<number[]> = [];
    for (let block = 0; block < blocks; block += 1) {
        const start = block * t;
        const len = Math.min(t, n - start);
        const table = Array<number>(1 << len).fill(0);
        for (let mask = 1; mask < 1 << len; mask += 1) {
            const lowest = mask & -mask;
            const bitIndex = Math.round(Math.log2(lowest));
            const previous = mask ^ lowest;
            let rowMask = 0;
            for (let col = 0; col < n; col += 1) {
                if (B[start + bitIndex]?.[col]) {
                    rowMask |= 1 << col;
                }
            }
            table[mask] = (table[previous] ?? 0) | rowMask;
        }
        tables.push(table);
        yield {
            stepNumber: step,
            entities: makeCells(n, product, -1),
            edges: [],
            description: `Precomputed lookup table for block ${block + 1} of ${blocks} (${len} row(s)).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n, blockSize: t, blocks, blocksDone: block + 1, c: product.flat() },
        };
        step += 1;
    }

    for (let i = 0; i < n; i += 1) {
        let resultMask = 0;
        for (let block = 0; block < blocks; block += 1) {
            const start = block * t;
            const len = Math.min(t, n - start);
            let select = 0;
            for (let r = 0; r < len; r += 1) {
                if (A[i]?.[start + r]) {
                    select |= 1 << r;
                }
            }
            resultMask |= tables[block]?.[select] ?? 0;
        }
        for (let j = 0; j < n; j += 1) {
            product[i]![j] = (resultMask >> j) & 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(n, product, i),
            edges: [],
            description: `Assembled row ${i} of the product with ${blocks} table lookup(s).`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { n, blockSize: t, blocks, c: product.flat() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(n, product, n),
        edges: [],
        description: `Boolean product complete using the Four Russians lookup tables.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { n, blockSize: t, blocks, c: product.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Boolean matrix multiplication only needs OR and AND, so a small block of inner rows can be summarized in a lookup table. Precompute, for each possible pattern of which rows in a block are selected, the OR of those rows as a column bitmask. Then a whole row of the answer comes from a handful of lookups, one per block, rather than a scan over every inner index.",
        invariants: [
            "A block table entry for a mask is the bitwise OR of the B rows selected by that mask.",
            "The column bitmask of a product row is the OR of the lookups over all inner blocks.",
            "Each product entry equals the OR of A[i][k] and B[k][j] over all inner indices k.",
        ],
        correctness:
            "For a fixed row i and inner block, the selected mask records exactly the inner indices k in that block with A[i][k] equal to one. The precomputed entry ORs precisely the rows B[k] for those indices, which is the contribution of that block to row i of the product. OR-ing the contributions from all blocks gives the column bitmask whose j-th bit is one exactly when some k has both A[i][k] and B[k][j] set, which is the Boolean matrix product.",
        complexityRationale:
            "With block size t about log base two of n, there are n/t blocks. Building each table costs O(2^t * n) and assembling each of the n rows costs O(n/t) lookups plus reading n bits, for O(n^3 / log n) time and comparable table storage.",
        uses: [
            "Transitive closure and all-pairs reachability",
            "Accelerating Boolean-matrix-based dynamic programs",
            "Fast set intersection kernels in combinatorial algorithms",
        ],
        references: [
            "Arlazarov, Dinic, Kronrod, and Faradzev, On Economical Construction of the Transitive Closure, 1970",
            "Aho, Hopcroft, and Ullman, The Design and Analysis of Computer Algorithms, Section 6.6",
        ],
        workedExample:
            "For four by four matrices with block size two, the inner indices split into blocks {0,1} and {2,3}. For a row whose selected pattern in the first block is 10, the table returns the bitmask of B row 1. OR-ing that with the second block lookup yields the full answer row as a bitmask.",
    },
    id: "four-russians-algorithm",
    name: "Four Russians Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(n^3 / log n)", space: "O(n^3 / log n)" },
    defaultInput: {
        A: [
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [1, 1, 0, 0],
            [0, 0, 1, 1],
        ],
        B: [
            [1, 1, 0, 0],
            [0, 1, 1, 0],
            [0, 0, 1, 1],
            [1, 0, 0, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a block size t near log base two of n",
        "split the inner dimension into consecutive blocks of at most t indices",
        "for each block precompute every t-bit row selection as a column bitmask",
        "for each result row build the selection mask in each block",
        "look up the block bitmask and OR it into the row result",
        "write the bits of the result mask into the product row",
        "done: report the Boolean product matrix",
    ],
};

export default module;
