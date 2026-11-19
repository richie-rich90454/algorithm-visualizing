/**
 * fringe-search.ts - Fringe Search.
 *
 * Fringe search is a memory-light alternative to A*. It keeps the open set as
 * a single ordered list (the fringe) and searches with a fixed f-limit. Nodes
 * beyond the limit are skipped and remembered for the next iteration; only
 * when no node under the limit can be expanded does the limit jump to the
 * smallest skipped f-value. Reusing one list cuts the allocation overhead of
 * a heap while preserving A*'s optimality.
 *
 * Time:  O(E) expansions per f-limit increase, O(E log V) overall with sorting
 * Space: O(V) for the fringe and g values
 */
import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;
type Coords = Record<string, [number, number]>;

interface Pass {
    limit: number;
    expanded: string[];
    fringe: string[];
}

interface Result {
    path: string[];
    cost: number;
    passes: Pass[];
}

function neighbors(wadj: WAdj, v: string): Array<[string, number]> {
    const out: Array<[string, number]> = [...(wadj[v] ?? [])];
    for (const [source, adj] of Object.entries(wadj)) {
        if (source === v) continue;
        for (const [target, weight] of adj) if (target === v) out.push([source, weight]);
    }
    return out;
}

function fringeSearch(wadj: WAdj, coords: Coords, start: string, goal: string): Result {
    const h = (v: string): number => {
        const a = coords[v];
        const b = coords[goal];
        if (!a || !b) return 0;
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    const g = new Map<string, number>([[start, 0]]);
    const parent = new Map<string, string>();
    const closed = new Set<string>();
    let fringe: string[] = [start];
    let limit = h(start);
    const passes: Pass[] = [];

    const buildPath = (): string[] => {
        const path: string[] = [];
        let cursor: string | undefined = goal;
        while (cursor !== undefined) {
            path.unshift(cursor);
            if (cursor === start) break;
            cursor = parent.get(cursor);
        }
        return path;
    };

    for (let iter = 0; iter < 300; iter += 1) {
        let nextLimit = Infinity;
        let expandedAny = false;
        const expanded: string[] = [];
        let i = 0;
        while (i < fringe.length) {
            const node = fringe[i] as string;
            const f = (g.get(node) ?? Infinity) + h(node);
            if (f > limit) {
                nextLimit = Math.min(nextLimit, f);
                i += 1;
                continue;
            }
            if (closed.has(node)) {
                i += 1;
                continue;
            }
            expandedAny = true;
            expanded.push(node);
            closed.add(node);
            if (node === goal) {
                passes.push({ limit, expanded, fringe: [...fringe] });
                return { path: buildPath(), cost: g.get(goal) as number, passes };
            }
            for (const [next, weight] of neighbors(wadj, node)) {
                const ng = (g.get(node) as number) + weight;
                if (ng >= (g.get(next) ?? Infinity)) continue;
                g.set(next, ng);
                parent.set(next, node);
                closed.delete(next);
                const childF = ng + h(next);
                const existing = fringe.indexOf(next);
                if (existing >= 0) fringe.splice(existing, 1);
                let pos = fringe.findIndex((x) => (g.get(x) ?? Infinity) + h(x) > childF);
                if (pos < 0) pos = fringe.length;
                fringe.splice(pos, 0, next);
            }
            i += 1;
        }
        fringe = [...new Set(fringe)].sort(
            (a, b) => (g.get(a) ?? Infinity) + h(a) - ((g.get(b) ?? Infinity) + h(b)),
        );
        passes.push({ limit, expanded, fringe: [...fringe] });
        if (!expandedAny) {
            if (!Number.isFinite(nextLimit)) break;
            limit = nextLimit;
        }
    }
    return { path: [], cost: Infinity, passes };
}

function dijkstra(wadj: WAdj, start: string, goal: string): number {
    const dist = new Map<string, number>();
    for (const v of Object.keys(wadj)) dist.set(v, Infinity);
    dist.set(start, 0);
    const done = new Set<string>();
    for (;;) {
        let u: string | undefined;
        let best = Infinity;
        for (const [v, d] of dist) if (!done.has(v) && d < best) [u, best] = [v, d];
        if (u === undefined) break;
        done.add(u);
        for (const [next, w] of wadj[u] ?? []) dist.set(next, Math.min(dist.get(next) ?? Infinity, best + w));
    }
    return dist.get(goal) ?? Infinity;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: WAdj; coords?: Coords; start?: string; goal?: string } | null) ?? {};
    const wadj: WAdj = task.graph ?? {
        A: [["B", 1], ["C", 3]],
        B: [["D", 2], ["E", 5]],
        C: [["D", 1], ["E", 4]],
        D: [["F", 2]],
        E: [["F", 1]],
        F: [],
    };
    const coords: Coords = task.coords ?? {
        A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1], E: [2, 1], F: [2, 2],
    };
    const start = task.start ?? "A";
    const goal = task.goal ?? "F";
    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((es) => es.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(wadj);
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    const result = fringeSearch(wadj, coords, start, goal);
    let step = 0;
    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    const snap = (description: string, codeLineNumber: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    clear();
    yield snap(
        `Fringe search from ${start}: the fringe starts as a single node with f-limit ${result.passes[0]?.limit ?? 0}.`,
        0,
        { cost: -1, optimal: dijkstra(wadj, start, goal), limit: 0 },
    );
    step += 1;

    for (const pass of result.passes.slice(0, 30)) {
        clear();
        for (const v of pass.expanded) {
            const n = byLabel.get(v);
            if (n) n.state = "active";
        }
        for (const v of pass.fringe) {
            const n = byLabel.get(v);
            if (n && n.state === "unvisited") n.state = "comparing";
        }
        yield snap(
            `f-limit ${pass.limit.toFixed(2)}: expanded ${pass.expanded.length} node(s); ${pass.fringe.length} remain on the fringe.`,
            2,
            {
                cost: -1,
                optimal: dijkstra(wadj, start, goal),
                limit: pass.limit,
                expanded: pass.expanded.length,
            },
        );
        step += 1;
    }

    clear();
    for (const v of result.path) {
        const n = byLabel.get(v);
        if (n) n.state = "path";
    }
    for (let i = 0; i + 1 < result.path.length; i += 1) {
        const e = edges.find(
            (x) =>
                (x.sourceId === `node-${result.path[i]}` && x.targetId === `node-${result.path[i + 1]}`) ||
                (x.sourceId === `node-${result.path[i + 1]}` && x.targetId === `node-${result.path[i]}`),
        );
        if (e) e.state = "path";
    }
    yield snap(
        `Goal reached: ${result.path.join(" -> ")} costs ${result.cost}, found with ${result.passes.length} fringe pass(es).`,
        7,
        {
            cost: Number.isFinite(result.cost) ? result.cost : -1,
            optimal: dijkstra(wadj, start, goal),
            path: result.path,
            passes: result.passes.length,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fringe search trades the heap of A* for one flat list of frontier nodes and an f-limit. It scans that list, expanding nodes at or below the limit and collecting the f-values of nodes that are too expensive. When nothing can be expanded, it raises the limit to the smallest skipped value and scans again, reusing the same list each time.",
        invariants: [
            "Every node on the fringe has a finite g value from the start.",
            "Nodes with f above the current limit are skipped, not discarded.",
            "The next f-limit is the smallest f-value seen above the current limit.",
        ],
        correctness:
            "With an admissible heuristic the f-limit never skips a node that could lead to a cheaper goal than one already found. Because each pass expands every node with f at or below the limit and the limit rises only to the smallest skipped f, the first time the goal is expanded it has the minimum possible f, which is the A* optimality condition.",
        complexityRationale:
            "Each pass scans the fringe once and relaxes its outgoing edges, and sorting costs O(V log V) per pass; with at most O(V) limit increases this is O(E log V) time in practice, using O(V) space for the list and g values.",
        uses: [
            "Memory-constrained pathfinding on large grids",
            "Game AI where heap allocation overhead matters",
            "An alternative open-list strategy for A* implementations",
        ],
        references: [
            "Bjornsson, Enzenberger, Holte, Neufeld, and Schaeffer, Fringe Search: Beating A* on Pathfinding Problems with Large Search Fronts (2005)",
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths (1968)",
        ],
        workedExample:
            "From A with limit h(A), the fringe expands A and inserts B and C whose f fits the limit. A child D has f just above the limit, so D is remembered for the next pass. When no node remains under the limit, the limit jumps to D's f and the scan continues until the goal is expanded.",
    },
    id: "fringe-search",
    name: "Fringe Search",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["C", 3]],
            B: [["D", 2], ["E", 5]],
            C: [["D", 1], ["E", 4]],
            D: [["F", 2]],
            E: [["F", 1]],
            F: [],
        },
        coords: {
            A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1], E: [2, 1], F: [2, 2],
        },
        start: "A",
        goal: "F",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize the fringe with the start and set f-limit to h start",
        "scan the fringe from left to right at the current limit",
        "skip nodes whose f exceeds the limit and remember their f",
        "expand each in-limit node and relax its neighbors",
        "insert improved children into the fringe if their f fits the limit",
        "otherwise record the child f for the next limit",
        "if no node expanded, raise the limit to the smallest recorded f",
        "stop when the goal is expanded",
        "done: report the reconstructed path and cost",
    ],
};

export default module;
