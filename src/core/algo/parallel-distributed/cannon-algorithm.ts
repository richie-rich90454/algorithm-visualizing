/**
 * cannon-algorithm.ts - Cannon's Block Matrix Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cannon's algorithm multiplies two n by n matrices on a q by q grid of
 * processors, where q divides n. Each processor owns one block of A and one
 * block of B, and accumulates one block of C. Before the main loop the A blocks
 * are skewed left by their row index and the B blocks are skewed up by their
 * column index so that the diagonal blocks line up. Each of the q steps then
 * multiplies the resident A and B blocks into C, shifts A blocks left and B
 * blocks up by one, and repeats. Across q shifts every block pair A[i][k] and
 * B[k][j] meets exactly once in processor (i, j), so C equals A times B.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 / q) arithmetic per processor with O(q) shift steps
 *   Space: O(n^2 / q^2) per processor for its blocks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells are the q by q blocks of the result C.
 *   - GREEN marks the block updated in the current step.
 *   - meta carries the current A/B block indices and the assembled result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface Input {
    a?: Matrix;
    b?: Matrix;
    grid?: number;
}

const defaultA: Matrix = [
    [1, 2, 3, 4],
    [2, 1, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 1, 1],
];
const defaultB: Matrix = [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 1, 1],
    [1, 0, 0, 1],
];

function matmul(x: Matrix, y: Matrix): Matrix {
    const p = x.length;
    const m = y[0]?.length ?? 0;
    const k = y.length;
    const out: Matrix = Array.from({ length: p }, () => Array.from({ length: m }, () => 0));
    for (let i = 0; i < p; i += 1) {
        for (let j = 0; j < m; j += 1) {
            let sum = 0;
            for (let t = 0; t < k; t += 1) sum += (x[i]?.[t] ?? 0) * (y[t]?.[j] ?? 0);
            out[i]![j] = sum;
        }
    }
    return out;
}

function addInto(acc: Matrix, add: Matrix): void {
    for (let i = 0; i < acc.length; i += 1) {
        for (let j = 0; j < (acc[i]?.length ?? 0); j += 1) acc[i]![j] = (acc[i]![j] ?? 0) + (add[i]?.[j] ?? 0);
    }
}

function getBlock(m: Matrix, bs: number, bi: number, bj: number): Matrix {
    return Array.from({ length: bs }, (_, r) => Array.from({ length: bs }, (_, c) => m[bi * bs + r]?.[bj * bs + c] ?? 0));
}

function assemble(blocks: Matrix[][], q: number, bs: number): Matrix {
    const n = q * bs;
    const out: Matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    for (let i = 0; i < q; i += 1) {
        for (let j = 0; j < q; j += 1) {
            const block = blocks[i]![j]!;
            for (let r = 0; r < bs; r += 1) {
                for (let c = 0; c < bs; c += 1) out[i * bs + r]![j * bs + c] = block[r]![c] ?? 0;
            }
        }
    }
    return out;
}

function makeCells(blocks: Matrix[][], q: number, hot: string, step: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < q; i += 1) {
        for (let j = 0; j < q; j += 1) {
            const sum = blocks[i]![j]!.flat().reduce((a, b) => a + b, 0);
            const id = `block-${i}-${j}`;
            entities.push({
                id,
                type: "cell",
                label: `C${i}${j} sum ${sum}`,
                value: sum,
                state: id === hot ? "active" : step < 0 ? "idle" : "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, sum },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const a: Matrix = Array.isArray(task.a) ? task.a : defaultA;
    const b: Matrix = Array.isArray(task.b) ? task.b : defaultB;
    const n = a.length;
    const q = Math.max(1, Math.min(n, Math.floor(task.grid ?? 2)));
    const bs = Math.floor(n / q);
    const dim = q * bs;
    const blocksA: Matrix[][] = Array.from({ length: q }, () => Array.from({ length: q }, () => [] as Matrix));
    const blocksB: Matrix[][] = Array.from({ length: q }, () => Array.from({ length: q }, () => [] as Matrix));
    const blocksC: Matrix[][] = Array.from({ length: q }, () => Array.from({ length: q }, () => Array.from({ length: bs }, () => Array.from({ length: bs }, () => 0))));

    for (let i = 0; i < q; i += 1) {
        for (let j = 0; j < q; j += 1) {
            blocksA[i]![j] = getBlock(a, bs, i, j);
            blocksB[i]![j] = getBlock(b, bs, i, j);
        }
    }

    let step = 0;
    const meta = (s: number, hot: string, last: string) => {
        const result = assemble(blocksC, q, bs);
        return {
            grid: q,
            blockSize: bs,
            dimension: dim,
            step: s,
            hot,
            result: result.flat(),
            resultRows: dim,
            last,
        };
    };

    yield {
        stepNumber: step++,
        entities: makeCells(blocksC, q, "", -1),
        edges: [],
        description: `Cannon multiplication of ${n} by ${n} matrices on a ${q} by ${q} processor grid, ${bs} by ${bs} blocks.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, "", "initialized"),
    };

    // Initial skew: row i shifts A left by i, column j shifts B up by j.
    const skewedA = blocksA.map((row, i) => row.map((_, j) => blocksA[i]![(i + j) % q]!));
    const skewedB = blocksB.map((row, i) => row.map((_, j) => blocksB[(i + j) % q]![j]!));
    for (let i = 0; i < q; i += 1) {
        for (let j = 0; j < q; j += 1) {
            blocksA[i]![j] = skewedA[i]![j]!;
            blocksB[i]![j] = skewedB[i]![j]!;
        }
    }
    yield {
        stepNumber: step++,
        entities: makeCells(blocksC, q, "", -1),
        edges: [],
        description: `Skew A left by row index and B up by column index so matching diagonal blocks align.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: meta(0, "", "skewed"),
    };

    for (let s = 0; s < q; s += 1) {
        for (let i = 0; i < q; i += 1) {
            for (let j = 0; j < q; j += 1) {
                addInto(blocksC[i]![j]!, matmul(blocksA[i]![j]!, blocksB[i]![j]!));
            }
        }
        const hot = `block-0-0`;
        const desc = `Shift ${s + 1} of ${q}: each processor multiplies its resident A and B blocks into C, then shifts A left and B up.`;
        yield {
            stepNumber: step++,
            entities: makeCells(blocksC, q, hot, s),
            edges: [],
            description: desc,
            codeLineNumber: 3,
            layout: "grid",
            meta: meta(s + 1, hot, desc),
        };
        const shiftedA = blocksA.map((row, i) => row.map((_, j) => blocksA[i]![(j + 1) % q]!));
        const shiftedB = blocksB.map((row, i) => row.map((_, j) => blocksB[(i + 1) % q]![j]!));
        for (let i = 0; i < q; i += 1) {
            for (let j = 0; j < q; j += 1) {
                blocksA[i]![j] = shiftedA[i]![j]!;
                blocksB[i]![j] = shiftedB[i]![j]!;
            }
        }
    }

    const result = assemble(blocksC, q, bs);
    const done = `Finished: C block ${q} by ${q} accumulated after ${q} shift(s); assembled ${dim} by ${dim} result.`;
    yield {
        stepNumber: step,
        entities: makeCells(blocksC, q, "", q),
        edges: [],
        description: done,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...meta(q, "", done), result: result.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Splitting two big matrices into tiles lets a grid of processors work in parallel. Cannon's trick is to pre-shift the tiles so that, as every processor repeatedly multiplies the tiles it holds and passes them along a row and a column, each needed pair A[i][k] and B[k][j] meets exactly once in the processor that owns output tile (i, j). After one full cycle of shifts the output tile is complete.",
        invariants: [
            "Each processor accumulates only into its own output block C[i][j].",
            "After s shifts, processor (i,j) holds A[i][(i+j+s) mod q] and B[(i+j+s) mod q][j].",
            "Across q shifts every k block index passes through each processor exactly once.",
        ],
        correctness:
            "The initial skew places A[i][(i+j) mod q] and B[(i+j) mod q][j] in processor (i,j). A left shift of A and an up shift of B advance the shared index by one each step, so at step s the processor multiplies A[i][(i+j+s) mod q] by B[(i+j+s) mod q][j]. As s ranges from 0 to q-1 the index k = (i+j+s) mod q takes every value once, so the accumulated block is the sum over k of A[i][k] times B[k][j], which is exactly the definition of matrix product block C[i][j]. Assembling all blocks gives A times B.",
        complexityRationale:
            "Each of the q steps multiplies q by q blocks of size bs by bs, which is O(bs^3) per processor per step, or O(q * bs^3) = O(n^3 / q^2) processor work with n = q*bs; across q^2 processors that is O(n^3) total work with an O(q) shift latency per step. Each processor stores its A block, B block, and C block, O(bs^2) = O(n^2 / q^2) space.",
        uses: [
            "Distributed dense linear algebra in scientific simulation libraries",
            "Training and inference kernels that multiply large weight matrices",
            "A canonical example of communication-avoiding parallel algorithms",
        ],
        references: [
            "Cannon, A Celestial Approach to Matrix Multiplication, 1969",
            "Golub and Van Loan, Matrix Computations, chapter on parallel matrix multiplication",
        ],
        workedExample:
            "On a 2 by 2 grid with 2 by 2 blocks, processor (0,0) starts with A block (0,0) and B block (0,0), while processor (0,1) starts with A block (0,1) and B block (1,1). After two multiply-and-shift steps, processor (0,0) has summed A(0,0)B(0,0) plus A(0,1)B(1,0), exactly the top-left block of the product.",
    },
    id: "cannon-algorithm",
    name: "Cannon Block Matrix Multiplication",
    category: "parallel-distributed",
    complexity: { time: "O(n^3 / q^2 + q) per processor", space: "O(n^2 / q^2)" },
    defaultInput: { a: defaultA, b: defaultB, grid: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "split A and B into q by q square blocks",
        "skew A left by row index and B up by column index",
        "for each of q shift steps do",
        "multiply the resident A and B blocks into C",
        "shift every A block left and every B block up",
        "after q shifts each C block is complete",
        "assemble the blocks into the product matrix",
        "done: report the full product",
    ],
};

export default module;
