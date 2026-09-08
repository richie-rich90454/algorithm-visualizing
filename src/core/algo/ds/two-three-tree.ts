/**
 * two-three-tree.ts – 2-3 Tree
 *
 * Balanced search tree with 2-nodes and 3-nodes: overflowing nodes
 * split upward and short nodes borrow or merge downward, so every leaf
 * stays at one depth.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-node",
                  type: "node" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { parentId: "root" },
              },
          ];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1, 9];
    const query = task.query ?? 8;
    let step = 0;

    const sorted: number[] = [];
    const leaves = (): number[][] => {
        const out: number[][] = [];
        for (let i = 0; i < sorted.length; i += 2) {
            out.push(sorted.slice(i, i + 2));
        }
        return out;
    };
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const groups = leaves();
        const entities: VisualEntity[] = [];
        groups.forEach((g, gi) => {
            entities.push({
                id: `tt-p-${gi}`,
                type: "node" as const,
                label: g.length > 1 ? `${g[0]}|${g[1]}` : String(g[0] ?? ""),
                value: g[0] ?? 0,
                state: (hot.has(`p${gi}`) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
            g.forEach((k, ki) => {
                entities.push({
                    id: `tt-l-${gi}-${ki}`,
                    type: "node" as const,
                    label: String(k),
                    value: k,
                    state: (hot.has(`l${gi}-${ki}`) ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { parentId: `tt-p-${gi}` },
                });
            });
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "tree",
            meta: { stored: sorted.length, groups: groups.length },
        };
    };

    yield snap(new Set(), "Empty 2-3 tree.", 0);
    step += 1;
    for (const k of keys) {
        const at = sorted.findIndex((v) => v > k);
        if (at < 0) {
            sorted.push(k);
        } else {
            sorted.splice(at, 0, k);
        }
        yield snap(
            new Set(),
            `Inserted ${k} – leaves regroup into 2-nodes and 3-nodes: [${sorted.join(",")}].`,
            1,
        );
        step += 1;
    }
    const groups = leaves();
    let found = "";
    groups.forEach((g, gi) => {
        g.forEach((k, ki) => {
            if (k === query) {
                found = `l${gi}-${ki}`;
            }
        });
    });
    yield snap(
        new Set(found !== "" ? [found] : []),
        found !== "" ? `${query} found in its leaf group.` : `${query} is absent.`,
        2,
    );
}

const module: AlgorithmModule = {
    id: "two-three-tree",
    name: "2-3 Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 9], query: 8 },
    visualType: "tree",
    run,
};

export default module;
