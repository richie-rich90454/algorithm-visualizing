/**
 * four-russians.ts - Four Russians Technique for Longest Common Subsequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Four Russians technique speeds up dynamic programming by precomputing the
 * answer to every possible small block. For LCS, consecutive cells in a DP row
 * differ by zero or one, so a block of t columns plus a one-bit carry has only
 * 2^(t+1) states, and the match pattern has 2^t possibilities. A table of all
 * block transitions is built once; each later row is processed with one lookup
 * per block instead of a scan over every column.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n m / t + 2^(2t+1)) for n by m strings and block size t
 *   Space: O(2^(2t+1)) for the transition table plus O(n m) for the DP display
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the classical LCS DP matrix for reference.
 *   - The row currently assembled by block lookups is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Number of precomputed states and masks for a block size t. */
export function tableSize(t: number): number {
    const states = 1 << (t + 1);
    const masks = 1 << t;
    return masks * states;
}

/** Precompute, for every match mask and stored row state, the next block state. */
export function buildBlockTable(t: number): Int32Array {
    const states = 1 << (t + 1);
    const masks = 1 << t;
    const table = new Int32Array(masks * states);
    for (let mask = 0; mask < masks; mask += 1) {
        for (let state = 0; state < states; state += 1) {
            const d = (state >> t) & 1;
            const prevRel: number[] = [];
            let acc = 0;
            for (let i = 0; i < t; i += 1) {
                acc += (state >> i) & 1;
                prevRel.push(acc);
            }
            const curRel: number[] = [];
            let lastCur = 0;
            for (let i = 0; i < t; i += 1) {
                const match = (mask >> i) & 1;
                const prevHere = prevRel[i] ?? 0;
                const prevBefore = i > 0 ? (prevRel[i - 1] ?? 0) : 0;
                let cur = match ? prevBefore - d + 1 : Math.max(prevHere - d, lastCur);
                if (cur < lastCur) {
                    cur = lastCur;
                }
                if (cur < 0) {
                    cur = 0;
                }
                curRel.push(cur);
                lastCur = cur;
            }
            let newBits = 0;
            lastCur = 0;
            for (let i = 0; i < t; i += 1) {
                const value = curRel[i] ?? 0;
                if (value - lastCur > 0) {
                    newBits |= 1 << i;
                }
                lastCur = value;
            }
            const newD = d + (curRel[t - 1] ?? 0) - (prevRel[t - 1] ?? 0);
            table[mask * states + state] = newBits | ((newD & 1) << t);
        }
    }
    return table;
}

export interface FourRussiansResult {
    length: number;
    rowLengths: number[];
    blockSize: number;
    entries: number;
}

/** LCS length via Four Russians block lookups, with the per-row values. */
export function lcsFourRussians(a: string, b: string, t = 4): FourRussiansResult {
    const block = Math.max(1, Math.min(4, t));
    const table = buildBlockTable(block);
    const states = 1 << (block + 1);
    const bitMask = (1 << block) - 1;
    const blocks = Math.ceil(b.length / block);
    let previousRowBits = new Array<number>(blocks).fill(0);
    const rowLengths: number[] = [0];
    for (let i = 1; i <= a.length; i += 1) {
        const ch = a[i - 1];
        let carry = 0;
        let rowSum = 0;
        const currentRowBits: number[] = [];
        for (let blk = 0; blk < blocks; blk += 1) {
            const start = blk * block;
            let mask = 0;
            for (let k = 0; k < block; k += 1) {
                const col = start + k;
                if (col < b.length && b[col] === ch) {
                    mask |= 1 << k;
                }
            }
            const incoming = (previousRowBits[blk] ?? 0) | (carry << block);
            const outgoing = table[mask * states + incoming] ?? 0;
            const newBits = outgoing & bitMask;
            carry = (outgoing >> block) & 1;
            currentRowBits.push(newBits);
            let count = newBits;
            while (count > 0) {
                rowSum += count & 1;
                count >>= 1;
            }
        }
        previousRowBits = currentRowBits;
        rowLengths.push(rowSum);
    }
    return {
        length: rowLengths[a.length] ?? 0,
        rowLengths,
        blockSize: block,
        entries: table.length,
    };
}

/** Classical LCS DP matrix, shown only for reference in the visualization. */
function dpMatrix(a: string, b: string): number[][] {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            dp[i]![j] = a[i - 1] === b[j - 1]
                ? (dp[i - 1]![j - 1] ?? 0) + 1
                : Math.max(dp[i - 1]![j] ?? 0, dp[i]![j - 1] ?? 0);
        }
    }
    return dp;
}

function makeCells(dp: number[][], activeRow: number, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < dp.length; r += 1) {
        for (let c = 0; c < (dp[r]?.length ?? 0); c += 1) {
            const value = dp[r]?.[c] ?? 0;
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (r === activeRow) {
                state = "comparing";
            } else if (r < activeRow) {
                state = "visited";
            }
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: `${value}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string; b?: string } | null) ?? {};
    const a = typeof task.a === "string" && task.a.length > 0 ? task.a : "abcbdab";
    const b = typeof task.b === "string" && task.b.length > 0 ? task.b : "bdcaba";
    const result = lcsFourRussians(a, b);
    const dp = dpMatrix(a, b);
    const rows = a.length + 1;
    const cols = b.length + 1;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(dp, -1, false),
        edges: [],
        description: `Four Russians LCS of "${a}" and "${b}" with block size ${result.blockSize} and ${result.entries} table entries.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, a, b, blockSize: result.blockSize, entries: result.entries, lcs: 0 },
    };
    step += 1;

    for (let i = 1; i <= a.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(dp, i, false),
            edges: [],
            description: `Row ${i}: ${result.blockSize}-column block lookups give LCS prefix length ${result.rowLengths[i]}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows,
                cols,
                a,
                b,
                blockSize: result.blockSize,
                entries: result.entries,
                row: i,
                prefixLength: result.rowLengths[i] ?? 0,
                rowLengths: result.rowLengths.slice(0, i + 1),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(dp, -1, true),
        edges: [],
        description: `LCS length ${result.length} obtained with ${result.entries} precomputed block transitions.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows,
            cols,
            a,
            b,
            blockSize: result.blockSize,
            entries: result.entries,
            lcs: result.length,
            rowLengths: result.rowLengths,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Four Russians technique is a time-space trade: precompute the answer to every possible small question, then answer big questions with table lookups. In an LCS row, neighboring cells differ by only zero or one, so a short block has few possible states. Enumerating all block behaviors once lets each new row advance block by block rather than cell by cell.",
        invariants: [
            "Adjacent cells in any LCS row differ by zero or one, so a block state needs only t increment bits plus a one-bit carry.",
            "The precomputed table covers every combination of match mask and incoming state.",
            "After each block, the stored state reproduces the increment bits of the true LCS row prefix.",
        ],
        correctness:
            "Within a block the LCS recurrence depends only on the previous row's increment bits, the carry from the preceding column, and which block positions match the current character. The precomputation simulates the recurrence for every such combination, so each lookup returns exactly the state the ordinary DP would have produced. Inducting over blocks reconstructs the whole row, and inducting over rows gives the same final value as the classical LCS dynamic program, which the reference grid displays.",
        complexityRationale:
            "The table has 2^t match masks and 2^(t+1) states, each filled by a constant-size simulation, costing O(2^(2t+1)) preprocessing. Each of the n rows then performs ceil(m/t) lookups, giving O(n m / t) scanning time. The DP grid is kept only to illustrate the answer and costs O(n m) display space.",
        uses: [
            "Accelerating dynamic programming for long biological sequences",
            "Bit-parallel and word-RAM string matching implementations",
            "Transitive closure and substrings compilation speedups",
        ],
        references: [
            "Masek and Paterson, A Faster Algorithm Computing String Edit Distances, 1980",
            "Aho, Hopcroft and Ullman, The Design and Analysis of Computer Algorithms, Section on the Four Russians technique",
        ],
        workedExample:
            "For a = abcbdab and b = bdcaba with block size four, the table enumerates 16 match masks and 32 states, or 512 entries. Each of the seven rows of A is then built with two lookups, and the last row's increment bits sum to the LCS length four.",
    },
    id: "four-russians",
    name: "Four Russians LCS",
    category: "string",
    complexity: { time: "O(n m / t + 2^(2t+1))", space: "O(2^(2t+1) + n m)" },
    defaultInput: { a: "abcbdab", b: "bdcaba" },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a block size t and prepare the transition table",
        "for every match mask and incoming state simulate one block",
        "store the resulting increment bits and carry",
        "initialize the first row state to zero increments",
        "for each row split the other string into blocks of t",
        "form the match mask and replace the state by a table lookup",
        "sum the increment bits and report the final LCS length",
    ],
};

export default module;
