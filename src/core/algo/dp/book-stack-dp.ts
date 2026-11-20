/**
 * book-stack-dp.ts - Book Stacking / Maximum Overhang (Bitmask DP)
 *
 * Stack a chosen set of books beyond the edge of a table so the top book
 * reaches as far out as possible while the whole stack stays balanced. The
 * center of mass of the books above any level must sit over the book bearing
 * them. Building the stack from the top down, adding a book of length L to a
 * stack of total length S extends the overhang by L^2 / (2 * (S + L)).
 *
 * Time: O(n * 2^n). Space: O(2^n).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    lengths?: number[];
}

function buildCells(
    values: number[],
    cols: number,
    active?: number,
): VisualEntity[] {
    return values.map((value, mask) => ({
        id: `cell-${mask}`,
        type: "cell" as const,
        label: value.toFixed(3),
        value,
        state: (active === mask ? "comparing" : mask === 0 ? "idle" : "visited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(mask / cols), col: mask % cols, mask, overhang: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const lengthsInput = Array.isArray(task.lengths) ? task.lengths.map((v) => Number(v)) : [1, 2, 3, 4];
    const lengths = lengthsInput
        .slice(0, 6)
        .map((v) => (Number.isFinite(v) ? Math.max(0.1, v) : 1));
    const n = lengths.length;
    const size = 1 << n;
    const cols = 1 << Math.ceil(n / 2);
    const rows = 1 << Math.floor(n / 2);

    const sum = new Array<number>(size).fill(0);
    for (let mask = 1; mask < size; mask += 1) {
        const bit = mask & -mask;
        const idx = 31 - Math.clz32(bit);
        sum[mask] = (sum[mask ^ bit] ?? 0) + (lengths[idx] ?? 0);
    }

    const dp = new Array<number>(size).fill(0);
    const choice = new Array<number>(size).fill(-1);
    let step = 0;
    yield {
        stepNumber: step,
        entities: buildCells(dp, cols),
        edges: [],
        description: `Balance ${n} books of lengths [${lengths.join(", ")}]; dp[0] = 0 overhang for an empty stack.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, lengths, rows, cols, answer: 0, bestOrder: [] },
    };
    step += 1;

    for (let mask = 1; mask < size; mask += 1) {
        let best = 0;
        let bestBook = -1;
        for (let b = 0; b < n; b += 1) {
            if ((mask & (1 << b)) === 0) continue;
            const total = sum[mask] ?? 0;
            const candidate = (dp[mask ^ (1 << b)] ?? 0) + ((lengths[b] ?? 0) ** 2) / (2 * total);
            if (candidate > best) {
                best = candidate;
                bestBook = b;
            }
        }
        dp[mask] = best;
        choice[mask] = bestBook;
        yield {
            stepNumber: step,
            entities: buildCells(dp, cols, mask),
            edges: [],
            description: `Using ${mask.toString(2).padStart(n, "0")}, the largest balanced overhang is ${best.toFixed(3)}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { n, lengths, rows, cols, answer: best, bestOrder: [] },
        };
        step += 1;
    }

    const full = size - 1;
    const bestOverhang = dp[full] ?? 0;
    const order: number[] = [];
    let cursor = full;
    while (cursor > 0) {
        const b = choice[cursor] ?? -1;
        if (b < 0) break;
        order.push(b);
        cursor ^= 1 << b;
    }
    order.reverse(); // choices are found bottom-first; report the stack top-first

    yield {
        stepNumber: step,
        entities: buildCells(dp, cols, full),
        edges: [],
        description: `Done: maximum overhang ${bestOverhang.toFixed(3)}, stacking books from top to bottom in order [${order.map((b) => lengths[b]).join(", ")}].`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { n, lengths, rows, cols, answer: bestOverhang, bestOrder: order, dp: [...dp] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A stack is stable only when the center of mass of every group of top books lies above the book supporting it. If a book of length L is placed under a stack whose total length above is S, it can be shifted outward by L squared over twice the new total length. Because that gain depends only on the set of books above, a subset DP can pick the best order and subset.",
        invariants: [
            "dp[mask] is the largest overhang obtainable by stacking exactly the books in mask.",
            "sum[mask] is the total length of those books and is independent of their order.",
            "The transition always removes one book, so it reads a smaller, already final state.",
        ],
        correctness:
            "Take an optimal stack for mask and look at its bottom book b. Removing b leaves an optimal stack for mask without b, otherwise the overhang could be improved. Adding b at the bottom increases the reach by length[b]^2 divided by twice the total length of mask. Maximizing this quantity over every choice of bottom book b therefore gives dp[mask]. The empty stack has zero overhang, so induction over subset size establishes every dp value, and the choice array reconstructs the optimal order.",
        complexityRationale:
            "There are 2^n subsets and each scans up to n candidate bottom books, giving O(n * 2^n) time. The sum, value, and choice arrays each hold 2^n entries, so space is O(2^n).",
        uses: [
            "Structural balance and center-of-mass reasoning in engineering",
            "Robotic stacking and grasp planning under stability constraints",
            "A teaching example for subset DP combined with physical invariants",
        ],
        references: [
            "Paterson and Zwick, Overhang, ACM Transactions on Algorithms, 2006",
            "Hall, The overhang problem: one hundred years on, 2005",
        ],
        workedExample:
            "With unit-length books, each new book under the stack adds 1/(2k) where k is the stack size, so four books reach 1/2 + 1/4 + 1/6 + 1/8 = 25/24 book lengths. With lengths 1 and 2 the DP finds the same overhang of about 1.167 in either order.",
    },
    id: "book-stack-dp",
    name: "Book Stacking / Maximum Overhang (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n * 2^n)", space: "O(2^n)" },
    defaultInput: { lengths: [1, 2, 3, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the book lengths and let n be the count",
        "precompute sum[mask], the total length of the books in mask",
        "set dp[0] = 0 and every other dp value to zero",
        "for each mask from 1 to two to the n minus one",
        "for every book b inside mask, let rest be mask without b",
        "let candidate be dp[rest] plus length[b] squared over twice sum[mask]",
        "keep the largest candidate in dp[mask] and remember b",
        "follow the remembered books from the full mask and report the overhang",
    ],
};

export default module;
