/**
 * circular-linked-list.ts â€?Circular Linked List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A circular linked list connects the last node back to the first, forming a
 * ring. There is no "head" or "tail" in the ordinary sense â€?any node can be
 * the entry point. This makes the list ideal for round-robin schedulers and
 * game loops where you must cycle through elements forever.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert at known position: O(1)
 *   Search:                   O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes form a ring of circles connected by "next" edges.
 *   - The closing edge back to the start is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The closing edge is the entire point.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Circular Linked List generator.
 *
 * @param input `{ values }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [7, 3, 9, 1];

    let step = 0;

    const nodes: VisualEntity[] = values.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index > 0 ? String(index - 1) : "root" },
    }));

    const edges: VisualEdge[] = [];
    for (let i = 0; i < values.length; i += 1) {
        edges.push({
            id: `next-${i}`,
            sourceId: `node-${i}`,
            targetId: `node-${(i + 1) % values.length}`,
            label: "next",
            state: i === values.length - 1 ? "highlight" : "idle",
            directed: true,
        });
    }

    // Frame 0: the ring.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Circular linked list: [${values.join(" â†?")}] â†?back to ${values[0]}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { size: values.length },
    };
    step += 1;

    // Traverse one full cycle.
    for (let i = 0; i < values.length; i += 1) {
        const current = nodes.map((n) => ({ ...n }));
        current[i] = { ...current[i], state: "comparing" as const };
        yield {
            stepNumber: step,
            entities: current,
            edges: edges.map((e) => ({ ...e })),
            description: `Cycling â€?visiting ${values[i]}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { size: values.length },
        };
        step += 1;
    }

    // The closing edge brings us back to the start.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Full cycle complete â€?the last node points back to ${values[0]}.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { size: values.length },
    };
}

/** The Circular Linked List module, registered with the engine. */
const module: AlgorithmModule = {
    id: "circular-linked-list",
    name: "Circular Linked List",
    category: "data-structures",
    complexity: { time: "O(1) known insert, O(n) search", space: "O(n)" },
    defaultInput: { values: [7, 3, 9, 1] },
    visualType: "graph",
    run,
};

export default module;
