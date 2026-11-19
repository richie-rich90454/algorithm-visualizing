/**
 * evolution-strategies.ts - (1+1) Evolution Strategy with the One-Fifth Rule
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A (1+1) evolution strategy is the simplest evolutionary optimizer: one parent
 * produces one offspring by adding Gaussian noise scaled by a step size, and
 * the better of the two survives. A fixed step size is rarely right, so the
 * one-fifth success rule adapts it. Every window of generations, if more than
 * one fifth of the mutations succeeded, the step grows; otherwise it shrinks.
 * This keeps the search exploratory early and precise near the optimum.
 *
 * A seeded pseudorandom generator makes the whole run reproducible, so every
 * replay follows exactly the same trajectory.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(generations * d) for d-dimensional samples
 *   Space: O(d) for the parent and offspring vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the parent x, y, objective, and current step size.
 *   - The objective bar is green on the final frame when the best point improves.
 *   - Captions report acceptance and step-size adjustments.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    startX?: number;
    startY?: number;
    sigma?: number;
    generations?: number;
    window?: number;
    seed?: number;
}

/** A small deterministic pseudorandom generator (mulberry32). */
function mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/** A standard normal sample via the Box-Muller transform. */
function normal(rand: () => number): number {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function objective(x: number, y: number): number {
    return x * x + y * y;
}

function makeBars(x: number, y: number, value: number, sigma: number, done: boolean): VisualEntity[] {
    const values = [x, y, value, sigma];
    return values.map((v, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: v.toFixed(5),
        value: v,
        state: (index === 2 ? (done ? "sorted" : "comparing") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "x" : index === 1 ? "y" : index === 2 ? "f" : "sigma" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    let x = typeof task.startX === "number" ? task.startX : 3;
    let y = typeof task.startY === "number" ? task.startY : 4;
    let sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 1;
    const generations = typeof task.generations === "number" ? Math.max(1, Math.floor(task.generations)) : 60;
    const window = typeof task.window === "number" ? Math.max(1, Math.floor(task.window)) : 10;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 42;
    const rand = mulberry32(seed);

    let best = objective(x, y);
    const initialBest = best;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(x, y, best, sigma, false),
        edges: [],
        description: `Start at (${x.toFixed(3)}, ${y.toFixed(3)}) with objective ${best.toFixed(4)} and step size ${sigma.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { generation: 0, x, y, objective: best, sigma, successes: 0, accepted: false, bestObjective: best },
    };
    step += 1;

    let successes = 0;
    for (let generation = 1; generation <= generations; generation += 1) {
        const childX = x + sigma * normal(rand);
        const childY = y + sigma * normal(rand);
        const childValue = objective(childX, childY);
        const accepted = childValue < best;
        if (accepted) {
            x = childX;
            y = childY;
            best = childValue;
            successes += 1;
        }
        let adjusted = false;
        if (generation % window === 0) {
            const rate = successes / window;
            sigma = rate > 0.2 ? sigma / 0.85 : sigma * 0.85;
            successes = 0;
            adjusted = true;
        }
        yield {
            stepNumber: step,
            entities: makeBars(x, y, best, sigma, false),
            edges: [],
            description: `Generation ${generation}: ${accepted ? "accepted" : "rejected"} offspring${adjusted ? ", step size adjusted by the one-fifth rule" : ""}; best ${best.toFixed(5)}.`,
            codeLineNumber: adjusted ? 7 : 4,
            layout: "array",
            meta: { generation, x, y, objective: best, sigma, successes, accepted, bestObjective: best },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, y, best, sigma, true),
        edges: [],
        description: `After ${generations} generations the best point is (${x.toFixed(4)}, ${y.toFixed(4)}) with objective ${best.toExponential(3)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { generation: generations, x, y, objective: best, sigma, bestObjective: best, improved: best < initialBest },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Evolution strategies optimize by trial and error rather than gradients. Keep one candidate solution, perturb it randomly, and keep the perturbation when it helps. The trick is choosing how large the perturbations should be: the one-fifth rule watches how often mutations succeed and grows the step when success is common, or shrinks it when success is rare.",
        invariants: [
            "The parent is replaced only when the offspring has a strictly smaller objective.",
            "The best objective is therefore non-increasing across generations.",
            "The step size is adjusted exactly once every window generations.",
            "A fixed seed reproduces the identical sequence of Gaussian mutations.",
        ],
        correctness:
            "Because replacement requires strict improvement, the tracked best objective is monotone non-increasing and cannot drift away from a good solution. The one-fifth rule is a proven heuristic: on unimodal functions it keeps the success rate near one fifth, balancing exploration against precision, so the iterate converges to a neighborhood of the optimum for a sufficiently small final step size.",
        complexityRationale:
            "Each generation draws d Gaussian coordinates and evaluates the objective once, costing O(d) work. Only the current point, its offspring, and a few scalars are stored, so the space is O(d).",
        uses: [
            "Derivative-free optimization of black-box simulation parameters",
            "Tuning controller gains where the objective is evaluated by experiment",
            "A teaching example for evolutionary computation and adaptive search",
        ],
        references: [
            "Rechenberg, Evolutionsstrategie: Optimierung technischer Systeme, 1973",
            "Schwefel, Numerical Optimization of Computer Models, 1981",
        ],
        workedExample:
            "From (3, 4) with step size 1, a mutation might land near (2.6, 3.1), whose squared distance is smaller, so it is accepted. After ten generations suppose three of ten mutations succeeded; that rate exceeds one fifth, so the step grows to about 1.18 and the next window explores more boldly.",
    },
    id: "evolution-strategies",
    name: "Evolution Strategy with One-Fifth Rule",
    category: "numerical-optimization",
    complexity: { time: "O(generations * d)", space: "O(d)" },
    defaultInput: { startX: 3, startY: 4, sigma: 1, generations: 60, window: 10, seed: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize one parent, a step size sigma, and a success counter",
        "for each generation up to the limit",
        "sample an offspring by adding sigma times a normal vector to the parent",
        "evaluate the offspring objective",
        "replace the parent when the offspring is better and count a success",
        "after each window compare the success rate with one fifth",
        "increase sigma when the rate is high, otherwise reduce it",
        "reset the success counter after an adjustment",
        "done: report the best point and its objective value",
    ],
};

export default module;
