/**
 * real-time-a-star.ts - Real-Time A* (RTA*)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RTA* is a one-step-lookahead agent. From the current state it scores each
 * immediate successor by edge cost plus heuristic, commits to the best one,
 * and backs up the second-best score as the new heuristic of the state it left.
 * Using the runner-up value keeps the learned estimate optimistic enough to
 * stay useful while avoiding the extra memory of a full search frontier.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * branching factor) per trial
 *   Space: O(V) for the learned heuristic and the visited path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current state is YELLOW (comparing), traveled states are CYAN (path).
 *   - Traversed edges turn CYAN (path).
 *   - Captions show successor scores, the chosen move, and the backed-up value.
 */
import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WGraph = Record<string, Array<[string, number]>>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            graph?: WGraph;
            start?: string;
            goal?: string;
            heuristic?: Record<string, number>;
            maxSteps?: number;
        } | null
    ) ?? {};
    const graph: WGraph = task.graph ?? {
        A: [
            ["B", 1],
            ["C", 3],
        ],
        B: [
            ["A", 1],
            ["D", 2],
        ],
        C: [
            ["A", 3],
            ["D", 1],
            ["E", 4],
        ],
        D: [
            ["B", 2],
            ["C", 1],
            ["E", 2],
            ["F", 4],
        ],
        E: [
            ["C", 4],
            ["D", 2],
            ["F", 1],
        ],
        F: [
            ["E", 1],
            ["D", 4],
        ],
    };
    const vertices: string[] = [];
    const seen = new Set<string>();
    for (const v of Object.keys(graph)) {
        if (!seen.has(v)) {
            seen.add(v);
            vertices.push(v);
        }
        for (const [nb] of graph[v] ?? []) {
            if (!seen.has(nb)) {
                seen.add(nb);
                vertices.push(nb);
            }
        }
    }
    const start = task.start ?? "A";
    const goal = task.goal ?? "F";
    const maxSteps =
        typeof task.maxSteps === "number" ? Math.max(1, task.maxSteps) : Math.max(4, vertices.length * 2);

    const nodes = makeGraphNodes(vertices.length > 0 ? vertices : ["A"]);
    const edges = makeWeightedEdges(graph);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const h = new Map<string, number>();
    for (const v of vertices) h.set(v, task.heuristic?.[v] ?? 0);

    let step = 0;
    const snap = (
        description: string,
        line: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber: line,
        layout: "graph",
        meta,
    });

    if (!seen.has(start) || !seen.has(goal)) {
        yield snap("Start or goal is not in the graph - no trial can run.", 7, {
            reached: false,
            cost: 0,
            path: "",
        });
        return;
    }

    const path: string[] = [start];
    let current = start;
    let cost = 0;
    const startNode = byId.get(`node-${current}`);
    if (startNode) startNode.state = "comparing";
    yield snap(`Begin RTA* at ${start}, heading for ${goal}.`, 0, {
        reached: start === goal,
        cost: 0,
        path: start,
        steps: 0,
    });
    step += 1;

    let reached = start === goal;
    for (let iteration = 0; iteration < maxSteps && !reached; iteration += 1) {
        const successors = [...(graph[current] ?? [])].sort((a, b) => a[0].localeCompare(b[0]));
        if (successors.length === 0) break;
        const scored = successors.map(
            ([nb, w]) => ({ next: nb, weight: w, f: w + (h.get(nb) ?? 0) }),
        );
        scored.sort((a, b) => a.f - b.f || a.next.localeCompare(b.next));
        const best = scored[0] as { next: string; weight: number; f: number };
        const backup = scored.length > 1 ? (scored[1] as { f: number }).f : best.f;
        h.set(current, backup);

        for (const e of edges) e.state = "idle";
        for (let i = 0; i < path.length - 1; i += 1) {
            const edge = edges.find(
                (e) => e.sourceId === `node-${path[i]}` && e.targetId === `node-${path[i + 1]}`,
            );
            if (edge) edge.state = "path";
        }
        const nextEdge = edges.find(
            (e) => e.sourceId === `node-${current}` && e.targetId === `node-${best.next}`,
        );
        if (nextEdge) nextEdge.state = "path";
        for (const n of nodes) n.state = "unvisited";
        for (const v of path) {
            const node = byId.get(`node-${v}`);
            if (node) node.state = "path";
        }
        const cn = byId.get(`node-${current}`);
        if (cn) cn.state = "comparing";

        const scores = scored.map((s) => `${s.next}:${s.f}`).join(", ");
        cost += best.weight;
        current = best.next;
        path.push(current);
        reached = current === goal;
        yield snap(
            `At ${path[path.length - 2]}: scores {${scores}}; commit to ${best.next}, back up h = ${backup}.`,
            3,
            { reached, cost, path: path.join("->"), steps: path.length - 1 },
        );
        step += 1;
    }

    for (const n of nodes) n.state = reached ? "path" : "unvisited";
    yield snap(
        reached
            ? `Reached ${goal} in ${path.length - 1} step(s) with cost ${cost}.`
            : `Stopped after ${path.length - 1} step(s) without reaching ${goal}.`,
        6,
        { reached, cost, path: path.join("->"), steps: path.length - 1 },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RTA* makes only one move at a time. It looks at the immediate successors, scores them by edge cost plus estimated remaining cost, commits to the best, and stores the runner-up score as the new estimate for where it stood. That backup value preserves optimism while letting the agent keep learning from each visit.",
        invariants: [
            "The chosen successor minimizes edge cost plus the heuristic estimate.",
            "The backed-up heuristic is the second-smallest successor score, or the only score when there is one successor.",
            "Each committed move traverses a real edge and adds its cost.",
        ],
        correctness:
            "RTA* is a learning real-time search: with a finite state space and bounded edge costs, the backed-up values converge and the policy becomes greedy with respect to a consistent estimate, so the agent eventually reaches the goal along a shortest path. The visualization exposes the actual traversed cost so an independent shortest-path calculation can confirm optimality for the shown trial.",
        complexityRationale:
            "Each decision scans the current state's successors, costing O(b) for branching factor b, so a trial of s steps costs O(s b). Storing the learned heuristic and path uses O(V) space.",
        uses: [
            "Agents that must act before a complete search can finish",
            "Mobile robots learning a route through repeated traversals",
            "A contrast case when teaching RTA* versus LRTA* backup rules",
        ],
        references: [
            "Korf, Real-Time Heuristic Search, 1990",
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths, 1968",
        ],
        workedExample:
            "At A the successor scores are B at 6 and C at 7. RTA* commits to B and backs up the runner-up 7 as h(A). Following the same rule at B, D, and E produces A-B-D-E-F with cost 6, matching the true shortest path in the example graph.",
    },
    id: "real-time-a-star",
    name: "Real-Time A* (RTA*)",
    category: "shortest-path",
    complexity: { time: "O(steps * b)", space: "O(V)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 1],
                ["C", 3],
            ],
            B: [
                ["A", 1],
                ["D", 2],
            ],
            C: [
                ["A", 3],
                ["D", 1],
                ["E", 4],
            ],
            D: [
                ["B", 2],
                ["C", 1],
                ["E", 2],
                ["F", 4],
            ],
            E: [
                ["C", 4],
                ["D", 2],
                ["F", 1],
            ],
            F: [
                ["E", 1],
                ["D", 4],
            ],
        },
        start: "A",
        goal: "F",
        heuristic: { A: 6, B: 5, C: 4, D: 3, E: 1, F: 0 },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set current to the start state",
        "while current is not the goal and steps remain",
        "score each successor as edge cost plus its heuristic",
        "choose the successor with the smallest score",
        "back up the second-smallest score into h of current",
        "move to the chosen successor and add the edge cost",
        "stop when the goal is reached or steps run out",
        "done: report the path and its cost",
    ],
};

export default module;
