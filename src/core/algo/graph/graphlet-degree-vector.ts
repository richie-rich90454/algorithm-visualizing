/**
 * graphlet-degree-vector.ts - Graphlet Degree Vector (3-node orbits)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The graphlet degree vector of a vertex counts how many small connected
 * induced subgraphs (graphlets) of each symmetry type contain that vertex in
 * each role (orbit). For three-node graphlets there are two shapes: a triangle
 * and an open wedge. A triangle has one orbit (every vertex plays the same
 * role). A wedge has two orbits: the center of the path and the two ends.
 * The vector [triangles, wedge-centers, wedge-ends] is a local structural
 * fingerprint used to compare how similar two vertices are.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3) enumerating unordered vertex triples
 *   Space: O(V + E) for the adjacency sets and result table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices of the triple under inspection are highlighted (comparing).
 *   - The remaining vertices stay idle.
 *   - The final frame colors every vertex by its triangle participation and
 *     reports the full orbit table in `meta.gdv`.
 */
import type { AlgorithmModule, EntityState, MetaValue, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Edge = [string, string];

interface In {
    nodes?: string[];
    edges?: Edge[];
}

/** Build an undirected edge set and adjacency map from the input. */
function build(input: In): { labels: string[]; adjacency: Map<string, Set<string>>; edges: Edge[] } {
    const supplied = input.nodes ?? [];
    const edges = (input.edges ?? []).map((e): Edge => [String(e[0]), String(e[1])]);
    const seen = new Set<string>(supplied.map(String));
    for (const [a, b] of edges) {
        seen.add(a);
        seen.add(b);
    }
    const labels = [...seen];
    const adjacency = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [a, b] of edges) {
        if (a === b) continue;
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
    }
    return { labels, adjacency, edges: edges.filter(([a, b]) => a !== b) };
}

/** Count [triangle, wedge-center, wedge-end] orbit participation per vertex. */
function computeOrbits(labels: string[], adjacency: Map<string, Set<string>>): Map<string, [number, number, number]> {
    const result = new Map(labels.map((v) => [v, [0, 0, 0] as [number, number, number]]));
    for (let i = 0; i < labels.length; i += 1) {
        const a = labels[i];
        if (!a) continue;
        const na = adjacency.get(a) as Set<string>;
        for (let j = i + 1; j < labels.length; j += 1) {
            const b = labels[j];
            if (!b) continue;
            const nb = adjacency.get(b) as Set<string>;
            for (let k = j + 1; k < labels.length; k += 1) {
                const c = labels[k];
                if (!c) continue;
                const nc = adjacency.get(c) as Set<string>;
                const ab = na.has(b);
                const ac = na.has(c);
                const bc = nb.has(c);
                const degree = (ab ? 1 : 0) + (ac ? 1 : 0) + (bc ? 1 : 0);
                if (degree === 3) {
                    for (const v of [a, b, c]) {
                        const orbit = result.get(v) as [number, number, number];
                        orbit[0] += 1;
                    }
                } else if (degree === 2) {
                    let center = "";
                    if (ab && ac) center = a;
                    else if (ab && bc) center = b;
                    else center = c;
                    const centerOrbit = result.get(center) as [number, number, number];
                    centerOrbit[1] += 1;
                    for (const v of [a, b, c].filter((x) => x !== center)) {
                        const orbit = result.get(v) as [number, number, number];
                        orbit[2] += 1;
                    }
                }
            }
        }
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as In | null) ?? {};
    const { labels, adjacency, edges } = build(task);
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const graphEdges: VisualEdge[] = edges.map(([a, b], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: "",
        state: "idle",
        directed: false,
    }));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const palette: EntityState[] = ["sorted", "visited", "highlight", "comparing", "active"];

    const frame = (stepNumber: number, description: string, codeLineNumber: number, meta: Record<string, MetaValue>): VisualFrame => ({
        stepNumber,
        entities: nodes.map((node) => ({ ...node })),
        edges: graphEdges.map((edge) => ({ ...edge })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    let step = 0;
    if (labels.length === 0) {
        yield frame(step, "Empty graph - no vertices have a graphlet degree vector.", 0, { gdv: {}, nodes: 0 });
        return;
    }

    yield frame(step, `Counting three-node graphlet orbits for ${labels.length} vertex(es).`, 0, {
        vertices: labels.length,
        edges: graphEdges.length,
    });
    step += 1;

    const orbits = computeOrbits(labels, adjacency);

    for (const node of nodes) {
        node.state = "unvisited";
    }
    const totals = { triangles: 0, wedgeCenters: 0, wedgeEnds: 0 };
    for (const [label, vector] of orbits) {
        const node = byId.get(`node-${label}`);
        if (node) node.state = "comparing";
        totals.triangles += vector[0];
        totals.wedgeCenters += vector[1];
        totals.wedgeEnds += vector[2];
        yield frame(
            step,
            `${label} participates in ${vector[0]} triangle(s), ${vector[1]} wedge center(s), and ${vector[2]} wedge end(s).`,
            2,
            { vertex: label, triangles: vector[0], wedgeCenters: vector[1], wedgeEnds: vector[2] },
        );
        step += 1;
        if (node) node.state = "unvisited";
    }

    for (const node of nodes) {
        const vector = orbits.get(String(node.label)) ?? [0, 0, 0];
        node.state = palette[Math.min(vector[0], palette.length - 1)] as EntityState;
    }
    const gdv: Record<string, MetaValue> = {};
    for (const [label, vector] of orbits) {
        gdv[label] = [...vector];
    }
    yield frame(
        step,
        `Done: ${totals.triangles} triangle participation(s), ${totals.wedgeCenters} wedge center(s), ${totals.wedgeEnds} wedge end(s).`,
        5,
        { gdv, triangles: totals.triangles, wedgeCenters: totals.wedgeCenters, wedgeEnds: totals.wedgeEnds },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two vertices can look similar if they sit in similar small neighborhoods. A graphlet degree vector records, for one vertex, how many times it appears in each role of every small connected induced subgraph. For three-node graphlets the roles are triangle member, wedge center, and wedge end, giving a compact local fingerprint.",
        invariants: [
            "Only connected induced subgraphs on exactly three distinct vertices are counted.",
            "A triangle contributes one count to each of its three vertices in the triangle orbit.",
            "An open wedge contributes one center count and two end counts, and the role assignment is unique.",
        ],
        correctness:
            "Every unordered triple of vertices induces either zero, one, two, or three edges among its members. Three edges form a triangle and all three vertices share the single triangle orbit. Exactly two edges form a path whose unique degree-two vertex is the wedge center and whose two degree-one vertices are the wedge ends. Classifying all triples therefore counts each orbit participation exactly once.",
        complexityRationale:
            "There are choose(V,3) triples and each classification inspects three adjacency-set lookups, giving O(V^3) time. Adjacency sets and the result table use O(V + E) space.",
        uses: [
            "Comparing local network structure in bioinformatics and social networks",
            "Graph-kernel features for machine learning on graphs",
            "Detecting structurally equivalent vertices in a large network",
        ],
        references: [
            "Przulj, Biological Network Comparison Using Graphlet Degree Distribution, 2007",
            "Milenkovic and Przulj, Uncovering Biological Network Function via Graphlet Degree Signatures, 2008",
        ],
        workedExample:
            "Take a path A-B-C plus a triangle A-B-D. The triple A,B,C induces two edges with B as center, so B gains one wedge center and A,C one wedge end. The triple A,B,D induces three edges, so A,B,D each gain one triangle. The final vectors are A = [1,0,1], B = [1,1,0], C = [0,0,1], D = [1,0,0].",
    },
    id: "graphlet-degree-vector",
    name: "Graphlet Degree Vector (3-node Orbits)",
    category: "graph",
    complexity: { time: "O(V^3)", space: "O(V + E)" },
    defaultInput: {
        nodes: ["A", "B", "C", "D"],
        edges: [
            ["A", "B"],
            ["B", "C"],
            ["A", "D"],
            ["B", "D"],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build an undirected adjacency set for every vertex",
        "initialize each vertex vector to zero triangle, center, and end counts",
        "for every unordered triple of distinct vertices",
        "count the edges induced among the three vertices",
        "if all three edges exist, add one triangle to each vertex",
        "if exactly two edges exist, add one center and two end counts by role",
        "emit the vector for each vertex as it is finalized",
        "done: report the graphlet degree vector of every vertex",
    ],
};

export default module;
