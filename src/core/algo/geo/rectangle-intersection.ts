/**
 * rectangle-intersection.ts - Axis-Aligned Rectangle Intersection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two axis-aligned rectangles overlap exactly when their x intervals and
 * their y intervals both overlap. Taking the maximum of the lower bounds and
 * the minimum of the upper bounds yields the intersection rectangle directly,
 * and its width and height determine whether the overlap has positive area.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rectangle A corners are GREEN; rectangle B corners are ACTIVE.
 *   - The overlap rectangle, when present, is drawn with SORTED corners.
 *   - A disjoint pair leaves the overlap frame empty.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Rect = [number, number, number, number];

/** Build corner nodes for a rectangle with a given prefix and state. */
function corners(rect: Rect, prefix: string, state: VisualEntity["state"]): VisualEntity[] {
    const [x1, y1, x2, y2] = rect;
    const points: Array<[number, number]> = [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
    ];
    return points.map(([x, y], index) => ({
        id: `${prefix}-${index}`,
        type: "node" as const,
        label: `${prefix}${index}`,
        value: [x, y],
        state,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { rect: prefix, index },
    }));
}

/** Build the four outline edges of a rectangle. */
function outline(prefix: string, state: VisualEdge["state"]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < 4; i += 1) {
        edges.push({
            id: `edge-${prefix}-${i}`,
            sourceId: `${prefix}-${i}`,
            targetId: `${prefix}-${(i + 1) % 4}`,
            label: "",
            state,
            directed: false,
        });
    }
    return edges;
}

/** The rectangle intersection generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rectA?: Rect; rectB?: Rect } | null) ?? {};
    const rectA: Rect = task.rectA ?? [0, 0, 4, 3];
    const rectB: Rect = task.rectB ?? [3, 1, 6, 5];
    let step = 0;

    yield {
        stepNumber: step,
        entities: [...corners(rectA, "a", "sorted"), ...corners(rectB, "b", "active")],
        edges: [...outline("a", "path"), ...outline("b", "active")],
        description: `Test whether rectangles [${rectA}] and [${rectB}] overlap.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { intersect: false, area: 0 },
    };
    step += 1;

    const ix1 = Math.max(rectA[0] as number, rectB[0] as number);
    const iy1 = Math.max(rectA[1] as number, rectB[1] as number);
    const ix2 = Math.min(rectA[2] as number, rectB[2] as number);
    const iy2 = Math.min(rectA[3] as number, rectB[3] as number);
    const width = (ix2 as number) - (ix1 as number);
    const height = (iy2 as number) - (iy1 as number);
    const intersect = width > 0 && height > 0;
    const area = intersect ? width * height : 0;

    yield {
        stepNumber: step,
        entities: [...corners(rectA, "a", "sorted"), ...corners(rectB, "b", "active")],
        edges: [...outline("a", "path"), ...outline("b", "active")],
        description:
            `x overlap [${ix1}, ${ix2}] width ${width}, y overlap [${iy1}, ${iy2}] height ${height}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { intersect, area, ix1, iy1, ix2, iy2, width, height },
    };
    step += 1;

    const overlap: Rect = [ix1 as number, iy1 as number, ix2 as number, iy2 as number];
    yield {
        stepNumber: step,
        entities: intersect
            ? [...corners(rectA, "a", "unvisited"), ...corners(rectB, "b", "unvisited"), ...corners(overlap, "i", "sorted")]
            : [...corners(rectA, "a", "sorted"), ...corners(rectB, "b", "active")],
        edges: intersect
            ? [...outline("a", "idle"), ...outline("b", "idle"), ...outline("i", "sorted")]
            : [...outline("a", "path"), ...outline("b", "active")],
        description: intersect
            ? `Overlap rectangle [${overlap}] with area ${area}.`
            : `The intervals do not overlap in at least one axis, so the rectangles are disjoint.`,
        codeLineNumber: intersect ? 4 : 5,
        layout: "point",
        meta: { intersect, area, overlap: intersect ? [...overlap] : [] },
    };
}

/** The rectangle intersection module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An axis-aligned rectangle is just a product of an x interval and a y interval. Two such rectangles overlap precisely when both pairs of intervals overlap. The intersection rectangle is found by taking the larger lower bound and smaller upper bound on each axis, and a positive width and height confirm real overlap.",
        invariants: [
            "The x overlap interval is the intersection of the two x intervals.",
            "The y overlap interval is the intersection of the two y intervals.",
            "The rectangles have positive-area overlap if and only if both intervals have positive length.",
        ],
        correctness:
            "A point belongs to a rectangle when its x and y coordinates lie in the respective intervals. A point belongs to both rectangles when its coordinates lie in both interval intersections, which form the overlap rectangle. This set is nonempty with positive area exactly when both overlap lengths are positive, so the computed test is correct.",
        complexityRationale:
            "Only a constant number of min and max operations and comparisons are performed, giving O(1) time and O(1) space.",
        uses: [
            "Collision detection for axis-aligned bounding boxes",
            "Computing clipping regions in windowing systems",
            "Overlap tests in geographic information systems",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2",
            "Ericson, Real-Time Collision Detection, Chapter 3",
        ],
        workedExample:
            "Rectangle A = [0, 0, 4, 3] and rectangle B = [3, 1, 6, 5]. The x intervals overlap on [3, 4] with width 1 and the y intervals overlap on [1, 3] with height 2, so the intersection is [3, 1, 4, 3] with area 2. Moving B to [5, 1, 6, 5] makes the x overlap empty and the rectangles disjoint.",
    },
    id: "rectangle-intersection",
    name: "Rectangle Intersection",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        rectA: [0, 0, 4, 3],
        rectB: [3, 1, 6, 5],
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the two rectangles as x and y intervals",
        "set ix1 to the larger of the lower x bounds",
        "set ix2 to the smaller of the upper x bounds",
        "repeat for the y bounds to get iy1 and iy2",
        "if ix2 > ix1 and iy2 > iy1 the rectangles overlap",
        "report the overlap rectangle and its area",
    ],
};

export default module;
