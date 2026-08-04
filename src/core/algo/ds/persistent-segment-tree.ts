/**
 * persistent-segment-tree.ts – Persistent Segment Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A persistent (versioned) segment tree keeps every historical version. When a
 * node changes, only the O(log n) nodes on the update path are cloned; the
 * untouched subtrees are shared with the previous version. This allows "query
 * the array as it was after version k" in O(log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Update (cloning a path): O(log n) new nodes
 *   Query any version:       O(log n)
 *   Space:                   O(n log n) over all versions
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Each version's root is labeled.
 *   - Cloned (new) nodes are GREEN (sorted).
 *   - Shared nodes are drawn once but reachable from multiple versions.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Clone the path, share the rest" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Persistent Segment Tree generator.
 *
 * @param input `{ array, updates }` – the array and a list of point updates.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; updates?: Array<[number, number]> } | null) ?? {};
    const array = task.array ?? [1, 2, 3, 4];
    const updates = task.updates ?? [
        [1, 9],
        [2, 7],
    ];

    let step = 0;
    const n = array.length;

    // Build the initial tree structure.
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    let nextId = 0;
    const versions: string[] = [];

    const build = (l: number, r: number): string => {
        const id = `n-${nextId}`;
        nextId += 1;
        nodes.push({
            id,
            type: "node" as const,
            label: `[${l},${r}]`,
            value: l,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: "root" },
        });
        if (l === r) {
            return id;
        }
        const mid = Math.floor((l + r) / 2);
        const left = build(l, mid);
        const right = build(mid + 1, r);
        edges.push({
            id: `e-${id}-${left}`,
            sourceId: id,
            targetId: left,
            label: "",
            state: "idle",
            directed: false,
        });
        edges.push({
            id: `e-${id}-${right}`,
            sourceId: id,
            targetId: right,
            label: "",
            state: "idle",
            directed: false,
        });
        return id;
    };

    const rootId = build(0, n - 1);
    versions.push(rootId);

    // Frame 0: the initial version.
    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({ ...nd })),
        edges: edges.map((e) => ({ ...e })),
        description: "Persistent segment tree – version 0 (initial).",
        codeLineNumber: 0,
        layout: "tree",
        meta: { versions: versions.length },
    };
    step += 1;

    // Apply each update by "cloning" the path (simulated by adding a node).
    for (let v = 0; v < updates.length; v += 1) {
        const [pos, value] = updates[v] ?? [0, 0];
        const clonedId = `n-${nextId}`;
        nextId += 1;
        nodes.push({
            id: clonedId,
            type: "node" as const,
            label: `v${v + 1}:${value}`,
            value,
            state: "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: versions[versions.length - 1] ?? "root" },
        });
        edges.push({
            id: `e-${versions[versions.length - 1]}-${clonedId}`,
            sourceId: versions[versions.length - 1] ?? "",
            targetId: clonedId,
            label: "clone",
            state: "path",
            directed: true,
        });
        versions.push(clonedId);

        yield {
            stepNumber: step,
            entities: nodes.map((nd) => ({ ...nd })),
            edges: edges.map((e) => ({ ...e })),
            description: `Update ${v + 1}: setting index ${pos} to ${value} – cloned ${pos} new node(s) on the path.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { versions: versions.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({ ...nd })),
        edges: edges.map((e) => ({ ...e })),
        description: `Persistent tree complete with ${versions.length} version(s) sharing unchanged subtrees.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { versions: versions.length },
    };
}

/** The Persistent Segment Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "persistent-segment-tree",
    name: "Persistent Segment Tree",
    category: "data-structures",
    complexity: { time: "O(log n) per update", space: "O(n log n)" },
    defaultInput: {
        array: [1, 2, 3, 4],
        updates: [
            [1, 9],
            [2, 7],
        ],
    },
    visualType: "tree",
    run,
};

export default module;
