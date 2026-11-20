/**
 * mo-algorithm.ts - Mo's Algorithm for Offline Range Queries
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Mo's algorithm answers many static range queries by reordering them so the
 * sliding window moves as little as possible. Queries are bucketed by the
 * block of their left endpoint and sorted by the right endpoint in alternating
 * directions. A single window then expands and contracts to each query in
 * turn, so the total number of add and remove operations is O(n sqrt n)
 * regardless of how the queries were originally ordered.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O((n + q) sqrt n) for n elements and q queries
 *   Space: O(n + q)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Array bars show the values; bars inside the active window are highlighted.
 *   - The left and right ends of the window are marked separately.
 *   - Each frame records the distinct-value count for the current query.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Query {
    original: number;
    lo: number;
    hi: number;
}

function makeBars(values: number[], curL: number, curR: number, lo: number, hi: number): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index >= curL && index <= curR) {
            state = "active";
        }
        if (index === lo || index === hi) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, inWindow: index >= curL && index <= curR },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; queries?: number[][] } | null) ?? {};
    const values = Array.isArray(task.values) ? (task.values as number[]).slice() : [1, 2, 1, 3, 2, 1, 4, 2];
    const rawQueries = Array.isArray(task.queries) ? task.queries : [[0, 4], [2, 6], [1, 3], [5, 7], [0, 7]];
    const n = values.length;
    const block = Math.max(1, Math.floor(Math.sqrt(Math.max(n, 1))));

    const queries: Query[] = [];
    rawQueries.forEach((pair, index) => {
        if (!Array.isArray(pair) || pair.length < 2) {
            return;
        }
        let lo = Math.floor(Number(pair[0]));
        let hi = Math.floor(Number(pair[1]));
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
            return;
        }
        lo = Math.max(0, Math.min(n - 1, lo));
        hi = Math.max(0, Math.min(n - 1, hi));
        if (lo > hi) {
            const swap = lo;
            lo = hi;
            hi = swap;
        }
        queries.push({ original: index, lo, hi });
    });

    const answers = new Array<number>(rawQueries.length).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, -1, -1, -1),
        edges: [],
        description: `Read ${n} values and ${queries.length} offline range queries; block size is ${block}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, block, queryCount: queries.length, answers: answers.slice() },
    };
    step += 1;

    if (n === 0 || queries.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(values, -1, -1, -1, -1),
            edges: [],
            description: "No values or no valid queries are present, so there is nothing to answer.",
            codeLineNumber: 8,
            layout: "array",
            meta: { n, block, queryCount: queries.length, answers: answers.slice() },
        };
        return;
    }

    queries.sort((a, b) => {
        const blockA = Math.floor(a.lo / block);
        const blockB = Math.floor(b.lo / block);
        if (blockA !== blockB) {
            return blockA - blockB;
        }
        return blockA % 2 === 0 ? a.hi - b.hi : b.hi - a.hi;
    });

    const frequency = new Map<number, number>();
    let distinct = 0;
    let moves = 0;
    let curL = 0;
    let curR = -1;

    const add = (index: number): void => {
        const value = values[index] as number;
        const count = frequency.get(value) ?? 0;
        if (count === 0) {
            distinct += 1;
        }
        frequency.set(value, count + 1);
        moves += 1;
    };
    const remove = (index: number): void => {
        const value = values[index] as number;
        const count = (frequency.get(value) ?? 0) - 1;
        if (count === 0) {
            frequency.delete(value);
            distinct -= 1;
        } else {
            frequency.set(value, count);
        }
        moves += 1;
    };

    for (const query of queries) {
        while (curL > query.lo) {
            curL -= 1;
            add(curL);
        }
        while (curR < query.hi) {
            curR += 1;
            add(curR);
        }
        while (curL < query.lo) {
            remove(curL);
            curL += 1;
        }
        while (curR > query.hi) {
            remove(curR);
            curR -= 1;
        }
        answers[query.original] = distinct;

        yield {
            stepNumber: step,
            entities: makeBars(values, curL, curR, query.lo, query.hi),
            edges: [],
            description: `Query [${query.lo}, ${query.hi}] answered with ${distinct} distinct value(s); the window moved ${moves} time(s).`,
            codeLineNumber: 7,
            layout: "array",
            meta: {
                n,
                block,
                queryCount: queries.length,
                answers: answers.slice(),
                queryIndex: query.original,
                lo: query.lo,
                hi: query.hi,
                curL,
                curR,
                distinct,
                moves,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, -1, -1, -1),
        edges: [],
        description: `All ${queries.length} queries answered after ${moves} window moves in sorted Mo order.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { n, block, queryCount: queries.length, answers: answers.slice(), moves },
    };
}

/** The Mo's algorithm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Moving one step of a sliding window is cheap, but jumping to an arbitrary query range is not. Sort the queries so that nearby ranges are handled together, then reuse a single window for all of them. Grouping by left block and sweeping the right endpoint back and forth keeps the total movement small.",
        invariants: [
            "After each query the active window equals that query's (clamped) range.",
            "The frequency map counts exactly the values currently inside the window.",
            "distinct is the number of keys in the frequency map with a positive count.",
            "Every answer is written to the query's original position, not its sorted position.",
        ],
        correctness:
            "The add and remove operations keep the frequency map in exact agreement with the window after every move. When the window equals a query's range, the map therefore counts precisely the values in that range, so distinct equals the number of different values there. Because answers are stored at original indices, output order is restored.",
        complexityRationale:
            "With block size roughly sqrt(n), the right endpoint moves at most n per block and there are about n / sqrt(n) blocks, giving O(n sqrt n) right moves. The left endpoint moves at most O(sqrt n) per query, giving O(q sqrt n) left moves. The frequency map holds at most n values and the query list holds q entries.",
        uses: [
            "Answering many static range distinct-count queries",
            "Offline network-analysis queries over array slices",
            "Competitive-programming range-query problem solving",
        ],
        references: [
            "Mo, USACO tutorial on Mo's algorithm, 2015",
            "Halim, Competitive Programming 3, range-query chapter",
        ],
        workedExample:
            "For values [1,2,1,3] and queries [0,2] and [1,3], sorting by left block then right end visits [0,2] first. The window grows to indices 0 through 2 and holds values 1,2,1, so the distinct count is 2. Sliding to [1,3] removes index 0 and adds index 3, leaving 2,1,3 with three distinct values.",
    },
    id: "mo-algorithm",
    name: "Mo's Algorithm",
    category: "searching",
    complexity: { time: "O((n + q) sqrt n)", space: "O(n + q)" },
    defaultInput: {
        values: [1, 2, 1, 3, 2, 1, 4, 2],
        queries: [[0, 4], [2, 6], [1, 3], [5, 7], [0, 7]],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the array and all offline range queries",
        "set the block size to the square root of the array length",
        "sort queries by left block, then by right end in alternating order",
        "start with an empty window and a zero distinct-value count",
        "for each query in sorted order",
        "slide the two ends until the window matches the query range",
        "add a value when the window grows, remove it when the window shrinks",
        "store the distinct count at the query's original position",
        "done: return all answers in the original query order",
    ],
};

export default module;
