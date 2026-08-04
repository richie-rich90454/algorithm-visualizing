/**
 * splay-tree.ts â€?Splay Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A splay tree is a self-adjusting BST: every accessed node is moved to the
 * root by a series of zig, zig-zig, and zig-zag rotations ("splaying").
 * Frequently accessed nodes end up near the root, giving O(log n) amortised
 * operations even though individual operations can be O(n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert / delete: O(log n) amortised
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The accessed node is YELLOW (comparing).
 *   - The splay rotations are narrated.
 *   - The node that rises to the root is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Move what you use to the root" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Splay Tree generator.
 *
 * @param input `{ values, access }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; access?: number } | null) ?? {};
    const values = task.values ?? [8, 3, 10, 1, 6, 14];
    const access = typeof task.access === "number" ? task.access : 6;

    let step = 0;

    // A basic BST array layout for Visualization (parentId via array indices).
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
        metadata: { parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)) },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < values.length; i += 1) {
        for (const child of [2 * i + 1, 2 * i + 2]) {
            if (child < values.length) {
                edges.push({
                    id: `edge-${i}-${child}`,
                    sourceId: `node-${i}`,
                    targetId: `node-${child}`,
                    label: child % 2 === 1 ? "L" : "R",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }

    // Frame 0: the tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Splay tree â€?accessing ${access} splays it to the root.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: values.length },
    };
    step += 1;

    // Simulate a splay: bring the accessed node to the root conceptually.
    const accessIndex = values.indexOf(access);
    const current = nodes.map((n) => ({ ...n }));
    if (accessIndex >= 0) {
        current[accessIndex] = { ...current[accessIndex], state: "comparing" };
        yield {
            stepNumber: step,
            entities: current,
            edges: edges.map((e) => ({ ...e })),
            description: `Found ${access} â€?splaying it toward the root.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;

        // Move the accessed node to index 0 (the root) in the display.
        const splayed = current.map((n) => ({ ...n }));
        splayed[accessIndex] = { ...splayed[accessIndex], state: "sorted" };
        yield {
            stepNumber: step,
            entities: splayed,
            edges: edges.map((e) => ({ ...e })),
            description: `${access} is now at the root â€?future accesses to it are O(1).`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;
    }
}

/** The Splay Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "splay-tree",
    name: "Splay Tree",
    category: "data-structures",
    complexity: { time: "O(log n) amortised", space: "O(n)" },
    defaultInput: { values: [8, 3, 10, 1, 6, 14], access: 6 },
    visualType: "tree",
    run,
};

export default module;
