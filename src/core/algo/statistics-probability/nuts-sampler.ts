/**
 * nuts-sampler.ts - No-U-Turn Sampler (NUTS)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * NUTS is an adaptive extension of Hamiltonian Monte Carlo. It simulates
 * Hamiltonian dynamics with a symplectic leapfrog integrator and builds a
 * binary tree of trajectory points by repeated doubling. A slice variable
 * selects valid states, and a U-turn criterion stops expansion once the
 * trajectory starts doubling back on itself, removing the need to choose a
 * trajectory length by hand. This module samples a one-dimensional Gaussian,
 * where the log density and its gradient are analytic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^depth) leapfrog steps per transition in the worst case
 *   Space: O(2^depth) for the explored trajectory tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Explored states are points in phase space at (position, momentum).
 *   - Accepted states are green, rejected states are idle, divergences red.
 *   - Edges show the order in which the doubling explored the trajectory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NutsState {
    q: number;
    p: number;
}

interface TraceEvent {
    iteration: number;
    depth: number;
    direction: number;
    q: number;
    p: number;
    logWeight: number;
    accepted: boolean;
    divergent: boolean;
}

interface TreeResult {
    qMinus: number;
    qPlus: number;
    pMinus: number;
    pPlus: number;
    sample: number | null;
    n: number;
    s: boolean;
    divergent: boolean;
}

interface Context {
    mean: number;
    sigmaSq: number;
    eps: number;
    maxDepth: number;
    rng: () => number;
    trace: TraceEvent[];
    iteration: number;
    stopReason: string;
}

/** Log density of a Gaussian, up to an additive constant. */
function logDensity(q: number, mean: number, sigmaSq: number): number {
    return -0.5 * ((q - mean) * (q - mean)) / sigmaSq;
}

/** One leapfrog step of Hamiltonian dynamics with unit mass. */
export function leapfrog(q: number, p: number, eps: number, mean: number, sigmaSq: number): NutsState {
    let pHalf = p + eps * 0.5 * (-(q - mean) / sigmaSq);
    const qNext = q + eps * pHalf;
    pHalf = pHalf + eps * 0.5 * (-(qNext - mean) / sigmaSq);
    return { q: qNext, p: pHalf };
}

/** Conservative U-turn criterion for a one-dimensional trajectory. */
export function noUTurn(qMinus: number, pMinus: number, qPlus: number, pPlus: number): boolean {
    const span = qPlus - qMinus;
    return span * pMinus >= 0 && span * pPlus >= 0;
}

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal via Box-Muller. */
function gaussian(rng: () => number): number {
    return Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
}

/** Recursively build one NUTS subtree by doubling. */
function buildTree(q: number, p: number, logu: number, v: number, depth: number, ctx: Context): TreeResult {
    if (depth === 0) {
        const next = leapfrog(q, p, v * ctx.eps, ctx.mean, ctx.sigmaSq);
        const logWeight = logDensity(next.q, ctx.mean, ctx.sigmaSq) - 0.5 * next.p * next.p;
        const accepted = logu <= logWeight;
        const divergent = logWeight < logu - 1000;
        ctx.trace.push({
            iteration: ctx.iteration,
            depth,
            direction: v,
            q: next.q,
            p: next.p,
            logWeight,
            accepted,
            divergent,
        });
        return {
            qMinus: next.q,
            qPlus: next.q,
            pMinus: next.p,
            pPlus: next.p,
            sample: accepted ? next.q : null,
            n: accepted ? 1 : 0,
            s: !divergent && logu < logWeight + 1000,
            divergent,
        };
    }

    const first = buildTree(q, p, logu, v, depth - 1, ctx);
    if (!first.s) return first;
    const second = v === -1
        ? buildTree(first.qMinus, first.pMinus, logu, v, depth - 1, ctx)
        : buildTree(first.qPlus, first.pPlus, logu, v, depth - 1, ctx);

    let sample = first.sample;
    const total = first.n + second.n;
    if (second.sample !== null && total > 0 && ctx.rng() < second.n / total) {
        sample = second.sample;
    }

    const qMinus = v === -1 ? second.qMinus : first.qMinus;
    const qPlus = v === 1 ? second.qPlus : first.qPlus;
    const pMinus = v === -1 ? second.pMinus : first.pMinus;
    const pPlus = v === 1 ? second.pPlus : first.pPlus;
    const turnOK = noUTurn(qMinus, pMinus, qPlus, pPlus);
    return {
        qMinus,
        qPlus,
        pMinus,
        pPlus,
        sample,
        n: total,
        s: first.s && second.s && turnOK,
        divergent: first.divergent || second.divergent,
    };
}

/** One complete NUTS transition from a starting position. */
function nutsStep(q0: number, ctx: Context): number {
    const p0 = gaussian(ctx.rng);
    const logu = logDensity(q0, ctx.mean, ctx.sigmaSq) - 0.5 * p0 * p0 - Math.log(Math.max(1e-12, ctx.rng()));
    let qMinus = q0;
    let qPlus = q0;
    let pMinus = p0;
    let pPlus = p0;
    let sample = q0;
    let n = 1;
    let s = true;
    let depth = 0;

    while (depth < ctx.maxDepth && s) {
        const v = ctx.rng() < 0.5 ? -1 : 1;
        const result = v === -1
            ? buildTree(qMinus, pMinus, logu, v, depth, ctx)
            : buildTree(qPlus, pPlus, logu, v, depth, ctx);
        if (v === -1) {
            qMinus = result.qMinus;
            pMinus = result.pMinus;
        } else {
            qPlus = result.qPlus;
            pPlus = result.pPlus;
        }
        const total = n + result.n;
        if (result.s && result.sample !== null && total > 0 && ctx.rng() < result.n / total) {
            sample = result.sample;
        }
        n += result.n;
        s = result.s && noUTurn(qMinus, pMinus, qPlus, pPlus);
        depth += 1;
    }
    ctx.stopReason = depth >= ctx.maxDepth ? "max-depth" : noUTurn(qMinus, pMinus, qPlus, pPlus) ? "u-turn" : "divergence";
    return sample;
}

/** Build phase-space point entities from trace events. */
function makeEntities(events: TraceEvent[]): VisualEntity[] {
    return events.map((event, index) => {
        let state: EntityState = "idle";
        if (event.divergent) state = "error";
        else if (event.accepted) state = "sorted";
        return {
            id: `state-${index}`,
            type: "node" as const,
            label: `q ${event.q.toFixed(3)}`,
            value: event.q,
            state,
            x: event.q,
            y: event.p,
            width: 0,
            height: 0,
            metadata: {
                index,
                q: event.q,
                p: event.p,
                depth: event.depth,
                direction: event.direction,
                accepted: event.accepted,
                divergent: event.divergent,
            },
        };
    });
}

/** The NUTS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        mean?: number;
        sigma?: number;
        q0?: number;
        stepSize?: number;
        maxDepth?: number;
        iterations?: number;
        seed?: number;
    } | null) ?? {};
    const mean = typeof task.mean === "number" ? task.mean : 0;
    const sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 1;
    const q0 = typeof task.q0 === "number" ? task.q0 : 0.5;
    const stepSize = typeof task.stepSize === "number" && task.stepSize > 0 ? task.stepSize : 0.4;
    const maxDepth = typeof task.maxDepth === "number" ? Math.min(10, Math.max(0, Math.floor(task.maxDepth))) : 4;
    const iterations = typeof task.iterations === "number" ? Math.min(60, Math.max(1, Math.floor(task.iterations))) : 1;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const rng = mulberry32(seed);
    const sigmaSq = sigma * sigma;

    const allTrace: TraceEvent[] = [];
    const samples: number[] = [];
    const stopReasons: string[] = [];
    let q = q0;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const ctx: Context = { mean, sigmaSq, eps: stepSize, maxDepth, rng, trace: [], iteration, stopReason: "max-depth" };
        const next = nutsStep(q, ctx);
        allTrace.push(...ctx.trace);
        samples.push(next);
        stopReasons.push(ctx.stopReason);
        q = next;
    }
    const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length;

    yield {
        stepNumber: 0,
        entities: makeEntities([]),
        edges: [],
        description: `NUTS starting at q = ${q0.toFixed(3)} with target mean ${mean.toFixed(2)}, sigma ${sigma.toFixed(2)}, step size ${stepSize}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {
            mean, sigma, stepSize, maxDepth, iterations, seed,
            q: q0, p: 0, logWeight: 0, accepted: false, divergent: false,
            sample: q0, samples, sampleMean, stopReasons, totalEvents: allTrace.length,
        },
    };
    let step = 1;

    for (let index = 0; index < allTrace.length; index += 1) {
        const event = allTrace[index] as TraceEvent;
        const edges = index === 0 ? [] : [{
            id: `edge-${index}`,
            sourceId: `state-${index - 1}`,
            targetId: `state-${index}`,
            label: event.direction > 0 ? "+" : "-",
            state: "path" as const,
            directed: true,
        }];
        yield {
            stepNumber: step,
            entities: makeEntities(allTrace.slice(0, index + 1)),
            edges,
            description: `Iteration ${event.iteration}, depth ${event.depth}, direction ${event.direction > 0 ? "+" : "-"}: leapfrog to q ${event.q.toFixed(3)}, p ${event.p.toFixed(3)}, log-weight ${event.logWeight.toFixed(2)}, ${event.accepted ? "accepted" : "rejected"}${event.divergent ? ", divergent" : ""}.`,
            codeLineNumber: event.accepted ? 3 : 2,
            layout: "point",
            meta: {
                mean, sigma, stepSize, maxDepth, iterations, seed,
                iteration: event.iteration,
                depth: event.depth,
                direction: event.direction,
                q: event.q,
                p: event.p,
                logWeight: event.logWeight,
                accepted: event.accepted,
                divergent: event.divergent,
                sample: samples[event.iteration] ?? 0,
                samples,
                sampleMean,
                stopReasons,
                totalEvents: allTrace.length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(allTrace),
        edges: allTrace.slice(1).map((_event, k) => ({
            id: `edge-${k + 1}`,
            sourceId: `state-${k}`,
            targetId: `state-${k + 1}`,
            label: "",
            state: "path" as const,
            directed: false,
        })),
        description: `Completed ${iterations} NUTS transition(s): ${allTrace.length} leapfrog step(s), sample mean ${sampleMean.toFixed(3)}; stopped by ${stopReasons.join(", ")}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            mean, sigma, stepSize, maxDepth, iterations, seed,
            samples,
            sampleMean,
            stopReasons,
            totalEvents: allTrace.length,
            complete: true,
        },
    };
}

/** The NUTS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a skater gliding over the contour of the target density, with momentum carrying them along an energy level set. NUTS extends that glide by repeatedly doubling the trajectory in both time directions and keeping states chosen by a slice of the energy surface. It stops as soon as the two ends of the trajectory start moving toward each other, which is the telltale sign of a U-turn and wasted computation.",
        invariants: [
            "Each leapfrog step is symplectic and time reversible.",
            "A state is kept only when its log weight is at least the slice level.",
            "Expansion stops when the trajectory turns back on itself or the depth cap is hit.",
        ],
        correctness:
            "The leapfrog map is reversible and volume preserving, so Hamiltonian dynamics leaves the canonical distribution invariant; augmenting the target with a momentum draw and a slice variable preserves that invariant measure. The recursive doubling builds a symmetric tree, and the probability of selecting a state from a subtree is proportional to its accepted mass, which is the slice-sampling acceptance rule. The U-turn criterion is a stopping rule only and does not bias the accepted state, so NUTS keeps the target as its stationary distribution.",
        complexityRationale:
            "Each doubling doubles the number of leapfrog evaluations, so a tree stopped at depth j costs O(2 to the j) time, bounded by the depth cap. The recursion stores the visited states and endpoints, using O(2 to the j) space in the worst case.",
        uses: [
            "Bayesian posterior sampling in probabilistic programming systems",
            "Hamiltonian Monte Carlo with automatic trajectory length",
            "High-dimensional continuous inference in hierarchical models",
        ],
        references: [
            "Hoffman and Gelman, The No-U-Turn Sampler, 2011",
            "Neal, MCMC Using Hamiltonian Dynamics, Handbook of Markov Chain Monte Carlo, 2011",
        ],
        workedExample:
            "From a starting position of 0.5 in a standard normal, NUTS draws a random momentum, sets a slice just below the starting energy, and doubles a trajectory of leapfrog steps. When the phase-space path reaches its furthest extent and the two ends begin moving inward, the U-turn test fires and the final state is drawn uniformly from the accepted points.",
    },
    id: "nuts-sampler",
    name: "No-U-Turn Sampler (NUTS)",
    category: "statistics-probability",
    complexity: { time: "O(2^depth)", space: "O(2^depth)" },
    defaultInput: { mean: 0, sigma: 1, q0: 0.5, stepSize: 0.4, maxDepth: 4, iterations: 1, seed: 7 },
    visualType: "point",
    run,
    pseudocode: [
        "read the target, starting point, step size, and seed",
        "draw a momentum and set a slice below the current energy",
        "leapfrog the position and momentum by one step",
        "keep the state when its log weight clears the slice",
        "double the trajectory tree until a U-turn appears",
        "draw the next state from the accepted points",
        "done: report the trajectory and sampled states",
    ],
};

export default module;
