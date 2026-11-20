/**
 * bentley-saxe.ts - Bentley-Saxe Rectangle Intersection Report
 *
 * Rectangles are swept by their left and right x coordinates. A rectangle
 * joins the active set at its left edge and leaves at its right edge. While
 * active it is tested against the active rectangles whose y interval overlaps
 * its own, so each intersecting pair is reported exactly once.
 *
 * Limit: the active y-interval search is a linear scan rather than the
 * dynamic interval tree of the full Bentley-Saxe structure. The reported
 * pairs are identical; only the asymptotic active-set query is simplified.
 *
 * Time:  O(n log n + k + active scans) for k reported intersections
 * Space: O(n + k)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Rect = [number, number, number, number];

interface Event {
    x: number;
    type: "enter" | "exit";
    id: number;
}

function overlaps(a: [number, number], b: [number, number]): boolean {
    return a[0] <= b[1] && b[0] <= a[1];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rectangles?: Rect[] } | null) ?? {};
    const rectangles: Rect[] = task.rectangles ?? [
        [0, 0, 4, 3],
        [2, 1, 6, 4],
        [5, 5, 8, 7],
        [1, 4, 3, 6],
        [7, 2, 9, 5],
    ];

    const events: Event[] = [];
    rectangles.forEach((rect, id) => {
        const [x1, , x2] = rect;
        events.push({ x: x1 ?? 0, type: "enter", id });
        events.push({ x: x2 ?? 0, type: "exit", id });
    });
    events.sort((a, b) => a.x - b.x || (a.type === "enter" ? -1 : 1));

    const active = new Set<number>();
    const pairs: Array<[number, number]> = [];
    const steps: Array<{ event: Event; active: number[]; found: Array<[number, number]> }> = [];

    for (const event of events) {
        const found: Array<[number, number]> = [];
        if (event.type === "enter") {
            const rect = rectangles[event.id]!;
            const yA: [number, number] = [rect[1] ?? 0, rect[3] ?? 0];
            for (const otherId of active) {
                const other = rectangles[otherId]!;
                const yB: [number, number] = [other[1] ?? 0, other[3] ?? 0];
                if (overlaps(yA, yB)) found.push([Math.min(event.id, otherId), Math.max(event.id, otherId)]);
            }
            for (const pair of found) pairs.push(pair);
            active.add(event.id);
        } else {
            active.delete(event.id);
        }
        steps.push({ event, active: [...active].sort((a, b) => a - b), found });
    }

    const entityFor = (focus: number[], found: Array<[number, number]>): VisualEntity[] => {
        const highlighted = new Set<number>(focus);
        for (const [a, b] of found) {
            highlighted.add(a);
            highlighted.add(b);
        }
        return rectangles.map((rect, i) => ({
            id: `rect-${i}`,
            type: "cell" as const,
            label: `R${i} [${rect.join(",")}]`,
            value: rect,
            state: highlighted.has(i) ? ("active" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i, id: i },
        }));
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: entityFor([], []),
        edges: [],
        description: `Sweeping ${rectangles.length} axis-aligned rectangles by x to report all intersecting pairs.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: rectangles.length, rectangles: rectangles.length, pairs: 0 },
    };
    step += 1;

    for (let i = 0; i < steps.length; i += 1) {
        const s = steps[i]!;
        yield {
            stepNumber: step,
            entities: entityFor([s.event.id], s.found),
            edges: [],
            description: `Sweep x=${s.event.x}: rectangle R${s.event.id} ${s.event.type}s; ${s.found.length} new intersection(s), ${s.active.length} active rectangle(s).`,
            codeLineNumber: s.event.type === "enter" ? 4 : 6,
            layout: "grid",
            meta: {
                rows: 1,
                cols: rectangles.length,
                event: i + 1,
                x: s.event.x,
                type: s.event.type,
                id: s.event.id,
                active: s.active,
                found: s.found,
                pairs: pairs.length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: entityFor([], pairs),
        edges: [],
        description: `Sweep complete: ${pairs.length} intersecting rectangle pair(s) reported.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: 1, cols: rectangles.length, pairs: pairs.length, allPairs: pairs },
    };
}

const module: AlgorithmModule = {
    id: "bentley-saxe",
    name: "Bentley-Saxe Rectangle Intersection Report",
    category: "geometry",
    complexity: { time: "O(n log n + k + active scans)", space: "O(n + k)" },
    defaultInput: {
        rectangles: [
            [0, 0, 4, 3],
            [2, 1, 6, 4],
            [5, 5, 8, 7],
            [1, 4, 3, 6],
            [7, 2, 9, 5],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "create enter and exit events for every rectangle at its x bounds",
        "sort events by x, processing enters before exits at the same x",
        "for each entering rectangle scan the active set",
        "report the pair when the active y interval overlaps the entering one",
        "insert the entering rectangle into the active set",
        "for each exiting rectangle remove it from the active set",
        "continue until all events have been processed",
        "done: report the complete list of intersecting pairs",
    ],
    education: {
        intuition:
            "Two axis-aligned rectangles can only intersect if their x ranges overlap, so a vertical sweep only needs to compare a new rectangle with those currently spanning the sweep line. Among those, only y ranges that overlap matter. The active set keeps the comparison local instead of checking every pair of rectangles.",
        invariants: [
            "A rectangle is active exactly between its left and right x events.",
            "Each intersecting pair is reported once, at the enter event of the rectangle with the larger left edge.",
            "Processing enters before exits at equal x preserves intersections that touch only at a boundary.",
        ],
        correctness:
            "If two rectangles intersect, their x intervals overlap, so when the one with the larger left edge enters, the other is still active (or enters at the same x and is already active). Their y intervals also overlap, so the scan reports the pair. Conversely, a reported pair has overlapping x ranges by active-set membership and overlapping y ranges by the test, which is exactly rectangle intersection. The ordering of events prevents misses at shared boundaries.",
        complexityRationale:
            "Sorting the 2n events costs O(n log n). Each of the k reported pairs is emitted once, and each enter event scans the active set, which is linear in the active size for this teaching version. Memory holds 2n events and k pairs.",
        uses: [
            "Detecting overlaps in VLSI layout and geographic information systems",
            "Collision filtering in 2D game engines",
            "Preprocessing steps for map overlay and spatial joins",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, chapter 2",
            "Bentley and Saxe, Discrete Reporting Problems, 1980",
        ],
        workedExample:
            "Rectangles [0,0,4,3] and [2,1,6,4] overlap. At x=2 the second rectangle enters while the first is still active; their y intervals [0,3] and [1,4] overlap, so the pair (0,1) is reported. Rectangle [5,5,8,7] has no y overlap with either and is never paired.",
    },
};

export default module;
