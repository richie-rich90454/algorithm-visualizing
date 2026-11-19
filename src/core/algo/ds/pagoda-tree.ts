/**
 * pagoda-tree.ts - Pagoda (Winner-Tree) Priority Queue.
 *
 * A pagoda tree is a complete binary tournament tree. Each leaf holds one item
 * (or a large sentinel when padded to a power of two) and every internal node
 * stores the smaller of its two children, so the root is always the minimum.
 * Removing the minimum replaces its leaf with a sentinel and replays the
 * tournament only along that leaf's path to the root.
 *
 * Time:  O(log n) extract-min, O(1) find-min, O(n) build
 * Space: O(n)
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const SENTINEL = 1_000_000_000;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = task.values ?? [7, 2, 9, 4, 1, 8, 3, 5];

    const size = Math.max(1, 2 ** Math.ceil(Math.log2(Math.max(1, values.length))));
    const tree: number[] = new Array(2 * size).fill(SENTINEL);
    for (let i = 0; i < values.length; i += 1) {
        tree[size + i] = values[i] as number;
    }
    for (let i = size - 1; i >= 1; i -= 1) {
        tree[i] = Math.min(tree[2 * i] as number, tree[2 * i + 1] as number);
    }

    const makeFrame = (message: string, codeLine: number, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        for (let i = 1; i < 2 * size; i += 1) {
            const value = tree[i] as number;
            const isLeaf = i >= size;
            const slot = isLeaf ? i - size : i;
            entities.push({
                id: `t-${i}`,
                type: "node" as const,
                label: value === SENTINEL ? "inf" : String(value),
                value,
                state: i === 1 ? "highlight" : (value === SENTINEL ? "idle" : "unvisited"),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: i === 1 ? "root" : `t-${i >> 1}`, level: Math.floor(Math.log2(i)), slot },
            });
            if (2 * i < 2 * size) {
                edges.push({
                    id: `e-${i}-l`,
                    sourceId: `t-${i}`,
                    targetId: `t-${2 * i}`,
                    label: "L",
                    state: "idle",
                    directed: false,
                });
                edges.push({
                    id: `e-${i}-r`,
                    sourceId: `t-${i}`,
                    targetId: `t-${2 * i + 1}`,
                    label: "R",
                    state: "idle",
                    directed: false,
                });
            }
        }
        return {
            stepNumber: 0,
            entities,
            edges,
            description: message,
            codeLineNumber: codeLine,
            layout: "tree",
            meta,
        };
    };

    let step = 0;
    const emit = (message: string, codeLine: number, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const frame = makeFrame(message, codeLine, meta);
        frame.stepNumber = step;
        step += 1;
        return frame;
    };

    yield emit(
        `Built a pagoda tree over ${values.length} values; the root holds the minimum ${tree[1]}.`,
        1,
        { size, count: values.length, root: tree[1] },
    );

    const output: number[] = [];
    for (let removed = 0; removed < values.length; removed += 1) {
        const minimum = tree[1] as number;
        let index = 1;
        while (index < size) {
            const left = tree[2 * index] as number;
            const right = tree[2 * index + 1] as number;
            index = left <= right ? 2 * index : 2 * index + 1;
        }
        tree[index] = SENTINEL;
        index >>= 1;
        while (index >= 1) {
            tree[index] = Math.min(tree[2 * index] as number, tree[2 * index + 1] as number);
            index >>= 1;
        }
        output.push(minimum);
        yield emit(
            `Extracted minimum ${minimum}; replayed the tournament up one leaf path.`,
            removed === values.length - 1 ? 6 : 4,
            { size, count: values.length - removed - 1, root: tree[1], removed: minimum, output: [...output] },
        );
    }

    yield emit(
        `Pagoda tree drained in sorted order: ${output.join(", ")}.`,
        6,
        { size, count: 0, output },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a single-elimination tournament where each match advances the smaller value. The champion sits at the root, so finding the minimum is instant. When the champion leaves, only its side of the bracket has to replay: replace that leaf with a huge sentinel and recompute winners along the single path back to the top.",
        invariants: [
            "Every internal node stores the smaller value of its two children.",
            "The root is the minimum among all non-sentinel leaves.",
            "Padding leaves hold a sentinel larger than every real value.",
        ],
        correctness:
            "The tournament rule makes the root the minimum of all leaves by induction over the tree levels. After replacing the winning leaf with a sentinel, only ancestors of that leaf can change, and recomputing each as the minimum of its children restores the rule along the whole path; every other subtree is untouched and still correct. The next root is therefore the smallest remaining value.",
        complexityRationale:
            "Building fills each of the O(n) internal nodes once, costing O(n). An extraction walks one root-to-leaf path of length O(log n) to find the leaf and another O(log n) path to replay winners, so extract-min is O(log n) while find-min reads the root in O(1). Storage is the 2n-node tournament tree, O(n).",
        uses: [
            "Priority queues with constant-time minimum inspection",
            "K-way merge where the current smallest head is always needed",
            "Event-driven simulation with repeated minimum extraction",
        ],
        references: [
            "D. E. Knuth, The Art of Computer Programming, Vol. 3, Section 5.4 (trees and tournaments)",
            "J. W. J. Williams, Algorithm 232: Heapsort, Communications of the ACM, 1964",
        ],
        workedExample:
            "For values 7, 2, 9, 4 padded to eight leaves, the tournament root becomes 2. Extracting 2 replaces its leaf with the sentinel and replays its path, so the next root is 4. Repeating yields 2, 4, 7, 9, and the extracted sequence is fully sorted.",
    },
    id: "pagoda-tree",
    name: "Pagoda Tree",
    category: "data-structures",
    complexity: { time: "O(log n) extract-min", space: "O(n)" },
    defaultInput: { values: [7, 2, 9, 4, 1, 8, 3, 5] },
    visualType: "tree",
    run,
    pseudocode: [
        "pad the values with sentinels to the next power of two",
        "place real values in the leaves of a complete binary tree",
        "for each internal node from the bottom up store the smaller child",
        "report the root as the current minimum",
        "on extract replace the winning leaf with a sentinel",
        "walk from that leaf to the root recomputing each parent as a minimum",
        "return the old root value",
        "done: repeated extraction yields values in sorted order",
    ],
};

export default module;
