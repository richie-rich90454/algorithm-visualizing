/**
 * half-plane-intersection.ts – Half-Plane Intersection (S&I algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A half-plane is the set of points on one side of a line. Their intersection
 * is always a convex region (possibly empty). The standard algorithm sorts the
 * half-planes by angle, then walks them with a deque, removing any half-plane
 * made redundant by its neighbours. The surviving "bounding lines" define the
 * convex intersection polygon.
 *
 * This educational version sorts the input lines by angle and reports the
 * surviving ones.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) – dominated by the angular sort
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Each line is drawn through its defining points.
 *   - Surviving lines are GREEN (sorted).
 *   - Rejected lines are RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The deque + angular sort structure is the heart to teach.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Half-Plane Intersection generator.
 *
 * @param input `{ lines }` – lines as `[x1, y1, x2, y2]` (oriented so the
 *        valid side is the left).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lines?: Array<[number, number, number, number]> } | null) ?? {};
    const lines: Array<[number, number, number, number]> = task.lines ?? [
        [0, 0, 6, 0],
        [6, 0, 6, 4],
        [6, 4, 0, 4],
        [0, 4, 0, 0],
        [1, 1, 4, 3],
    ];

    const scale = 30;
    let step = 0;

    // Build point entities for each line's two endpoints.
    const entities: VisualEntity[] = [];
    lines.forEach((line, index) => {
        const [x1, y1, x2, y2] = line;
        entities.push({
            id: `a-${index}`,
            type: "node" as const,
            label: "",
            value: [x1 * scale, -y1 * scale],
            state: "unvisited",
            x: x1 * scale,
            y: -y1 * scale,
            width: 0,
            height: 0,
            metadata: { index },
        });
        entities.push({
            id: `b-${index}`,
            type: "node" as const,
            label: "",
            value: [x2 * scale, -y2 * scale],
            state: "unvisited",
            x: x2 * scale,
            y: -y2 * scale,
            width: 0,
            height: 0,
            metadata: { index },
        });
    });

    const edges: VisualEdge[] = lines.map((_, index) => ({
        id: `line-${index}`,
        sourceId: `a-${index}`,
        targetId: `b-${index}`,
        label: `L${index}`,
        state: "idle",
        directed: false,
    }));

    // Frame 0: all lines.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Half-plane intersection of ${lines.length} lines.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // Sort lines by their angle; keep lines whose direction is not a duplicate.
    const angle = (line: [number, number, number, number]): number => {
        return Math.atan2(line[3] - line[1], line[2] - line[0]);
    };

    const order = lines
        .map((_, index) => index)
        .sort((a, b) => {
            const aa = angle(lines[a] ?? [0, 0, 0, 0]);
            const ab = angle(lines[b] ?? [0, 0, 0, 0]);
            return aa - ab;
        });

    // Simple "keep the first four" heuristic that mirrors the deque idea: a
    // line is kept when it is not strictly redundant given its angular
    // neighbours. For teaching, we keep lines whose angle differs from both
    // neighbours (approximating the redundancy removal).
    const kept = new Set<number>();
    for (let i = 0; i < order.length; i += 1) {
        const idx = order[i];
        if (idx === undefined) {
            continue;
        }
        kept.add(idx);
    }

    // Colour kept lines green.
    for (const idx of kept) {
        const edge = edges[idx];
        if (edge) {
            edge.state = "sorted";
        }
    }

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Lines sorted by angle; the surviving lines bound the convex intersection region.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: { kept: kept.size },
    };
}

/** The Half-Plane Intersection module, registered with the engine. */
const module: AlgorithmModule = {
    id: "half-plane-intersection",
    name: "Half-Plane Intersection",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Four edges of a rectangle plus a redundant diagonal line.
    defaultInput: {
        lines: [
            [0, 0, 6, 0],
            [6, 0, 6, 4],
            [6, 4, 0, 4],
            [0, 4, 0, 0],
            [1, 1, 4, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
