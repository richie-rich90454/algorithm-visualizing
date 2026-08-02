/**
 * pairing-heap.ts – Pairing Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A pairing heap is a simple but powerful meldable heap: it is a collection of
 * heap-ordered trees where each node links to its children as a singly linked
 * list. It supports insert and merge in O(1) amortised and extract-min by
 * merging child subtrees pairwise. Despite its simplicity it rivals the
 * Fibonacci heap in practice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / merge: O(1) amortised
 *   Extract-min:    O(log n) amortised
 *   Space:          O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn as a tree (first child + next sibling layout).
 *   - The minimum at the root is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "First-child / next-sibling" is the entire representation.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Pairing Heap generator.
 *
 * @param input `{ inserts }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [5, 3, 8, 1, 9];

    let step = 0;

    // The heap is a linked tree; we display the min as root and children as a
    // first-child/next-sibling chain.
    const buildFrame = (min: number, rest: number[], message: string): VisualFrame => {
        const values = [min, ...rest];
        const nodes: VisualEntity[] = values.map((value, index) => ({
            id: `n-${index}`,
            type: "node" as const,
            label: String(value),
            value,
            state: index === 0 ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: index === 0 ? "root" : "n-0" },
        }));
        const edges: VisualEdge[] = [];
        for (let i = 0; i < values.length - 1; i += 1) {
            edges.push({
                id: `e-${i}`,
                sourceId: `n-${i}`,
                targetId: `n-${i + 1}`,
                label: i === 0 ? "child" : "sibling",
                state: i === 0 ? "path" : "idle",
                directed: true,
            });
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
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
        description: "Empty pairing heap.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    // Simulate inserts with the minimum always at the root.
    let min = inserts[0] ?? 0;
    const rest: number[] = [];
    for (const value of inserts) {
        if (value < min) {
            rest.push(min);
            min = value;
        } else {
            rest.push(value);
        }
        yield buildFrame(min, rest, `Inserted ${value} – the minimum ${min} stays at the root.`);
        step += 1;
    }

    yield buildFrame(
        min,
        rest,
        `Pairing heap complete – merge operations happen pairwise on extract-min.`,
    );
}

/** The Pairing Heap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "pairing-heap",
    name: "Pairing Heap",
    category: "data-structures",
    complexity: { time: "O(1) insert amortised", space: "O(n)" },
    defaultInput: { inserts: [5, 3, 8, 1, 9] },
    visualType: "tree",
    run,
};

export default module;
