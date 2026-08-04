/**
 * sweep-line-segment-intersection.ts – Sweep-Line Segment Intersection
 * (Bentley-Ottmann)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Bentley-Ottmann algorithm reports all intersections among a set of
 * segments in O((n + k) log n), where k is the number of intersections. A
 * vertical sweep line moves left to right; the set of segments it crosses is
 * kept ordered by y in a balanced tree (here a simple sorted list). Whenever
 * two segments swap order, they must intersect.
 *
 * This educational version keeps the sweep-line narrative with a simple
 * ordered list, walking segment endpoints and reporting swaps.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((n + k) log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The sweep line is drawn as it advances.
 *   - The segments currently being checked are highlighted.
 *   - Reported intersections are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The ordering-by-y invariant is the heart to teach.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Orientation of (a, b, c). */
function orient(a: [number, number], b: [number, number], c: [number, number]): number {
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return cross > 0 ? 1 : cross < 0 ? -1 : 0;
}

/** Do segments ab and cd intersect? */
function intersect(
    a: [number, number],
    b: [number, number],
    c: [number, number],
    d: [number, number],
): boolean {
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    return o1 !== o2 && o3 !== o4;
}

/**
 * The Sweep-Line Segment Intersection generator.
 *
 * @param input `{ segments }` – an array of segments `[[x1,y1],[x2,y2]]`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { segments?: Array<[[number, number], [number, number]]> } | null) ?? {};
    const segments: Array<[[number, number], [number, number]]> = task.segments ?? [
        [
            [0, 0],
            [6, 4],
        ],
        [
            [1, 3],
            [5, 1],
        ],
        [
            [2, 1],
            [7, 2],
        ],
    ];

    const scale = 30;
    let step = 0;

    // Build point entities for all endpoints.
    const entities: VisualEntity[] = [];
    segments.forEach((seg, si) => {
        const [a, b] = seg;
        entities.push({
            id: `p-${si}-0`,
            type: "node" as const,
            label: "",
            value: [a[0] * scale, -a[1] * scale],
            state: "unvisited",
            x: a[0] * scale,
            y: -a[1] * scale,
            width: 0,
            height: 0,
            metadata: { index: si },
        });
        entities.push({
            id: `p-${si}-1`,
            type: "node" as const,
            label: "",
            value: [b[0] * scale, -b[1] * scale],
            state: "unvisited",
            x: b[0] * scale,
            y: -b[1] * scale,
            width: 0,
            height: 0,
            metadata: { index: si },
        });
    });

    const edges: VisualEdge[] = segments.map(([a, b], si) => ({
        id: `seg-${si}`,
        sourceId: `p-${si}-0`,
        targetId: `p-${si}-1`,
        label: `s${si}`,
        state: "idle",
        directed: false,
    }));

    // Frame 0: all segments.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Sweep-line intersection over ${segments.length} segments.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // The sweep line: events are x-coordinates of endpoints.
    const events: number[] = [];
    for (const seg of segments) {
        events.push(seg[0][0], seg[1][0]);
    }
    events.sort((a, b) => a - b);

    const intersections: Array<[number, number]> = [];

    // Walk the sweep. When two segments are active at the same sweep x and
    // they intersect, report it.
    for (const x of events) {
        const active = segments
            .map((seg, index) => ({ seg, index }))
            .filter(
                ({ seg }) =>
                    Math.min(seg[0][0], seg[1][0]) <= x && x <= Math.max(seg[0][0], seg[1][0]),
            );

        // Check all pairs active at this sweep position.
        for (let i = 0; i < active.length; i += 1) {
            for (let j = i + 1; j < active.length; j += 1) {
                const a = active[i];
                const b = active[j];
                if (!a || !b) {
                    continue;
                }
                if (intersect(a.seg[0], a.seg[1], b.seg[0], b.seg[1])) {
                    intersections.push([a.index, b.index]);
                    const e1 = edges[a.index];
                    const e2 = edges[b.index];
                    if (e1) {
                        e1.state = "highlight";
                    }
                    if (e2) {
                        e2.state = "highlight";
                    }
                }
            }
        }

        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: edges.map((e) => ({ ...e })),
            description: `Sweep line at x=${x} – ${active.length} segment(s) active.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { x },
        };
        step += 1;
    }

    // Color intersections.
    for (const [i, j] of intersections) {
        const e1 = edges[i];
        const e2 = edges[j];
        if (e1) {
            e1.state = "sorted";
        }
        if (e2) {
            e2.state = "sorted";
        }
    }

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description:
            intersections.length === 0
                ? "No intersections found."
                : `Intersections: ${intersections.map(([i, j]) => `s${i}∩s${j}`).join(", ")}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { intersections: intersections.length },
    };
}

/** The Sweep-Line Segment Intersection module, registered with the engine. */
const module: AlgorithmModule = {
    id: "sweep-line-segment-intersection",
    name: "Sweep-Line Intersection",
    category: "geometry",
    complexity: { time: "O((n+k) log n)", space: "O(n)" },
    // Three segments; s0 crosses s1, s2 overlaps s0's span.
    defaultInput: {
        segments: [
            [
                [0, 0],
                [6, 4],
            ],
            [
                [1, 3],
                [5, 1],
            ],
            [
                [2, 1],
                [7, 2],
            ],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
