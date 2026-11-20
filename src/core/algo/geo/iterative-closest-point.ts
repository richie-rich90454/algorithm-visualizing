/**
 * iterative-closest-point.ts - Point-to-point ICP rigid registration in 2D.
 *
 * ICP alternates between two steps: pair each transformed source point with
 * its nearest target point, then compute the closed-form rigid transform that
 * best aligns those pairs (a 2D Kabsch fit). The error decreases each round
 * until it stops changing, recovering the transform that overlays the clouds.
 *
 * Time: O(iterations * n^2). Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function rotate(p: Pt, angle: number): Pt {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

function transformPoint(p: Pt, angle: number, tx: number, ty: number): Pt {
    const r = rotate(p, angle);
    return [r[0] + tx, r[1] + ty];
}

/** Closed-form 2D rigid fit from source points to their target correspondences. */
function rigidFit(source: Pt[], targets: Pt[]): { angle: number; tx: number; ty: number } {
    const n = source.length;
    let sx = 0, sy = 0, tx = 0, ty = 0;
    for (let i = 0; i < n; i += 1) {
        sx += source[i]![0];
        sy += source[i]![1];
        tx += targets[i]![0];
        ty += targets[i]![1];
    }
    sx /= n;
    sy /= n;
    tx /= n;
    ty /= n;
    let crossTerm = 0;
    let dotTerm = 0;
    for (let i = 0; i < n; i += 1) {
        const ax = source[i]![0] - sx;
        const ay = source[i]![1] - sy;
        const bx = targets[i]![0] - tx;
        const by = targets[i]![1] - ty;
        crossTerm += ax * by - ay * bx;
        dotTerm += ax * bx + ay * by;
    }
    const angle = Math.atan2(crossTerm, dotTerm);
    const r = rotate([sx, sy], angle);
    return { angle, tx: tx - r[0], ty: ty - r[1] };
}

/** The ICP generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { target?: Pt[]; source?: Pt[]; iterations?: number } | null) ?? {};
    const target: Pt[] = task.target ?? [
        [0, 0], [2, 0], [3, 1], [2, 3], [0, 2], [1, 1], [4, 2],
    ];
    // Default demo: a rotated and shifted copy of the target, so the true
    // answer is known exactly and ICP has a well-conditioned alignment to find.
    const trueAngle = 0.4;
    const trueTx = 1;
    const trueTy = -0.5;
    const source: Pt[] = task.source ?? target.map((p) => {
        const dx = p[0] - trueTx;
        const dy = p[1] - trueTy;
        const c = Math.cos(trueAngle);
        const s = Math.sin(trueAngle);
        return [dx * c + dy * s, -dx * s + dy * c];
    });
    const maxIterations = Math.max(1, Math.min(40, Math.floor(task.iterations ?? 12)));
    let angle = 0;
    let tx = 0;
    let ty = 0;
    const errors: number[] = [];
    let step = 0;

    const emit = (a: number, x: number, y: number, description: string, codeLineNumber: number, final: boolean): VisualFrame => {
        const entities: VisualEntity[] = [];
        target.forEach((p, i) => {
            entities.push({
                id: `t-${i}`, type: "node", label: `t${i}`, value: p, state: "sorted",
                x: p[0], y: -p[1], width: 0, height: 0, metadata: { index: i, role: "target" },
            });
        });
        const moved = source.map((p) => transformPoint(p, a, x, y));
        moved.forEach((p, i) => {
            entities.push({
                id: `s-${i}`, type: "node", label: `s${i}`, value: p, state: final ? "path" : "active",
                x: p[0], y: -p[1], width: 0, height: 0, metadata: { index: i, role: "source" },
            });
        });
        const edges: VisualEdge[] = [];
        moved.forEach((p, i) => {
            let nearest = 0;
            let best = Infinity;
            target.forEach((q, j) => {
                const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
                if (d < best) {
                    best = d;
                    nearest = j;
                }
            });
            edges.push({
                id: `corr-${i}`, sourceId: `s-${i}`, targetId: `t-${nearest}`,
                label: Math.sqrt(best).toFixed(2), state: "comparing", directed: false,
            });
        });
        const flat = (pts: Pt[]): number[] => {
            const out: number[] = [];
            for (const p of pts) out.push(p[0], p[1]);
            return out;
        };
        const aligned = source.map((p) => transformPoint(p, a, x, y));
        let squared = 0;
        for (let i = 0; i < aligned.length; i += 1) {
            let best = Infinity;
            for (const q of target) best = Math.min(best, (aligned[i]![0] - q[0]) ** 2 + (aligned[i]![1] - q[1]) ** 2);
            squared += best;
        }
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "point",
            meta: {
                target: flat(target),
                source: flat(source),
                aligned: flat(aligned),
                errors: [...errors],
                rotation: [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)],
                translation: [x, y],
                rmsd: Math.sqrt(squared / Math.max(1, source.length)),
                iterations: errors.length,
            },
        };
    };

    if (source.length === 0 || target.length === 0) {
        yield emit(0, 0, 0, "ICP: an empty point cloud has no correspondences to fit.", 0, true);
        return;
    }

    yield emit(angle, tx, ty, `ICP: ${source.length} source points against ${target.length} target points.`, 0, false);

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const moved = source.map((p) => transformPoint(p, angle, tx, ty));
        const matched: Pt[] = [];
        let squared = 0;
        for (const p of moved) {
            let nearest = target[0]!;
            let best = Infinity;
            for (const q of target) {
                const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
                if (d < best) {
                    best = d;
                    nearest = q;
                }
            }
            matched.push(nearest);
            squared += best;
        }
        const error = Math.sqrt(squared / source.length);
        const previous = errors[errors.length - 1];
        errors.push(error);
        const fit = rigidFit(source, matched);
        angle = fit.angle;
        tx = fit.tx;
        ty = fit.ty;
        yield emit(
            angle,
            tx,
            ty,
            `ICP: round ${iteration + 1} fitted rotation ${angle.toFixed(3)} and error ${error.toFixed(4)}.`,
            2,
            false,
        );
        if (previous !== undefined && Math.abs(previous - error) < 1e-10) break;
    }

    yield emit(angle, tx, ty, `ICP: converged after ${errors.length} rounds with RMS error ${errors[errors.length - 1]!.toFixed(6)}.`, 5, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Iterative closest point aligns two shapes without knowing which point corresponds to which. It guesses a transform, sends each moved source point to the nearest target point, and then solves for the best rigid transform explaining those pairs. Repeating the two steps gradually pulls the clouds together.",
        invariants: [
            "Each round uses nearest-neighbor correspondences under the current transform.",
            "The rigid fit uses only rotation and translation, never scaling or shearing.",
            "The mean correspondence error never increases after a fit.",
        ],
        correctness:
            "The 2D rigid fit centers both paired sets and maximizes the trace term of the cross-covariance, which is solved exactly by an angle of atan2 of the cross and dot sums; this is the least-squares optimal rotation for the current correspondences. Because each fit is optimal for its pairs, the error cannot rise, and when correspondences stop changing the transform is a fixed point of the iteration. For clouds that are rotated and translated copies of each other and start close, that fixed point recovers the true alignment.",
        complexityRationale:
            "Finding the nearest target for each of n source points costs O(n^2) per round, and the rigid fit is linear, so t rounds take O(t n^2) time and O(n) working space plus the buffered frames.",
        uses: [
            "Registering lidar scans and 3D point clouds",
            "Aligning shapes in computer vision and robotics",
            "Fitting a template to observed landmark positions",
        ],
        references: [
            "Besl and McKay, A Method for Registration of 3-D Shapes, 1992",
            "Chen and Medioni, Object Modelling by Registration of Multiple Range Images, 1992",
        ],
        workedExample:
            "A small L-shaped cloud is rotated by about 0.4 radians and shifted. From the identity guess, nearest neighbors are wrong at first, but the first rigid fit rotates most of the way; a handful of further rounds correct the residual until each source point sits on its true target and the RMS error is nearly zero.",
    },
    id: "iterative-closest-point",
    name: "Iterative Closest Point",
    category: "geometry",
    complexity: { time: "O(t n^2)", space: "O(n)" },
    defaultInput: {
        target: [[0, 0], [2, 0], [3, 1], [2, 3], [0, 2], [1, 1], [4, 2]],
        iterations: 12,
    },
    visualType: "point",
    run,
    pseudocode: [
        "start with an identity rigid transform",
        "apply the current transform to every source point",
        "pair each moved point with its nearest target point",
        "center both sets and solve the optimal rotation and translation",
        "replace the current transform with the fitted one",
        "repeat until the mean error stops decreasing",
        "done: the source cloud overlays the target cloud",
    ],
};

export default module;
