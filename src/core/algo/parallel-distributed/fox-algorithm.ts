/**
 * fox-algorithm.ts - Fox Block Matrix Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fox's algorithm multiplies two matrices on a square grid of processors. In
 * each of sqrt(p) steps a processor broadcasts one block of A along its row,
 * multiplies it by the B block it currently holds, and then passes that B
 * block one row up. After all steps each processor has accumulated its own
 * block of the product, and every block of A and B is read exactly once per
 * processor row.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 / sqrt(p)) per process on a sqrt(p) by sqrt(p) grid
 *   Space: O(n^2 / p) per process for its blocks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three stacked grids show A, the shifting B blocks, and the result C.
 *   - The A block being broadcast and the B block used this step are YELLOW.
 *   - The C block being accumulated is GREEN (active).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const defaultA: number[][] = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
];
const defaultB: number[][] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
];

type Block = number[][];

function blockAt(matrix: number[][], br: number, bc: number, block: number): Block {
    const out: Block = [];
    for (let r = 0; r < block; r += 1) {
        const row: number[] = [];
        for (let c = 0; c < block; c += 1) {
            row.push(matrix[br * block + r]?.[bc * block + c] ?? 0);
        }
        out.push(row);
    }
    return out;
}

function addProduct(out: number[][], a: Block, b: Block, offR: number, offC: number): void {
    const size = a.length;
    for (let r = 0; r < size; r += 1) {
        for (let col = 0; col < size; col += 1) {
            let sum = 0;
            for (let k = 0; k < size; k += 1) {
                sum += (a[r]?.[k] ?? 0) * (b[k]?.[col] ?? 0);
            }
            out[offR + r]![offC + col] = (out[offR + r]?.[offC + col] ?? 0) + sum;
        }
    }
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[][]; b?: number[][] } | null) ?? {};
    const a = Array.isArray(task.a) && task.a.length > 0 ? task.a : defaultA;
    const b = Array.isArray(task.b) && task.b.length > 0 ? task.b : defaultB;
    const n = Math.max(2, Math.min(a.length, b.length));
    const matrixA = Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => Number(a[r]?.[c]) || 0),
    );
    const matrixB = Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => Number(b[r]?.[c]) || 0),
    );
    const grid = 2;
    const block = Math.max(1, Math.floor(n / grid));
    const side = grid * block;
    const c: number[][] = Array.from({ length: side }, () => Array.from({ length: side }, () => 0));
    const aBlocks: Block[][] = [];
    const bCurrent: Block[][] = [];
    for (let i = 0; i < grid; i += 1) {
        aBlocks.push([]);
        bCurrent.push([]);
        for (let j = 0; j < grid; j += 1) {
            aBlocks[i]!.push(blockAt(matrixA, i, j, block));
            bCurrent[i]!.push(blockAt(matrixB, i, j, block));
        }
    }

    let step = 0;
    const cells = (activeA: [number, number], activeB: [number, number], activeC: [number, number]): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        const push = (prefix: string, row: number, col: number, value: number, offset: number, state: EntityState): void => {
            entities.push({
                id: `${prefix}-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: offset + row, col, matrix: prefix },
            });
        };
        for (let r = 0; r < side; r += 1) {
            for (let col = 0; col < side; col += 1) {
                const inA = Math.floor(r / block) === activeA[0] && Math.floor(col / block) === activeA[1];
                const inB = Math.floor(r / block) === activeB[0] && Math.floor(col / block) === activeB[1];
                const inC = Math.floor(r / block) === activeC[0] && Math.floor(col / block) === activeC[1];
                push("a", r, col, matrixA[r]?.[col] ?? 0, 0, inA ? "comparing" : "unvisited");
                push("b", r, col, matrixB[r]?.[col] ?? 0, side, inB ? "comparing" : "unvisited");
                push("c", r, col, c[r]?.[col] ?? 0, 2 * side, inC ? "active" : "unvisited");
            }
        }
        return entities;
    };
    const frame = (
        description: string,
        codeLineNumber: number,
        aBlock: [number, number] = [-1, -1],
        bBlock: [number, number] = [-1, -1],
        cBlock: [number, number] = [-1, -1],
        edges: VisualEdge[] = [],
    ): VisualFrame => ({
        stepNumber: step++,
        entities: cells(aBlock, bBlock, cBlock),
        edges,
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            rows: 3 * side,
            cols: side,
            grid,
            block,
            result: c.flat(),
        },
    });

    yield frame(`Fox multiplication on a ${grid}x${grid} processor grid with ${block}x${block} blocks.`, 0);

    for (let k = 0; k < grid; k += 1) {
        const edges: VisualEdge[] = [];
        for (let i = 0; i < grid; i += 1) {
            for (let j = 0; j < grid; j += 1) {
                const aIndex = (i + k) % grid;
                const aBlock = aBlocks[i]![aIndex]!;
                const bBlock = bCurrent[i]![j]!;
                addProduct(c, aBlock, bBlock, i * block, j * block);
                edges.push({
                    id: `broadcast-${k}-${i}-${j}`,
                    sourceId: `a-${i * block}-${aIndex * block}`,
                    targetId: `c-${i * block}-${j * block}`,
                    label: "A broadcast",
                    state: "active",
                    directed: true,
                });
            }
        }
        yield frame(
            `Step ${k + 1}: each row broadcasts its next A block, multiplies it by the held B block, and accumulates into C.`,
            2,
            [0, k],
            [0, k],
            [0, 0],
            edges,
        );

        const shifted: Block[][] = [];
        for (let i = 0; i < grid; i += 1) {
            shifted.push([]);
            for (let j = 0; j < grid; j += 1) {
                shifted[i]!.push(bCurrent[(i + 1) % grid]![j]!);
            }
        }
        bCurrent.length = 0;
        bCurrent.push(...shifted);
        yield frame(`Step ${k + 1}: every processor shifts its B block one row up for the next round.`, 4);
    }

    yield frame(`Multiplication complete; each processor has accumulated its ${block}x${block} block of C.`, 6);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Lay the processors out as a square. A block of A travels across a row while a block of B travels up a column, so every processor sees one strip of A and one strip of B per step. Multiplying those two small blocks and adding into a local accumulator builds the final product without any processor ever holding the whole matrices.",
        invariants: [
            "At step k, processor (i,j) multiplies A[i][(i+k) mod sqrt(p)] by B[(i+k) mod sqrt(p)][j].",
            "After each step the B blocks are shifted up one row cyclically.",
            "Each C block is the running sum of the block products for its row and column.",
        ],
        correctness:
            "For output block (i,j), step k contributes A[i][(i+k) mod g] times B[(i+k) mod g][j]. The B blocks shift up one row per step, so processor (i,j) holds B[(i+k) mod g][j] at step k. The shared index sweeps all values 0 through g-1, so the sum is exactly sum over a of A[i][a] times B[a][j], which is the definition of the (i,j) block of the matrix product.",
        complexityRationale:
            "Each of the g=sqrt(p) steps multiplies blocks of size n/g by n/g, costing O((n/g)^3) per processor, so O(n^3/g) time per process and O(n^3) total. A processor stores a constant number of blocks, O(n^2/p) values.",
        uses: [
            "Dense linear algebra on processor grids and supercomputers",
            "ScaLAPACK-style blocked matrix multiplication kernels",
            "A teaching model for communication-computation overlap in parallel algorithms",
        ],
        references: [
            "Fox, Lyzenga, Otto, Salmon, and Walker, Solving Problems on Concurrent Processors, 1988",
            "Golub and Van Loan, Matrix Computations, fourth edition",
        ],
        workedExample:
            "With a 2x2 processor grid and 4x4 matrices split into 2x2 blocks, step one accumulates A00 times B00 into C00 while step two broadcasts A01 and the shifted B10, adding A01 times B10. The final C00 block equals the top-left block of the ordinary product.",
    },
    id: "fox-algorithm",
    name: "Fox Block Matrix Multiplication",
    category: "parallel-distributed",
    complexity: { time: "O(n^3 / sqrt(p)) per process", space: "O(n^2 / p) per process" },
    defaultInput: { a: defaultA, b: defaultB },
    visualType: "grid",
    run,
    pseudocode: [
        "split A and B into sqrt(p) by sqrt(p) blocks",
        "give processor (i,j) blocks A[i][j] and B[i][j]",
        "for step k from 0 to sqrt(p)-1",
        "broadcast A[i][(i+k) mod sqrt(p)] along row i",
        "multiply it by B[(i+k) mod sqrt(p)][j] and add into C[i][j]",
        "shift every B block one row up cyclically",
        "repeat until all steps are done",
        "done: each processor owns one block of the product C",
    ],
};

export default module;
