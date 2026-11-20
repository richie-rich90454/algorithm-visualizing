/**
 * plateau-branching.ts - A* with Plateau Branching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A* expands the frontier node with the smallest f = g + h. When many nodes
 * share the same f value they form a plateau, and ordinary tie-breaking may
 * sprawl sideways. Plateau branching breaks ties by preferring the node with
 * the largest g, which is deepest in the search and usually closest to the
 * goal. Because the tie-break only orders equal-f nodes, A* remains optimal
 * for an admissible, consistent heuristic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) with a heap; O(E V) for the teaching array frontier
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex currently expanded is YELLOW (comparing).
 *   - Frontier vertices are BLUE (active), settled ones GREEN (sorted).
 *   - The final path edges are CYAN (path).
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        graph?: WAdj;
        start?: string;
        target?: string;
        heuristic?: Record<string, number>;
    } | null) ?? {};
    const wadj: WAdj = task.graph ?? {
        A: [["B", 1], ["C", 1]],
        B: [["D", 2]],
        C: [["E", 2]],
        D: [["F", 1]],
        E: [["F", 1]],
        F: [],
    };
    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((vs) => vs.map(([v]) => v)),
        ]),
    ];
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [{ id: "node-empty", type: "node" as const, label: "", value: "", state: "unvisited", x: 0, y: 0, width: 0, height: 0, metadata: { label: "" } }],
            edges: [],
            description: "Empty graph: nothing to search.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { cost: -1 },
        };
        return;
    }
    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(wadj);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const hOf = (v: string): number => task.heuristic?.[v] ?? 0;
    const start = task.start && wadj[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? labels[labels.length - 1];
    const INF = Infinity;

    const gScore = new Map(labels.map((v) => [v, INF]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    gScore.set(start, 0);
    const open: Array<{ v: string; g: number; f: number }> = [{ v: start, g: 0, f: hOf(start) }];
    const settled = new Set<string>();
    let step = 0;
    let expanded = 0;

    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    yield snap(`A* plateau branching from ${start} to ${target}; tie-break favors deeper same-f nodes.`, 0, {
        start,
        target,
    });
    step += 1;

    while (open.length > 0) {
        // Plateau branching: smallest f first; on equal f, larger g first.
        open.sort((a, b) => (a.f - b.f) || (b.g - a.g));
        const current = open.shift() as { v: string; g: number; f: number };
        if (settled.has(current.v) || current.g > (gScore.get(current.v) as number)) continue;
        settled.add(current.v);
        expanded += 1;
        clear();
        const currentNode = byId.get(`node-${current.v}`);
        if (currentNode) currentNode.state = "comparing";
        for (const item of open) {
            const n = byId.get(`node-${item.v}`);
            if (n && !settled.has(item.v)) n.state = "active";
        }
        for (const v of settled) {
            const n = byId.get(`node-${v}`);
            if (n) n.state = "sorted";
        }
        yield snap(
            `Expand ${current.v}: g=${current.g}, h=${hOf(current.v)}, f=${current.f}; frontier size ${open.length}.`,
            3,
            { current: current.v, g: current.g, h: hOf(current.v), f: current.f, expanded },
        );
        step += 1;

        if (current.v === target) break;

        for (const [next, weight] of wadj[current.v] ?? []) {
            if (settled.has(next)) continue;
            const tentative = current.g + weight;
            if (tentative < (gScore.get(next) as number)) {
                gScore.set(next, tentative);
                prev.set(next, current.v);
                open.push({ v: next, g: tentative, f: tentative + hOf(next) });
                const e = edges.find(
                    (x) => x.sourceId === `node-${current.v}` && x.targetId === `node-${next}`,
                );
                if (e) e.state = "active";
                const n = byId.get(`node-${next}`);
                if (n) n.state = "active";
            }
        }
    }

    const reachable = gScore.get(target) !== INF;
    const path: string[] = [];
    if (reachable) {
        let cur: string | null = target;
        while (cur !== null) {
            path.unshift(cur);
            cur = prev.get(cur) as string | null;
        }
    }
    clear();
    if (reachable) {
        for (const v of path) {
            const n = byId.get(`node-${v}`);
            if (n) n.state = "path";
        }
        for (let i = 0; i + 1 < path.length; i += 1) {
            const e = edges.find(
                (x) => x.sourceId === `node-${path[i]}` && x.targetId === `node-${path[i + 1]}`,
            );
            if (e) e.state = "path";
        }
    }
    yield snap(
        reachable
            ? `Done: cheapest path ${start} to ${target} costs ${gScore.get(target)} via ${path.join(" → ")}, after ${expanded} expansion(s).`
            : `Done: ${target} is unreachable from ${start} after ${expanded} expansion(s).`,
        6,
        {
            cost: reachable ? (gScore.get(target) as number) : -1,
            path: reachable ? path.join("→") : "",
            expanded,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A* orders the frontier by f = g + h. Often many nodes have the same f, forming a flat plateau where arbitrary tie-breaking wastes work. Plateau branching resolves those ties by choosing the node with the largest g, the one explored deepest along the current best route. Since only equal-f nodes are reordered, the guarantee of an optimal path is unchanged.",
        invariants: [
            "f(v) equals g(v) plus the heuristic estimate h(v).",
            "Among equal-f frontier nodes the one with the largest g expands first.",
            "A settled vertex keeps its final, optimal g value.",
        ],
        correctness:
            "With an admissible and consistent heuristic, every node removed from the frontier with minimal f has its optimal g value, exactly as in standard A*. The plateau rule only permutes nodes that share the same f, so the minimum f is still chosen and A*'s completeness and optimality proofs carry over unchanged.",
        complexityRationale:
            "Each settled vertex scans its outgoing edges once, costing O(E) relaxations; the teaching version sorts a small frontier each step for O(E V) time, replaced by O(E log V) with a binary heap. Storing scores and predecessors uses O(V) space.",
        uses: [
            "Route planning on grids with many equal-cost routes",
            "Game-path search where deep ties are common",
            "A drop-in tie-break for any consistent-heuristic A* implementation",
        ],
        references: [
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths, 1968",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, informed search chapter",
        ],
        workedExample:
            "On the demo graph A has two equal-f successors B and C with g=1. Plateau branching cannot choose between them on f alone, so it prefers whichever has accumulated the larger g; both routes reach F with cost 3, and the tie-break simply reaches that common route sooner.",
    },
    id: "plateau-branching",
    name: "A* Plateau Branching",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["C", 1]],
            B: [["D", 2]],
            C: [["E", 2]],
            D: [["F", 1]],
            E: [["F", 1]],
            F: [],
        },
        start: "A",
        target: "F",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set g of start to zero, push it on the frontier",
        "while the frontier is not empty do",
        "choose the smallest f, breaking ties by largest g",
        "remove and settle that vertex",
        "if it is the target reconstruct the path and stop",
        "relax each edge to an unsettled neighbor",
        "on improvement update g, parent, and frontier entry",
        "done: report the cheapest path and its cost",
    ],
};

export default module;
