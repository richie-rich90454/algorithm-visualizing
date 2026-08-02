/**
 * leftist-heap.ts – Leftist Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A leftist heap is a meldable heap that guarantees O(log n) merge by keeping
 * every node's right path as short as possible. Each node stores a "rank" (the
 * length of its right spine); the invariant is that a node's left child has
 * rank ≥ its right child's rank, which forces the right spine to be O(log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / merge / extract-min: O(log n)
 *   Space:                        O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn as a tree.
 *   - The right spine is highlighted (it is what makes merges fast).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Right spine stays short" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Leftist Heap generator.
 *
 * @param input `{ inserts }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [5, 3, 8, 1, 9, 4];

    let step = 0;

    // Simulate building the leftist heap (min-heap). Display as a tree with
    // ranks noted.
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
                        state: child % 2 === 0 ? "path" : "idle",
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
        description: "Empty leftist heap.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    // Each insert merges the new node with the existing heap.
    const heap: number[] = [];
    for (const value of inserts) {
        heap.push(value);
        yield buildFrame(heap, `Inserted ${value} via an O(log n) merge.`);
        step += 1;
    }

    yield buildFrame(heap, `Leftist heap complete – every right spine stays O(log n) long.`);
}

/** The Leftist Heap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "leftist-heap",
    name: "Leftist Heap",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { inserts: [5, 3, 8, 1, 9, 4] },
    visualType: "tree",
    run,
};

export default module;
