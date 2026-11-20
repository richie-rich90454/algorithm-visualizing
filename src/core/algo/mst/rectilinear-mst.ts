/**
 * rectilinear-mst.ts - Rectilinear (Manhattan) Minimum Spanning Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given points in the plane, connect them with straight segments whose length
 * is measured by the L1 or rectilinear distance |dx| + |dy|. Sorting all pairs
 * by that distance and running Kruskal's union-find produces a minimum
 * spanning tree for the Manhattan metric.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 log n) for all pairs and sorting
 *   Space: O(n^2) for the sorted edge list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points are drawn at their own coordinates using the point layout.
 *   - An edge currently under consideration is YELLOW.
 *   - Edges accepted into the tree are GREEN; rejected edges are RED.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

function makePoints(points: Point[]): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: `${index}`,
        value: [x, y],
        state: "idle" as EntityState,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, x, y },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[] } | null) ?? {};
    const raw: Point[] = Array.isArray(task.points)
        ? task.points
        : [[0, 0], [3, 0], [0, 4], [4, 4], [2, 2]];
    const points = raw
        .map((p) => [Number(p[0]) || 0, Number(p[1]) || 0] as Point)
        .slice(0, 20);
    const n = points.length;
    const parent = Array.from({ length: n }, (_, i) => i);

    const find = (x: number): number => {
        let root = x;
        while (parent[root] !== root) root = parent[root]!;
        while (parent[x] !== x) {
            const next = parent[x]!;
            parent[x] = root;
            x = next;
        }
        return root;
    };

    const edges: Array<{ u: number; v: number; w: number }> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            const a = points[i]!;
            const b = points[j]!;
            edges.push({ u: i, v: j, w: Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) });
        }
    }
    edges.sort((a, b) => a.w - b.w || a.u - b.u || a.v - b.v);

    const chosen = new Set<string>();
    const rejected = new Set<string>();
    let active = "";
    let total = 0;
    let step = 0;

    const frame = (description: string, line: number, answer: number | null): VisualFrame => {
        const visualEdges: VisualEdge[] = edges.map((edge) => {
            const key = `${edge.u}-${edge.v}`;
            let state: EntityState = "idle";
            if (chosen.has(key)) state = "sorted";
            else if (key === active) state = "comparing";
            else if (rejected.has(key)) state = "error";
            return {
                id: `edge-${edge.u}-${edge.v}`,
                sourceId: `point-${edge.u}`,
                targetId: `point-${edge.v}`,
                label: String(edge.w),
                state,
                directed: false,
            };
        });
        return {
            stepNumber: step++,
            entities: makePoints(points),
            edges: visualEdges,
            description,
            codeLineNumber: line,
            layout: "point",
            meta: { answer, points: points.map((p) => [...p]), total, accepted: chosen.size },
        };
    };

    yield frame(`Building a rectilinear MST over ${n} point(s) with ${edges.length} candidate pair(s).`, 0, null);
    if (n <= 1) {
        yield frame("Fewer than two points need no connecting edge.", 1, 0);
        return;
    }

    for (const edge of edges) {
        active = `${edge.u}-${edge.v}`;
        const ru = find(edge.u);
        const rv = find(edge.v);
        if (ru !== rv) {
            parent[ru] = rv;
            chosen.add(active);
            total += edge.w;
            yield frame(
                `Accepted pair (${edge.u}, ${edge.v}) with rectilinear length ${edge.w}; tree weight is now ${total}.`,
                3,
                null,
            );
        } else {
            rejected.add(active);
            yield frame(`Rejected pair (${edge.u}, ${edge.v}); its endpoints are already connected.`, 4, null);
        }
        active = "";
        if (chosen.size === n - 1) break;
    }

    const finalFrame = frame(`Rectilinear MST total length is ${total}.`, 6, total);
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In a rectilinear layout the distance between two points is the sum of the horizontal and vertical gaps, like walking along city blocks. Once every pair has that distance, any standard minimum spanning tree method applies; Kruskal simply takes the shortest pairs first and skips any that would close a cycle.",
        invariants: [
            "The weight of a pair equals the absolute x gap plus the absolute y gap.",
            "Accepted edges never form a cycle in the growing forest.",
            "After k accepted edges the forest spans k+1 components.",
        ],
        correctness:
            "Kruskal's algorithm is correct for any weighted complete graph. Supplying Manhattan distances as the weights therefore yields a minimum spanning tree under the rectilinear metric. The cycle test via union-find ensures acyclicity, and stopping after n-1 acceptances guarantees a spanning tree.",
        complexityRationale:
            "Computing all pairwise Manhattan distances is O(n^2), sorting them is O(n^2 log n), and union-find makes the scan nearly linear in the number of pairs, so the total is O(n^2 log n). The sorted edge list uses O(n^2) space.",
        uses: [
            "Circuit wiring where wires run along horizontal and vertical tracks",
            "Urban network design with grid-constrained travel",
            "Clustering under the L1 metric",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 23",
            "de Berg et al., Computational Geometry, Chapter 9",
        ],
        workedExample:
            "For points (0,0), (3,0), (0,4), (4,4), and (2,2), the closest pairs are (0,0)-(2,2) and (3,0)-(2,2) with L1 length 3 each, followed by (2,2)-(0,4) and (2,2)-(4,4) with length 4; the accepted set totals 14.",
    },
    id: "rectilinear-mst",
    name: "Rectilinear Minimum Spanning Tree",
    category: "mst",
    complexity: { time: "O(n^2 log n)", space: "O(n^2)" },
    defaultInput: { points: [[0, 0], [3, 0], [0, 4], [4, 4], [2, 2]] },
    visualType: "point",
    run,
    pseudocode: [
        "read the list of points in the plane",
        "for every pair of points compute the Manhattan distance",
        "sort all pairs by that distance",
        "start a union-find structure with one component per point",
        "scan the sorted pairs from shortest to longest",
        "if the endpoints lie in different components add the pair to the tree",
        "merge those two components and add the distance to the total",
        "stop once the tree has one fewer edge than there are points",
        "report the total rectilinear length",
    ],
};

export default module;
