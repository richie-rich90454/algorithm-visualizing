/**
 * shamos-hoey.ts - Shamos-Hoey Segment Intersection Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Decides whether any two segments in a set intersect, in O(n log n) time. A
 * vertical sweep line visits every segment endpoint from left to right. The
 * segments crossing the sweep line are kept ordered by height; when a segment
 * is inserted only its immediate neighbors can newly cross it, and when a
 * segment is deleted its predecessor and successor can newly cross each other.
 * Checking just those neighbor pairs at each event is the Shamos-Hoey trick.
 * It is distinct from Bentley-Ottmann, which reports every intersection rather
 * than answering the yes/no existence question.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) with a balanced active structure (sorted list here)
 *   Space: O(n) for the active set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Segment endpoints are POINT nodes; segments are edges between them.
 *   - Segments currently crossing the sweep line are ACTIVE.
 *   - The pair responsible for the first detected crossing is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Seg = [Pt, Pt];

function orient(a: Pt, b: Pt, c: Pt): number {
    const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
}

function onSeg(a: Pt, b: Pt, p: Pt): boolean {
    return (
        orient(a, b, p) === 0 &&
        p[0] >= Math.min(a[0], b[0]) - 1e-9 &&
        p[0] <= Math.max(a[0], b[0]) + 1e-9 &&
        p[1] >= Math.min(a[1], b[1]) - 1e-9 &&
        p[1] <= Math.max(a[1], b[1]) + 1e-9
    );
}

/** True when closed segments ab and cd share any point. */
function intersects(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);
    if (o1 * o2 < 0 && o3 * o4 < 0) {
        return true;
    }
    return (
        (o1 === 0 && onSeg(a, b, c)) ||
        (o2 === 0 && onSeg(a, b, d)) ||
        (o3 === 0 && onSeg(c, d, a)) ||
        (o4 === 0 && onSeg(c, d, b))
    );
}

/** Height of a segment at sweep position x; vertical segments use mid-height. */
function yAt(seg: Seg, x: number): number {
    const [a, b] = seg;
    if (Math.abs(a[0] - b[0]) < 1e-12) {
        return (a[1] + b[1]) / 2;
    }
    return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
}

function makeEntities(segs: Seg[], active: Set<number>, current: number, pair: [number, number] | null): VisualEntity[] {
    const out: VisualEntity[] = [];
    segs.forEach((seg, i) => {
        seg.forEach((p, k) => {
            const state: EntityState =
                pair && (pair[0] === i || pair[1] === i)
                    ? "error"
                    : i === current
                      ? "comparing"
                      : active.has(i)
                        ? "active"
                        : "unvisited";
            out.push({
                id: `p-${i}-${k}`,
                type: "node" as const,
                label: `${i}.${k}`,
                value: p,
                state,
                x: p[0],
                y: p[1],
                width: 0,
                height: 0,
                metadata: { segment: i, endpoint: k },
            });
        });
    });
    return out;
}

function makeEdges(segs: Seg[], active: Set<number>, current: number, pair: [number, number] | null): VisualEdge[] {
    return segs.map((_seg, i) => ({
        id: `seg-${i}`,
        sourceId: `p-${i}-0`,
        targetId: `p-${i}-1`,
        label: `s${i}`,
        state: (pair && (pair[0] === i || pair[1] === i)
            ? "error"
            : i === current
              ? "comparing"
              : active.has(i)
                ? "active"
                : "idle") as EntityState,
        directed: false,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { segments?: Seg[] } | null) ?? {};
    const segs: Seg[] = (task.segments ?? [
        [[0, 0], [4, 4]],
        [[0, 4], [4, 0]],
        [[0, 1], [4, 1]],
        [[5, 0], [5, 4]],
    ]).map((s) => [[s[0][0], s[0][1]], [s[1][0], s[1][1]]] as Seg);

    type Event = { x: number; kind: "insert" | "delete"; seg: number };
    const events: Event[] = [];
    segs.forEach((seg, i) => {
        const left = seg[0][0] <= seg[1][0] ? seg[0] : seg[1];
        const right = seg[0][0] <= seg[1][0] ? seg[1] : seg[0];
        events.push({ x: left[0], kind: "insert", seg: i });
        events.push({ x: right[0], kind: "delete", seg: i });
    });
    events.sort((a, b) => a.x - b.x || (a.kind === b.kind ? a.seg - b.seg : a.kind === "insert" ? -1 : 1));

    let step = 0;
    const active = new Set<number>();
    let pair: [number, number] | null = null;
    let processed = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(segs, active, -1, null),
        edges: makeEdges(segs, active, -1, null),
        description: `Sweep ${segs.length} segment(s) from left to right, checking only neighboring segments at each endpoint.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { hasIntersection: false, segmentCount: segs.length, eventsProcessed: 0, activeCount: 0, pair: -1 },
    };
    step += 1;

    for (const event of events) {
        const current = event.seg;
        if (event.kind === "insert") {
            active.add(current);
        }
        const ordered = [...active].sort((i, j) => yAt(segs[i] as Seg, event.x) - yAt(segs[j] as Seg, event.x));
        const pos = ordered.indexOf(current);

        const check = (i: number, j: number): boolean => {
            if (i < 0 || j < 0 || i >= ordered.length || j >= ordered.length) {
                return false;
            }
            const si = ordered[i] as number;
            const sj = ordered[j] as number;
            const a = segs[si] as Seg;
            const b = segs[sj] as Seg;
            if (intersects(a[0], a[1], b[0], b[1])) {
                pair = [si, sj];
                return true;
            }
            return false;
        };

        if (event.kind === "insert") {
            check(pos - 1, pos);
            if (!pair) {
                check(pos, pos + 1);
            }
        } else {
            check(pos - 1, pos + 1);
        }

        if (event.kind === "delete") {
            active.delete(current);
        }
        processed += 1;
        yield {
            stepNumber: step,
            entities: makeEntities(segs, active, current, pair),
            edges: makeEdges(segs, active, current, pair),
            description: pair
                ? `Event ${processed}: segments ${pair[0]} and ${pair[1]} cross; a crossing exists.`
                : `Event ${processed}: ${event.kind} segment ${current}; ${active.size} active, only vertical neighbors checked.`,
            codeLineNumber: event.kind === "insert" ? 2 : 4,
            layout: "point",
            meta: {
                hasIntersection: pair !== null,
                segmentCount: segs.length,
                eventsProcessed: processed,
                activeCount: active.size,
                pair: pair ? pair[0] * segs.length + pair[1] : -1,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(segs, active, -1, pair),
        edges: makeEdges(segs, active, -1, pair),
        description: pair
            ? `Done: segments ${pair[0]} and ${pair[1]} intersect, detected after ${processed} sweep event(s).`
            : `Done: no two of the ${segs.length} segments intersect.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            hasIntersection: pair !== null,
            segmentCount: segs.length,
            eventsProcessed: processed,
            activeCount: active.size,
            pair: pair ? pair[0] * segs.length + pair[1] : -1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a vertical line sliding across the drawing. Only segments the line currently touches can meet a newly arriving segment, and among those only the ones directly above and below it can be the first to cross. By checking just those two vertical neighbors at every endpoint event, the sweep decides the whole question without comparing every pair of segments.",
        invariants: [
            "Between consecutive events, the vertical order of active segments never changes unless two of them intersect.",
            "A new intersection can only involve the segment being inserted or deleted and its immediate neighbors in the active order.",
            "Once a crossing pair is found, the answer stays true for the rest of the sweep.",
        ],
        correctness:
            "If two segments intersect, consider the leftmost intersection point. Just before that x coordinate, the two segments are adjacent in the vertical order, because any segment between them at the crossing x would also have to pass through one of them, contradicting the choice of the first crossing. At the endpoint event that makes them adjacent, the neighbor check tests exactly this pair and reports it. Conversely, every reported pair is tested with the orientation predicate, so no false positive occurs.",
        complexityRationale:
            "There are two endpoint events per segment, so O(n) events. Each event sorts the active set and does a constant number of intersection tests; with a balanced tree this is O(log n) per event, giving O(n log n) time. The active set and event list hold O(n) items.",
        uses: [
            "Collision detection in computer graphics and geographic information systems",
            "Validating that roads or circuit traces do not cross unexpectedly",
            "A first-phase filter before Bentley-Ottmann reports all crossings",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2",
            "Shamos and Hoey, Geometric Intersection Problems, 1976",
        ],
        workedExample:
            "With diagonals (0,0)-(4,4) and (0,4)-(4,0), the sweep inserts both at x = 0, making them neighbors in the active order. They intersect at (2,2), so the neighbor check reports a crossing without ever comparing the separate vertical segment at x = 5.",
    },
    id: "shamos-hoey",
    name: "Shamos-Hoey Intersection Detection",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        segments: [
            [[0, 0], [4, 4]],
            [[0, 4], [4, 0]],
            [[0, 1], [4, 1]],
            [[5, 0], [5, 4]],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "create an insert and a delete event for every segment endpoint",
        "sort all events by increasing x coordinate",
        "on an insert, add the segment to the active order and check its two vertical neighbors",
        "on a delete, check the predecessor and successor before removing the segment",
        "test each checked neighbor pair with the orientation predicate",
        "if any tested pair intersects, report a crossing and stop",
        "done: report whether any two segments intersect",
    ],
};

export default module;
