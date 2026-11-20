/**
 * lrta-star.ts - Learning Real-Time A* (LRTA*)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LRTA* is an agent-centered search method. At each step it examines only the
 * immediate successors of the current state, picks the one minimizing edge
 * cost plus learned heuristic, and updates the heuristic of the state it just
 * left to that minimum. The learning step makes repeated trials converge
 * toward optimal behavior while each decision stays constant-time in the
 * number of successors.
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
 *   - The current state is YELLOW (comparing), visited states are CYAN (path).
 *   - Traversed edges turn CYAN (path).
 *   - Each caption lists the successor f-values that drove the decision.
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
    const currentNode = byId.get(`node-${current}`);
    if (currentNode) currentNode.state = "comparing";
    yield snap(`Begin LRTA* at ${start}, heading for ${goal}.`, 0, {
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
        let best: [string, number] = successors[0] as [string, number];
        let bestF = Infinity;
        const scores: string[] = [];
        for (const [nb, w] of successors) {
            const f = w + (h.get(nb) ?? 0);
            scores.push(`${nb}:${f}`);
            if (f < bestF) {
                bestF = f;
                best = [nb, w];
            }
        }
        h.set(current, bestF);
        const [next, weight] = best;
        for (const e of edges) e.state = "idle";
        for (let i = 0; i < path.length - 1; i += 1) {
            const edge = edges.find(
                (e) => e.sourceId === `node-${path[i]}` && e.targetId === `node-${path[i + 1]}`,
            );
            if (edge) edge.state = "path";
        }
        const nextEdge = edges.find(
            (e) => e.sourceId === `node-${current}` && e.targetId === `node-${next}`,
        );
        if (nextEdge) nextEdge.state = "path";
        for (const n of nodes) n.state = "unvisited";
        for (const v of path) {
            const node = byId.get(`node-${v}`);
            if (node) node.state = "path";
        }
        const cn = byId.get(`node-${current}`);
        if (cn) cn.state = "comparing";

        cost += weight;
        current = next;
        path.push(next);
        reached = current === goal;
        yield snap(
            `At ${path[path.length - 2]}: f-values {${scores.join(", ")}}; learn h = ${bestF}, move to ${next}.`,
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
            "An agent that cannot afford a full search looks only one move ahead. LRTA* scores each immediate successor by the cost to reach it plus its learned estimate of the remaining cost, moves to the cheapest, and records that best score as the new estimate for the place it left. Repeated experience gradually turns a rough heuristic into a good one.",
        invariants: [
            "The learned heuristic of a state never decreases during learning.",
            "At each step the chosen successor has minimum cost plus estimated remaining cost.",
            "Every move follows an actual edge and adds its cost to the trial total.",
        ],
        correctness:
            "For an admissible and consistent heuristic, the learned values increase monotonically up to the true optimal cost-to-go, so repeated trials from the same start eventually follow an optimal path. In the single-trial visualization with a consistent heuristic the path is already optimal. The visualization reports the actual cost so it can be checked against an independent shortest-path computation rather than assuming success.",
        complexityRationale:
            "A decision inspects only the current state's successors, so one step costs O(b) for branching factor b and a trial of s steps costs O(s b). State consists of the learned heuristic on V states and the current path, using O(V) space.",
        uses: [
            "Real-time pathfinding for game characters with limited planning time",
            "Robot navigation where the map is discovered while moving",
            "Incremental search that improves with repeated traversals",
        ],
        references: [
            "Korf, Real-Time Heuristic Search, 1990",
            "Hart, Nilsson, and Raphael, A Formal Basis for the Heuristic Determination of Minimum Cost Paths, 1968",
        ],
        workedExample:
            "From A with true remaining distances as the heuristic, successors B and C score 1 plus 5 equals 6 and 3 plus 4 equals 7. LRTA* sets h(A) to 6 and steps to B. Repeating at B, D, and E yields the path A-B-D-E-F with cost 6, which is optimal.",
    },
    id: "lrta-star",
    name: "Learning Real-Time A* (LRTA*)",
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
        "for each successor compute f = edge cost + h of successor",
        "set h of current to the minimum f found",
        "move to the successor with the smallest f",
        "record the edge and add its cost to the total",
        "stop when the goal is reached or steps run out",
        "done: report the path and its cost",
    ],
};

export default module;
