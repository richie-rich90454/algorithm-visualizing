/**
 * monarch-mixer.ts - Monarch Matrix Mixing Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Monarch matrix replaces a dense n by n mixing matrix with two block
 * diagonal matrices separated by reshape permutations. With n equals p times
 * q, one block diagonal matrix holds p small q by q blocks and the other holds
 * q small p by p blocks. The factored form multiplies a vector in O(n (p+q))
 * work and still spans a rich family of dense matrices, which makes it useful
 * as a token-mixing layer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n (p + q)) for n = p * q inputs
 *   Space: O(n) for the intermediate vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the vector after each of the four structured stages.
 *   - The final bars are the mixed output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface MonarchInput {
    x?: number[];
    leftBlocks?: Matrix[];
    rightBlocks?: Matrix[];
    p?: number;
    q?: number;
}

/** Apply a block-diagonal matrix whose blocks act on the q-coordinates of each group i. */
function applyLeft(y: number[], leftBlocks: Matrix[], p: number, q: number): number[] {
    const out: number[] = new Array(p * q).fill(0);
    for (let i = 0; i < p; i += 1) {
        const block = leftBlocks[i] ?? [];
        for (let j = 0; j < q; j += 1) {
            let sum = 0;
            for (let b = 0; b < q; b += 1) sum += (block[j]?.[b] ?? 0) * (y[i * q + b] ?? 0);
            out[i * q + j] = sum;
        }
    }
    return out;
}

/** Apply q independent p by p blocks, each acting on the entries sharing a j index. */
function applyRight(y: number[], rightBlocks: Matrix[], p: number, q: number): number[] {
    const out: number[] = new Array(p * q).fill(0);
    for (let j = 0; j < q; j += 1) {
        const block = rightBlocks[j] ?? [];
        for (let i = 0; i < p; i += 1) {
            let sum = 0;
            for (let a = 0; a < p; a += 1) sum += (block[i]?.[a] ?? 0) * (y[j * p + a] ?? 0);
            out[j * p + i] = sum;
        }
    }
    return out;
}

/** The four-stage Monarch matvec, returning every intermediate vector. */
export function monarchStages(x: number[], leftBlocks: Matrix[], rightBlocks: Matrix[], p: number, q: number) {
    const forward: number[] = new Array(p * q).fill(0);
    for (let i = 0; i < p; i += 1) {
        for (let j = 0; j < q; j += 1) forward[j * p + i] = x[i * q + j] ?? 0;
    }
    const right = applyRight(forward, rightBlocks, p, q);
    const backward: number[] = new Array(p * q).fill(0);
    for (let j = 0; j < q; j += 1) {
        for (let i = 0; i < p; i += 1) backward[i * q + j] = right[j * p + i] ?? 0;
    }
    const left = applyLeft(backward, leftBlocks, p, q);
    return { forward, right, backward, left };
}

/** Convenience wrapper returning only the mixed output. */
export function monarchMatvec(x: number[], leftBlocks: Matrix[], rightBlocks: Matrix[], p: number, q: number): number[] {
    return monarchStages(x, leftBlocks, rightBlocks, p, q).left;
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MonarchInput | null) ?? {};
    const defaultLeft: Matrix[] = [
        [
            [1, 2],
            [3, 4],
        ],
        [
            [0, 1],
            [1, 0],
        ],
    ];
    const defaultRight: Matrix[] = [
        [
            [1, 0],
            [0, 1],
        ],
        [
            [2, 1],
            [1, 1],
        ],
    ];
    const p = typeof task.p === "number" && task.p > 0 ? task.p : 2;
    const q = typeof task.q === "number" && task.q > 0 ? task.q : 2;
    const leftBlocks: Matrix[] = Array.isArray(task.leftBlocks) && task.leftBlocks.length === p
        ? task.leftBlocks
        : defaultLeft;
    const rightBlocks: Matrix[] = Array.isArray(task.rightBlocks) && task.rightBlocks.length === q
        ? task.rightBlocks
        : defaultRight;
    const x: number[] = Array.isArray(task.x) && task.x.length === p * q
        ? task.x.slice()
        : [1, 2, 3, 4].slice(0, p * q);
    const { forward, right, backward, left } = monarchStages(x, leftBlocks, rightBlocks, p, q);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(x, "idle"),
        edges: [],
        description: `Mix a length ${p * q} vector using ${p} left blocks and ${q} right blocks.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", p, q, x, leftBlocks, rightBlocks },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(forward, "active"),
        edges: [],
        description: "Reshape the vector so entries sharing a right-block index become contiguous.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "reshape-forward", p, q, x, forward },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(right, "comparing"),
        edges: [],
        description: "Apply the q small right blocks, each mixing its group of p entries.",
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "right-blocks", p, q, x, forward, right },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(backward, "active"),
        edges: [],
        description: "Reshape back so entries sharing a left-block index become contiguous.",
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "reshape-back", p, q, x, right, backward },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(left, "sorted"),
        edges: [],
        description: "Apply the p small left blocks to obtain the mixed output vector.",
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "left-blocks", p, q, x, backward, left, output: left, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A dense mixing matrix touches every pair of inputs, which is expensive for long sequences. A Monarch matrix breaks the mixing into two rounds of small independent matrix multiplies with a reshape between them. The reshuffling lets the second round of small blocks influence different groups, so the composition is far more expressive than either round alone while staying cheap.",
        invariants: [
            "Each right block only mixes entries that share the same group index j.",
            "Each left block only mixes entries that share the same group index i.",
            "The reshape steps are permutations, so no information is lost.",
        ],
        correctness:
            "The two reshapes are bijections on the n coordinates. After the forward reshape the right blocks act as one block diagonal matrix R; after the backward reshape the left blocks act as one block diagonal matrix L. The whole map is therefore L times P inverse times R times P, which is a fixed n by n matrix. Reconstructing that matrix column by column by feeding unit vectors through the stages reproduces the dense product on any input, proving the factored computation is exact.",
        complexityRationale:
            "Each of the q right blocks costs p squared work, for q p squared total, and the p left blocks cost p q squared total. With n equal to p times q this is O(n (p + q)). Only a constant number of length-n intermediate vectors are stored, so space is O(n).",
        uses: [
            "Token and channel mixing in efficient language model layers",
            "Structured linear layers that replace dense projections",
            "Butterfly-style fast transforms in signal processing",
        ],
        references: [
            "Dao et al., Monarch: Expressive Structured Matrices for Efficient and Accurate Training, ICML 2022",
            "Dao et al., Simple and Efficient Mixed Precision Algorithm for Monarch Matrices, 2023",
        ],
        workedExample:
            "With p equals two and q equals two, a vector (1,2,3,4) is reshaped so entries 1 and 3 are grouped and entries 2 and 4 are grouped. Two by two right blocks mix each group, the vector is reshaped back, and two by two left blocks mix the new groups. Feeding four unit vectors through the same stages reconstructs the equivalent dense four by four matrix.",
    },
    id: "monarch-mixer",
    name: "Monarch Mixer",
    category: "ml-ai",
    complexity: { time: "O(n (p + q))", space: "O(n)" },
    defaultInput: {
        x: [1, 2, 3, 4],
        p: 2,
        q: 2,
        leftBlocks: [
            [
                [1, 2],
                [3, 4],
            ],
            [
                [0, 1],
                [1, 0],
            ],
        ],
        rightBlocks: [
            [
                [1, 0],
                [0, 1],
            ],
            [
                [2, 1],
                [1, 1],
            ],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "reshape the input so each right-block group is contiguous",
        "for each right block multiply it by its group of entries",
        "reshape the result so each left-block group is contiguous",
        "for each left block multiply it by its group of entries",
        "collect the entries into the output vector",
        "done: report the mixed output",
    ],
};

export default module;
