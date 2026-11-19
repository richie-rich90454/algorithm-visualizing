/**
 * alphabetic-tree-optimal.ts - Optimal Alphabetic Tree by Dynamic Programming
 *
 * Given leaf weights in a fixed left-to-right order, find the binary tree that
 * minimizes the sum of weight times leaf depth while keeping that order. The
 * DP over contiguous intervals is the optimal-binary-search-tree recursion
 * with zero internal-node weights and costs O(n^3).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Task = { weights?: number[] };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const weights = (Array.isArray(task.weights) ? task.weights : [4, 3, 2, 6, 5])
        .map((w) => Math.max(0, Math.floor(w)));
    const n = weights.length;
    const frames: VisualFrame[] = [];
    let step = 0;

    const dp = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const split = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
    const sum = Array.from({ length: n }, () => new Array<number>(n).fill(0));

    const dpCells = (hot: [number, number] | null): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const value = dp[i]?.[j] ?? 0;
                const state: EntityState = hot && hot[0] === i && hot[1] === j ? "comparing" : j < i ? "unvisited" : "idle";
                entities.push({
                    id: `cell-${i}-${j}`,
                    type: "cell",
                    label: j < i ? "-" : String(value),
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
        return entities;
    };

    const emitDp = (hot: [number, number] | null, description: string, line: number): void => {
        frames.push({
            stepNumber: step,
            entities: dpCells(hot),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: { leaves: n, optimalCost: dp[0]?.[n - 1] ?? 0, cells: n * n },
        });
        step += 1;
    };

    if (n === 0) {
        emitDp(null, "No weights - there is no alphabetic tree to build.", 0);
        yield* frames;
        return;
    }

    for (let i = 0; i < n; i += 1) {
        dp[i][i] = 0;
        sum[i][i] = weights[i] ?? 0;
    }
    emitDp(null, `Optimal alphabetic tree on ${n} ordered weights: ${weights.join(", ")}.`, 0);

    for (let length = 2; length <= n; length += 1) {
        for (let i = 0; i + length <= n; i += 1) {
            const j = i + length - 1;
            sum[i][j] = (sum[i]?.[j - 1] ?? 0) + (weights[j] ?? 0);
            let best = Infinity;
            let bestK = i;
            for (let k = i; k < j; k += 1) {
                const value = (dp[i]?.[k] ?? 0) + (dp[k + 1]?.[j] ?? 0);
                if (value < best) {
                    best = value;
                    bestK = k;
                }
            }
            dp[i][j] = (sum[i]?.[j] ?? 0) + best;
            split[i][j] = bestK;
            emitDp([i, j], `Interval ${i}..${j}: best split after ${bestK}, cost ${dp[i][j]}.`, 3);
        }
    }

    const parentMap = new Map<string, string | null>();
    const ids: string[] = [];
    const build = (i: number, j: number, parent: string | null): string => {
        if (i === j) {
            const id = `leaf-${i}`;
            ids.push(id);
            parentMap.set(id, parent);
            return id;
        }
        const id = `int-${i}-${j}`;
        ids.push(id);
        parentMap.set(id, parent);
        const k = split[i]?.[j] ?? i;
        build(i, k, id);
        build(k + 1, j, id);
        return id;
    };
    build(0, n - 1, null);

    const depth = new Map<string, number>();
    const walk = (id: string, d: number): void => {
        depth.set(id, d);
        for (const [child, p] of parentMap) {
            if (p === id) {
                walk(child, d + 1);
            }
        }
    };
    const root = ids[0] as string;
    walk(root, 0);
    let realizedCost = 0;
    for (let i = 0; i < n; i += 1) {
        realizedCost += (weights[i] ?? 0) * (depth.get(`leaf-${i}`) ?? 0);
    }

    frames.push({
        stepNumber: step,
        entities: makeTreeNodes(parentMap, ids).map((node) => {
            const leafIndex = node.id.startsWith("leaf-") ? Number(node.id.slice(5)) : -1;
            return {
                ...node,
                label: leafIndex >= 0 ? `w=${weights[leafIndex]}` : "join",
                value: leafIndex >= 0 ? (weights[leafIndex] ?? 0) : (sum[leafIndex] ?? 0),
                state: leafIndex >= 0 ? "sorted" : "visited",
            };
        }),
        edges: makeTreeEdges(parentMap, ids),
        description: `Optimal alphabetic tree keeps leaves in input order with weighted path cost ${realizedCost}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: {
            leaves: n,
            optimalCost: realizedCost,
            dpCost: dp[0]?.[n - 1] ?? 0,
            leafOrder: weights.join(","),
        },
    });
    step += 1;

    yield* frames;
}

const module: AlgorithmModule = {
    id: "alphabetic-tree-optimal",
    name: "Optimal Alphabetic Tree (Dynamic Programming)",
    category: "tree",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: { weights: [4, 3, 2, 6, 5] },
    visualType: "tree",
    run,
    pseudocode: [
        "read leaf weights in their fixed left-to-right order",
        "set each single-leaf interval cost to zero",
        "for every interval length from two to n",
        "try every split point and store the cheapest one",
        "set the interval cost to its weight sum plus the best split cost",
        "reconstruct the tree from the stored split points",
        "read leaf depths and report the weighted path cost",
    ],
    education: {
        intuition:
            "An alphabetic tree keeps its leaves in a prescribed order, like the words in a dictionary. Since a split must divide one contiguous block into two contiguous blocks, the problem has optimal substructure: the best tree for a block is a best left block, a best right block, and the cheapest place to join them.",
        invariants: [
            "Each DP state covers a contiguous interval of leaves in the original order.",
            "The cost stored for an interval equals its weight sum plus the cost of its two child intervals.",
            "The reconstructed tree's in-order leaf labels match the input order exactly.",
        ],
        correctness:
            "Every alphabetic tree over an interval has a root that splits the interval at some position k. The two subtrees are themselves alphabetic trees over their intervals, so choosing the best k by the DP recurrence considers every possible tree and picks a minimum. Inductively dp[0][n-1] is the optimal weighted path cost.",
        complexityRationale:
            "There are O(n^2) intervals and each scans O(n) split points, giving O(n^3) time and O(n^2) storage for the DP and split tables.",
        uses: [
            "Optimal binary search trees with ordered keys",
            "Variable-length prefix codes that preserve symbol order",
            "Verifying faster alphabetic-tree algorithms such as Garsia-Wachs",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, dynamic programming chapter",
            "Knuth, The Art of Computer Programming, Volume 3, optimal alphabetic trees",
        ],
        workedExample:
            "For weights 4, 3, 2, 6, 5 the DP finds the cheapest join of the block 4,3,2 with 6,5. The reconstructed tree keeps leaves in that order and the weighted sum of their depths equals the value stored at dp[0][4].",
    },
};

export default module;
