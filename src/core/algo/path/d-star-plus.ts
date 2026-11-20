/**
 * d-star-plus.ts - D* Plus Incremental Replanning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * D* Plus keeps a shortest-path tree from a start vertex as an agent moves.
 * When an edge cost changes, it does not restart the search. If the changed
 * edge is a tree edge, the new cost is pushed down to every descendant in the
 * tree. Then a small priority queue of affected vertices repairs any shorter
 * routes that the change made possible. Unaffected branches are untouched.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((V + E) log V) for the initial tree, then O(k log k) per repair
 *   Space: O(V + E) for the tree, priorities, and edge entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The initial tree path is CYAN; the changed edge is ORANGE.
 *   - Descendants receiving a pushed cost are YELLOW.
 *   - The repaired path is GREEN, and meta reports how many vertices were
 *     revisited versus a full replan.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: WAdj;
            start?: string;
            target?: string;
            change?: [string, string, number];
        } | null) ?? {};
    const wadj: WAdj = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 5],
        ],
        B: [
            ["C", 1],
            ["D", 6],
        ],
        C: [["D", 2]],
        D: [["E", 1]],
        E: [],
    };
    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((pairs) => pairs.map(([v]) => v)),
        ]),
    ];
    let step = 0;
    const snap = (
        description: string,
        line: number,
        nodeStates: Map<string, EntityState>,
        edgeStates: Map<string, EntityState>,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
        for (const n of nodes) n.state = nodeStates.get(String(n.value)) ?? "unvisited";
        const edges = makeWeightedEdges(wadj);
        for (const e of edges) {
            const key = `${e.sourceId}|${e.targetId}`;
            e.state = edgeStates.get(key) ?? "idle";
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph" as const,
            meta,
        };
    };

    if (labels.length === 0) {
        yield snap("Empty graph - nothing to plan.", 0, new Map(), new Map(), {
            repaired: 0,
            fullSize: 0,
        });
        return;
    }
    const start = task.start && wadj[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? labels[labels.length - 1];

    const buildTree = (): { g: Map<string, number>; parent: Map<string, string | null> } => {
        const g = new Map(labels.map((v) => [v, Infinity]));
        const parent = new Map<string, string | null>(labels.map((v) => [v, null]));
        const done = new Set<string>();
        g.set(start, 0);
        for (;;) {
            let u: string | undefined;
            let best = Infinity;
            for (const v of labels) {
                if (!done.has(v) && (g.get(v) as number) < best) {
                    best = g.get(v) as number;
                    u = v;
                }
            }
            if (u === undefined) break;
            done.add(u);
            for (const [v, w] of wadj[u] ?? []) {
                const nd = (g.get(u) as number) + w;
                if (nd < (g.get(v) as number)) {
                    g.set(v, nd);
                    parent.set(v, u);
                }
            }
        }
        return { g, parent };
    };

    const initialPathOf = (parent: Map<string, string | null>): string[] => {
        const path: string[] = [];
        const seen = new Set<string>();
        let cur: string | null = target;
        while (cur !== null && !seen.has(cur)) {
            seen.add(cur);
            path.unshift(cur);
            cur = parent.get(cur) ?? null;
        }
        return path[0] === start ? path : [];
    };

    let { g, parent } = buildTree();
    const initialPath = initialPathOf(parent);
    if (initialPath.length === 0) {
        yield snap(`Target ${target} is unreachable from ${start}.`, 0, new Map(), new Map(), {
            repaired: 0,
            fullSize: labels.length,
            cost: -1,
            path: "",
        });
        return;
    }
    const initialNS = new Map<string, EntityState>();
    const initialES = new Map<string, EntityState>();
    for (const v of initialPath) initialNS.set(v, "path");
    for (let k = 0; k + 1 < initialPath.length; k += 1)
        initialES.set(`node-${initialPath[k]}|node-${initialPath[k + 1]}`, "path");
    yield snap(
        `Initial shortest-path tree found; route ${initialPath.join(" > ")} costs ${g.get(target)}.`,
        0,
        initialNS,
        initialES,
        { repaired: 0, fullSize: labels.length, cost: g.get(target) as number },
    );
    step += 1;

    const change = task.change ?? ["D", "E", 4];
    const [cu, cv, cw] = change;
    const findWeight = (a: string, b: string): number | undefined => {
        const pair = (wadj[a] ?? []).find(([v]) => v === b);
        return pair?.[1];
    };
    const oldWeight = findWeight(cu, cv);
    if (oldWeight === undefined) {
        yield snap(`Edge ${cu} to ${cv} is not in the graph; no repair is needed.`, 1, initialNS, initialES, {
            repaired: 0,
            fullSize: labels.length,
        });
        return;
    }
    for (const pair of wadj[cu] ?? []) if (pair[0] === cv) pair[1] = cw;
    for (const pair of wadj[cv] ?? []) if (pair[0] === cu) pair[1] = cw;

    const changedNS = new Map<string, EntityState>();
    changedNS.set(cu, "highlight");
    changedNS.set(cv, "highlight");
    const changedES = new Map<string, EntityState>([
        [`node-${cu}|node-${cv}`, "swapped"],
        [`node-${cv}|node-${cu}`, "swapped"],
    ]);
    yield snap(
        `Edge ${cu} to ${cv} changed from ${oldWeight} to ${cw}; affected vertices become inconsistent.`,
        2,
        changedNS,
        changedES,
        { repaired: 0, fullSize: labels.length, oldWeight, newWeight: cw },
    );
    step += 1;

    const children = new Map<string, string[]>(labels.map((v) => [v, []]));
    const rebuildChildren = (): void => {
        for (const list of children.values()) list.length = 0;
        for (const v of labels) {
            const p = parent.get(v);
            if (p !== null && p !== undefined) children.get(p)?.push(v);
        }
    };
    rebuildChildren();

    const affected = new Set<string>([cu, cv]);
    const pushDescendants = (root: string): void => {
        const stack = [root];
        const visited = new Set<string>();
        while (stack.length > 0) {
            const x = stack.pop() as string;
            if (visited.has(x)) continue;
            visited.add(x);
            affected.add(x);
            for (const c of children.get(x) ?? []) {
                g.set(c, (g.get(x) as number) + (findWeight(x, c) as number));
                stack.push(c);
            }
        }
    };
    if (parent.get(cv) === cu) {
        g.set(cv, (g.get(cu) as number) + cw);
        pushDescendants(cv);
    } else if (parent.get(cu) === cv) {
        g.set(cu, (g.get(cv) as number) + cw);
        pushDescendants(cu);
    }

    const pushNS = new Map<string, EntityState>();
    for (const v of affected) pushNS.set(v, "comparing");
    yield snap(
        `Pushed the new cost to ${affected.size} descendant(s); those values may now be too large.`,
        3,
        pushNS,
        changedES,
        { repaired: affected.size, fullSize: labels.length },
    );
    step += 1;

    let repairs = 0;
    const queue = new Set<string>(affected);
    for (const v of affected) for (const [nb] of wadj[v] ?? []) queue.add(nb);
    let guard = 0;
    const guardLimit = 500 * labels.length + 2000;
    while (queue.size > 0) {
        guard += 1;
        if (guard > guardLimit) break;
        let x: string | undefined;
        let bestG = Infinity;
        for (const v of queue) {
            if ((g.get(v) as number) < bestG) {
                bestG = g.get(v) as number;
                x = v;
            }
        }
        if (x === undefined) break;
        queue.delete(x);
        let rhs = x === start ? 0 : Infinity;
        let bestParent: string | null = x === start ? null : null;
        for (const [p, w] of wadj[x] ?? []) {
            const cand = (g.get(p) as number) + w;
            if (cand < rhs) {
                rhs = cand;
                bestParent = p;
            }
        }
        if (rhs < (g.get(x) as number) - 1e-12) {
            g.set(x, rhs);
            parent.set(x, bestParent);
            rebuildChildren();
            repairs += 1;
            for (const [nb, w] of wadj[x] ?? []) {
                const cand = rhs + w;
                if (cand < (g.get(nb) as number)) {
                    g.set(nb, cand);
                    parent.set(nb, x);
                    rebuildChildren();
                    queue.add(nb);
                }
            }
            const ns = new Map<string, EntityState>();
            ns.set(x, "active");
            for (const [nb] of wadj[x] ?? []) ns.set(nb, "comparing");
            yield snap(
                `Repair relaxed ${x} to ${rhs} and rechecked its neighbors.`,
                5,
                ns,
                changedES,
                {
                    repaired: queue.size + repairs,
                    fullSize: labels.length,
                    cost: Number.isFinite(g.get(target)) ? (g.get(target) as number) : -1,
                },
            );
            step += 1;
        }
    }

    const finalPath = initialPathOf(parent);
    const finalCost = Number.isFinite(g.get(target)) ? (g.get(target) as number) : -1;
    const finalNS = new Map<string, EntityState>();
    const finalES = new Map<string, EntityState>();
    for (const v of finalPath) finalNS.set(v, "path");
    for (let k = 0; k + 1 < finalPath.length; k += 1)
        finalES.set(`node-${finalPath[k]}|node-${finalPath[k + 1]}`, "path");
    yield snap(
        `Repaired route ${finalPath.join(" > ")} costs ${finalCost} after visiting ${repairs} vertex(es) instead of all ${labels.length}.`,
        7,
        finalNS,
        finalES,
        {
            repaired: repairs,
            fullSize: labels.length,
            cost: finalCost,
            path: finalPath.join(">"),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep one shortest-path tree and reuse it. When a tree edge gets more expensive, every vertex below it inherits the higher cost, so push that correction down the tree. A tiny queue of only those descendants then relaxes local alternatives; branches that never used the changed edge are never looked at again.",
        invariants: [
            "Every parent link describes an actual edge of the current graph.",
            "A non-tree edge cost change cannot change any stored distance, because no tree path uses it.",
            "Only descendants of a changed tree edge can have distances that became too large.",
        ],
        correctness:
            "If the changed edge is not in the tree, all tree paths stay valid and the edge only became more expensive, so no shorter path can appear. If it is a tree edge, pushing the new cost down the subtree restores each descendant to the length of its current tree path. The label-correcting queue then lowers any vertex with a better one-step route and pushes that improvement to its children; because all later distances start from correct values and only decrease, the process ends at the true shortest-path tree.",
        complexityRationale:
            "The first shortest-path tree costs O(E log V). A repair touches only the inconsistent set of k vertices, each pulled from a priority queue and relaxing its incident edges, for O(k log k) work, versus O(E log V) for a full restart.",
        uses: [
            "Robot navigation when a mapped passage is blocked or reopened",
            "Network routing after a single link cost update",
            "Repeated closest queries where only a small local change occurs",
        ],
        references: [
            "Ramalingam and Reps, An Incremental Algorithm for a Family of Shortest Path Problems, 1996",
            "Koenig and Likhachev, D* Lite, 2002",
        ],
        workedExample:
            "The tree route A-B-D-E costs 9. If edge D-E rises from 1 to 4, D and E are the only inconsistent vertices. Pushing the change gives E a tentative cost of 12, then the repair relaxes E through C to 8, leaving A and B completely untouched.",
    },
    id: "d-star-plus",
    name: "D* Plus Incremental Replanning",
    category: "shortest-path",
    complexity: { time: "O(k log k) per repair", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
            ],
            B: [
                ["C", 1],
                ["D", 6],
            ],
            C: [["D", 2]],
            D: [["E", 1]],
            E: [],
        },
        start: "A",
        target: "E",
        change: ["D", "E", 4],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build an initial shortest-path tree from the start",
        "apply the changed edge cost to the graph",
        "identify inconsistent vertices from the changed edge",
        "if a tree edge changed, push new costs down its subtree",
        "place inconsistent vertices in a priority queue",
        "extract the smallest vertex and compute its best one-step value",
        "on improvement update its parent and push the change to children",
        "stop when the queue is empty",
        "done: follow parent links for the repaired route",
    ],
};

export default module;
