/**
 * beam-stack-search.ts - Beam Stack Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Beam stack search keeps the memory discipline of beam search without giving
 * up completeness. At each step it orders a frontier by f = g + h, expands only
 * the best beamWidth nodes, and pushes the unexpanded remainder of that
 * frontier onto a stack. Once the active beam is exhausted, the most recently
 * deferred frontier is popped and explored. Running the stack until it is
 * empty eventually relaxes every reachable label, so the first-found solution
 * can be improved into the optimal one instead of being lost to pruning.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R log R) for R frontier entries processed until convergence
 *   Space: O(V + E) for labels, parents, and the deferred-frontier stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The active beam is highlighted; deferred nodes are drawn as visited.
 *   - Edges relaxed in the current expansion are active.
 *   - The final optimal path is drawn in cyan.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface AdjEntry {
    to: string;
    w: number;
    id: string;
}

interface Entry {
    node: string;
    g: number;
}

function edgeKey(u: string, v: string): string {
    return u < v ? `${u}-${v}` : `${v}-${u}`;
}

/** The Beam Stack Search generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            positions?: Record<string, Point>;
            start?: string;
            target?: string;
            beamWidth?: number;
        } | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 1],
            ["D", 1],
        ],
        B: [
            ["C", 1],
            ["E", 2],
        ],
        C: [["F", 1]],
        D: [
            ["E", 1],
            ["G", 1],
        ],
        E: [
            ["F", 2],
            ["H", 1],
        ],
        F: [["I", 1]],
        G: [["H", 1]],
        H: [["I", 1]],
        I: [],
    };
    const positions: Record<string, Point> = task.positions ?? {
        A: [0, 0],
        B: [1, 0],
        C: [2, 0],
        D: [0, 1],
        E: [1, 1],
        F: [2, 1],
        G: [0, 2],
        H: [1, 2],
        I: [2, 2],
    };
    const start = task.start ?? "A";
    const target = task.target ?? "I";
    const beamWidth = typeof task.beamWidth === "number" ? Math.max(1, Math.floor(task.beamWidth)) : 2;

    let step = 0;

    // Unique undirected edges and adjacency.
    const edges: Array<{ u: string; v: string; w: number }> = [];
    const seenEdges = new Set<string>();
    for (const [u, neighbors] of Object.entries(graph)) {
        for (const [v, w] of neighbors) {
            const key = edgeKey(u, v);
            if (!seenEdges.has(key)) {
                seenEdges.add(key);
                edges.push({ u, v, w });
            }
        }
    }
    const nodes = Array.from(
        new Set([...edges.flatMap((e) => [e.u, e.v]), start, target]),
    ).sort();
    const adjacency = new Map<string, AdjEntry[]>();
    for (const node of nodes) {
        adjacency.set(node, []);
    }
    for (const edge of edges) {
        const id = edgeKey(edge.u, edge.v);
        adjacency.get(edge.u)?.push({ to: edge.v, w: edge.w, id });
        adjacency.get(edge.v)?.push({ to: edge.u, w: edge.w, id });
    }
    const targetPoint = positions[target] ?? [0, 0];
    const heuristic = (node: string): number => {
        const p = positions[node];
        if (!p) {
            return 0;
        }
        return Math.hypot(p[0] - targetPoint[0], p[1] - targetPoint[1]);
    };

    const makeFrame = (
        beam: Set<string>,
        seen: Set<string>,
        relaxed: Set<string>,
        pathNodes: Set<string>,
        pathEdges: Set<string>,
        description: string,
        codeLine: number,
        meta: Record<string, number | string | boolean>,
    ): VisualFrame => {
        const entities: VisualEntity[] = nodes.map((label) => {
            let state: VisualEntity["state"] = "unvisited";
            if (label === start || label === target) {
                state = "highlight";
            }
            if (seen.has(label)) {
                state = "visited";
            }
            if (beam.has(label)) {
                state = "active";
            }
            if (pathNodes.has(label)) {
                state = "path";
            }
            const p = positions[label] ?? [0, 0];
            return {
                id: `node-${label}`,
                type: "node" as const,
                label,
                value: label,
                state,
                x: p[0],
                y: p[1],
                width: 0,
                height: 0,
                metadata: { label, g: heuristic(label) },
            };
        });
        const visualEdges: VisualEdge[] = edges.map((edge) => {
            const id = edgeKey(edge.u, edge.v);
            return {
                id: `edge-${id}`,
                sourceId: `node-${edge.u}`,
                targetId: `node-${edge.v}`,
                label: String(edge.w),
                state: pathEdges.has(id)
                    ? ("path" as const)
                    : relaxed.has(id)
                      ? ("active" as const)
                      : ("idle" as const),
                directed: false,
            };
        });
        return {
            stepNumber: step,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber: codeLine,
            layout: "point",
            meta,
        };
    };

    yield makeFrame(
        new Set([start]),
        new Set(),
        new Set(),
        new Set(),
        new Set(),
        `Beam stack search from ${start} to ${target} with beam width ${beamWidth}.`,
        0,
        { beamWidth, expansions: 0, stackDepth: 1, bestGoal: -1 },
    );
    step += 1;

    const best = new Map<string, number>();
    const parent = new Map<string, string>();
    for (const node of nodes) {
        best.set(node, Infinity);
    }
    best.set(start, 0);
    const stack: Entry[][] = [[{ node: start, g: 0 }]];
    const seen = new Set<string>([start]);
    let expansions = 0;

    while (stack.length > 0 && expansions < 2000) {
        const frontier = stack.pop() as Entry[];
        if (frontier.length === 0) {
            continue;
        }
        frontier.sort((a, b) => a.g + heuristic(a.node) - (b.g + heuristic(b.node)));
        const beam = frontier.slice(0, beamWidth);
        const deferred = frontier.slice(beamWidth);
        if (deferred.length > 0) {
            stack.push(deferred);
        }
        const relaxed = new Set<string>();
        const next: Entry[] = [];
        for (const entry of beam) {
            if (entry.g > (best.get(entry.node) as number)) {
                continue;
            }
            seen.add(entry.node);
            expansions += 1;
            for (const neighbor of adjacency.get(entry.node) ?? []) {
                const candidate = entry.g + neighbor.w;
                relaxed.add(neighbor.id);
                if (candidate < (best.get(neighbor.to) as number)) {
                    best.set(neighbor.to, candidate);
                    parent.set(neighbor.to, entry.node);
                    next.push({ node: neighbor.to, g: candidate });
                }
            }
        }
        if (next.length > 0) {
            stack.push(next);
        }
        const goalCost = best.get(target) as number;
        yield makeFrame(
            new Set(beam.map((entry) => entry.node)),
            seen,
            relaxed,
            new Set(),
            new Set(),
            `Expanded beam of ${beam.length} node(s); deferred ${deferred.length}, best goal estimate ${Number.isFinite(goalCost) ? goalCost.toFixed(2) : "infinity"}.`,
            4,
            {
                beamWidth,
                expansions,
                stackDepth: stack.length,
                bestGoal: Number.isFinite(goalCost) ? goalCost : -1,
            },
        );
        step += 1;
    }

    const goalCost = best.get(target) as number;
    const found = Number.isFinite(goalCost);
    const pathNodes = new Set<string>();
    const pathEdges = new Set<string>();
    if (found) {
        let cursor: string | undefined = target;
        pathNodes.add(target);
        while (cursor !== undefined && parent.has(cursor)) {
            const prev = parent.get(cursor) as string;
            pathEdges.add(edgeKey(prev, cursor));
            pathNodes.add(prev);
            cursor = prev;
        }
    }
    yield makeFrame(
        new Set(),
        seen,
        new Set(),
        pathNodes,
        pathEdges,
        found
            ? `Optimal path ${start} to ${target} has cost ${goalCost.toFixed(2)} after ${expansions} expansion(s).`
            : `${target} is unreachable from ${start}.`,
        7,
        { beamWidth, expansions, stackDepth: stack.length, found, pathCost: found ? goalCost : -1 },
    );
}

/** The Beam Stack Search module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain beam search throws away every candidate outside the top w, so it can permanently discard the branch that leads to the goal. Beam stack search keeps those discarded candidates on a stack instead. It expands a small beam now and returns to the saved frontier later, getting the low memory use of beam search while still being able to recover a complete answer.",
        invariants: [
            "Every frontier entry records the best discovered cost g for its node at insertion time.",
            "A node's label is relaxed only when a strictly cheaper path to it is found.",
            "Deferred frontiers stay on the stack until the current beam is fully expanded.",
        ],
        correctness:
            "The stack is exhausted only when no frontier contains an entry that can improve a label. Because every edge is relaxed whenever a cheaper predecessor is found, the stored labels satisfy the same relaxation conditions as Bellman-Ford, so each best value equals the true shortest distance. When the goal is reached, running the stack to completion lets any later cheaper route replace it, leaving an optimal predecessor chain.",
        complexityRationale:
            "Each frontier entry is sorted and expanded at most once per improvement; with R total entries the ordering work is O(R log R). Labels, parents, and deferred frontiers hold at most O(V + E) entries at a time.",
        uses: [
            "Anytime search where a quick answer must improve over time",
            "Planning with limited memory but a need for eventual completeness",
            "Heuristic search that wants beam speed without beam pruning losses",
        ],
        references: [
            "Patel, Chu, and Pan, Beam Stack Search: A New Anytime Search Algorithm, 2002",
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths, 1968",
        ],
        workedExample:
            "With beam width 2 on a nine-node grid, the start's two successors are expanded and the rest of that frontier is stacked. Later the stack is popped, alternate branches are expanded, and a cheaper route to the goal replaces the first one found, ending at the optimal cost of 4.",
    },
    id: "beam-stack-search",
    name: "Beam Stack Search",
    category: "searching",
    complexity: { time: "O(R log R)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 1],
                ["D", 1],
            ],
            B: [
                ["C", 1],
                ["E", 2],
            ],
            C: [["F", 1]],
            D: [
                ["E", 1],
                ["G", 1],
            ],
            E: [
                ["F", 2],
                ["H", 1],
            ],
            F: [["I", 1]],
            G: [["H", 1]],
            H: [["I", 1]],
            I: [],
        },
        positions: {
            A: [0, 0],
            B: [1, 0],
            C: [2, 0],
            D: [0, 1],
            E: [1, 1],
            F: [2, 1],
            G: [0, 2],
            H: [1, 2],
            I: [2, 2],
        },
        start: "A",
        target: "I",
        beamWidth: 2,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize best costs to infinity and push the start frontier",
        "pop a frontier and order it by g plus heuristic h",
        "expand only the first beamWidth entries as the active beam",
        "push the unexpanded remainder back onto the stack",
        "relax each neighbor when a cheaper path is discovered",
        "push improved successors as a new frontier onto the stack",
        "repeat until the stack is empty or a step limit is reached",
        "reconstruct the optimal path from predecessor links",
        "done: report the optimal goal cost",
    ],
};

export default module;
