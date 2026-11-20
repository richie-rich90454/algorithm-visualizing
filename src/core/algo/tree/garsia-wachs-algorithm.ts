/**
 * garsia-wachs-algorithm.ts - Garsia-Wachs Optimal Alphabetic Tree
 *
 * Phase one repeatedly merges the leftmost adjacent pair with a locally
 * minimal sum and reinserts the new node before the largest earlier weight it
 * does not dominate. Leaf depths from that tree determine a unique tree with
 * the correct left-to-right order and the same optimal cost.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Task = { weights?: number[] };
type Node = { id: string; weight: number; left?: Node; right?: Node; leaf?: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const weights = (Array.isArray(task.weights) ? task.weights : [4, 3, 2, 6, 5])
        .map((w) => Math.max(0, Math.floor(w)));
    const n = weights.length;
    const frames: VisualFrame[] = [];
    let step = 0;
    let merges = 0;

    const emitList = (list: number[], message: string, line: number, hot: number[] = []): void => {
        frames.push({
            stepNumber: step,
            entities: list.map((w, i) => ({
                id: `cell-${i}`,
                type: "cell",
                label: String(w),
                value: w,
                state: hot.includes(i) ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            })),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { leaves: n, merges, items: list.length },
        });
        step += 1;
    };

    if (n === 0) {
        emitList([], "No weights - there is no alphabetic tree to build.", 0);
        yield* frames;
        return;
    }
    if (n === 1) {
        emitList([weights[0] ?? 0], "A single weight already forms the optimal tree.", 0);
        frames.push({
            stepNumber: step,
            entities: [{
                id: "leaf-0",
                type: "node",
                label: `w=${weights[0]}`,
                value: weights[0] ?? 0,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            }],
            edges: [],
            description: "One leaf at depth zero gives cost zero.",
            codeLineNumber: 6,
            layout: "tree",
            meta: { leaves: 1, optimalCost: 0, merges: 0 },
        });
        yield* frames;
        return;
    }

    const infinity = weights.reduce((a, b) => a + b, 0) + 1;
    let items: Array<{ node: Node; weight: number }> = [
        { node: { id: "sentinel", weight: infinity }, weight: infinity },
        ...weights.map((w, i) => ({ node: { id: `leaf-${i}`, weight: w, leaf: i }, weight: w })),
    ];

    const fork = (a: { node: Node; weight: number }, b: { node: Node; weight: number }) => {
        merges += 1;
        return {
            node: { id: `merge-${merges}`, weight: a.weight + b.weight, left: a.node, right: b.node },
            weight: a.weight + b.weight,
        };
    };
    const insert = (x: { node: Node; weight: number }, list: Array<{ node: Node; weight: number }>) => {
        let splitAt = 0;
        while (splitAt < list.length && (list[splitAt]?.weight ?? 0) < x.weight) {
            splitAt += 1;
        }
        const before = list.slice(0, splitAt);
        const after = list.slice(splitAt);
        return [...before, ...combine(x, after)];
    };
    const combine = (x: { node: Node; weight: number }, list: Array<{ node: Node; weight: number }>): Array<{ node: Node; weight: number }> => {
        if (list.length < 2) {
            return [x, ...list];
        }
        const y = list[0] as { node: Node; weight: number };
        const z = list[1] as { node: Node; weight: number };
        if (x.weight >= z.weight) {
            return combine(x, insert(fork(y, z), list.slice(2)));
        }
        return [x, ...list];
    };

    emitList(items.map((item) => item.weight), `Initial working list with an infinity sentinel: ${items.map((i) => i.weight).join(", ")}.`, 0);

    const source = [...items];
    items = [];
    for (let k = source.length - 1; k >= 0; k -= 1) {
        const x = source[k] as { node: Node; weight: number };
        items = combine(x, items);
        emitList(items.map((item) => item.weight), `Inserted weight ${x.weight}; working list is now ${items.map((i) => i.weight).join(", ")}.`, 2);
    }

    const root = items[1]?.node;
    if (!root) {
        emitList([], "Phase one did not produce a tree.", 3);
        yield* frames;
        return;
    }

    const depths = new Map<number, number>();
    const mark = (node: Node, depth: number): void => {
        if (node.leaf !== undefined) {
            depths.set(node.leaf, depth);
            return;
        }
        if (node.left) {
            mark(node.left, depth + 1);
        }
        if (node.right) {
            mark(node.right, depth + 1);
        }
    };
    mark(root, 0);

    const parentMap = new Map<string, string | null>();
    const ids: string[] = [];
    let cursor = 0;
    const build = (depth: number): string => {
        const leafIndex = cursor;
        if (depths.get(leafIndex) === depth) {
            cursor += 1;
            const id = `leaf-${leafIndex}`;
            ids.push(id);
            parentMap.set(id, parent);
            return id;
        }
        const id = `join-${ids.length}`;
        ids.push(id);
        parentMap.set(id, parent);
        parent = id;
        build(depth + 1);
        build(depth + 1);
        parent = parentMap.get(id) ?? null;
        return id;
    };
    let parent: string | null = null;
    build(0);

    let cost = 0;
    for (let i = 0; i < n; i += 1) {
        cost += (weights[i] ?? 0) * (depths.get(i) ?? 0);
    }
    frames.push({
        stepNumber: step,
        entities: makeTreeNodes(parentMap, ids).map((node) => {
            const leafIndex = node.id.startsWith("leaf-") ? Number(node.id.slice(5)) : -1;
            return {
                ...node,
                label: leafIndex >= 0 ? `w=${weights[leafIndex]}` : "join",
                state: leafIndex >= 0 ? "sorted" : "visited",
            };
        }),
        edges: makeTreeEdges(parentMap, ids),
        description: `Garsia-Wachs produced an order-preserving tree with weighted path cost ${cost}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { leaves: n, merges, optimalCost: cost, leafDepths: Array.from(depths.values()) },
    });
    step += 1;
    yield* frames;
}

const module: AlgorithmModule = {
    id: "garsia-wachs-algorithm",
    name: "Garsia-Wachs Algorithm",
    category: "tree",
    complexity: { time: "O(n log n) with balanced lists", space: "O(n)" },
    defaultInput: { weights: [4, 3, 2, 6, 5] },
    visualType: "tree",
    run,
    pseudocode: [
        "append an infinity sentinel and list the leaves in order",
        "insert each weight from right to left into a working list",
        "while the new weight dominates the second list entry",
        "merge the two lightest adjacent entries into one node",
        "reinsert the merged node before the largest lighter prefix",
        "record the depth of every leaf in the merged tree",
        "rebuild a tree with those depths in the original leaf order",
        "report the weighted path cost",
    ],
    education: {
        intuition:
            "Garsia-Wachs builds an optimal alphabetic tree in two stages. First it makes a tree with optimal cost but possibly shuffled leaves by merging locally minimal adjacent pairs. Because the leaf depths are already correct, those depths can be reused to lay the leaves out in their required order.",
        invariants: [
            "Each merge creates one internal node whose weight is the sum of its children.",
            "Leaves keep the same depths when the tree is rebuilt in sorted order.",
            "The working list remains two-descending around each examined pair.",
        ],
        correctness:
            "Garsia and Wachs proved that merging the leftmost pair with a locally minimal sum preserves the existence of an optimal alphabetic tree. The final depths therefore match some optimum. Rebuilding a tree with those depths in the original order is always possible and keeps weighted path length unchanged, so the result is optimal.",
        complexityRationale:
            "A direct scan of the working list makes this quadratic, while balanced lists reduce each insert and merge to O(log n), giving O(n log n). Nodes and the working list use O(n) space.",
        uses: [
            "Constructing optimal alphabetic codes",
            "Building optimal binary search trees from frequency data",
            "A fast alternative to the cubic interval DP",
        ],
        references: [
            "Garsia and Wachs, A New Algorithm for Minimum Cost Binary Trees, SIAM Journal on Computing 1977",
            "Knuth, The Art of Computer Programming, Volume 3, section 6.2.2",
        ],
        workedExample:
            "For weights 4, 3, 2, 6, 5 the working list repeatedly merges the smallest adjacent pair and reinserts the sum. The resulting leaf depths are then reused to place leaves 4, 3, 2, 6, 5 in order with the same minimum cost the interval DP finds.",
    },
};

export default module;
