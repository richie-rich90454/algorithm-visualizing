/**
 * dynamic-mst.ts - Fully Dynamic Minimum Spanning Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A dynamic MST maintains the minimum spanning tree of an undirected weighted
 * graph while edges are inserted, deleted, or reweighted. Each update is
 * repaired locally: an inserted edge can only displace the heaviest edge on
 * the cycle it closes (cycle property), while deleting a tree edge is repaired
 * by the cheapest edge crossing the cut it leaves behind (cut property).
 * Non-tree edge updates never change the tree unless they become cheap enough
 * to win a cycle. Every repair is checked against a fresh Kruskal run in the
 * companion tests.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) per update (path search + crossing-edge scan)
 *   Space: O(V + E) for the graph and the maintained forest
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and weighted edges are drawn on a graph layout.
 *   - Forest edges are GREEN; the edge under test is YELLOW.
 *   - An edge entering the forest flashes swapped; one leaving flashes error.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Edge = { id: number; a: string; b: string; w: number };
type Update =
    | { op: "insert"; a: string; b: string; w: number }
    | { op: "delete"; a: string; b: string }
    | { op: "setWeight"; a: string; b: string; w: number };
type Input = { vertices?: string[]; edges?: [string, string, number][]; updates?: Update[] };

/** A tiny union-find used only for connectivity inside one repair. */
class DSU {
    private parent = new Map<string, string>();

    add(x: string): void {
        if (!this.parent.has(x)) {
            this.parent.set(x, x);
        }
    }

    find(x: string): string {
        const p = this.parent.get(x);
        if (p === undefined) {
            this.add(x);
            return x;
        }
        if (p !== x) {
            const root = this.find(p);
            this.parent.set(x, root);
            return root;
        }
        return x;
    }

    union(a: string, b: string): boolean {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra === rb) {
            return false;
        }
        this.parent.set(ra, rb);
        return true;
    }
}

const FR = (
    step: number,
    entities: VisualEntity[],
    edges: VisualEdge[],
    description: string,
    codeLineNumber: number,
    meta: VisualFrame["meta"],
): VisualFrame => ({ stepNumber: step, entities, edges, description, codeLineNumber, layout: "graph", meta });

const nodes = (vertices: string[], states: Map<string, EntityState> = new Map()): VisualEntity[] =>
    vertices.map((v) => ({
        id: `node-${v}`,
        type: "node" as const,
        label: v,
        value: v,
        state: states.get(v) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: v },
    }));

const linkEdges = (
    edges: Edge[],
    forest: Set<number>,
    override: Map<number, EntityState> = new Map(),
): VisualEdge[] =>
    edges.map((e) => ({
        id: `edge-${e.id}`,
        sourceId: `node-${e.a}`,
        targetId: `node-${e.b}`,
        label: String(e.w),
        state: override.get(e.id) ?? (forest.has(e.id) ? "sorted" : "idle"),
        directed: false,
    }));

/** Kruskal from scratch: the reference the incremental repairs must match. */
const kruskal = (vertices: string[], edges: Edge[]): Set<number> => {
    const dsu = new DSU();
    for (const v of vertices) {
        dsu.add(v);
    }
    const chosen = new Set<number>();
    const ordered = [...edges].sort((x, y) => x.w - y.w || x.id - y.id);
    for (const e of ordered) {
        if (dsu.union(e.a, e.b)) {
            chosen.add(e.id);
        }
    }
    return chosen;
};

const weightOf = (edges: Edge[], forest: Set<number>): number => {
    let total = 0;
    for (const e of edges) {
        if (forest.has(e.id)) {
            total += e.w;
        }
    }
    return total;
};

/** Heaviest edge on the unique forest path between a and b, by id on ties. */
const pathMaxEdge = (edges: Edge[], forest: Set<number>, a: string, b: string): Edge | null => {
    const adj = new Map<string, Array<{ to: string; edge: Edge }>>();
    for (const v of [a, b]) {
        adj.set(v, []);
    }
    for (const e of edges) {
        if (!forest.has(e.id)) {
            continue;
        }
        if (!adj.has(e.a)) {
            adj.set(e.a, []);
        }
        if (!adj.has(e.b)) {
            adj.set(e.b, []);
        }
        adj.get(e.a)?.push({ to: e.b, edge: e });
        adj.get(e.b)?.push({ to: e.a, edge: e });
    }
    const prev = new Map<string, { from: string; edge: Edge }>();
    const queue = [a];
    prev.set(a, { from: "", edge: { id: -1, a, b, w: 0 } });
    while (queue.length > 0) {
        const u = queue.shift() as string;
        if (u === b) {
            break;
        }
        for (const nb of adj.get(u) ?? []) {
            if (!prev.has(nb.to)) {
                prev.set(nb.to, { from: u, edge: nb.edge });
                queue.push(nb.to);
            }
        }
    }
    if (!prev.has(b)) {
        return null;
    }
    let best: Edge | null = null;
    let cursor = b;
    while (cursor !== a) {
        const step = prev.get(cursor);
        if (!step) {
            break;
        }
        if (best === null || step.edge.w > best.w || (step.edge.w === best.w && step.edge.id > best.id)) {
            best = step.edge;
        }
        cursor = step.from;
    }
    return best;
};

/** Every vertex reachable from start using only forest edges. */
const componentOf = (vertices: string[], edges: Edge[], forest: Set<number>, start: string): Set<string> => {
    const adj = new Map<string, string[]>();
    for (const v of vertices) {
        adj.set(v, []);
    }
    for (const e of edges) {
        if (forest.has(e.id)) {
            adj.get(e.a)?.push(e.b);
            adj.get(e.b)?.push(e.a);
        }
    }
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
        const u = queue.shift() as string;
        for (const v of adj.get(u) ?? []) {
            if (!seen.has(v)) {
                seen.add(v);
                queue.push(v);
            }
        }
    }
    return seen;
};

/** Cheapest edge crossing from a vertex set to its complement. */
const cheapestCrossing = (edges: Edge[], inside: Set<string>): Edge | null => {
    let best: Edge | null = null;
    for (const e of edges) {
        if (inside.has(e.a) === inside.has(e.b)) {
            continue;
        }
        if (best === null || e.w < best.w || (e.w === best.w && e.id < best.id)) {
            best = e;
        }
    }
    return best;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const rawEdges = Array.isArray(task.edges) ? task.edges : [];
    const vertices: string[] = [];
    if (Array.isArray(task.vertices)) {
        for (const v of task.vertices) {
            if (typeof v === "string" && !vertices.includes(v)) {
                vertices.push(v);
            }
        }
    }
    const edges: Edge[] = [];
    rawEdges.forEach((raw, index) => {
        if (!Array.isArray(raw) || raw.length < 3) {
            return;
        }
        const a = raw[0];
        const b = raw[1];
        const w = raw[2];
        if (typeof a !== "string" || typeof b !== "string" || typeof w !== "number" || !Number.isFinite(w)) {
            return;
        }
        for (const v of [a, b]) {
            if (!vertices.includes(v)) {
                vertices.push(v);
            }
        }
        edges.push({ id: index, a, b, w });
    });

    if (vertices.length === 0) {
        yield FR(0, [], [], "Empty graph - there is no dynamic MST to maintain.", 0, { totalWeight: 0, update: 0 });
        return;
    }

    const updates = Array.isArray(task.updates) ? task.updates : [];
    let forest = kruskal(vertices, edges);
    let step = 0;

    yield FR(
        step++,
        nodes(vertices),
        linkEdges(edges, forest),
        `Initial minimum spanning forest has ${forest.size} edge(s) and weight ${weightOf(edges, forest)}.`,
        0,
        { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: 0 },
    );

    const findEdge = (a: string, b: string): Edge | undefined =>
        edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));

    let nextId = edges.length;
    let changedIn = -1;
    let changedOut = -1;

    const repairInsert = (e: Edge): void => {
        const dsu = new DSU();
        for (const v of vertices) {
            dsu.add(v);
        }
        for (const f of edges) {
            if (forest.has(f.id)) {
                dsu.union(f.a, f.b);
            }
        }
        if (dsu.find(e.a) !== dsu.find(e.b)) {
            forest.add(e.id);
            changedIn = e.id;
            return;
        }
        const heavy = pathMaxEdge(edges, forest, e.a, e.b);
        if (heavy && e.w < heavy.w) {
            forest.delete(heavy.id);
            forest.add(e.id);
            changedOut = heavy.id;
            changedIn = e.id;
        }
    };

    const repairDelete = (e: Edge): void => {
        if (!forest.has(e.id)) {
            return;
        }
        forest.delete(e.id);
        changedOut = e.id;
        const inside = componentOf(vertices, edges, forest, e.a);
        const crossing = cheapestCrossing(edges, inside);
        if (crossing) {
            forest.add(crossing.id);
            changedIn = crossing.id;
        }
    };

    for (let index = 0; index < updates.length; index += 1) {
        const update = updates[index];
        if (!update || typeof update.op !== "string") {
            continue;
        }
        changedIn = -1;
        changedOut = -1;
        const op = update.op;
        if (op === "insert") {
            const u = update.a;
            const v = update.b;
            const w = (update as { w?: number }).w;
            if (typeof u !== "string" || typeof v !== "string" || typeof w !== "number" || !Number.isFinite(w)) {
                continue;
            }
            if (!vertices.includes(u)) {
                vertices.push(u);
            }
            if (!vertices.includes(v)) {
                vertices.push(v);
            }
            const existing = findEdge(u, v);
            if (existing) {
                const wasIn = forest.has(existing.id);
                const position = edges.indexOf(existing);
                if (position >= 0) {
                    edges.splice(position, 1);
                }
                if (wasIn) {
                    repairDelete(existing);
                }
                existing.w = w;
                edges.splice(position >= 0 ? position : edges.length, 0, existing);
                repairInsert(existing);
                yield FR(
                    step++,
                    nodes(vertices),
                    linkEdges(edges, forest, new Map([[existing.id, "comparing" as EntityState]])),
                    `Update ${index + 1}: reweight edge ${u}-${v} to ${w}.`,
                    2,
                    { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: index + 1 },
                );
            } else {
                const fresh: Edge = { id: nextId++, a: u, b: v, w };
                edges.push(fresh);
                repairInsert(fresh);
                yield FR(
                    step++,
                    nodes(vertices),
                    linkEdges(edges, forest, new Map([[fresh.id, "comparing" as EntityState]])),
                    `Update ${index + 1}: insert edge ${u}-${v} of weight ${w}.`,
                    1,
                    { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: index + 1 },
                );
            }
        } else if (op === "delete") {
            const victim = findEdge(update.a, update.b);
            if (!victim) {
                yield FR(
                    step++,
                    nodes(vertices),
                    linkEdges(edges, forest),
                    `Update ${index + 1}: edge ${update.a}-${update.b} is absent, so the forest is unchanged.`,
                    3,
                    { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: index + 1 },
                );
                continue;
            }
            const wasIn = forest.has(victim.id);
            const idx = edges.indexOf(victim);
            if (idx >= 0) {
                edges.splice(idx, 1);
            }
            if (wasIn) {
                repairDelete(victim);
            }
            yield FR(
                step++,
                nodes(vertices),
                linkEdges(edges, forest),
                `Update ${index + 1}: delete edge ${update.a}-${update.b}${wasIn ? " from the forest" : " (not in the forest)"}.`,
                3,
                { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: index + 1 },
            );
        } else if (op === "setWeight") {
            const target = findEdge(update.a, update.b);
            const w = (update as { w?: number }).w;
            if (!target || typeof w !== "number" || !Number.isFinite(w)) {
                yield FR(
                    step++,
                    nodes(vertices),
                    linkEdges(edges, forest),
                    `Update ${index + 1}: edge ${update.a}-${update.b} cannot be reweighted, so the forest is unchanged.`,
                    4,
                    { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: index + 1 },
                );
                continue;
            }
            const old = target.w;
            const wasIn = forest.has(target.id);
            const position = edges.indexOf(target);
            if (position >= 0) {
                edges.splice(position, 1);
            }
            if (wasIn) {
                repairDelete(target);
            }
            target.w = w;
            edges.splice(position >= 0 ? position : edges.length, 0, target);
            repairInsert(target);
            yield FR(
                step++,
                nodes(vertices),
                linkEdges(edges, forest, new Map([[target.id, "comparing" as EntityState]])),
                `Update ${index + 1}: reweight edge ${update.a}-${update.b} from ${old} to ${w}.`,
                4,
                { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: index + 1 },
            );
        }

        const overrides = new Map<number, EntityState>();
        if (changedIn >= 0) {
            overrides.set(changedIn, "swapped");
        }
        if (changedOut >= 0) {
            overrides.set(changedOut, "error");
        }
        yield FR(
            step++,
            nodes(vertices),
            linkEdges(edges, forest, overrides),
            `Repaired: forest now has ${forest.size} edge(s), total weight ${weightOf(edges, forest)}.`,
            5,
            { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: index + 1 },
        );
    }

    yield FR(
        step++,
        nodes(vertices),
        linkEdges(edges, forest),
        `Dynamic MST finished after ${updates.length} update(s); final weight ${weightOf(edges, forest)}.`,
        6,
        { totalWeight: weightOf(edges, forest), mstEdges: forest.size, update: updates.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of rebuilding the whole tree after every change, watch what a single edge can do. A new edge can only remove the heaviest edge on the cycle it closes, and a lost tree edge can only be replaced by the cheapest edge crossing the gap it leaves. Those two local rules keep the tree minimal after any small update.",
        invariants: [
            "The maintained edge set is always acyclic and has one tree per connected component.",
            "A non-tree edge is replacing a tree edge only when it is strictly lighter on their cycle.",
            "After a tree edge is deleted, the replacement is the cheapest edge crossing the resulting cut.",
        ],
        correctness:
            "The cycle property says the heaviest edge on a cycle is not needed by any minimum spanning tree, so inserting an edge and dropping that heaviest edge preserves optimality. The cut property says the lightest edge crossing a cut is safe to include, so repairing a deleted tree edge with the cheapest crossing edge restores an minimum spanning forest. Neither operation can increase total weight, and a fresh Kruskal run in the tests confirms the result after every update.",
        complexityRationale:
            "An insertion scans the forest path to find the heaviest edge, O(V) in a tree; a deletion scans all E edges for the cheapest crossing edge. Connectivity checks are near-constant with union-find, so each update costs O(V + E) time and the graph plus forest use O(V + E) space.",
        uses: [
            "Network topologies that gain or lose links while staying minimum-cost",
            "Incremental clustering as new similarity edges arrive",
            "Reoptimizing a spanning tree after a link failure",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, minimum spanning tree chapter",
            "Demetrescu and Italiano, A Fully Dynamic Algorithm for Maintaining the Shortest Paths (dynamic update techniques)",
        ],
        workedExample:
            "Start with the tree A-B(1), B-C(2). Inserting C-A(5) closes a cycle whose heaviest edge is C-A itself, so nothing changes. Inserting A-C(1) instead makes the heaviest edge B-C(2), so B-C leaves and A-C enters. Deleting A-B then splits the tree into {A,C} and {B}; the cheapest crossing edge A-B is gone, so if B-C(2) exists it becomes the replacement.",
    },
    id: "dynamic-mst",
    name: "Dynamic MST",
    category: "mst",
    complexity: { time: "O(V + E) per update", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 2],
            ["C", "D", 3],
            ["A", "C", 5],
            ["B", "D", 6],
        ],
        updates: [
            { op: "insert", a: "A", b: "D", w: 1 },
            { op: "delete", a: "B", b: "C" },
            { op: "setWeight", a: "C", b: "D", w: 8 },
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build an initial tree with kruskal over the starting edges",
        "for each update in the sequence do the following",
        "on insertion add the edge then drop the heaviest edge on its cycle when lighter",
        "on deletion of a tree edge find the cheapest edge crossing the resulting cut",
        "on a weight change delete the old edge then insert it with the new weight",
        "leave the tree unchanged when a non-tree edge cannot improve a cycle",
        "report the repaired forest and its total weight",
    ],
};

export default module;
