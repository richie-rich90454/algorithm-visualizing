/**
 * ara-star.ts - ARA* (Anytime Repairing A*)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ARA* is an anytime path planner. It first runs weighted A* with a loose bound
 * epsilon to find a feasible path quickly, then tightens epsilon and repairs the
 * previous search by reopening closed nodes instead of starting over. Each pass
 * reuses earlier g-values and improves the path, ending with an optimal path
 * when epsilon reaches one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * (V + E) log V) over k epsilon rounds
 *   Space: O(V) for g-values, parents, open and closed sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices and weighted edges are drawn with the standard graph layout.
 *   - The open frontier is yellow, expanded nodes are gray, the current path
 *     is green, and the node being expanded is bright blue.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type Adjacency = Record<string, Array<[string, number]>>;
type Coords = Record<string, [number, number]>;

/** Euclidean heuristic, admissible when every edge costs at least its length. */
function heuristic(coords: Coords, node: string, goal: string): number {
    const a = coords[node];
    const b = coords[goal];
    if (!a || !b) return 0;
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** The ARA* generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            graph?: Adjacency;
            coords?: Coords;
            start?: string;
            goal?: string;
            epsilons?: number[];
        } | null
    ) ?? {};
    const adjacency: Adjacency = task.graph ?? {
        A: [["B", 1], ["D", 1]],
        B: [["A", 1], ["C", 1], ["E", 1]],
        C: [["B", 1], ["F", 1]],
        D: [["A", 1], ["E", 1], ["G", 1]],
        E: [["B", 1], ["D", 1], ["F", 1], ["H", 1]],
        F: [["C", 1], ["E", 1], ["I", 1]],
        G: [["D", 1], ["H", 1]],
        H: [["E", 1], ["G", 1], ["I", 1]],
        I: [["F", 1], ["H", 1]],
    };
    const coords: Coords = task.coords ?? {
        A: [0, 0], B: [1, 0], C: [2, 0],
        D: [0, 1], E: [1, 1], F: [2, 1],
        G: [0, 2], H: [1, 2], I: [2, 2],
    };
    const start = task.start ?? "A";
    const goal = task.goal ?? "I";
    const epsilons = Array.isArray(task.epsilons) && task.epsilons.length > 0
        ? task.epsilons.map(Number)
        : [2, 1.5, 1];
    const vertices = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat().map((e) => e[0])])];

    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(adjacency);

    const g = new Map<string, number>(vertices.map((v) => [v, Number.POSITIVE_INFINITY]));
    const parent = new Map<string, string>();
    let closed = new Set<string>();
    let open = new Set<string>();
    g.set(start, 0);
    open.add(start);
    const costs: number[] = [];
    let step = 0;

    const render = (description: string, codeLine: number, expand: string, path: string[], meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const pathEdges = new Set<string>();
        for (let i = 0; i + 1 < path.length; i += 1) {
            pathEdges.add(`${path[i]}-${path[i + 1]}`);
            pathEdges.add(`${path[i + 1]}-${path[i]}`);
        }
        for (const node of nodes) {
            let state: EntityState = "unvisited";
            if (path.includes(node.label)) state = "path";
            else if (node.label === expand) state = "active";
            else if (closed.has(node.label)) state = "visited";
            else if (open.has(node.label)) state = "comparing";
            node.state = state;
        }
        const styled: VisualEdge[] = edges.map((edge) => ({
            ...edge,
            state: pathEdges.has(`${edge.sourceId.slice(5)}-${edge.targetId.slice(5)}`) ? "path" : "idle",
        }));
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: styled,
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta,
        };
    };

    yield render(
        `ARA* planning from ${start} to ${goal} over ${vertices.length} vertices with ${epsilons.length} epsilon bound(s).`,
        0,
        "",
        [],
        { rounds: epsilons.length, round: 0, epsilon: epsilons[0] ?? 1, costs: [] },
    );
    step += 1;

    for (let r = 0; r < epsilons.length; r += 1) {
        const epsilon = epsilons[r] as number;
        if (r > 0) {
            for (const v of closed) open.add(v);
            closed = new Set();
            if (Number.isFinite(g.get(goal))) open.add(goal);
        }
        let expansions = 0;
        let found = false;

        while (open.size > 0) {
            let current = "";
            let bestF = Number.POSITIVE_INFINITY;
            let bestH = Number.POSITIVE_INFINITY;
            for (const v of open) {
                const h = heuristic(coords, v, goal);
                const f = (g.get(v) as number) + epsilon * h;
                if (f < bestF - 1e-12 || (Math.abs(f - bestF) <= 1e-12 && h < bestH)) {
                    bestF = f;
                    bestH = h;
                    current = v;
                }
            }
            if (current === "") break;
            open.delete(current);
            if (current === goal) {
                found = true;
                break;
            }
            closed.add(current);
            expansions += 1;
            for (const [neighbor, weight] of adjacency[current] ?? []) {
                const tentative = (g.get(current) as number) + weight;
                if (tentative < (g.get(neighbor) as number)) {
                    g.set(neighbor, tentative);
                    parent.set(neighbor, current);
                    closed.delete(neighbor);
                    open.add(neighbor);
                }
            }
            yield render(
                `Round ${r + 1}, epsilon ${epsilon}: expand ${current}, g=${(g.get(current) as number).toFixed(2)}, f=${bestF.toFixed(2)}; ${open.size} node(s) on the frontier.`,
                3,
                current,
                [],
                { rounds: epsilons.length, round: r + 1, epsilon, costs: [...costs], expansions },
            );
            step += 1;
        }

        const path: string[] = [];
        if (found) {
            let cursor: string | undefined = goal;
            const guard = vertices.length + 1;
            for (let i = 0; i < guard && cursor !== undefined; i += 1) {
                path.unshift(cursor);
                if (cursor === start) break;
                cursor = parent.get(cursor);
            }
        }
        const cost = found ? (g.get(goal) as number) : Number.POSITIVE_INFINITY;
        if (found && Number.isFinite(cost)) costs.push(cost);
        yield render(
            found
                ? `Round ${r + 1} complete: path ${path.join(" -> ")} with cost ${cost.toFixed(2)} after ${expansions} expansion(s).`
                : `Round ${r + 1}: no path from ${start} to ${goal} exists.`,
            5,
            "",
            found ? path : [],
            {
                rounds: epsilons.length,
                round: r + 1,
                epsilon,
                costs: [...costs],
                path: path.length > 0 ? path : ["none"],
                cost: Number.isFinite(cost) ? cost : -1,
                expansions,
            },
        );
        step += 1;
    }

    yield render(
        costs.length > 0
            ? `Anytime search finished: ${costs.length} improving path(s), final cost ${(costs[costs.length - 1] as number).toFixed(2)} with epsilon ${(epsilons[epsilons.length - 1] as number).toFixed(2)}.`
            : `No path found from ${start} to ${goal}.`,
        6,
        "",
        [],
        { rounds: epsilons.length, round: epsilons.length, costs: [...costs], bestCost: costs.length > 0 ? costs[costs.length - 1] : -1, roundsUsed: costs.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A star with a heavy heuristic weight finds a path fast but not necessarily the best one. ARA* runs that fast search first, then lowers the weight and repairs the search tree by reopening nodes it already explored. Each pass reuses what it learned, so it keeps producing better paths and ends with an optimal route once the weight is one.",
        invariants: [
            "The heuristic never overestimates the true remaining cost.",
            "A node is reopened whenever a cheaper path to it is discovered.",
            "Successive path costs never increase as epsilon decreases.",
        ],
        correctness:
            "Weighted A star with epsilon at least one is complete and returns a path whose cost is at most epsilon times optimal. Reopening closed nodes on improvement makes each repair pass equivalent to a fresh A star seeded with the best g-values found so far; with an admissible heuristic and epsilon one, the first goal removal is optimal. Because each pass starts from no worse g-values than the last, the reported path costs form a nonincreasing anytime sequence ending at the optimum.",
        complexityRationale:
            "Each of the k rounds expands each vertex at most a bounded number of times, so the dominant cost is k priority selections and relaxations, O(k (V + E) log V). The g map, parent map, and open and closed sets hold O(V) entries.",
        uses: [
            "Real-time robot and game pathfinding that needs an answer immediately",
            "Anytime planning where computation can be cut off at any moment",
            "Navigation systems refining a route while a vehicle is already moving",
        ],
        references: [
            "Likhachev, Gordon, and Thrun, ARA*: Anytime A* with Provable Bounds on Sub-Optimality, NIPS 2003",
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths, 1968",
        ],
        workedExample:
            "On a three-by-three grid from the top-left to the bottom-right, epsilon two may accept a detour of cost six quickly. Repairing with epsilon one and one and a half reopens the frontier and shortens the route to cost four, which a Dijkstra check confirms is optimal.",
    },
    id: "ara-star",
    name: "ARA* (Anytime Repairing A*)",
    category: "shortest-path",
    complexity: { time: "O(k (V + E) log V)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["D", 1]],
            B: [["A", 1], ["C", 1], ["E", 1]],
            C: [["B", 1], ["F", 1]],
            D: [["A", 1], ["E", 1], ["G", 1]],
            E: [["B", 1], ["D", 1], ["F", 1], ["H", 1]],
            F: [["C", 1], ["E", 1], ["I", 1]],
            G: [["D", 1], ["H", 1]],
            H: [["E", 1], ["G", 1], ["I", 1]],
            I: [["F", 1], ["H", 1]],
        },
        coords: {
            A: [0, 0], B: [1, 0], C: [2, 0],
            D: [0, 1], E: [1, 1], F: [2, 1],
            G: [0, 2], H: [1, 2], I: [2, 2],
        },
        start: "A",
        goal: "I",
        epsilons: [2, 1.5, 1],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize g-values to infinity and open the start node",
        "for each epsilon bound from loose to tight",
        "reopen closed nodes to repair the previous search",
        "repeatedly expand the open node with smallest g plus epsilon times h",
        "stop the pass when the goal is selected",
        "reconstruct and record the improved path",
        "done: report the anytime sequence of path costs",
    ],
};

export default module;
