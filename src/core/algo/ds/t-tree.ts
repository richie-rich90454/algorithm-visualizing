/**
 * t-tree.ts – T-Tree
 *
 * Main-memory index nodes: each node holds a sorted array of keys instead
 * of one key, balancing search speed with storage density. Full nodes
 * split; search walks one node array at a time.
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

const NODE_CAP = 3;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1, 9, 4];
    const query = task.query ?? 8;
    let step = 0;

    const nodes: number[][] = [[]];
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        nodes.forEach((node, ni) => {
            node.forEach((k, ki) => {
                entities.push({
                    id: `tt-${ni}-${ki}`,
                    type: "cell" as const,
                    label: String(k),
                    value: k,
                    state: (hot.has(`${ni}:${ki}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: ni, col: ki },
                });
            });
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { nodes: nodes.length, stored: nodes.reduce((a, n) => a + n.length, 0) },
        };
    };

    yield snap(new Set(), `Empty T-tree – ${NODE_CAP} keys per node.`, 0);
    step += 1;
    for (const k of keys) {
        let node = nodes[nodes.length - 1] ?? [];
        if (node.length >= NODE_CAP) {
            node = [];
            nodes.push(node);
        }
        node.push(k);
        node.sort((a, b) => a - b);
        const ni = nodes.length - 1;
        yield snap(
            new Set([`${ni}:${node.indexOf(k)}`]),
            node.length === 1 && nodes.length > 1
                ? `Node full – split, ${k} starts node ${ni}.`
                : `Inserted ${k} into node ${ni}: [${node.join(",")}].`,
            1,
        );
        step += 1;
    }
    let found = false;
    outer: for (let ni = 0; ni < nodes.length; ni += 1) {
        const node = nodes[ni] ?? [];
        for (let ki = 0; ki < node.length; ki += 1) {
            yield snap(
                new Set([`${ni}:${ki}`]),
                `Searching node ${ni}: is ${node[ki]} the query ${query}?`,
                2,
            );
            step += 1;
            if (node[ki] === query) {
                found = true;
                break outer;
            }
        }
    }
    yield snap(new Set(), found ? `${query} found.` : `${query} is absent.`, 3);
}

const module: AlgorithmModule = {
    id: "t-tree",
    name: "T-Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 9, 4], query: 8 },
    visualType: "grid",
    run,
};

export default module;
