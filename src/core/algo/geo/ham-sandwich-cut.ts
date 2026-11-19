/**
 * ham-sandwich-cut.ts - Ham Sandwich Cut (Bisecting Line)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The planar ham-sandwich theorem says two finite point sets can be split by
 * one line so that each open half-plane holds at most half of each set. This
 * module searches the finite family of critical directions, perpendicular to
 * pairs of input points, where the ordering of the projections can change.
 * For each direction it places the unique median line that bisects the first
 * set, then checks the second set. A bisecting direction always exists, so the
 * sweep is finite and exact. This is distinct from ordinary polygon bisection
 * and from single-set median lines.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^3 log N) for N total points (finite critical-angle sweep)
 *   Space: O(N)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points of set A and set B are nodes with different states.
 *   - The candidate bisecting line is drawn as a path-colored edge between two
 *     helper endpoint nodes; the final frame shows the accepted cut.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Projection of a point onto the normal (cos a, sin a). */
function project(p: Point, angle: number): number {
    return p[0] * Math.cos(angle) + p[1] * Math.sin(angle);
}

/** Count points strictly on each side of the line n dot x = offset. */
function sides(points: Point[], angle: number, offset: number): [number, number] {
    let below = 0;
    let above = 0;
    const eps = 1e-9;
    for (const p of points) {
        const value = project(p, angle) - offset;
        if (value > eps) {
            above += 1;
        } else if (value < -eps) {
            below += 1;
        }
    }
    return [below, above];
}

/** The median offset that leaves at most floor(n/2) points on each side. */
function medianOffset(points: Point[], angle: number): number {
    const values = points.map((p) => project(p, angle)).sort((a, b) => a - b);
    const n = values.length;
    if (n % 2 === 0) {
        return ((values[n / 2 - 1] as number) + (values[n / 2] as number)) / 2;
    }
    return values[Math.floor(n / 2)] as number;
}

/** Whether both sides hold at most half of the points. */
function bisects(points: Point[], angle: number, offset: number): boolean {
    const half = Math.floor(points.length / 2);
    const [below, above] = sides(points, angle, offset);
    return below <= half && above <= half;
}

/** Build point nodes plus the two helper endpoints of the drawn cut line. */
function makeEntities(a: Point[], b: Point[], cut: [Point, Point] | null): VisualEntity[] {
    const nodes: VisualEntity[] = [];
    a.forEach((p, i) => nodes.push({
        id: `a-${i}`,
        type: "node",
        label: `A${i}`,
        value: p,
        state: "active",
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { set: "a", index: i },
    }));
    b.forEach((p, i) => nodes.push({
        id: `b-${i}`,
        type: "node",
        label: `B${i}`,
        value: p,
        state: "sorted",
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { set: "b", index: i },
    }));
    if (cut) {
        nodes.push({
            id: "cut-start",
            type: "node",
            label: "",
            value: cut[0],
            state: "path",
            x: cut[0][0],
            y: cut[0][1],
            width: 0,
            height: 0,
            metadata: { role: "line" },
        });
        nodes.push({
            id: "cut-end",
            type: "node",
            label: "",
            value: cut[1],
            state: "path",
            x: cut[1][0],
            y: cut[1][1],
            width: 0,
            height: 0,
            metadata: { role: "line" },
        });
    }
    return nodes;
}

/** The cut line edge, when a cut has been chosen. */
function cutEdge(cut: [Point, Point] | null): VisualEdge[] {
    if (!cut) {
        return [];
    }
    return [{
        id: "cut-line",
        sourceId: "cut-start",
        targetId: "cut-end",
        label: "bisecting line",
        state: "path",
        directed: false,
    }];
}

/** Endpoints of the cut segment clipped to the point cloud's bounding box. */
function lineSegment(points: Point[], angle: number, offset: number): [Point, Point] {
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const dir: Point = [-ny, nx];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
    }
    const span = Math.max(maxX - minX, maxY - minY, 1) * 1.4;
    const cx = nx * offset;
    const cy = ny * offset;
    return [
        [cx - dir[0] * span / 2, cy - dir[1] * span / 2],
        [cx + dir[0] * span / 2, cy + dir[1] * span / 2],
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { setA?: Point[]; setB?: Point[] } | null) ?? {};
    const a: Point[] = (task.setA ?? [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1]]).map((p) => [p[0], p[1]] as Point);
    const b: Point[] = (task.setB ?? [[0, 3], [1, 2], [2, 4], [3, 2], [4, 4], [5, 3]]).map((p) => [p[0], p[1]] as Point);
    if (a.length === 0 || b.length === 0) {
        yield {
            stepNumber: 0,
            entities: makeEntities(a, b, null),
            edges: [],
            description: "Both point sets must be nonempty to define a ham-sandwich cut.",
            codeLineNumber: 0,
            layout: "point",
            meta: { found: false, degenerate: true },
        };
        return;
    }

    const all = a.concat(b);
    const angles = new Set<number>([0]);
    for (let i = 0; i < all.length; i += 1) {
        for (let j = i + 1; j < all.length; j += 1) {
            const pi = all[i] as Point;
            const pj = all[j] as Point;
            const dx = pj[0] - pi[0];
            const dy = pj[1] - pi[1];
            if (dx === 0 && dy === 0) {
                continue;
            }
            // Normal perpendicular to the segment joining the two points.
            let angle = Math.atan2(dx, -dy);
            if (angle < 0) {
                angle += Math.PI;
            }
            angles.add(angle);
            angles.add(angle + 1e-6);
        }
    }
    const candidates = [...angles].filter((angle) => angle < Math.PI + 1e-5).sort((x, y) => x - y);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(a, b, null),
        edges: [],
        description: `Searching ${candidates.length} critical directions for a line that bisects both sets.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { found: false, candidates: candidates.length, tested: 0 },
    };
    step += 1;

    let found: { angle: number; offset: number } | null = null;
    let tested = 0;
    for (const angle of candidates) {
        const offset = medianOffset(a, angle);
        tested += 1;
        const ok = bisects(b, angle, offset);
        if (tested % 6 === 0 || ok) {
            const cut = lineSegment(all, angle, offset);
            yield {
                stepNumber: step,
                entities: makeEntities(a, b, cut),
                edges: cutEdge(cut),
                description: ok
                    ? `Direction ${angle.toFixed(3)} bisects both sets; the cut is accepted.`
                    : `Direction ${angle.toFixed(3)} bisects set A but not set B; keep rotating.`,
                codeLineNumber: ok ? 4 : 3,
                layout: "point",
                meta: { found: ok, angle, offset, tested, candidates: candidates.length },
            };
            step += 1;
        }
        if (ok) {
            found = { angle, offset };
            break;
        }
    }

    const chosen = found ?? { angle: 0, offset: medianOffset(a, 0) };
    const cut = lineSegment(all, chosen.angle, chosen.offset);
    const [belowA, aboveA] = sides(a, chosen.angle, chosen.offset);
    const [belowB, aboveB] = sides(b, chosen.angle, chosen.offset);
    yield {
        stepNumber: step,
        entities: makeEntities(a, b, cut),
        edges: cutEdge(cut),
        description: found
            ? `Ham sandwich cut found: set A split ${belowA}/${aboveA}, set B split ${belowB}/${aboveB}.`
            : "No exact cut was found among the sampled directions.",
        codeLineNumber: 5,
        layout: "point",
        meta: {
            found: found !== null,
            angle: chosen.angle,
            offset: chosen.offset,
            splitA: [belowA, aboveA],
            splitB: [belowB, aboveB],
            tested,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine sliding a knife across a sandwich of two disjoint piles of points. For any fixed blade direction there is a position that cuts the first pile in half. Rotating the blade moves that balanced cut continuously, and after a half turn the two half-planes swap. The count for the second pile therefore changes from above half to below half, so at some direction it must also be balanced. Enumerating the finitely many directions where the ordering changes finds that moment exactly.",
        invariants: [
            "For every tested direction the chosen line leaves at most half of set A on each open side.",
            "The count of set B points on one side changes only when the blade direction crosses a critical angle.",
            "A direction and its opposite describe the same geometric line with the half-planes exchanged.",
        ],
        correctness:
            "The median offset always bisects set A because it lies between the two middle projections, or on the single middle point. Critical directions are exactly those perpendicular to a segment joining two input points, so between consecutive candidates no projection order and no side assignment changes. Rotating by pi exchanges the sides, so the set B count goes from c to |B| minus c; as it changes by at most one at each critical direction, it must equal a balanced count somewhere. Enumerating all candidates therefore finds a cut that bisects both sets.",
        complexityRationale:
            "There are O(N^2) critical directions for N total points. For each direction the projections are sorted in O(N log N), giving O(N^3 log N) total time. Only the point arrays and the candidate list are stored, so space is O(N^2) in the strict enumeration and O(N) beyond the candidate set.",
        uses: [
            "Fair division and cake-cutting constructions in computational social choice",
            "Constructing balanced spatial partitions for parallel load distribution",
            "A building block for k-sets, centerpoints, and geometric discrepancy algorithms",
        ],
        references: [
            "Matousek, Lectures on Discrete Geometry, Chapter 3",
            "Edelsbrunner and Waupotitsch, An O(n log n) Algorithm for the Ham-Sandwich Cut, 1986",
        ],
        workedExample:
            "With set A at x = 0 through 5 at alternating heights and set B stacked above them, the vertical median line at x = 2.5 already leaves three A points on each side. Rotating slightly adjusts the B split until it is three and three as well, giving a single line that bisects both piles.",
    },
    id: "ham-sandwich-cut",
    name: "Ham Sandwich Cut",
    category: "geometry",
    complexity: { time: "O(N^3 log N)", space: "O(N^2)" },
    defaultInput: {
        setA: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1]],
        setB: [[0, 3], [1, 2], [2, 4], [3, 2], [4, 4], [5, 3]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "collect the directions perpendicular to every pair of input points",
        "for each critical direction",
        "project the first set onto the normal and place its median line",
        "count how many second-set points fall on each open side",
        "if neither side holds more than half, accept this line",
        "otherwise rotate to the next critical direction",
        "done: report the bisecting line and both side counts",
    ],
};

export default module;
