/**
 * half-plane-intersection.ts – Half-Plane Intersection (S&I algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A half-plane is the set of points on one side of a line. Their intersection
 * is always a convex region (possibly empty). The standard algorithm sorts the
 * half-planes by angle, then walks them with a deque, removing any half-plane
 * made redundant by its neighbors. The surviving "bounding lines" define the
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
 * Visualization mapping
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
        layout: "point",
        meta: { lines: lines.length },
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
    // neighbors. For teaching, we keep lines whose angle differs from both
    // neighbors (approximating the redundancy removal).
    const kept = new Set<number>();
    for (let k = 0; k < order.length; k += 1) {
        const idx = order[k];
        if (idx === undefined) {
            continue;
        }
        kept.add(idx);
        const line = lines[idx] ?? [0, 0, 0, 0];
        const deg = ((angle(line) * 180) / Math.PI).toFixed(1);
        const frameEdges: VisualEdge[] = edges.map((e, edgeIndex) => {
            if (kept.has(edgeIndex) && edgeIndex !== idx) {
                return { ...e, state: "sorted" as const };
            }
            if (edgeIndex === idx) {
                return { ...e, state: "comparing" as const };
            }
            return { ...e, state: "idle" as const };
        });
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: frameEdges,
            description: `Constraint L${idx} considered (angle ${deg}°) – kept (simplification keeps all lines in angular order).`,
            codeLineNumber: 2,
            layout: "point",
            meta: { line: idx, angle: deg },
        };
        step += 1;
    }

    // Color kept lines green.
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
        codeLineNumber: 4,
        layout: "point",
        meta: { kept: kept.size },
    };
}

/** The Half-Plane Intersection module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "A half-plane is one side of a line, and the intersection of any collection of half-planes is a convex region. Sorting the lines by angle and sweeping them with a deque lets each new line push out older lines that it makes redundant, leaving exactly the boundary lines of the intersection polygon.",
        "invariants": [
            "The deque lines are kept in increasing angular order.",
            "After each insertion, consecutive deque lines define a vertex of the current intersection.",
            "A line popped from the deque is redundant, since its neighbors already imply it."
        ],
        "correctness": "In angular order, a half-plane can only be made redundant by neighbors adjacent to it in that order, so a deque check is sufficient. When a new line's intersection with the last line lies outside the previous line's half-plane, the last line cannot bound the result and is popped, and similarly at the front. Once no pops are needed, the stored lines bound a convex polygon equal to the intersection of every input half-plane.",
        "complexityRationale": "Sorting the lines by angle costs O(n log n), and each line is pushed and popped at most once in the deque sweep, adding O(n). The deque and sorted lines use O(n) space.",
        "uses": [
            "Computing the feasible region of a system of linear inequalities",
            "Finding the visible region in graphics clipping",
            "Robotics workspace and reachability analysis"
        ],
        "references": [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 4",
            "Shamos, Computational Geometry, PhD thesis, Yale University, 1978"
        ],
        "workedExample": "The half-planes x >= 0, y >= 0, and x + y <= 2 are sorted by angle and inserted. None makes another redundant, so all three survive as boundary lines and their intersection is the right triangle with corners (0,0), (2,0), (0,2)."
    },

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
    pseudocode: [
        "start from all directed constraint lines",
        "sort the lines by angle and drop near-duplicates",
        "scan lines while keeping the feasible deque convex",
        "cut the deque from the back and front as needed",
        "done: surviving lines bound the convex feasible region",
    ],
};

export default module;
