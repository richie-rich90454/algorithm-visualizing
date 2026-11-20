/**
 * zigzag-sampler.ts - Zig-Zag Sampler for a Standard Normal Target
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Zig-Zag process is a continuous-time piecewise-deterministic Markov
 * process. A particle travels at unit speed in one of two directions. Bounces
 * occur at a rate equal to the positive part of the slope of the target
 * potential, so the particle slows down where the target density falls away
 * from the mode. A constant refreshment rate keeps the process ergodic. The
 * time-weighted positions converge to the standard normal distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps)
 *   Space: O(steps) for the displayed trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Every event location is a node on the real line at (position, 0).
 *   - The current location is highlighted; earlier locations stay visible.
 *   - The final frame reports the time-weighted stationary mean.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ZigZagInput {
    steps?: number;
    refresh?: number;
    seed?: number;
    x0?: number;
    v0?: number;
}

/** Small deterministic generator so replays are reproducible. */
export function makeRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Total event rate for the standard normal potential U(x) = x^2/2. */
export function zigzagRate(x: number, velocity: number, refresh: number): number {
    return Math.max(0, velocity * x) + refresh;
}

/** Build the moving trace as nodes on a horizontal line. */
function makeNodes(
    positions: number[],
    velocities: number[],
    states: Map<number, EntityState>,
): VisualEntity[] {
    const start = Math.max(0, positions.length - 60);
    return positions.slice(start).map((x, j) => {
        const i = start + j;
        return {
            id: `event-${i}`,
            type: "node" as const,
            label: `${x.toFixed(2)} ${velocities[i] === 1 ? "+" : "-"}`,
            value: x,
            state: states.get(i) ?? "unvisited",
            x,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, position: x, velocity: velocities[i] ?? 1 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ZigZagInput | null) ?? {};
    const steps = Math.max(1, typeof task.steps === "number" ? Math.floor(task.steps) : 40);
    const refresh = typeof task.refresh === "number" && task.refresh >= 0 ? task.refresh : 0.5;
    const seed = typeof task.seed === "number" ? task.seed : 7;
    const rng = makeRng(seed);
    let x = typeof task.x0 === "number" ? task.x0 : 2;
    let velocity = typeof task.v0 === "number" && task.v0 < 0 ? -1 : 1;

    const positions: number[] = [x];
    const velocities: number[] = [velocity];
    let weightedSum = 0;
    let elapsed = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(positions, velocities, new Map()),
        edges: [],
        description: `Zig-Zag sampler: start at x ${x.toFixed(2)} with velocity ${velocity}, refresh rate ${refresh}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { x, velocity, rate: zigzagRate(x, velocity, refresh), weightedMean: 0, trace: [[x, velocity]] },
    };
    step += 1;

    for (let i = 0; i < steps; i += 1) {
        const rate = Math.max(zigzagRate(x, velocity, refresh), 1e-12);
        const u = Math.max(rng(), 1e-12);
        const tau = -Math.log(u) / rate;
        const midpoint = x + (velocity * tau) / 2;
        weightedSum += midpoint * tau;
        elapsed += tau;
        x += velocity * tau;
        velocity = -velocity;
        positions.push(x);
        velocities.push(velocity);
        const states = new Map<number, EntityState>([[positions.length - 1, "active"]]);
        yield {
            stepNumber: step,
            entities: makeNodes(positions, velocities, states),
            edges: [],
            description: `Event ${i + 1}: rate ${rate.toFixed(3)}, wait ${tau.toFixed(3)}, move to x ${x.toFixed(3)}, then reverse velocity.`,
            codeLineNumber: 1 + (i % 6),
            layout: "point",
            meta: {
                x,
                velocity,
                rate,
                waitingTime: tau,
                weightedMean: weightedSum / elapsed,
                trace: positions.slice(-60).map((p, k) => [p, velocities[positions.length - Math.min(60, positions.length) + k] ?? 1]),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(positions, velocities, new Map()),
        edges: [],
        description: `Done: ${steps} events over time ${elapsed.toFixed(2)}, time-weighted mean ${(weightedSum / elapsed).toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            steps,
            elapsed,
            weightedMean: weightedSum / elapsed,
            finalPosition: x,
            velocity,
            trace: positions.map((p, k) => [p, velocities[k] ?? 1]),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a particle sliding along a line at constant speed. When it wanders into a region where the target distribution is falling, it bounces back more often, so it spends more time near the mode. Occasionally it flips direction at random to keep exploring. Averaging the particle's position by how long it stays there recovers the target distribution.",
        invariants: [
            "Between events the position changes linearly at unit speed.",
            "The bounce rate is the positive slope of the potential plus the refreshment rate.",
            "Every event reverses the velocity, and the time-weighted average uses segment midpoints.",
        ],
        correctness:
            "The Zig-Zag process satisfies the skew detailed balance condition with respect to the product of the target density and the uniform velocity distribution. For the normal target the potential is x squared over two, so the bounce rate is the positive part of x. That makes excursions away from the mode short and excursions near it long, and the ergodic average of the position converges to the target mean of zero.",
        complexityRationale:
            "Each requested event draws one uniform number, one logarithm, and a constant amount of arithmetic, so the run takes O(steps) time. Storing the displayed trace uses O(steps) space.",
        uses: [
            "Markov chain Monte Carlo with continuous trajectories",
            "Sampling when gradient evaluations are cheap but accept-reject tests are costly",
            "A teaching example of piecewise-deterministic sampling",
        ],
        references: [
            "Bierkens, Fearnhead and Roberts, The Zig-Zag Process and Super-Efficient Sampling, 2019",
            "Fearnhead, Bierkens, Pollock and Roberts, Piecewise Deterministic Markov Processes, 2018",
        ],
        workedExample:
            "Starting at x equals two with velocity plus one, the potential slope is two, so with refreshment 0.5 the event rate is 2.5. An exponential wait of about 0.4 moves the particle to roughly 2.4 before it reverses. Repeating this pulls the time-weighted mean from two toward zero.",
    },
    id: "zigzag-sampler",
    name: "Zig-Zag Sampler",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { steps: 40, refresh: 0.5, seed: 7, x0: 2, v0: 1 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize position and velocity",
        "compute the event rate from the potential slope plus refreshment",
        "draw an exponential waiting time at that rate",
        "move the particle along its current velocity",
        "reverse the velocity at the event",
        "accumulate the midpoint times the waiting time",
        "repeat until the requested number of events is reached",
        "done: report the time-weighted stationary mean",
    ],
};

export default module;
