/**
 * visvalingam-whyatt-simplification.ts - Area-based polyline simplification.
 *
 * Each interior vertex is assigned the area of the triangle formed with its
 * current neighbors. The vertex with the smallest effective area below the
 * tolerance is removed, and the areas of its two neighbors are recomputed.
 * Repeating this keeps the visually important corners and drops shallow ones.
 *
 *   Time:  O(n^2) in this straightforward priority-rescan form
 *   Space: O(n)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function nodes(pts: Pt[], kept: Set<number> = new Set(), focus = -1): VisualEntity[] {
    return pts.map((p, i) =>
        node(`p-${i}`, p, i === focus ? "comparing" : kept.has(i) ? "sorted" : "unvisited", String(i)),
    );
}

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: p,
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}

function edgesFor(order: number[]): VisualFrame["edges"] {
    return order.slice(0, -1).map((v, i) => ({
        id: `e-${i}`,
        sourceId: `p-${v}`,
        targetId: `p-${order[i + 1]}`,
        label: "",
        state: "sorted" as EntityState,
        directed: false,
    }));
}

function triangleArea(a: Pt, b: Pt, c: Pt): number {
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polyline?: Pt[]; tolerance?: number } | null) ?? {};
    const line: Pt[] = task.polyline ?? [
        [0, 0], [1, 0.1], [2, 0], [3, 0.1], [4, 6], [5, 0.1], [6, 0], [7, 0],
    ];
    const tolerance = task.tolerance ?? 0.5;
    let step = 0;
    const frame = (
        entities: VisualEntity[],
        edges: VisualFrame["edges"],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta: { tolerance, original: line.length, ...meta },
    });

    if (line.length < 3) {
        yield frame(
            nodes(line, new Set(line.map((_, i) => i))),
            edgesFor(line.map((_, i) => i)),
            "Fewer than three vertices, so nothing can be removed.",
            0,
            { kept: line.map((_, i) => i) },
        );
        return;
    }
    yield frame(
        nodes(line, new Set(line.map((_, i) => i))),
        edgesFor(line.map((_, i) => i)),
        `Simplifying ${line.length} vertices with tolerance ${tolerance}.`,
        0,
        { kept: line.map((_, i) => i) },
    );
    step += 1;

    const alive = new Set<number>(line.map((_, i) => i));
    const order = (): number[] => [...alive].sort((a, b) => a - b);
    const area = (idx: number): number => {
        const seq = order();
        const pos = seq.indexOf(idx);
        if (pos <= 0 || pos >= seq.length - 1) return Infinity;
        return triangleArea(line[seq[pos - 1]!]!, line[idx]!, line[seq[pos + 1]!]!);
    };
    let guard = 0;
    while (guard++ < 10000) {
        const seq = order();
        let victim = -1;
        let smallest = Infinity;
        for (let k = 1; k < seq.length - 1; k += 1) {
            const a = area(seq[k]!);
            if (a < smallest) {
                smallest = a;
                victim = seq[k]!;
            }
        }
        if (victim < 0 || smallest >= tolerance) break;
        alive.delete(victim);
        yield frame(
            nodes(line, alive, victim),
            edgesFor(order()),
            `Removed vertex ${victim} with effective area ${smallest.toFixed(3)}.`,
            2,
            { removed: victim, area: smallest, kept: order() },
        );
        step += 1;
    }
    const kept = order();
    yield frame(
        nodes(line, new Set(kept)),
        edgesFor(kept),
        `Kept ${kept.length} of ${line.length} vertices: [${kept.join(", ")}].`,
        4,
        { kept, removedCount: line.length - kept.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Visvalingam-Whyatt judges a vertex by the area of the triangle it forms with its two current neighbors. A vertex that barely bends the line has a tiny triangle and can be dropped with little visual error. After each removal the neighbors become adjacent and their triangle areas are recomputed, so the importance of a vertex reflects the shape that actually remains.",
        invariants: [
            "The first and last vertices of the polyline are never removed.",
            "The kept vertices always appear in their original relative order.",
            "Only a vertex whose current effective area is below the tolerance is removed.",
        ],
        correctness:
            "Removing a vertex replaces two segments by the chord across it, and the triangle area measures the largest deviation introduced by that replacement. Always removing the smallest such area minimizes the local error at each step, and recomputing neighbors keeps those measurements accurate for the current polyline. Stopping when every remaining area meets the tolerance therefore leaves a simplified curve whose every dropped point contributed less than the allowed error.",
        complexityRationale:
            "Each round scans the remaining vertices and recomputes triangle areas, costing linear time, and up to n vertices can be removed. The simple rescanning implementation is O(n^2) time and uses O(n) space for the vertex set and order.",
        uses: [
            "Simplifying map coastlines and road geometries",
            "Reducing detail in chart and time-series rendering",
            "Preparing lighter meshes for mobile graphics",
        ],
        references: [
            "Visvalingam and Whyatt, Line Generalisation by Repeated Elimination of Points, Cartographic Journal 30 (1993)",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2",
        ],
        workedExample:
            'Given the points (0,0), (1,0.1), (2,0), (3,0.1), (4,6), (5,0.1), (6,0), (7,0) with tolerance 0.5, the small bend at (1,0.1) has a tiny triangle area and is removed early, while the sharp peak at (4,6) has a large area and is kept.',
    },
    id: "visvalingam-whyatt-simplification",
    name: "Visvalingam-Whyatt Simplification",
    category: "geometry",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        polyline: [
            [0, 0], [1, 0.1], [2, 0], [3, 0.1], [4, 6], [5, 0.1], [6, 0], [7, 0],
        ],
        tolerance: 0.5,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "keep the first and last vertices of the polyline",
        "for each interior vertex compute its effective triangle area",
        "find the vertex with the smallest area below the tolerance",
        "remove it and join its two neighbors",
        "recompute the areas of the affected neighbors",
        "repeat until no remaining vertex is below the tolerance",
        "report the kept vertices in their original order",
    ],
};

export default module;
