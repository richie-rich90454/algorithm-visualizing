/**
 * liang-barsky-line-clipping.ts - Parametric clipping of a segment to a rectangle.
 *
 * The segment is written as p0 + t * d with t in [0, 1]. Four inequalities keep
 * it inside the window; each one tightens the visible interval to a half-open
 * range of t values. Unlike region-code methods this needs only a few divisions
 * and rejects a segment as soon as the interval becomes empty.
 *
 * Time: O(1). Space: O(1) per frame.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
interface Rect {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
}

interface ClipStep {
    t0: number;
    t1: number;
    accept: boolean;
}

/** Liang-Barsky clipping with the four p/q tests recorded for playback. */
function clip(p0: Pt, p1: Pt, rect: Rect): { accept: boolean; t0: number; t1: number; steps: ClipStep[]; p: number[]; q: number[] } {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const p = [-dx, dx, -dy, dy];
    const q = [p0[0] - rect.xmin, rect.xmax - p0[0], p0[1] - rect.ymin, rect.ymax - p0[1]];
    let t0 = 0;
    let t1 = 1;
    let accept = true;
    const steps: ClipStep[] = [];
    for (let k = 0; k < 4; k += 1) {
        const pk = p[k]!;
        const qk = q[k]!;
        if (pk === 0) {
            if (qk < 0) accept = false;
        } else {
            const r = qk / pk;
            if (pk < 0) {
                if (r > t0) t0 = r;
            } else if (r < t1) {
                t1 = r;
            }
            if (t0 > t1) accept = false;
        }
        steps.push({ t0, t1, accept });
    }
    return { accept, t0, t1, steps, p, q };
}

function along(p0: Pt, p1: Pt, t: number): Pt {
    return [p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])];
}

function rectCorners(rect: Rect): Pt[] {
    return [
        [rect.xmin, rect.ymin],
        [rect.xmax, rect.ymin],
        [rect.xmax, rect.ymax],
        [rect.xmin, rect.ymax],
    ];
}

/** The Liang-Barsky generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p0?: Pt; p1?: Pt; rect?: Partial<Rect> } | null) ?? {};
    const p0: Pt = task.p0 ?? [-2, -1];
    const p1: Pt = task.p1 ?? [3, 2];
    const r = task.rect ?? {};
    const rect: Rect = {
        xmin: r.xmin ?? 0,
        xmax: r.xmax ?? 2,
        ymin: r.ymin ?? 0,
        ymax: r.ymax ?? 2,
    };
    const result = clip(p0, p1, rect);
    const corners = rectCorners(rect);
    let step = 0;

    const emit = (
        shownSteps: number,
        description: string,
        codeLineNumber: number,
        final: boolean,
        activeTest: number,
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        corners.forEach((c, i) => {
            entities.push({
                id: `rc-${i}`,
                type: "node",
                label: `(${c[0]},${c[1]})`,
                value: c,
                state: "unvisited",
                x: c[0],
                y: -c[1],
                width: 0,
                height: 0,
                metadata: { corner: i },
            });
        });
        ([p0, p1] as Pt[]).forEach((p, i) => {
            entities.push({
                id: `s${i}`,
                type: "node",
                label: i === 0 ? "p0" : "p1",
                value: p,
                state: "pivot",
                x: p[0],
                y: -p[1],
                width: 0,
                height: 0,
                metadata: { endpoint: i },
            });
        });
        const edges: VisualEdge[] = [];
        for (let i = 0; i < 4; i += 1) {
            edges.push({
                id: `rect-${i}`,
                sourceId: `rc-${i}`,
                targetId: `rc-${(i + 1) % 4}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
        edges.push({ id: "original", sourceId: "s0", targetId: "s1", label: "", state: "idle", directed: false });

        const visible = shownSteps >= 4 ? result.accept : (result.steps[shownSteps - 1]?.accept ?? true);
        if (shownSteps > 0 && visible) {
            const state: EntityState = final ? "sorted" : "active";
            const t0 = shownSteps >= 4 ? result.t0 : (result.steps[shownSteps - 1]?.t0 ?? 0);
            const t1 = shownSteps >= 4 ? result.t1 : (result.steps[shownSteps - 1]?.t1 ?? 1);
            const a = along(p0, p1, t0);
            const b = along(p0, p1, t1);
            entities.push(
                { id: "c0", type: "node", label: `t=${t0.toFixed(2)}`, value: a, state, x: a[0], y: -a[1], width: 0, height: 0, metadata: { t: t0 } },
                { id: "c1", type: "node", label: `t=${t1.toFixed(2)}`, value: b, state, x: b[0], y: -b[1], width: 0, height: 0, metadata: { t: t1 } },
            );
            edges.push({ id: "clipped", sourceId: "c0", targetId: "c1", label: "", state: final ? "path" : "comparing", directed: false });
        }

        const clipped: number[] = [];
        if (result.accept) {
            const a = along(p0, p1, result.t0);
            const b = along(p0, p1, result.t1);
            clipped.push(a[0], a[1], b[0], b[1]);
        }
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "point",
            meta: {
                accept: result.accept,
                t0: result.t0,
                t1: result.t1,
                clipped,
                p: result.p,
                q: result.q,
                activeTest,
            },
        };
    };

    yield emit(0, `Liang-Barsky: clip segment p0-p1 to the window [${rect.xmin},${rect.xmax}] x [${rect.ymin},${rect.ymax}].`, 0, false, -1);
    const names = ["left", "right", "bottom", "top"];
    for (let k = 0; k < 4; k += 1) {
        const snap = result.steps[k]!;
        yield emit(
            k + 1,
            `Liang-Barsky: ${names[k]} test ${snap.accept ? "keeps" : "rejects"} the interval t in [${snap.t0.toFixed(2)}, ${snap.t1.toFixed(2)}].`,
            2,
            false,
            k,
        );
    }
    yield emit(
        4,
        result.accept
            ? `Liang-Barsky: visible subsegment runs from t=${result.t0.toFixed(3)} to t=${result.t1.toFixed(3)}.`
            : "Liang-Barsky: the empty parameter interval means the segment is fully clipped away.",
        4,
        true,
        -1,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Liang-Barsky views a line segment as a point moving linearly from p0 to p1 as t goes from zero to one. Each side of the clipping rectangle is an inequality that permits only part of that time interval. Intersecting the four permitted intervals gives the exact portion of the segment that lies inside the window.",
        invariants: [
            "The visible interval always starts at or after t = 0 and ends at or before t = 1.",
            "A test either tightens the interval or rejects the segment outright.",
            "If the interval survives all four tests, its endpoints lie on the rectangle boundary or inside it.",
        ],
        correctness:
            "A point p0 + t d is inside the rectangle exactly when all four inequalities p_k t <= q_k hold. For p_k < 0 the inequality is t >= q_k/p_k and tightens the lower bound; for p_k > 0 it is t <= q_k/p_k and tightens the upper bound; p_k = 0 is a parallel case decided by the sign of q_k. The surviving interval is therefore precisely the set of parameters inside the window, and mapping its ends back through p0 + t d gives the clipped segment.",
        complexityRationale:
            "Only four inequalities are evaluated, each with at most one division, so clipping is constant time and constant space regardless of coordinate magnitude.",
        uses: [
            "Viewport culling of lines in rasterizers and game engines",
            "Window-to-viewport transformations in computer graphics pipelines",
            "Trimming geometric primitives before intersection tests",
        ],
        references: [
            "Liang and Barsky, A New Concept and Method for Line Clipping, 1984",
            "Foley et al., Computer Graphics: Principles and Practice, Chapter 3",
        ],
        workedExample:
            "Clip (-2, -1) to (3, 2) against [0,2] x [0,2]. The four inequalities give t >= 0.5 from the left side, t <= 1 from the right, t >= 0.5 from the bottom, and t <= 1 from the top. The surviving interval is [0.5, 1], so the visible subsegment runs from (0.5, 0) to (2, 1).",
    },
    id: "liang-barsky-line-clipping",
    name: "Liang-Barsky Line Clipping",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { p0: [-2, -1], p1: [3, 2], rect: { xmin: 0, xmax: 2, ymin: 0, ymax: 2 } },
    visualType: "point",
    run,
    pseudocode: [
        "write the segment as p0 plus t times direction d for t in [0, 1]",
        "form the four p and q values from the rectangle sides",
        "for each side test a parallel case or compute the crossing ratio",
        "tighten the lower or upper bound and reject if they cross",
        "map the surviving interval ends back to segment endpoints",
        "done: the visible subsegment lies inside the window",
    ],
};

export default module;
