/**
 * pallottino-algorithm.ts - Pallottino's Label-Correcting Shortest Paths.
 *
 * Pallottino's algorithm keeps a deque of nodes whose labels may need
 * updating. A node relaxed for the first time goes to the back of the deque;
 * a node that was already scanned goes to the front, so a changed predecessor
 * is propagated immediately. Unlike Dijkstra it tolerates negative edges.
 *
 * Time O(V E) worst case, space O(V + E).
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Arc = { u: string; v: string; w: number };
type Input = { vertices?: string[]; edges?: [string, string, number][]; source?: string };

function nodes(
    verts: string[],
    dist: Map<string, number>,
    states: Map<string, EntityState>,
): VisualEntity[] {
    return verts.map((name) => {
        const d = dist.get(name) ?? Infinity;
        return {
            id: `node-${name}`,
            type: "node" as const,
            label: `${name} (${Number.isFinite(d) ? d : "inf"})`,
            value: Number.isFinite(d) ? d : 0,
            state: states.get(name) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label: name, dist: Number.isFinite(d) ? d : -1 },
        };
    });
}

function arcs(list: Arc[], states: Map<number, EntityState>): VisualEdge[] {
    return list.map((a, i) => ({
        id: `edge-${i}`,
        sourceId: `node-${a.u}`,
        targetId: `node-${a.v}`,
        label: String(a.w),
        state: states.get(i) ?? "idle",
        directed: true,
    }));
}

function snapshot(
    step: number,
    verts: string[],
    arcList: Arc[],
    dist: Map<string, number>,
    states: Map<string, EntityState>,
    edgeStates: Map<number, EntityState>,
    description: string,
    line: number,
    extra: Record<string, number | string | boolean> = {},
): VisualFrame {
    return {
        stepNumber: step,
        entities: nodes(verts, dist, states),
        edges: arcs(arcList, edgeStates),
        description,
        codeLineNumber: line,
        layout: "graph",
        meta: { ...extra, source: verts[0] ?? "" },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const arcList: Arc[] = (task.edges ?? []).map((e) => ({ u: String(e[0]), v: String(e[1]), w: Number(e[2]) }));
    const verts = Array.from(new Set<string>([
        ...(task.vertices ?? []).map(String),
        ...arcList.flatMap((a) => [a.u, a.v]),
    ]));
    const source = task.source !== undefined ? String(task.source) : (verts[0] ?? "");
    let step = 0;

    if (verts.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - no shortest paths to compute.",
            codeLineNumber: 0,
            layout: "graph",
            meta: {},
        };
        return;
    }

    const dist = new Map<string, number>(verts.map((v) => [v, Infinity]));
    const parent = new Map<string, string | null>(verts.map((v) => [v, null]));
    dist.set(source, 0);

    const deque: string[] = [source];
    const queued = new Set<string>([source]);
    const scanned = new Set<string>();

    yield snapshot(
        step++,
        verts,
        arcList,
        dist,
        new Map([[source, "active" as EntityState]]),
        new Map(),
        `Pallottino label-correcting from ${source}: only ${source} has a finite label.`,
        0,
        { relaxations: 0 },
    );

    let relaxations = 0;
    let guard = 0;
    const guardLimit = 100 * Math.max(1, verts.length * arcList.length);

    while (deque.length > 0 && guard++ < guardLimit) {
        const u = deque.shift() as string;
        queued.delete(u);
        scanned.add(u);
        const edgeStates = new Map<number, EntityState>();
        let changed = false;

        arcList.forEach((a, i) => {
            if (a.u !== u) return;
            const du = dist.get(u) ?? Infinity;
            const dv = dist.get(a.v) ?? Infinity;
            if (du + a.w < dv) {
                changed = true;
                relaxations += 1;
                edgeStates.set(i, "comparing");
                dist.set(a.v, du + a.w);
                parent.set(a.v, u);
                if (!queued.has(a.v)) {
                    queued.add(a.v);
                    if (scanned.has(a.v)) deque.unshift(a.v);
                    else deque.push(a.v);
                }
            }
        });

        const states = new Map<string, EntityState>([[u, "visited" as EntityState]]);
        for (const v of queued) states.set(v, "active");
        yield snapshot(
            step++,
            verts,
            arcList,
            dist,
            states,
            edgeStates,
            `Scan ${u}: ${changed ? "improved labels and requeued affected nodes" : "no improvement"}; deque size ${deque.length}.`,
            changed ? 3 : 2,
            { relaxations, deque: deque.length },
        );
    }

    const finalStates = new Map<string, EntityState>();
    for (const v of verts) {
        finalStates.set(v, Number.isFinite(dist.get(v) ?? Infinity) ? "sorted" : "unvisited");
    }
    yield snapshot(
        step,
        verts,
        arcList,
        dist,
        finalStates,
        new Map(),
        `Final labels from ${source}: ${verts.map((v) => `${v}=${Number.isFinite(dist.get(v) ?? Infinity) ? dist.get(v) : "inf"}`).join(", ")}.`,
        5,
        { relaxations, converged: guard <= guardLimit },
    );
}

const module: AlgorithmModule = {
    id: "pallottino-algorithm",
    name: "Pallottino Label-Correcting Shortest Paths",
    category: "shortest-path",
    complexity: { time: "O(V E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B", 4],
            ["A", "C", 5],
            ["B", "C", -2],
            ["C", "D", 3],
            ["B", "D", 10],
        ],
        source: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set label of source to zero and all others to infinity",
        "place the source in a deque and mark it queued",
        "while the deque is nonempty take the front node u",
        "mark u as scanned and relax every outgoing arc",
        "on improvement update the label and predecessor of v",
        "if v was scanned push it to the front, else to the back",
        "when the deque empties report the final labels",
    ],
    education: {
        intuition:
            "Labels are upper bounds on the true distance and only ever decrease. The algorithm repeatedly pulls a node from a deque and relaxes its outgoing arcs. If a node that was already scanned gets a better label, putting it at the front of the deque propagates the correction immediately instead of waiting behind other work.",
        invariants: [
            "Every label is the length of some path from the source, so it is at least the true distance.",
            "Once a label decreases its predecessor chain forms a path of that length.",
            "A node is in the deque exactly when its outgoing arcs may need rescanning.",
        ],
        correctness:
            "Each relaxation preserves the invariant that labels are path lengths. When the deque empties, no outgoing arc of any node can improve a label, so the labels satisfy the Bellman condition d(v) <= d(u) + w(u,v) for every arc. On graphs without negative cycles reachable from the source these inequalities are exactly the shortest-path optimality conditions, so the labels are the true distances.",
        complexityRationale:
            "A node can be rescanned each time one of its labels improves, and each scan examines its outgoing arcs. With O(V E) possible improvements the worst case is O(V E) time. The labels, predecessors, and deque together use O(V + E) space.",
        uses: [
            "Shortest paths on graphs with negative edges but no negative cycles",
            "A teaching bridge between Bellman-Ford and Dijkstra",
            "Label-correcting solvers in network flow packages",
        ],
        references: [
            "Pallottino, A New Algorithm for Finding Shortest Paths in Networks with Negative Arc Lengths, 1984",
            "Ahuja, Magnanti, and Orlin, Network Flows, label-correcting algorithms",
        ],
        workedExample:
            "With arcs A-B weight 4, A-C weight 5, B-C weight -2, and C-D weight 3 from source A: A starts at 0. Scanning A sets B=4 and C=5. Scanning B improves C to 2; because C was not yet scanned it joins the deque. Scanning C sets D=5. The final distances are A=0, B=4, C=2, D=5.",
    },
};

export default module;
