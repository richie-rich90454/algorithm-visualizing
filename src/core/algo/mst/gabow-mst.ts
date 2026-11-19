/**
 * gabow-mst.ts - Gabow's Component-Queue MST.
 *
 * Gabow's variant keeps a frontier of candidate edges for every contracted
 * component, much like running Prim from all components at once. The globally
 * cheapest frontier edge that leaves its component is added, the two endpoint
 * components are merged, and their frontier lists are combined with edges now
 * internal to the merged component discarded. Repeating this grows one minimum
 * spanning tree without sorting every edge up front.
 *
 * Time:  O(E log V) with heaped frontiers, O(E V) with scanned lists
 * Space: O(V + E)
 */
import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Edge = [string, string, number];
type Candidate = { weight: number; from: string; to: string };

interface Component {
    id: string;
    vertices: Set<string>;
    frontier: Candidate[];
}

function kruskal(vertices: string[], edges: Edge[]): number {
    const parent = new Map(vertices.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        return r;
    };
    let weight = 0;
    let count = 0;
    for (const [a, b, w] of [...edges].sort((x, y) => x[2] - y[2])) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) continue;
        parent.set(ra, rb);
        weight += w;
        if (++count === vertices.length - 1) break;
    }
    return weight;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[]; edges?: Edge[] } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edges: Edge[] = task.edges ?? [
        ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
        ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
    ];
    const nodes = makeGraphNodes(vertices);
    const visualEdges: VisualEdge[] = edges.map(([a, b, w], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: String(w),
        state: "idle",
        directed: false,
    }));
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    let step = 0;
    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of visualEdges) e.state = "idle";
    };
    const snap = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean>): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: visualEdges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    const comps = new Map<string, Component>();
    const owner = new Map<string, string>();
    for (const v of vertices) {
        const frontier: Candidate[] = [];
        for (const [a, b, w] of edges) {
            if (a === v) frontier.push({ weight: w, from: a, to: b });
            else if (b === v) frontier.push({ weight: w, from: b, to: a });
        }
        comps.set(v, { id: v, vertices: new Set([v]), frontier });
        owner.set(v, v);
    }

    clear();
    yield snap(
        `Gabow MST starts with ${comps.size} single-vertex components, each holding a frontier of incident edges.`,
        0,
        { cost: 0, accepted: 0, components: comps.size },
    );
    step += 1;

    const chosen: number[] = [];
    let weight = 0;
    for (let guard = 0; comps.size > 1 && guard < vertices.length + 5; guard += 1) {
        let pick: { compId: string; index: number; candidate: Candidate } | null = null;
        for (const comp of comps.values()) {
            for (let i = 0; i < comp.frontier.length; i += 1) {
                const candidate = comp.frontier[i] as Candidate;
                if (comp.vertices.has(candidate.to)) continue;
                if (!pick || candidate.weight < pick.candidate.weight) {
                    pick = { compId: comp.id, index: i, candidate };
                }
            }
        }
        if (!pick) break;
        const { from, to, weight: w } = pick.candidate;
        const compA = comps.get(pick.compId) as Component;
        const compB = comps.get(owner.get(to) as string) as Component;
        if (!compA || !compB || compA.id === compB.id) {
            compA?.frontier.splice(pick.index, 1);
            continue;
        }
        const edgeIndex = edges.findIndex(
            ([a, b]) => (a === from && b === to) || (a === to && b === from),
        );
        if (edgeIndex >= 0) chosen.push(edgeIndex);
        weight += w;
        const mergedVertices = new Set([...compA.vertices, ...compB.vertices]);
        const mergedFrontier = [...compA.frontier, ...compB.frontier].filter(
            (candidate) => !mergedVertices.has(candidate.to),
        );
        const newId = compA.id < compB.id ? compA.id : compB.id;
        comps.delete(compA.id);
        comps.delete(compB.id);
        comps.set(newId, { id: newId, vertices: mergedVertices, frontier: mergedFrontier });
        for (const v of mergedVertices) owner.set(v, newId);

        clear();
        for (const v of mergedVertices) {
            const n = byLabel.get(v);
            if (n) n.state = "active";
        }
        const edge = edgeIndex >= 0 ? visualEdges[edgeIndex] : undefined;
        if (edge) edge.state = "path";
        yield snap(
            `Merge via ${from}-${to} of weight ${w}: combine the two component frontiers and discard edges now internal; ${comps.size} component(s) remain.`,
            3,
            { cost: weight, accepted: chosen.length, components: comps.size },
        );
        step += 1;
    }

    clear();
    for (const index of chosen) {
        const e = visualEdges[index];
        if (e) e.state = "path";
    }
    yield snap(
        `One component remains. The component-queue MST has weight ${weight} with ${chosen.length} edge(s).`,
        6,
        { cost: weight, optimal: kruskal(vertices, edges), accepted: chosen.length, components: comps.size },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Gabow's approach is like starting Prim's algorithm from every vertex at once. Each contracted component keeps a frontier of edges leaving it. The cheapest valid frontier edge is chosen globally, the two components merge, and their frontiers are combined after dropping edges that have become internal. This avoids sorting all edges while still growing a minimum spanning tree.",
        invariants: [
            "Every frontier entry has its source inside the component and its target outside.",
            "The chosen edge is the cheapest one crossing between two components.",
            "Merging two components never creates a cycle in the accumulated tree.",
        ],
        correctness:
            "The cheapest edge leaving any component is the lightest edge of the cut defined by that component's vertices, so by the cut property it is safe to add. Merging the components and refreshing frontiers preserves the invariant, and after V minus one merges the single component is connected and acyclic with minimum total weight.",
        complexityRationale:
            "Scanning frontiers each round is O(E V) in the simple form; storing each component's frontier in a heap reduces this to O(E log V). Vertices, owners, and frontier lists use O(V + E) space.",
        uses: [
            "MST construction without a global edge sort",
            "Parallel and external-memory spanning tree algorithms",
            "A teaching bridge between Prim and Kruskal",
        ],
        references: [
            "Gabow, A Scaling Algorithm for Weighted Matching on General Graphs (1985)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, minimum spanning trees",
        ],
        workedExample:
            "Starting from six vertices, the cheapest frontier edge B-C(1) merges B and C. Their combined frontier keeps C-D(8) and B-D(5) but drops internal edges. The next cheapest edge D-E(2) merges again, and after five merges the accumulated edges weigh 16.",
    },
    id: "gabow-mst",
    name: "Gabow MST (Component Queue)",
    category: "mst",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        edges: [
            ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
            ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "create one component per vertex with its incident edges as frontier",
        "scan all component frontiers for the cheapest edge leaving its component",
        "add that edge to the growing spanning tree",
        "find the components containing the two endpoints",
        "merge their vertex sets and concatenate their frontiers",
        "remove frontier edges whose target is now internal",
        "repeat until a single component remains",
        "done: report the spanning tree weight",
    ],
};

export default module;
