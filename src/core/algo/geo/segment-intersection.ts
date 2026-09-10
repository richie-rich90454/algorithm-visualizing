/**
 * segment-intersection.ts – Segment Intersection Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two segments intersect iff the endpoints of each segment lie on opposite
 * sides of the other segment's line (proper intersection), or one segment's
 * endpoint lies on the other (touching). The orientation test from the cross
 * product decides "which side":
 *
 *   orient(a, b, c) = sign of (b−a)×(c−a).
 *
 * Segments ab and cd intersect iff orient(a,b,c)·orient(a,b,d) ≤ 0 and
 * orient(c,d,a)·orient(c,d,b) ≤ 0.
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
 *   - Segment 1 is BLUE (active).
 *   - Segment 2 is PINK (highlight).
 *   - The intersection point (if any) is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The orientation test is the building block of all geometry.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Orientation of (a, b, c): -1, 0, or 1. */
function orient(a: [number, number], b: [number, number], c: [number, number]): number {
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross > 0) {
        return 1;
    }
    if (cross < 0) {
        return -1;
    }
    return 0;
}

/** Does c lie on segment ab? (assumes collinear). */
function onSegment(a: [number, number], b: [number, number], c: [number, number]): boolean {
    return (
        c[0] <= Math.max(a[0], b[0]) &&
        c[0] >= Math.min(a[0], b[0]) &&
        c[1] <= Math.max(a[1], b[1]) &&
        c[1] >= Math.min(a[1], b[1])
    );
}

/**
 * The Segment Intersection generator.
 *
 * @param input `{ a, b, c, d }` – the two segments' endpoints.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            a?: [number, number];
            b?: [number, number];
            c?: [number, number];
            d?: [number, number];
        } | null) ?? {};
    const a = task.a ?? [0, 0];
    const b = task.b ?? [6, 4];
    const c = task.c ?? [1, 3];
    const d = task.d ?? [5, 1];

    const scale = 30;

    const entities: VisualEntity[] = [
        { id: "a", label: "a", pos: [a[0] * scale, -a[1] * scale] },
        { id: "b", label: "b", pos: [b[0] * scale, -b[1] * scale] },
        { id: "c", label: "c", pos: [c[0] * scale, -c[1] * scale] },
        { id: "d", label: "d", pos: [d[0] * scale, -d[1] * scale] },
    ].map((p, index) => ({
        id: p.id,
        type: "node" as const,
        label: p.label,
        value: p.pos,
        state: "unvisited",
        x: p.pos[0],
        y: p.pos[1],
        width: 0,
        height: 0,
        metadata: { index },
    }));

    const edges: VisualEdge[] = [
        { id: "seg1", sourceId: "a", targetId: "b", label: "", state: "active", directed: false },
        {
            id: "seg2",
            sourceId: "c",
            targetId: "d",
            label: "",
            state: "highlight",
            directed: false,
        },
    ];

    let step = 0;

    // Frame 0: the two segments.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Segments ab and cd.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // The intersection test.
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);

    const snapshot = (highlightIds: string[]): VisualEntity[] =>
        entities.map((e) => ({
            ...e,
            state: highlightIds.includes(e.id) ? ("comparing" as const) : ("unvisited" as const),
        }));

    const orientationFrames: Array<{ value: number; ids: string[]; label: string }> = [
        { value: o1, ids: ["a", "b", "c"], label: "o1 = orient(a, b, c)" },
        { value: o2, ids: ["a", "b", "d"], label: "o2 = orient(a, b, d)" },
        { value: o3, ids: ["c", "d", "a"], label: "o3 = orient(c, d, a)" },
        { value: o4, ids: ["c", "d", "b"], label: "o4 = orient(c, d, b)" },
    ];
    for (const frame of orientationFrames) {
        yield {
            stepNumber: step,
            entities: snapshot(frame.ids),
            edges: edges.map((e) => ({ ...e })),
            description: `${frame.label} = ${frame.value}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }

    let intersects = false;
    if (o1 !== o2 && o3 !== o4) {
        intersects = true;
    } else {
        if (o1 === 0 && onSegment(a, b, c)) {
            intersects = true;
        }
        if (o2 === 0 && onSegment(a, b, d)) {
            intersects = true;
        }
        if (o3 === 0 && onSegment(c, d, a)) {
            intersects = true;
        }
        if (o4 === 0 && onSegment(c, d, b)) {
            intersects = true;
        }
    }

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Orientations: (${o1}, ${o2}, ${o3}, ${o4}) → ${intersects ? "SEGMENTS INTERSECT" : "no intersection"}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { intersects },
    };
}

/** The Segment Intersection module, registered with the engine. */
const module: AlgorithmModule = {
    id: "segment-intersection",
    name: "Segment Intersection",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    // These two segments cross near the middle.
    defaultInput: { a: [0, 0], b: [6, 4], c: [1, 3], d: [5, 1] },
    visualType: "graph",
    run,
};

export default module;
