/**
 * rectified-flow.ts - Rectified Flow Straight-Line Interpolation and Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rectified flow turns generation into following a straight line. For a paired
 * source sample x0 and target sample x1 it defines the interpolation x_t =
 * (1 - t) x0 + t x1 and a constant target velocity v = x1 - x0. A model is
 * trained by regression to predict v from x_t, and sampling integrates the
 * learned velocity with Euler steps from x0 back to x1. This module implements
 * the exact arithmetic core: the linear interpolation, the constant velocity,
 * and the Euler sampler, with the velocity assumed learned perfectly. It is a
 * teachable two-dimensional model, not a trained generative network.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(m * n) for m sample pairs and n Euler steps
 *   Space: O(m * n) to display the sampled trajectories
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Source points are blue, target points green, interpolated points yellow.
 *   - Euler trajectory points trace the straight path from source to target.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Vec2 = [number, number];

interface Pair {
    x0: Vec2;
    x1: Vec2;
}

interface FlowInput {
    pairs?: Pair[];
    steps?: number;
}

const TS = [0, 0.25, 0.5, 0.75, 1];

function pt(x: number, y: number): [number, number] {
    return [Number(x.toFixed(6)), Number(y.toFixed(6))];
}

function pointEntity(
    id: string,
    position: Vec2,
    label: string,
    state: EntityState,
    role: string,
    index: number,
): VisualEntity {
    return {
        id,
        type: "node",
        label,
        value: pt(position[0], position[1]),
        state,
        x: position[0],
        y: position[1],
        width: 0,
        height: 0,
        metadata: { role, index },
    };
}

/** Build the full set of entities for a given phase of the flow. */
function makeEntities(pairs: Pair[], steps: number, phase: string, activeT: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let p = 0; p < pairs.length; p += 1) {
        const pair = pairs[p]!;
        const v: Vec2 = [pair.x1[0] - pair.x0[0], pair.x1[1] - pair.x0[1]];
        entities.push(pointEntity(`s-${p}`, pair.x0, `x0-${p}`, "idle", "source", p));
        entities.push(pointEntity(`t-${p}`, pair.x1, `x1-${p}`, "sorted", "target", p));
        for (let q = 0; q < TS.length; q += 1) {
            const t = TS[q]!;
            const position: Vec2 = [pair.x0[0] + t * v[0], pair.x0[1] + t * v[1]];
            const state: EntityState = phase === "interp" && t === activeT ? "highlight" : "comparing";
            entities.push(pointEntity(`p-${p}-${q}`, position, `t=${t}`, state, "interp", p));
        }
        if (phase === "sample" || phase === "done") {
            let cx = pair.x0[0];
            let cy = pair.x0[1];
            for (let k = 0; k <= steps; k += 1) {
                const state: EntityState = k === steps ? "path" : "visited";
                entities.push(pointEntity(`e-${p}-${k}`, [cx, cy], `k${k}`, state, "euler", p));
                cx += v[0] / steps;
                cy += v[1] / steps;
            }
        }
    }
    return entities;
}

function makeEdges(pairs: Pair[], steps: number): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let p = 0; p < pairs.length; p += 1) {
        for (let k = 0; k < steps; k += 1) {
            edges.push({
                id: `edge-${p}-${k}`,
                sourceId: `e-${p}-${k}`,
                targetId: `e-${p}-${k + 1}`,
                label: "",
                state: "path",
                directed: true,
            });
        }
    }
    return edges;
}

/** Demonstrate rectified-flow interpolation and Euler sampling. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FlowInput | null) ?? {};
    const pairs: Pair[] =
        Array.isArray(task.pairs) && task.pairs.length > 0
            ? task.pairs.map((p) => ({ x0: [...p.x0], x1: [...p.x1] }))
            : [
                  { x0: [-2, -1], x1: [2, 1] },
                  { x0: [-1, 2], x1: [3, -2] },
              ];
    const steps = Math.max(1, Math.min(typeof task.steps === "number" ? Math.trunc(task.steps) : 4, 50));

    const velocities = pairs.map((pair) => pt(pair.x1[0] - pair.x0[0], pair.x1[1] - pair.x0[1]));
    const flatVelocities = velocities.flat();
    const endpoints = pairs.map((pair) => {
        let cx = pair.x0[0];
        let cy = pair.x0[1];
        const v0 = (pair.x1[0] - pair.x0[0]) / steps;
        const v1 = (pair.x1[1] - pair.x0[1]) / steps;
        for (let k = 0; k < steps; k += 1) {
            cx += v0;
            cy += v1;
        }
        return pt(cx, cy);
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(pairs, steps, "setup", -1),
        edges: [],
        description: `Rectified flow over ${pairs.length} source-target pair(s); velocity is the straight-line displacement.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { pairs: pairs.length, steps, velocities: flatVelocities, endpoints: [], reachedTarget: false },
    };
    step += 1;

    for (let q = 0; q < TS.length; q += 1) {
        const t = TS[q]!;
        yield {
            stepNumber: step,
            entities: makeEntities(pairs, steps, "interp", t),
            edges: [],
            description: `Interpolation at t = ${t}: x_t = (1 - t) x0 + t x1 lies on the straight line between the pair.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { pairs: pairs.length, steps, velocities: flatVelocities, t, endpoints: [], reachedTarget: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(pairs, steps, "sample", -1),
        edges: makeEdges(pairs, steps),
        description: `Sampling: integrate the constant velocity with ${steps} Euler steps of size 1/${steps}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { pairs: pairs.length, steps, velocities: flatVelocities, endpoints: [], reachedTarget: false },
    };
    step += 1;

    const reached = endpoints.every((end, p) => {
        const target = pairs[p]!.x1;
        return Math.abs(end[0] - target[0]) < 1e-6 && Math.abs(end[1] - target[1]) < 1e-6;
    });
    yield {
        stepNumber: step,
        entities: makeEntities(pairs, steps, "done", -1),
        edges: makeEdges(pairs, steps),
        description: reached
            ? `Done: all Euler trajectories end exactly at their target samples.`
            : `Done: Euler endpoints deviate from targets because of rounding.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { pairs: pairs.length, steps, velocities: flatVelocities, endpoints: endpoints.flat(), reachedTarget: reached },
    };
}

/** The rectified flow module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Generation can be made simple by pairing each noise sample with a data sample and drawing the straight segment between them. Rectified flow trains a model to point along that segment, so producing a sample just means starting at noise and walking along the predicted direction. Because the path is straight, a few large steps land exactly on the data point when the velocity is known.",
        invariants: [
            "The interpolation x_t is affine in t and equals x0 at t = 0 and x1 at t = 1.",
            "The regression target velocity is the constant displacement x1 minus x0.",
            "Euler integration with step size 1/n over n steps accumulates exactly one full velocity.",
        ],
        correctness:
            "For a pair, x_t = x0 + t (x1 - x0) is linear in t by construction. The target velocity is the derivative of x_t with respect to t, namely x1 - x0, which is constant. Euler updates add (x1 - x0)/n each step; after n steps the accumulated change is x1 - x0, so the endpoint is x0 + (x1 - x0) = x1. A brute-force evaluation of these identities at any t reproduces the module's reported interpolation and endpoint.",
        complexityRationale:
            "For m pairs and n Euler steps the module evaluates m interpolation points per time and m times n trajectory points, giving O(m n) time and O(m n) stored points. A trained flow model replaces the known velocity with a network call per step but keeps the same sampling structure.",
        uses: [
            "Fast image and video generation with few sampling steps",
            "Understanding flow matching and consistency-style generative models",
            "Teaching the connection between ODEs and generative sampling",
        ],
        references: [
            "Liu et al., Flow Straight and Fast: Learning to Generate and Transfer Data, 2022",
            "Lipman et al., Flow Matching for Generative Modeling, 2022",
        ],
        workedExample:
            "Pair x0 = (-2, -1) with x1 = (2, 1). The velocity is (4, 2). At t = 0.5 the interpolation is (0, 0), the midpoint. With four Euler steps each update is (1, 0.5), and after four updates the walker reaches (2, 1), exactly the target.",
    },
    id: "rectified-flow",
    name: "Rectified Flow (Straight-Line Core)",
    category: "ml-ai",
    complexity: { time: "O(m * n)", space: "O(m * n)" },
    defaultInput: {
        pairs: [
            { x0: [-2, -1], x1: [2, 1] },
            { x0: [-1, 2], x1: [3, -2] },
        ],
        steps: 4,
    },
    visualType: "point",
    run,
    pseudocode: [
        "read paired source and target samples and the number of Euler steps",
        "set the target velocity of each pair to x1 minus x0",
        "for each time t form the interpolation (1 - t) x0 plus t x1",
        "train a model by regression to predict the velocity from x_t",
        "start each sample at x0",
        "repeat n times: move by the predicted velocity divided by n",
        "done: report the endpoints and check they equal the targets",
    ],
};

export default module;
