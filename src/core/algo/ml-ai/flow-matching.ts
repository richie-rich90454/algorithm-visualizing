/**
 * flow-matching.ts - Flow Matching on Straight-Line Paths (Teachable Core)
 *
 * Flow matching learns a time-dependent velocity field that transports samples
 * from a source distribution to a target distribution. This module shows the
 * teachable core: rectified (straight-line) paths with constant velocity
 * v = x1 - x0, integrated from t=0 to t=1. It is not a trained generative model.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

export interface FlowPath {
    source: Point;
    target: Point;
    velocity: Point;
}

/** Compute constant velocities from each source to its target. */
export function buildPaths(sources: Point[], targets: Point[]): FlowPath[] {
    return sources.map((source, i) => {
        const target = targets[i] ?? source;
        return {
            source,
            target,
            velocity: [target[0] - source[0], target[1] - source[1]],
        };
    });
}

/** Position of a path at time t on its straight line. */
export function positionAt(path: FlowPath, t: number): Point {
    return [
        path.source[0] + t * path.velocity[0],
        path.source[1] + t * path.velocity[1],
    ];
}

function makeParticles(paths: FlowPath[], t: number): VisualEntity[] {
    return paths.map((path, i) => {
        const [x, y] = positionAt(path, t);
        return {
            id: `particle-${i}`,
            type: "node" as const,
            label: String(i),
            value: [x, y],
            state: "active" as const,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, t },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sources?: Point[]; targets?: Point[]; steps?: number } | null) ?? {};
    const sources: Point[] = Array.isArray(task.sources) && task.sources.length > 0
        ? task.sources
        : [[0, 0], [1, 0], [0, 1], [1, 1]];
    const targets: Point[] = Array.isArray(task.targets) && task.targets.length > 0
        ? task.targets
        : [[1, 1], [2, 0.5], [0.5, 2], [2, 2]];
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 4;
    const paths = buildPaths(sources, targets);
    const positionsAt = (t: number): number[] =>
        paths.reduce<number[]>((acc, path) => acc.concat(positionAt(path, t)), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeParticles(paths, 0),
        edges: [],
        description: `Flow matching over ${paths.length} particles: start at the source positions at t=0 (teaching core of rectified flow).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { phase: "start", n: paths.length, steps, t: 0, positions: positionsAt(0) },
    };
    step += 1;

    for (let k = 1; k <= steps; k += 1) {
        const t = k / steps;
        yield {
            stepNumber: step,
            entities: makeParticles(paths, t),
            edges: [],
            description: `Euler step ${k}/${steps}, t=${t.toFixed(2)}: each particle advances by velocity times dt along its straight path.`,
            codeLineNumber: k === 1 ? 1 : 2,
            layout: "point",
            meta: { phase: "flow", n: paths.length, steps, t, positions: positionsAt(t) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeParticles(paths, 1),
        edges: [],
        description: `Done: all particles reach their targets at t=1.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { phase: "end", n: paths.length, steps, t: 1, positions: positionsAt(1), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Flow matching turns generation into transport: define a path from a simple source distribution to the data distribution and learn the velocity that moves points along it. The simplest path is a straight line, so the velocity is constant and equal to the difference between target and source. Simulating that velocity from time zero to one carries each point to its destination.",
        invariants: [
            "Each particle follows a straight line from its source to its target.",
            "The velocity is constant: v = x1 - x0.",
            "At t=1 the interpolated position equals the target exactly.",
        ],
        correctness:
            "The Euler update x_{k+1} = x_k + v*dt with dt = 1/steps and constant v telescopes: after k steps x_k = x_0 + k*v/steps = (1-t)x_0 + t*x_1 for t = k/steps. This is exactly the closed-form straight-line interpolation, so integrating the constant velocity field reproduces the prescribed path and lands on the target at t=1; the property test checks this against the closed form.",
        complexityRationale:
            "Each of the steps updates every one of the n particles with O(1) arithmetic, giving O(n*steps) time and O(n) stored particle positions per frame.",
        uses: [
            "Generative modeling with continuous normalizing flows and rectified flow",
            "Fast samplers that solve an ordinary differential equation",
            "A teaching model for transporting one distribution to another",
        ],
        references: [
            "Lipman et al., Flow Matching for Generative Modeling, ICLR 2023",
            "Liu et al., Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow, ICLR 2023",
        ],
        workedExample:
            "A particle from (0, 0) to (1, 1) has velocity (1, 1). With four steps dt is 0.25, so its positions are (0, 0), (0.25, 0.25), (0.5, 0.5), (0.75, 0.75), and (1, 1), matching the straight-line interpolation at each sampled time.",
    },
    id: "flow-matching",
    name: "Flow Matching",
    category: "ml-ai",
    complexity: { time: "O(n*steps)", space: "O(n)" },
    defaultInput: {
        sources: [[0, 0], [1, 0], [0, 1], [1, 1]],
        targets: [[1, 1], [2, 0.5], [0.5, 2], [2, 2]],
        steps: 4,
    },
    visualType: "point",
    run,
    pseudocode: [
        "set each particle's velocity to target minus source",
        "place all particles at their source positions at t=0",
        "for each of the steps set dt to one over steps",
        "advance every particle by velocity times dt",
        "record the interpolated positions at this time",
        "done: report the particles at their targets at t=1",
    ],
};

export default module;
