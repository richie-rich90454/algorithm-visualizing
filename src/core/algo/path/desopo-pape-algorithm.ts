/**
 * desopo-pape-algorithm.ts - Dees-Pape (Pape-Levit) Shortest Paths.
 *
 * A label-correcting single-source shortest-path algorithm. Instead of a
 * priority queue it uses a deque: a relaxed neighbor is pushed to the front,
 * so recently improved labels are corrected first. It handles negative edge
 * weights (as long as no reachable negative cycle exists) and relaxes a label
 * as often as needed rather than finalizing vertices one at a time.
 *
 * Time:  O(V * E) worst case, fast in practice
 * Space: O(V + E)
 */
import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

type WAdj = Record<string, Array<[string, number]>>;

interface Result {
    dist: Map<string, number>;
    pred: Map<string, string>;
    rounds: Array<{ u: string; relaxed: Array<[string, number]> }>;
}

function deesPape(wadj: WAdj, start: string): Result {
    const dist = new Map<string, number>();
    const pred = new Map<string, string>();
    for (const v of Object.keys(wadj)) dist.set(v, Infinity);
    dist.set(start, 0);
    const deque: string[] = [start];
    const inQueue = new Set<string>([start]);
    const rounds: Array<{ u: string; relaxed: Array<[string, number]> }> = [];
    for (let guard = 0; deque.length > 0 && guard < 5000; guard += 1) {
        const u = deque.shift() as string;
        inQueue.delete(u);
        const relaxed: Array<[string, number]> = [];
        for (const [v, w] of wadj[u] ?? []) {
            const candidate = (dist.get(u) as number) + w;
            if (candidate < (dist.get(v) ?? Infinity)) {
                dist.set(v, candidate);
                pred.set(v, u);
                relaxed.push([v, candidate]);
                const existing = deque.indexOf(v);
                if (existing >= 0) deque.splice(existing, 1);
                deque.unshift(v);
                inQueue.add(v);
            }
        }
        rounds.push({ u, relaxed });
    }
    return { dist, pred, rounds };
}

function bellmanFord(wadj: WAdj, start: string): Map<string, number> {
    const dist = new Map<string, number>();
    for (const v of Object.keys(wadj)) dist.set(v, Infinity);
    dist.set(start, 0);
    const vertices = [...Object.keys(wadj)];
    for (let i = 0; i < vertices.length - 1; i += 1) {
        for (const u of vertices) {
            for (const [v, w] of wadj[u] ?? []) {
                dist.set(v, Math.min(dist.get(v) ?? Infinity, (dist.get(u) ?? Infinity) + w));
            }
        }
    }
    return dist;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: WAdj; start?: string; target?: string } | null) ?? {};
    const wadj: WAdj = task.graph ?? {
        A: [["B", 5], ["C", 2]],
        B: [["D", 1]],
        C: [["B", 1], ["D", 6], ["E", 3]],
        D: [["E", 1]],
        E: [],
    };
    const start = task.start ?? "A";
    const target = task.target ?? "E";
    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((es) => es.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels);
    const edges = makeWeightedEdges(wadj);
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    const result = deesPape(wadj, start);
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
        `Dees-Pape from ${start}: labels start at infinity except the source, which is zero.`,
        0,
        { cost: -1, rounds: 0 },
    );
    step += 1;

    const shown = result.rounds.slice(0, 40);
    for (const round of shown) {
        clear();
        const active = byLabel.get(round.u);
        if (active) active.state = "active";
        for (const [v] of round.relaxed) {
            const edge = edges.find(
                (x) => x.sourceId === `node-${round.u}` && x.targetId === `node-${v}`,
            );
            if (edge) edge.state = "comparing";
        }
        yield snap(
            `Pop ${round.u} from the front of the deque; ${round.relaxed.length} label(s) improved and moved to the front.`,
            round.relaxed.length > 0 ? 3 : 2,
            {
                cost: Number.isFinite(result.dist.get(target)) ? Number(result.dist.get(target)) : -1,
                rounds: step,
                active: round.u,
            },
        );
        step += 1;
    }

    clear();
    const path: string[] = [];
    let cursor: string | undefined = target;
    while (cursor !== undefined) {
        path.unshift(cursor);
        if (cursor === start) break;
        cursor = result.pred.get(cursor);
    }
    if (path[0] === start && Number.isFinite(result.dist.get(target))) {
        for (const v of path) {
            const n = byLabel.get(v);
            if (n) n.state = "path";
        }
        for (let i = 0; i + 1 < path.length; i += 1) {
            const e = edges.find(
                (x) => x.sourceId === `node-${path[i]}` && x.targetId === `node-${path[i + 1]}`,
            );
            if (e) e.state = "path";
        }
    }
    const cost = result.dist.get(target) ?? Infinity;
    const reference = bellmanFord(wadj, start).get(target) ?? Infinity;
    yield snap(
        Number.isFinite(cost)
            ? `Deque emptied. Shortest route ${path.join(" -> ")} costs ${cost}.`
            : `Deque emptied. ${target} is unreachable from ${start}.`,
        6,
        {
            cost: Number.isFinite(cost) ? cost : -1,
            optimal: Number.isFinite(reference) ? reference : -1,
            path,
            rounds: result.rounds.length,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Dees-Pape keeps a list of candidate labels in a deque rather than a priority queue. Whenever a vertex's distance improves, its new label goes to the front so the change propagates immediately. Labels may be updated many times, which is why the algorithm tolerates negative edges (provided no negative cycle is reachable).",
        invariants: [
            "Every distance label is the length of some concrete path from the source.",
            "A vertex enters the deque whenever its label improves.",
            "When the deque is empty, no label can be improved any further.",
        ],
        correctness:
            "Each relaxation replaces a label with a shorter realizable path length, so labels only decrease. If a shorter path remained after the deque emptied, its predecessor's label would have been improved earlier and would have enqueued the successor. Therefore at termination every label equals the true shortest-path distance.",
        complexityRationale:
            "Each of the V vertices can be relaxed up to E times in the worst case, giving O(V E) time; the deque, distance labels, and predecessor map use O(V + E) space.",
        uses: [
            "Shortest paths with negative edge weights but no negative cycles",
            "Label-correcting solvers in network flow packages",
            "A simple queue-based alternative to Bellman-Ford",
        ],
        references: [
            "Pape, Implementation and Efficiency of Moore-Algorithms for the Shortest Route Problem (1974)",
            "Dees, A Faster Algorithm for the Shortest Path Problem (1980)",
        ],
        workedExample:
            "From A, edge A-C sets C to 2 and C is pushed to the front. Popping C lowers B to 3 and D to 8; B at the front then lowers D to 4. After a few front insertions the deque empties with E's label settled at 5.",
    },
    id: "desopo-pape-algorithm",
    name: "Dees-Pape Shortest Paths",
    category: "shortest-path",
    complexity: { time: "O(V * E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [["B", 5], ["C", 2]],
            B: [["D", 1]],
            C: [["B", 1], ["D", 6], ["E", 3]],
            D: [["E", 1]],
            E: [],
        },
        start: "A",
        target: "E",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set every distance to infinity and the source to zero",
        "push the source onto the front of the deque",
        "pop the front vertex u from the deque",
        "for each outgoing edge u to v of weight w",
        "if distance u plus w is less than distance v, relax it",
        "place v at the front of the deque, moving it if already present",
        "repeat until the deque is empty",
        "done: distance labels hold the shortest paths",
    ],
};

export default module;
