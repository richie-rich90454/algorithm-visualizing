/**
 * persistent-bst.ts – Persistent BST (Path Copying)
 *
 * Each update copies only the root-to-leaf path; untouched subtrees are
 * shared between versions, so old roots keep answering queries.
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

type PNode = { key: number; left: number; right: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; queryVersion?: number; query?: number } | null) ?? {};
    const keys = task.keys ?? [3, 1, 4];
    const queryVersion = task.queryVersion ?? 1;
    const query = task.query ?? 1;
    let step = 0;

    const nodes: PNode[] = [];
    const roots: number[] = [];
    const alloc = (key: number, left: number, right: number): number => {
        nodes.push({ key, left, right });
        return nodes.length - 1;
    };
    const insert = (root: number, key: number): number => {
        if (root < 0) {
            return alloc(key, -1, -1);
        }
        const n = nodes[root];
        if (n === undefined) {
            return alloc(key, -1, -1);
        }
        if (key < n.key) {
            return alloc(n.key, insert(n.left, key), n.right);
        }
        if (key > n.key) {
            return alloc(n.key, n.left, insert(n.right, key));
        }
        return root;
    };
    const search = (root: number, key: number): boolean => {
        let cur = root;
        while (cur >= 0) {
            const n = nodes[cur];
            if (n === undefined) {
                return false;
            }
            if (key === n.key) {
                return true;
            }
            cur = key < n.key ? n.left : n.right;
        }
        return false;
    };
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            nodes.map((n, i) => ({
                id: `pb-${i}`,
                type: "node" as const,
                label: String(n.key),
                value: n.key,
                state: (hot.has(i) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            })),
        ),
        edges: nodes.flatMap((n, i) => {
            const out: VisualFrame["edges"] = [];
            if (n.left >= 0) {
                out.push({
                    id: `pbe-${i}-l`,
                    sourceId: `pb-${i}`,
                    targetId: `pb-${n.left}`,
                    label: "",
                    state: "idle",
                    directed: true,
                });
            }
            if (n.right >= 0) {
                out.push({
                    id: `pbe-${i}-r`,
                    sourceId: `pb-${i}`,
                    targetId: `pb-${n.right}`,
                    label: "",
                    state: "idle",
                    directed: true,
                });
            }
            return out;
        }),
        description: message,
        codeLineNumber: line,
        layout: "graph",
        meta: { versions: roots.length, nodes: nodes.length },
    });

    yield snap(new Set(), "Empty persistent BST.", 0);
    step += 1;
    let root = -1;
    for (const k of keys) {
        const before = nodes.length;
        root = insert(root, k);
        roots.push(root);
        const fresh = new Set<number>();
        for (let i = before; i < nodes.length; i += 1) {
            fresh.add(i);
        }
        yield snap(
            fresh,
            `Insert ${k} – version ${roots.length} copies ${nodes.length - before} path node(s), shares the rest.`,
            1,
        );
        step += 1;
    }
    const r = roots[queryVersion] ?? -1;
    const found = search(r, query);
    yield snap(
        new Set(),
        `Search ${query} in version ${queryVersion + 1}: ${found ? "found" : "absent"} – old roots still work.`,
        2,
    );
}

const module: AlgorithmModule = {
    id: "persistent-bst",
    name: "Persistent BST",
    category: "data-structures",
    complexity: { time: "O(log n) per version", space: "O(log n) per update" },
    defaultInput: { keys: [3, 1, 4], queryVersion: 1, query: 1 },
    visualType: "graph",
    run,
};

export default module;
