/**
 * stack-linked.ts â€?Stack (linked-list based)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A linked stack is a singly linked list where pushes and pops happen at the
 * head. Because the head is always accessible, both operations are O(1) and
 * the stack never needs to know its size in advance. It trades the array
 * version's cache locality for dynamic growth without resizing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Push / pop / peek: O(1)
 *   Space:             O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are a vertical chain; the head (top) is highlighted.
 *   - The pushed node is YELLOW (comparing).
 *   - The popped node is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Same LIFO semantics as the array stack, different storage.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a linked-stack Visualization (head at the top).
 *
 * @param items The stack contents (top â†?bottom).
 * @returns { nodes, edges } entity pairs.
 */
function buildStack(items: number[]): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = items.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: index === 0 ? "comparing" : "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index > 0 ? String(index - 1) : "root" },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < items.length - 1; i += 1) {
        edges.push({
            id: `next-${i}`,
            sourceId: `node-${i}`,
            targetId: `node-${i + 1}`,
            label: "next",
            state: "idle",
            directed: true,
        });
    }
    return { nodes, edges };
}

/**
 * The Stack (linked) generator.
 *
 * @param input `{ pushes, popCount }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pushes?: number[]; popCount?: number } | null) ?? {};
    const pushes = task.pushes ?? [5, 3, 8];
    const popCount = typeof task.popCount === "number" ? task.popCount : 2;

    let step = 0;
    const stack: number[] = [];

    // Frame 0: the empty stack (shown with a placeholder node).
    yield {
        stepNumber: step,
        entities: [
            {
                id: "node-0",
                type: "node" as const,
                label: "null",
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
        description: "Empty linked stack â€?the head points to null.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    // Push each value at the head.
    for (const value of pushes) {
        stack.unshift(value);
        const { nodes, edges } = buildStack(stack);
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Pushed ${value} at the head â€?stack is [${stack.join(", ")}].`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: stack.length },
        };
        step += 1;
    }

    // Pop from the head.
    for (let i = 0; i < popCount && stack.length > 0; i += 1) {
        const popped = stack.shift();
        const { nodes, edges } = buildStack(stack);
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Popped ${popped} from the head (LIFO).`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { size: stack.length },
        };
        step += 1;
    }
}

/** The Stack (linked) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "stack-linked",
    name: "Stack (Linked)",
    category: "data-structures",
    complexity: { time: "O(1) push/pop", space: "O(n)" },
    defaultInput: { pushes: [5, 3, 8], popCount: 2 },
    visualType: "graph",
    run,
};

export default module;
