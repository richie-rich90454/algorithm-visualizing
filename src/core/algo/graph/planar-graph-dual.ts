/**
 * planar-graph-dual.ts - Planar Graph Dual by Face Tracing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a plane embedding specified by the cyclic neighbor order at each
 * vertex, this algorithm walks around directed edges to discover every face.
 * Each undirected edge touches two face walks, so placing one dual vertex in
 * each face and joining dual vertices across each primal edge builds the
 * geometric dual. A bridge appears as a loop in the dual.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) because every directed edge is visited exactly once
 *   Space: O(V + E) for the rotation system, face labels, and dual edges
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Primal vertices stay visible while faces are traced.
 *   - Darts on the current face flash YELLOW; discovered face nodes are CYAN.
 *   - The final frame shows only the dual multigraph and reports Euler's count.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Rotation = Record<string, string[]>;

interface Dart {
    from: string;
    to: string;
    id: string;
}

function buildDarts(rotation: Rotation, labels: string[]): Dart[] {
    const darts: Dart[] = [];
    for (const from of labels) {
        for (const to of rotation[from] ?? []) {
            if (!labels.includes(to)) continue;
            darts.push({ from, to, id: `edge-${from}-${to}` });
        }
    }
    return darts;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rotation?: Rotation } | null) ?? {};
    const rotation: Rotation = task.rotation ?? {
        A: ["B", "C", "D"],
        B: ["C", "A"],
        C: ["D", "A", "B"],
        D: ["C", "A"],
    };
    const labels = Object.keys(rotation).sort();
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty embedding - there is no dual to build.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { faces: 0, dualEdges: 0, faceSizes: [] },
        };
        return;
    }
    const darts = buildDarts(rotation, labels);
    const byKey = new Map(darts.map((d) => [`${d.from}|${d.to}`, d]));
    const nextDart = (from: string, to: string): string | null => {
        const ring = rotation[to] ?? [];
        const index = ring.indexOf(from);
        if (index < 0 || ring.length === 0) return null;
        const predecessor = ring[(index - 1 + ring.length) % ring.length] as string;
        return `${to}|${predecessor}`;
    };

    const primalNodes: VisualEntity[] = makeGraphNodes(labels);
    const primalEdges: VisualEdge[] = darts.map((d) => ({
        id: d.id,
        sourceId: `node-${d.from}`,
        targetId: `node-${d.to}`,
        label: "",
        state: "idle",
        directed: true,
    }));
    const faceOf = new Map<string, number>();
    const faces: Dart[][] = [];
    let step = 0;

    const primalSnap = (description: string, line: number, activeFace: Dart[], faceCount: number): VisualFrame => {
        const activeKeys = new Set(activeFace.map((d) => `${d.from}|${d.to}`));
        for (const node of primalNodes) node.state = faceCount > 0 ? "sorted" : "unvisited";
        return {
            stepNumber: step,
            entities: [
                ...primalNodes.map((n) => ({ ...n })),
                ...Array.from({ length: faceCount }, (_, i) => ({
                    id: `face-${i}`,
                    type: "node" as const,
                    label: `f${i}`,
                    value: i,
                    state: "path" as const,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { face: i },
                })),
            ],
            edges: primalEdges.map((e) => ({
                ...e,
                state: activeKeys.has(`${(e.sourceId ?? "").replace("node-", "")}|${(e.targetId ?? "").replace("node-", "")}`)
                    ? "comparing"
                    : "idle",
            })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                faces: faceCount,
                faceSizes: faces.map((f) => f.length),
                dualEdges: 0,
                dartCount: darts.length,
            },
        };
    };

    yield primalSnap(`Loaded a plane embedding with ${labels.length} vertices and ${darts.length} darts.`, 0, [], 0);
    step += 1;

    for (const start of darts) {
        const startKey = `${start.from}|${start.to}`;
        if (faceOf.has(startKey)) continue;
        const faceId = faces.length;
        const face: Dart[] = [];
        let key: string | null = startKey;
        let guard = 0;
        while (key !== null && !faceOf.has(key) && guard <= darts.length + 1) {
            const dart = byKey.get(key);
            if (!dart) break;
            face.push(dart);
            faceOf.set(key, faceId);
            key = nextDart(dart.from, dart.to);
            guard += 1;
        }
        faces.push(face);
        yield primalSnap(
            `Traced face f${faceId} with ${face.length} directed edge${face.length === 1 ? "" : "s"}.`,
            3,
            face,
            faces.length,
        );
        step += 1;
    }

    const primalEdgeCount = darts.length / 2;
    const dualEdges: VisualEdge[] = [];
    const seenPrimal = new Set<string>();
    for (const dart of darts) {
        const undirected = [dart.from, dart.to].sort().join("|");
        if (seenPrimal.has(undirected)) continue;
        seenPrimal.add(undirected);
        const reverse = byKey.get(`${dart.to}|${dart.from}`);
        const f1 = faceOf.get(`${dart.from}|${dart.to}`);
        const f2 = reverse ? faceOf.get(`${reverse.from}|${reverse.to}`) : undefined;
        if (f1 === undefined || f2 === undefined) continue;
        dualEdges.push({
            id: `dual-${undirected}`,
            sourceId: `face-${f1}`,
            targetId: `face-${f2}`,
            label: undirected.replace("|", "-"),
            state: f1 === f2 ? "error" : "sorted",
            directed: false,
        });
    }

    const dualNodes: VisualEntity[] = faces.map((_, i) => ({
        id: `face-${i}`,
        type: "node" as const,
        label: `f${i}`,
        value: i,
        state: "path" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { face: i, size: faces[i]?.length ?? 0 },
    }));
    const loops = dualEdges.filter((e) => e.sourceId === e.targetId).length;
    yield {
        stepNumber: step,
        entities: dualNodes,
        edges: dualEdges,
        description: `Dual has ${faces.length} face-vertices and ${dualEdges.length} edges (${loops} bridge loop${loops === 1 ? "" : "s"}); Euler checks F = E - V + 2.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            faces: faces.length,
            dualEdges: dualEdges.length,
            primalEdges: primalEdgeCount,
            faceSizes: faces.map((f) => f.length),
            loops,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plane graph splits the surface into regions. If you walk along the left-hand side of each directed edge, following the same turn rule at every corner, you will trace out one complete region and return to where you started. Put a point inside each region and connect points whenever a wall separates them: that is the dual.",
        invariants: [
            "Every directed edge belongs to exactly one traced face.",
            "The two directions of an undirected edge border the two sides of that edge.",
            "A face walk terminates because each directed edge is used at most once.",
        ],
        correctness:
            "The next-dart rule picks the predecessor of the incoming edge in the cyclic order at a vertex, which is exactly the next boundary edge when keeping a face on the left. Iterating this permutation decomposes all directed edges into disjoint cycles, one per face, so no face is missed and none is counted twice. Each primal edge has two sides and therefore contributes one dual edge, possibly a loop when both sides bound the same face; Euler's formula F = E - V + 2 verifies the count for connected embeddings.",
        complexityRationale:
            "Face tracing visits each of the 2E directed darts once and each lookup in a rotation is constant time after the index map is built, giving O(V + E) time. Storing the rotation, the face assignment of each dart, and the dual edge list uses O(V + E) space.",
        uses: [
            "Converting road networks into face adjacency for route planning",
            "Computing the dual of a floor plan for graph-based spatial analysis",
            "Turning a planar circuit layout into its region adjacency graph",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, chapter on planar subdivisions",
            "West, Introduction to Graph Theory, section on planar duals",
        ],
        workedExample:
            "A square A-B-C-D with diagonal A-C has five edges and four vertices. Face tracing finds triangles A-B-C and A-C-D plus the outer face A-D-C-B, so F = 3 = 5 - 4 + 2. The dual has three vertices and five edges, with the pair A-B and B-C forming parallel dual edges between the inner triangle and the outer face.",
    },
    id: "planar-graph-dual",
    name: "Planar Graph Dual",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        rotation: {
            A: ["B", "C", "D"],
            B: ["C", "A"],
            C: ["D", "A", "B"],
            D: ["C", "A"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build one directed edge for each entry in the rotation system",
        "for every unvisited directed edge start a new face",
        "follow the predecessor turn rule until the face closes",
        "label every directed edge on the walk with the face number",
        "for each undirected edge connect the faces on its two sides",
        "use a self-loop when both sides bound the same face",
        "verify Euler's formula for a connected embedding",
        "report the dual vertices, edges, and face sizes",
    ],
};

export default module;
