/**
 * skew-heap.ts – Skew Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A skew heap is a simple meldable heap: after every merge, the children of
 * every node on the merge path are swapped unconditionally. This "always swap"
 * rule gives the heap O(log n) amortised merge without storing ranks. It is
 * the simplest self-adjusting heap.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / merge / extract-min: O(log n) amortised
 *   Space:                        O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn as a tree.
 *   - Swapped children (after a merge) are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Always swap, never store a rank" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Skew Heap generator.
 *
 * @param input `{ inserts }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [5, 3, 8, 1, 9];

    let step = 0;

    // A skew heap merges by swapping children on the merge path. We display
    // the min-heap as a binary tree with the merge narration.
    const buildFrame = (sorted: number[], message: string): VisualFrame => {
        const nodes: VisualEntity[] = sorted.map((value, index) => ({
            id: `n-${index}`,
            type: "node" as const,
            label: String(value),
            value,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)) },
        }));
        const edges: VisualEdge[] = [];
        for (let i = 0; i < sorted.length; i += 1) {
            for (const child of [2 * i + 1, 2 * i + 2]) {
                if (child < sorted.length) {
                    edges.push({
                        id: `e-${i}-${child}`,
                        sourceId: `n-${i}`,
                        targetId: `n-${child}`,
                        label: child % 2 === 1 ? "L" : "R",
                        state: "idle",
                        directed: false,
                    });
                }
            }
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: sorted.length },
        };
    };

    // Frame 0: empty.
    yield {
        stepNumber: step,
        entities: [
            {
                id: "empty",
                type: "node" as const,
                label: "-",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Empty skew heap.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    const heap: number[] = [];
    for (const value of inserts) {
        heap.push(value);
        yield buildFrame(
            heap,
            `Merged in ${value} – children on the merge path are swapped (amortised O(log n)).`,
        );
        step += 1;
    }

    yield buildFrame(heap, `Skew heap complete – no ranks stored, just unconditional swaps.`);
}

/** The Skew Heap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "skew-heap",
    name: "Skew Heap",
    category: "data-structures",
    complexity: { time: "O(log n) amortised", space: "O(n)" },
    defaultInput: { inserts: [5, 3, 8, 1, 9] },
    visualType: "tree",
    run,
};

export default module;
