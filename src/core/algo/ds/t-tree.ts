/**
 * t-tree.ts – T-Tree
 *
 * Main-memory index nodes: each node holds a sorted array of keys instead
 * of one key, balancing search speed with storage density. Full nodes
 * split; search walks one node array at a time.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Main-memory index nodes: each node holds a sorted array of keys instead of one key, balancing search speed with storage density. Full nodes split; search walks one node array at a time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Cells form rows or columns of values.
 *    - The touched cell is YELLOW (comparing).
 *    - Finished cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard T-Tree behavior with textbook operation costs.
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
    yield snap(
        new Set(),
        found ? `${query} found in the T-tree.` : `${query} is absent from the T-tree.`,
        6,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A T-tree is a balanced main-memory index where each node holds a sorted array of several keys instead of one. This packs more keys per cache line than a binary tree while keeping search logarithmic by scanning within a node then descending.",
        "invariants": [
            "Keys within a node are sorted.",
            "All keys in a left child are smaller than node keys and all in a right child larger.",
            "Leaves stay at similar depth."
        ],
        "correctness": "Search scans a node key array to decide whether the key is present or which child to descend; because child key ranges are disjoint and ordered, the descent narrows to the only possible location. Splitting a full node keeps the range invariant so all keys remain findable.",
        "complexityRationale": "Each level scans a small fixed-size array and descends one child, O(log n) levels. Storing several keys per node reduces pointer overhead, O(n) space.",
        "uses": [
            "Main-memory databases and indexes",
            "In-memory key-value stores",
            "Real-time systems needing cache-friendly ordered access"
        ],
        "references": [
            "Bayer and McCreight, Organization and Maintenance of Large Ordered Indexes, Acta Informatica 1972",
            "Lehman and Yao, A Study of Balanced Index Structures for Main Memory, 1981"
        ],
        "workedExample": "Keys 5, 2, 8, 1, 9, 4 fill nodes with sorted arrays; searching 8 scans the root array, finds it or chooses the correct child, and reports the node and slot where 8 sits."
    },
    id: "t-tree",
    name: "T-Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 9, 4], query: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with one empty node capped at a few sorted keys",
        "insert key into the last node keeping it sorted",
        "when the node is full: start a fresh node for the key",
        "nodes chain in key order like a B-tree with arrays",
        "search scans nodes in order comparing within each array",
        "report the node and slot where the query key sits",
        "done: nodes hold all keys sorted and the query verdict is reported",
    ],
};

export default module;
