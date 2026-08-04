/**
 * a-star.ts – A* Search Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A* is the workhorse of pathfinding in games and robotics. Like Dijkstra, it
 * maintains tentative distances and settles the smallest; but it steers the
 * search toward the goal by adding a *heuristic* estimate h(n) of the
 * remaining cost to the target. The priority of a vertex is f(n) = g(n) + h(n),
 * where g(n) is the real cost so far. With an admissible heuristic (one that
 * never overestimates), A* is guaranteed to find the optimal path while
 * exploring far fewer vertices than Dijkstra.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) worst (with a heap), but typically far less in practice
 *   Space: O(V) for the open set and bookkeeping maps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being expanded is YELLOW (comparing).
 *   - The edge being relaxed is BLUE (active).
 *   - Closed vertices are GREEN (sorted).
 *   - The final path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Optimal when the heuristic is admissible (never overestimates).
 *   - h = 0 everywhere reduces A* to Dijkstra – a neat observation.
 *   - The heuristic quality trades optimality vs. speed.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The A* generator.
 *
 * @param input `{ graph, start, target, heuristic? }` – a weighted adjacency
 *        list plus a coordinate-based heuristic per vertex (a simple map of
 *        "straight-line-ish" estimates works for teaching).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
        } | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 4],
            ["C", 2],
        ],
        B: [
            ["D", 5],
            ["E", 3],
        ],
        C: [
            ["B", 1],
            ["D", 8],
        ],
        D: [
            ["E", 2],
            ["F", 6],
        ],
        E: [["F", 1]],
        F: [],
    };
    const start = task.start ?? "A";
    const target = task.target ?? "F";

    const vertices = Object.keys(graph);
    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(graph);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // A simple admissible heuristic: straight-line distances to F (all 0 is
    // admissible, but this example keeps small non-zero values so the guiding
    // effect is visible).
    const heuristic: Record<string, number> = {
        A: 5,
        B: 3,
        C: 4,
        D: 2,
        E: 1,
        F: 0,
    };

    let step = 0;

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `A* from ${start} to ${target} – prioritizing f(n) = g(n) + h(n).`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: {},
    });

    // g-cost and bookkeeping.
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const predecessor = new Map<string, string>();
    const closed = new Set<string>();

    for (const v of vertices) {
        gScore.set(v, Infinity);
        fScore.set(v, Infinity);
    }
    gScore.set(start, 0);
    fScore.set(start, heuristic[start] ?? 0);

    // The open set: vertices discovered but not yet expanded.
    const open = new Set<string>([start]);

    while (open.size > 0) {
        // Pick the open vertex with the smallest f-score.
        let current = "";
        let bestF = Infinity;
        for (const v of open) {
            const f = fScore.get(v) ?? Infinity;
            if (f < bestF) {
                bestF = f;
                current = v;
            }
        }

        if (current === "") {
            break;
        }

        // Goal reached: reconstruct the path.
        if (current === target) {
            const path: string[] = [];
            let cursor = target;
            while (cursor !== undefined) {
                path.push(cursor);
                cursor = predecessor.get(cursor) ?? "";
                if (cursor === "") {
                    break;
                }
            }
            path.reverse();
            for (let i = 0; i < path.length - 1; i += 1) {
                const edge = edges.find(
                    (e) => e.sourceId === `node-${path[i]}` && e.targetId === `node-${path[i + 1]}`,
                );
                if (edge) {
                    edge.state = "path";
                }
            }
            yield {
                stepNumber: step,
                entities: nodes.map((n) => ({ ...n })),
                edges: edges.map((e) => ({ ...e })),
                description: `A* found the path ${path.join(" → ")} (cost ${gScore.get(target)}).`,
                codeLineNumber: 4,
                layout: "graph",
                meta: { distance: gScore.get(target) ?? Infinity },
            };
            return;
        }

        // Expand the best vertex.
        open.delete(current);
        closed.add(current);

        const node = nodeById.get(`node-${current}`);
        if (node) {
            node.state = "comparing";
            node.label = String(gScore.get(current) ?? Infinity);
        }
        yield buildFrame(
            `Expanding ${current} (g=${gScore.get(current)}, h=${heuristic[current] ?? 0}).`,
        );
        step += 1;

        // Relax each neighbor.
        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [neighbor, weight] of graph[current] ?? []) {
            if (closed.has(neighbor)) {
                continue;
            }
            const tentativeG = (gScore.get(current) ?? Infinity) + weight;
            if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
                gScore.set(neighbor, tentativeG);
                fScore.set(neighbor, tentativeG + (heuristic[neighbor] ?? 0));
                predecessor.set(neighbor, current);
                open.add(neighbor);
            }

            const edge = edges.find(
                (e) => e.sourceId === `node-${current}` && e.targetId === `node-${neighbor}`,
            );
            if (edge) {
                edge.state = "active";
            }
            const neighborNode = nodeById.get(`node-${neighbor}`);
            if (neighborNode) {
                neighborNode.state = "visited";
            }
            yield buildFrame(`Relaxing ${current} → ${neighbor}.`);
            step += 1;
        }

        if (node) {
            node.state = "sorted";
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `${target} is unreachable from ${start}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { distance: Infinity },
    };
}

/** The A* module, registered with the engine. */
const module: AlgorithmModule = {
    id: "a-star",
    name: "A*",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V)" },
    // Same graph as Dijkstra so the heuristic's steering effect is visible.
    defaultInput: {
        graph: {
            A: [
                ["B", 4],
                ["C", 2],
            ],
            B: [
                ["D", 5],
                ["E", 3],
            ],
            C: [
                ["B", 1],
                ["D", 8],
            ],
            D: [
                ["E", 2],
                ["F", 6],
            ],
            E: [["F", 1]],
            F: [],
        },
        start: "A",
        target: "F",
    },
    visualType: "graph",
    run,
};

export default module;
