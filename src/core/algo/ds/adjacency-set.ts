/**
 * adjacency-set.ts – Adjacency Set
 *
 * Adjacency lists upgraded to hash sets: neighbor iteration stays linear
 * but edge-existence tests drop to expected O(1).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-note",
                  type: "cell" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { row: 0, col: 0 },
              },
          ];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { edges?: Array<[string, string]>; queries?: Array<[string, string]> } | null) ??
        {};
    const edges = task.edges ?? [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
    ];
    const queries = task.queries ?? [
        ["A", "B"],
        ["A", "D"],
        ["B", "C"],
    ];
    let step = 0;
    let hits = 0;

    const adj = new Map<string, Set<string>>();
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        let row = 0;
        for (const [v, set] of adj) {
            let col = 0;
            for (const w of set) {
                entities.push({
                    id: `as-${v}-${w}`,
                    type: "cell" as const,
                    label: `${v}>${w}`,
                    value: w,
                    state: (hot.has(`${v}>${w}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col },
                });
                col += 1;
            }
            row += 1;
        }
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { vertices: adj.size, edgeTests: hits },
        };
    };

    yield snap(new Set(), "Empty adjacency sets.", 0);
    step += 1;
    for (const [a, b] of edges) {
        if (!adj.has(a)) {
            adj.set(a, new Set());
        }
        if (!adj.has(b)) {
            adj.set(b, new Set());
        }
        adj.get(a)?.add(b);
        adj.get(b)?.add(a);
        yield snap(
            new Set([`${a}>${b}`, `${b}>${a}`]),
            `Linked ${a}–${b} in both endpoint sets.`,
            1,
        );
        step += 1;
    }
    for (const [a, b] of queries) {
        const exists = adj.get(a)?.has(b) ?? false;
        if (exists) {
            hits += 1;
        }
        yield snap(
            new Set(exists ? [`${a}>${b}`] : []),
            exists ? `Edge ${a}–${b} exists (hash hit).` : `Edge ${a}–${b} absent (hash miss).`,
            2,
        );
        step += 1;
    }
    yield snap(new Set(), `${hits} of ${queries.length} edge tests hit.`, 3);
}

const module: AlgorithmModule = {
    id: "adjacency-set",
    name: "Adjacency Set",
    category: "data-structures",
    complexity: { time: "O(1) edge test", space: "O(V + E)" },
    defaultInput: {
        edges: [
            ["A", "B"],
            ["B", "C"],
            ["A", "C"],
        ],
        queries: [
            ["A", "B"],
            ["A", "D"],
            ["B", "C"],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
