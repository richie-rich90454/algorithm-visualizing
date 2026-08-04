/**
 * persistent-dsu.ts – Persistent Disjoint Set Union
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A persistent DSU records the parent of every element at every point in time,
 * so you can answer "were a and b connected after version k?" Each union
 * writes O(1) parent updates, but because history is kept, the space grows
 * with the number of operations. It is the standard tool for "offline
 * connectivity over time" problems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Union:    O(log n) amortised (with rollback-friendly heuristics)
 *   Query:    O(log n) per version
 *   Space:    O(ops · log n) if fully persistent
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The parent array at each version is shown.
 *   - The elements merged at a version are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Remember every version of the parent array" is the idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The Persistent DSU generator.
 *
 * @param input `{ size, unions }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number; unions?: Array<[number, number]> } | null) ?? {};
    const size = typeof task.size === "number" ? task.size : 5;
    const unions = task.unions ?? [
        [0, 1],
        [2, 3],
        [0, 2],
    ];

    let step = 0;

    // History: each version is a snapshot of the parent array.
    const history: number[][] = [Array.from({ length: size }, (_, i) => i)];

    const makeCells = (parents: number[], active: number[] = []): VisualEntity[] =>
        parents.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (active.includes(index) ? "comparing" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        }));

    // Frame 0: version 0.
    yield {
        stepNumber: step,
        entities: makeCells(history[0] ?? []),
        edges: [],
        description: "Persistent DSU – version 0: every element points to itself.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size, versions: history.length },
    };
    step += 1;

    // Apply each union as a new version.
    for (let v = 0; v < unions.length; v += 1) {
        const prev = history[history.length - 1] ?? [];
        const next = [...prev];
        const [a, b] = unions[v] ?? [0, 0];
        next[b] = a; // simple union (educational): point b at a.

        history.push(next);
        yield {
            stepNumber: step,
            entities: makeCells(next, [a, b]),
            edges: [],
            description: `Version ${v + 1}: union(${a}, ${b}) – parent[${b}] = ${a}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size, versions: history.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(history[history.length - 1] ?? []),
        edges: [],
        description: `Persistent DSU complete – ${history.length} version(s) of the parent array are retained.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size, versions: history.length },
    };
}

/** The Persistent DSU module, registered with the engine. */
const module: AlgorithmModule = {
    id: "persistent-dsu",
    name: "Persistent DSU",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(ops·log n)" },
    defaultInput: {
        size: 5,
        unions: [
            [0, 1],
            [2, 3],
            [0, 2],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
