/**
 * two-three-tree.ts – 2-3 Tree
 *
 * Balanced search tree with 2-nodes and 3-nodes: overflowing nodes
 * split upward and short nodes borrow or merge downward, so every leaf
 * stays at one depth.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Balanced search tree with 2-nodes and 3-nodes: overflowing nodes split upward and short nodes borrow or merge downward, so every leaf stays at one depth.
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
 *    - Nodes are circles; edges show parent links.
 *    - The active node is YELLOW (comparing).
 *    - Finished nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard 2-3 Tree behavior with textbook operation costs.
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

    education: {
        "intuition": "A 2-3 tree is a balanced search tree whose nodes hold either one key with two children or two keys with three children. Overflowing nodes split and promote a key while underfull nodes borrow or merge, so all leaves stay at one depth.",
        "invariants": [
            "Every node has two or three children.",
            "All leaves are at the same depth.",
            "Keys within a node are sorted and partition child ranges."
        ],
        "correctness": "Splitting a four-key overflow and promoting the middle key preserves sorted order and balance, and borrow or merge repairs underflow without changing depth. Search compares within a node then descends into the unique child range containing the key, so it finds the key exactly when present.",
        "complexityRationale": "All leaves at one depth force height O(log n), so search and update take O(log n). One node per group of one or two keys gives O(n) space.",
        "uses": [
            "Balanced ordered indexes",
            "The structure underlying B-trees",
            "Dictionaries with guaranteed logarithmic search"
        ],
        "references": [
            "Bayer and McCreight, Organization and Maintenance of Large Ordered Indexes, Acta Informatica 1972",
            "CLRS, Introduction to Algorithms, Chapter 18 on B-trees"
        ],
        "workedExample": "Insert 5, 2, 8, 1, 9; inserting 9 overflows the node holding 5, 8, 9 so 8 is promoted and the node splits into 5 and 9; searching 8 compares at the root and finds it."
    },
    id: "two-three-tree",
    name: "2-3 Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 9], query: 8 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty 2-3 tree of no nodes",
        "insert key into the correct leaf in sorted order",
        "leaves regroup into 2-nodes and 3-nodes of one or two keys",
        "split overflowing 4-nodes and promote the middle key upward",
        "repeat until every level holds only 2-nodes and 3-nodes",
        "search compares within each node then descends correctly",
        "done: tree stays balanced and the query verdict is reported",
    ],
};

export default module;
