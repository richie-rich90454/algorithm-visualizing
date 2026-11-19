/**
 * self-adjusting-top-tree.ts - Self-Adjusting Top Tree on a Dynamic Path
 *
 * Edge clusters are held in a splay tree, the self-adjusting representation of
 * a top tree over a path. Exposing a subpath rotates the clusters that cover it
 * toward the root, after which the root cluster stores the path aggregate.
 * Link and cut edit the cluster sequence while preserving order.
 *
 * Time: O(log n) amortized per operation. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";

type Op = { op: "link" | "cut" | "query"; a: string; b: string; weight?: number };
type Task = { path?: string[]; weights?: number[]; operations?: Op[] };
type Cluster = {
    key: number;
    weight: number;
    left?: Cluster;
    right?: Cluster;
    parent?: Cluster;
    max: number;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const path = Array.isArray(task.path) ? [...task.path].map(String) : ["A", "B", "C", "D", "E"];
    const weights = Array.isArray(task.weights) ? [...task.weights] : [4, 2, 7, 3];
    const operations: Op[] = Array.isArray(task.operations)
        ? task.operations
        : [
              { op: "query", a: "A", b: "E" },
              { op: "query", a: "B", b: "D" },
              { op: "cut", a: "C", b: "D" },
              { op: "query", a: "A", b: "C" },
          ];
    const frames: VisualFrame[] = [];
    let step = 0;
    let rotations = 0;
    let nextKey = 0;
    let root: Cluster | null = null;
    const keyAt: number[] = [];

    const emit = (hot: number[], description: string, line: number, extra: Record<string, number | string | boolean> = {}): void => {
        const entities: VisualFrame["entities"] = [];
        const collect = (node: Cluster | undefined): void => {
            if (!node) {
                return;
            }
            entities.push({
                id: `cluster-${node.key}`,
                type: "node",
                label: `${node.key}:${node.weight}`,
                value: node.weight,
                state: (hot.includes(node.key) ? "comparing" : "visited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: node.parent ? `cluster-${node.parent.key}` : "root", max: node.max },
            });
            collect(node.left);
            collect(node.right);
        };
        collect(root ?? undefined);
        frames.push({
            stepNumber: step,
            entities,
            edges: entities
                .filter((e) => e.metadata["parentId"] !== "root")
                .map((e) => ({
                    id: `link-${e.id}`,
                    sourceId: String(e.metadata["parentId"]),
                    targetId: e.id,
                    label: String(e.metadata["max"] ?? ""),
                    state: "idle" as EntityState,
                    directed: false,
                })),
            description,
            codeLineNumber: line,
            layout: "tree",
            meta: {
                edges: path.length - 1,
                path: path.join("-"),
                rotations,
                ...extra,
            },
        });
        step += 1;
    };

    const pull = (node: Cluster): void => {
        node.max = Math.max(node.weight, node.left?.max ?? -Infinity, node.right?.max ?? -Infinity);
    };
    const rotate = (x: Cluster): void => {
        const p = x.parent;
        if (!p) {
            return;
        }
        const g = p.parent;
        if (p.left === x) {
            p.left = x.right;
            if (x.right) {
                x.right.parent = p;
            }
            x.right = p;
        } else {
            p.right = x.left;
            if (x.left) {
                x.left.parent = p;
            }
            x.left = p;
        }
        p.parent = x;
        x.parent = g;
        if (g) {
            if (g.left === p) {
                g.left = x;
            } else {
                g.right = x;
            }
        } else {
            root = x;
        }
        pull(p);
        pull(x);
        rotations += 1;
        emit([x.key], `Rotated cluster ${x.key} upward; its aggregate is now ${x.max}.`, 3, { rotated: x.key });
    };
    const splay = (node: Cluster): void => {
        while (node.parent) {
            const parent = node.parent;
            const grand = parent.parent;
            if (grand) {
                rotate((grand.left === parent) === (parent.left === node) ? parent : node);
            }
            rotate(node);
        }
    };
    const splayTo = (node: Cluster, stop: Cluster): void => {
        while (node.parent && node.parent !== stop) {
            const parent = node.parent;
            const grand = parent.parent;
            if (grand && grand !== stop) {
                rotate((grand.left === parent) === (parent.left === node) ? parent : node);
            }
            rotate(node);
        }
    };
    const make = (weight: number): Cluster => ({ key: nextKey++, weight, max: weight });
    const rightmost = (node: Cluster): Cluster => {
        let current = node;
        while (current.right) {
            current = current.right;
        }
        return current;
    };

    for (let i = 0; i < weights.length && i + 1 < path.length; i += 1) {
        const node = make(weights[i] ?? 0);
        keyAt.push(node.key);
        if (!root) {
            root = node;
        } else {
            const tail = rightmost(root);
            splay(tail);
            root.right = node;
            node.parent = root;
            pull(root);
        }
    }
    emit([], `Built ${path.length - 1} edge clusters; each stores a max weight.`, 0, { clusters: path.length - 1 });

    for (const operation of operations) {
        const from = path.indexOf(operation.a);
        const to = path.indexOf(operation.b);
        if (operation.op === "link") {
            if (from < 0 || to !== path.length - 1 || from !== path.length - 2) {
                emit([], `link(${operation.a},${operation.b}) is only valid at the end of the represented path.`, 1, { linked: false });
                continue;
            }
            path.push(operation.b);
            const node = make(operation.weight ?? 0);
            keyAt.push(node.key);
            if (root) {
                const tail = rightmost(root);
                splay(tail);
                root.right = node;
                node.parent = root;
                pull(root);
            } else {
                root = node;
            }
            emit([node.key], `link(${operation.a},${operation.b}) appended one edge cluster.`, 2, { linked: true });
            continue;
        }
        if (from < 0 || to < 0) {
            emit([], `Operation names a vertex outside the represented path.`, 1, { valid: false });
            continue;
        }
        if (operation.op === "cut") {
            if (Math.abs(from - to) !== 1) {
                emit([], `cut(${operation.a},${operation.b}) needs two adjacent path vertices.`, 1, { cut: false });
                continue;
            }
            const key = keyAt[Math.min(from, to)] ?? -1;
            const target = findByKey(root, key);
            if (!target) {
                emit([], `cut(${operation.a},${operation.b}) could not find its edge cluster.`, 1, { cut: false });
                continue;
            }
            splay(target);
            const left = target.left;
            const right = target.right;
            if (left) {
                left.parent = undefined;
                root = left;
                splay(rightmost(left));
                if (root) {
                    root.right = right;
                    if (right) {
                        right.parent = root;
                    }
                    pull(root);
                }
            } else {
                root = right ?? null;
                if (root) {
                    root.parent = undefined;
                }
            }
            if (to < from) {
                path.splice(from, 1);
                keyAt.splice(from - 1, 1);
            } else {
                path.splice(to, 1);
                keyAt.splice(to - 1, 1);
            }
            emit([target.key], `cut(${operation.a},${operation.b}) removed the edge cluster; the path is now ${path.join("-")}.`, 4, { cut: true });
            continue;
        }
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        if (lo === hi) {
            emit([], `query(${operation.a},${operation.b}) is a single vertex with no edge aggregate.`, 6, { answer: -Infinity });
            continue;
        }
        const first = findByKey(root, keyAt[lo] ?? -1);
        const last = findByKey(root, keyAt[hi - 1] ?? -1);
        if (!first || !last) {
            emit([], `query(${operation.a},${operation.b}) could not find the exposed clusters.`, 6, { answer: -Infinity });
            continue;
        }
        splay(first);
        splayTo(last, first);
        const answer = Math.max(first.weight, last.weight, last.left?.max ?? -Infinity);
        emit(
            [first.key, last.key, ...(last.left ? collectKeys(last.left) : [])],
            `Exposed subpath ${operation.a}..${operation.b}: its top cluster has max ${answer}.`,
            7,
            { answer, exposed: answer },
        );
    }
    yield* frames;

    function findByKey(node: Cluster | null, key: number): Cluster | null {
        let current = node;
        while (current) {
            if (current.key === key) {
                return current;
            }
            current = (key < current.key ? current.left : current.right) ?? null;
        }
        return null;
    }
    function collectKeys(node: Cluster): number[] {
        const result: number[] = [];
        const stack: Array<Cluster | undefined> = [node];
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) {
                continue;
            }
            result.push(current.key);
            stack.push(current.left, current.right);
        }
        return result;
    }
}

const module: AlgorithmModule = {
    id: "self-adjusting-top-tree",
    name: "Self-Adjusting Top Tree",
    category: "tree",
    complexity: { time: "O(log n) amortized per operation", space: "O(n)" },
    defaultInput: {
        path: ["A", "B", "C", "D", "E"],
        weights: [4, 2, 7, 3],
        operations: [
            { op: "query", a: "A", b: "E" },
            { op: "query", a: "B", b: "D" },
            { op: "cut", a: "C", b: "D" },
            { op: "query", a: "A", b: "C" },
        ],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "create one edge cluster per edge of the represented path",
        "store each cluster in a self-adjusting splay tree",
        "for an operation, locate the relevant edge clusters",
        "rotate clusters along the access path toward the root",
        "link appends a cluster and cut removes one",
        "after exposing a subpath, read the root cluster aggregate",
        "continue with the next requested operation",
        "report the aggregates found for all queries",
    ],
    education: {
        intuition:
            "A self-adjusting top tree keeps a path broken into clusters and reorganizes those clusters whenever they are touched. Splay rotations bring the clusters covering a queried subpath near the root, so repeatedly accessed parts of the path become cheap to reach without any explicit balancing rules.",
        invariants: [
            "The in-order sequence of edge clusters always matches the represented path from left to right.",
            "Each cluster's aggregate equals the maximum weight over its in-order subtree.",
            "Rotations preserve in-order order while changing the cluster tree shape.",
        ],
        correctness:
            "Splay rotations preserve the in-order sequence of the BST, so the cluster order always equals the path order. After splaying both endpoints of a subpath, the subtree between them contains exactly its edges, and its stored maximum is the path aggregate. Link and cut insert or delete one cluster, preserving the representation invariant.",
        complexityRationale:
            "Each splay costs O(log n) amortized rotations and link or cut adds O(1) pointer changes after access, so all operations are O(log n) amortized. One cluster per edge uses O(n) space.",
        uses: [
            "Dynamic path aggregate queries",
            "Self-adjusting representations of dynamic trees",
            "A teaching bridge between splay trees and top trees",
        ],
        references: [
            "Sleator and Tarjan, Self-Adjusting Binary Search Trees, JACM 1985",
            "Acar et al., Self-Adjusting Top Trees, SODA 2005",
        ],
        workedExample:
            "On the path A-B-C-D-E with edge weights 4, 2, 7, 3, querying B..D exposes clusters for weights 2 and 7, so the top cluster reports 7. Cutting C-D removes the weight-7 cluster, and a later query over A..C reads the maximum of 4 and 2.",
    },
};

export default module;
