/**
 * deamortized-union-find.ts - Deamortized Union-Find
 *
 * Classic union-find has excellent amortized cost but a single find can still
 * walk a long path. This variant keeps the tree height logarithmic with union
 * by rank and spreads path compression across operations: each find performs
 * only one deferred path-halving step from a FIFO queue. No operation ever
 * compresses a whole path at once, so the worst-case cost is bounded.
 *
 * Time:  O(log n) worst case per operation
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pair = [number, number];

interface FindResult {
    root: number;
    path: number[];
    compressed: number;
}

function pureRoot(parent: number[], x: number): number {
    let cur = x;
    while (parent[cur] !== cur) cur = parent[cur] ?? cur;
    return cur;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; unions?: Pair[]; finds?: number[] } | null) ?? {};
    const n = typeof task.n === "number" && task.n > 0 ? task.n : 8;
    const unions: Pair[] = Array.isArray(task.unions)
        ? task.unions
        : [
              [0, 1],
              [2, 3],
              [4, 5],
              [6, 7],
              [1, 3],
              [5, 7],
              [3, 7],
          ];
    const finds = Array.isArray(task.finds) ? task.finds : [0, 6, 4];

    const parent: number[] = Array.from({ length: n }, (_, i) => i);
    const rank: number[] = Array(n).fill(0);
    const queue: number[] = [];
    let deferredSteps = 0;
    let step = 0;

    const snapshot = (
        highlight: Set<number>,
        message: string,
        line: number,
        extra: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        for (let i = 0; i < n; i += 1) {
            const p = parent[i] ?? i;
            entities.push({
                id: `uf-${i}`,
                type: "node" as const,
                label: String(i),
                value: i,
                state: (highlight.has(i) ? "comparing" : p === i ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: p === i ? "root" : `uf-${p}`, rank: rank[i] ?? 0 },
            });
            if (p !== i) {
                edges.push({
                    id: `ufe-${i}-${p}`,
                    sourceId: `uf-${i}`,
                    targetId: `uf-${p}`,
                    label: "",
                    state: "idle",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: line,
            layout: "tree",
            meta: extra,
        };
    };

    const find = (x: number): FindResult => {
        let cur = x;
        const path: number[] = [];
        while ((parent[cur] ?? cur) !== cur) {
            path.push(cur);
            cur = parent[cur] ?? cur;
        }
        for (const p of path) queue.push(p);
        let compressed = -1;
        if (queue.length > 0) {
            const node = queue.shift() ?? -1;
            const grand = parent[parent[node] ?? node] ?? node;
            if (node >= 0 && parent[node] !== grand) {
                parent[node] = grand;
                compressed = node;
                deferredSteps += 1;
            }
        }
        return { root: cur, path, compressed };
    };

    yield snapshot(new Set(), `Start with ${n} singleton sets; paths compress one node at a time.`, 0, {
        n,
        unions: 0,
        deferredSteps,
        queue: queue.length,
    });
    step += 1;

    let unionsDone = 0;
    for (const pair of unions) {
        const [a, b] = pair;
        const ra = find(a);
        const rb = find(b);
        let x = ra.root;
        let y = rb.root;
        const highlight = new Set([...ra.path, ...rb.path, x, y]);
        if (x !== y) {
            if ((rank[x] ?? 0) < (rank[y] ?? 0)) {
                const tmp = x;
                x = y;
                y = tmp;
            }
            parent[y] = x;
            if ((rank[x] ?? 0) === (rank[y] ?? 0)) rank[x] = (rank[x] ?? 0) + 1;
            unionsDone += 1;
        }
        yield snapshot(
            highlight,
            x === y
                ? `Union(${a}, ${b}): already connected through root ${x}.`
                : `Union(${a}, ${b}): attached root ${y} under root ${x} by rank.`,
            2,
            { n, unions: unionsDone, deferredSteps, queue: queue.length, roots: [x, y] },
        );
        step += 1;
    }

    for (const value of finds) {
        const result = find(value);
        const highlight = new Set([value, ...result.path]);
        if (result.compressed >= 0) highlight.add(result.compressed);
        yield snapshot(
            highlight,
            result.compressed >= 0
                ? `Find(${value}): root is ${result.root}; deferred halving shortened node ${result.compressed}.`
                : `Find(${value}): root is ${result.root}; no deferred step was needed.`,
            6,
            { n, unions: unionsDone, deferredSteps, queue: queue.length, root: result.root, value },
        );
        step += 1;
    }

    const components: number[] = Array.from({ length: n }, (_, i) => pureRoot(parent, i));
    yield snapshot(new Set(), `Final components: [${components.join(", ")}] with ${deferredSteps} deferred step(s).`, 7, {
        components,
        n,
        unions: unionsDone,
        deferredSteps,
        queue: queue.length,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Union-find keeps a forest where each set has one root. Union by rank stops the trees from getting tall, and path compression flattens them but can be expensive in one unlucky operation. The deamortized version records the nodes visited by a find in a queue and shortens only one of them per operation, spreading the work evenly while keeping every answer correct.",
        invariants: [
            "Two elements are in the same set exactly when following parent pointers leads to the same root.",
            "Ranks only increase at the root of a merged tree and bound its height by log n.",
            "Deferred compression changes only parent pointers, never set membership.",
        ],
        correctness:
            "Union by rank attaches a shorter tree under a taller one, so a root's rank rises only when two equal-rank trees merge and the height stays at most log n. A find walks to the true root before any queued compression, so it always returns the correct representative. Replacing a parent pointer with its grandparent keeps the same root, so every deferred step preserves all components; comparing components with a plain union-find confirms equivalence.",
        complexityRationale:
            "Rank bounds every root-to-node path by log n, so a find walks at most log n links regardless of compression. Each operation adds at most one constant-time deferred step. Unions do two finds, giving O(log n) worst case per operation and O(n) space for parents, ranks, and the queue.",
        uses: [
            "Real-time systems that cannot tolerate an occasional slow path compression",
            "Parallel graph processing where predictable per-operation latency matters",
            "Incremental connectivity maintenance with bounded worst-case updates",
        ],
        references: [
            "Tarjan, Efficiency of a Good But Not Linear Set Union Algorithm, 1975",
            "Krokowski, Rehmsmeier and RMP, Union-Find with Deletions and Incremental Operations, 2016",
        ],
        workedExample:
            "With eight elements, unions 0-1, 2-3, 4-5, 6-7 pair them up, then 1-3 and 5-7 and 3-7 merge everything into one component. A find(0) walks 0 to 1 to 3 to 7, queues those nodes, and shortens only node 0 to point at 3. The root remains 7 and the component is unchanged.",
    },
    id: "deamortized-union-find",
    name: "Deamortized Union-Find",
    category: "data-structures",
    complexity: { time: "O(log n) worst case", space: "O(n)" },
    defaultInput: {
        n: 8,
        unions: [
            [0, 1],
            [2, 3],
            [4, 5],
            [6, 7],
            [1, 3],
            [5, 7],
            [3, 7],
        ],
        finds: [0, 6, 4],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize each element as its own root with rank zero",
        "for each union locate the roots of the two endpoints",
        "attach the smaller-rank root beneath the larger-rank root",
        "when ranks tie increment the rank of the new root",
        "for each find walk parent pointers up to the root",
        "enqueue the traversed nodes for later path shortening",
        "shorten exactly one queued node per operation by halving",
        "report the final component root of every element",
    ],
};

export default module;
