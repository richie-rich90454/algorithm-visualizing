/**
 * berkman-vishkin-rmq.ts - Berkman-Vishkin Range Minimum Query
 *
 * An array RMQ is reduced to an LCA query on its min Cartesian tree, then to
 * a ±1 RMQ on the Euler tour of that tree. Block prefix and suffix minima plus
 * a sparse table over block minima answer a query in constant time after
 * linear-size preprocessing.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { array?: number[]; query?: [number, number] };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const array = (Array.isArray(task.array) ? task.array : [5, 2, 8, 1, 7, 3, 9])
        .map((v) => Math.floor(Number(v) || 0));
    const n = array.length;
    const frames: VisualFrame[] = [];
    let step = 0;

    const cells = (hot: number[] = [], answerIndex = -1): VisualEntity[] =>
        array.map((value, i) => ({
            id: `cell-${i}`,
            type: "cell",
            label: String(value),
            value,
            state: i === answerIndex ? "sorted" : hot.includes(i) ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
    const emit = (description: string, line: number, hot: number[] = [], answerIndex = -1, extra: Record<string, number | string | boolean | Array<number | string>> = {}): void => {
        frames.push({
            stepNumber: step,
            entities: cells(hot, answerIndex),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: { length: n, answer: answerIndex >= 0 ? (array[answerIndex] ?? 0) : -Infinity, ...extra },
        });
        step += 1;
    };

    if (n === 0) {
        emit("Empty array - there is no range minimum to report.", 0, [], -1, { answer: -Infinity });
        yield* frames;
        return;
    }

    const query: [number, number] = Array.isArray(task.query)
        ? [Math.max(0, Math.min(n - 1, Math.floor(task.query[0] ?? 0))), Math.max(0, Math.min(n - 1, Math.floor(task.query[1] ?? 0)))]
        : [1, 5];
    const [rawL, rawR] = query;
    const l = Math.min(rawL, rawR);
    const r = Math.max(rawL, rawR);
    emit(`Berkman-Vishkin RMQ on [${array.join(", ")}]; query range ${l}..${r}.`, 0, Array.from({ length: r - l + 1 }, (_, i) => l + i));

    const left = new Array<number>(n).fill(-1);
    const right = new Array<number>(n).fill(-1);
    const stack: number[] = [];
    for (let i = 0; i < n; i += 1) {
        let last = -1;
        while (stack.length > 0 && (array[stack[stack.length - 1] as number] ?? 0) > (array[i] ?? 0)) {
            last = stack.pop() as number;
        }
        if (stack.length > 0) {
            right[stack[stack.length - 1] as number] = i;
        }
        if (last >= 0) {
            left[i] = last;
        }
        stack.push(i);
    }
    const root = stack[0] ?? 0;
    emit(`Cartesian tree root is index ${root} with value ${array[root]}; it is the leftmost minimum.`, 1, [root]);

    const tour: number[] = [];
    const depth: number[] = [];
    const first = new Array<number>(n).fill(-1);
    const walk = (node: number, d: number): void => {
        if (first[node] === -1) {
            first[node] = tour.length;
        }
        tour.push(node);
        depth.push(d);
        const lChild = left[node] ?? -1;
        const rChild = right[node] ?? -1;
        if (lChild >= 0) {
            walk(lChild, d + 1);
            tour.push(node);
            depth.push(d);
        }
        if (rChild >= 0) {
            walk(rChild, d + 1);
            tour.push(node);
            depth.push(d);
        }
    };
    walk(root, 0);
    emit(`Euler tour has ${tour.length} entries, with depths changing by one at each step.`, 2);

    const size = Math.max(2, Math.floor(Math.log2(Math.max(2, tour.length)) / 2));
    const blocks = Math.ceil(tour.length / size);
    const prefixMin: number[][] = [];
    const suffixMin: number[][] = [];
    const blockMin: number[] = [];
    for (let b = 0; b < blocks; b += 1) {
        const from = b * size;
        const to = Math.min(tour.length, from + size) - 1;
        const pre: number[] = [];
        let best = from;
        for (let i = from; i <= to; i += 1) {
            if ((depth[i] ?? 0) < (depth[best] ?? 0)) {
                best = i;
            }
            pre.push(best);
        }
        prefixMin.push(pre);
        const suf = new Array<number>(to - from + 1).fill(to);
        best = to;
        for (let i = to; i >= from; i -= 1) {
            if ((depth[i] ?? 0) <= (depth[best] ?? 0)) {
                best = i;
            }
            suf[i - from] = best;
        }
        suffixMin.push(suf);
        blockMin.push(best);
    }
    const levels = Math.max(1, Math.floor(Math.log2(Math.max(1, blocks))) + 1);
    const sparse: number[][] = [blockMin];
    for (let k = 1; k < levels; k += 1) {
        const previous = sparse[k - 1] ?? [];
        const current: number[] = [];
        for (let i = 0; i + (1 << k) <= blocks; i += 1) {
            const a = previous[i] ?? 0;
            const b = previous[i + (1 << (k - 1))] ?? 0;
            current.push((depth[a] ?? 0) <= (depth[b] ?? 0) ? a : b);
        }
        sparse.push(current);
    }
    emit(`Split the tour into ${blocks} blocks of size ${size}; built ${levels} sparse-table level(s) over block minima.`, 3);

    const rangeMinTour = (i: number, j: number): number => {
        const from = Math.min(i, j);
        const to = Math.max(i, j);
        const blockA = Math.floor(from / size);
        const blockB = Math.floor(to / size);
        let best = from;
        if (blockA === blockB) {
            for (let k = from; k <= to; k += 1) {
                if ((depth[k] ?? 0) < (depth[best] ?? 0)) {
                    best = k;
                }
            }
            return best;
        }
        const suffix = suffixMin[blockA]?.[from - blockA * size] ?? from;
        const prefix = prefixMin[blockB]?.[to - blockB * size] ?? to;
        best = (depth[suffix] ?? 0) <= (depth[prefix] ?? 0) ? suffix : prefix;
        if (blockA + 1 <= blockB - 1) {
            const span = blockB - blockA - 1;
            const k = Math.floor(Math.log2(Math.max(1, span)));
            const row = sparse[k] ?? [];
            const a = row[blockA + 1] ?? from;
            const b = row[blockB - (1 << k)] ?? to;
            const middle = (depth[a] ?? 0) <= (depth[b] ?? 0) ? a : b;
            if ((depth[middle] ?? 0) < (depth[best] ?? 0)) {
                best = middle;
            }
        }
        return best;
    };

    const i = first[l] ?? 0;
    const j = first[r] ?? 0;
    const k = rangeMinTour(i, j);
    const answerNode = tour[k] ?? 0;
    const answerValue = array[answerNode] ?? 0;
    let truth = Infinity;
    for (let idx = l; idx <= r; idx += 1) {
        truth = Math.min(truth, array[idx] ?? 0);
    }
    emit(`Tour range ${i}..${j} has minimum depth at node ${answerNode}, value ${answerValue}.`, 5, Array.from({ length: r - l + 1 }, (_, idx) => l + idx), answerNode, {
        query: [l, r],
        bruteForce: truth,
        tourIndex: k,
    });
    emit(`RMQ answer for ${l}..${r} is ${answerValue}.`, 6, Array.from({ length: r - l + 1 }, (_, idx) => l + idx), answerNode, {
        query: [l, r],
        answer: answerValue,
    });
    yield* frames;
}

const module: AlgorithmModule = {
    id: "berkman-vishkin-rmq",
    name: "Berkman-Vishkin RMQ",
    category: "tree",
    complexity: { time: "O(n) preprocessing, O(1) query", space: "O(n)" },
    defaultInput: { array: [5, 2, 8, 1, 7, 3, 9], query: [1, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "build a min Cartesian tree of the array",
        "record its Euler tour and the depth at every visit",
        "store the first tour position of each array index",
        "split the depth sequence into small blocks",
        "precompute prefix and suffix minima inside each block",
        "build a sparse table over the minima of whole blocks",
        "combine boundary and whole-block minima for a query",
        "read the array value at the shallowest tour visit",
    ],
    education: {
        intuition:
            "A range minimum query on an array can be turned into a lowest-common-ancestor query on a Cartesian tree: the shallowest node visited between two leaves is the minimum of the interval. Euler-tour depths change by plus or minus one, so those depths can be indexed with small block tables rather than a large sparse table.",
        invariants: [
            "The Cartesian tree's in-order traversal reproduces the original array.",
            "Consecutive Euler-tour depths differ by exactly one.",
            "A whole block's stored minimum is the shallowest visit inside that block.",
        ],
        correctness:
            "The LCA of two Cartesian-tree nodes is the minimum element of the array interval between them because the Cartesian tree is a min heap whose in-order order matches the array. In the Euler tour the LCA is exactly the shallowest vertex between the first visits of the two nodes. The block decomposition considers the left boundary, right boundary, and every whole block in between, so it returns that shallowest vertex.",
        complexityRationale:
            "Building the Cartesian tree, Euler tour, block tables, and sparse table all take linear time and space; each query reads at most three precomputed entries. This improves on the O(n log n) preprocessing of a plain sparse table.",
        uses: [
            "Static range minimum queries on large arrays",
            "LCA preprocessing on trees",
            "RMQ primitives in suffix-array and string algorithms",
        ],
        references: [
            "Berkman and Vishkin, Recursive Star-Tree Parallel Data Structure, SIAM Journal on Computing 1993",
            "Bender and Farach-Colton, The LCA Problem Revisited, LATIN 2000",
        ],
        workedExample:
            "On the array 5,2,8,1,7,3,9 the Cartesian tree has root value 1 at index 3. The query 1..5 visits tour positions from the first occurrence of index 1 to that of index 5; the shallowest visit is the node holding 1, so the answer is 1.",
    },
};

export default module;
