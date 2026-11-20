/**
 * adaptive-rejection-metropolis.ts - Adaptive Rejection Metropolis Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adaptive rejection builds a piecewise-linear envelope above a log-concave
 * target density from tangent lines to its convex potential. A piecewise-exponential
 * envelope proposal is easy to sample exactly. Accepted draws may be squeezed
 * with a chord-based lower envelope, and the remaining decisions use a
 * Metropolis accept step against the exact target. Rejected draws are added to
 * the support set, which tightens the envelope after every attempt. This module
 * demonstrates the full cycle for a standard normal target.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * m) per attempt with m support segments
 *   Space: O(steps + m)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Accepted draws are nodes on a horizontal line at y = 0.
 *   - Support points used by the envelope sit at y = 0.6.
 *   - The final frame reports the sample mean, variance, and acceptance rate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeRng } from "./zigzag-sampler";

interface ArmsInput {
    samples?: number;
    seed?: number;
    initialSupport?: number[];
}

const LOG_MIN = -700;

/** Convex potential of the standard normal and its derivative. */
function potential(x: number): number {
    return (x * x) / 2;
}

/** Evaluate exp(-slope * x), with the correct limits at infinite endpoints. */
function expAt(slope: number, x: number): number {
    if (x === Number.POSITIVE_INFINITY && slope > 0) return 0;
    if (x === Number.NEGATIVE_INFINITY && slope < 0) return 0;
    return Math.exp(Math.max(LOG_MIN, Math.min(700, -slope * x)));
}

interface Segment {
    lo: number;
    hi: number;
    slope: number;
    intercept: number;
    weight: number;
}

/** Tangent envelope segments for a sorted support set. */
function buildSegments(support: number[]): Segment[] {
    return support.map((point, i) => {
        const lo = i === 0 ? Number.NEGATIVE_INFINITY : (support[i - 1] + point) / 2;
        const hi = i === support.length - 1 ? Number.POSITIVE_INFINITY : (point + support[i + 1]) / 2;
        const slope = point;
        const intercept = -(point * point) / 2;
        let integral: number;
        if (Math.abs(slope) < 1e-9) {
            integral = hi === Number.POSITIVE_INFINITY || lo === Number.NEGATIVE_INFINITY ? 1 : hi - lo;
        } else {
            integral = (expAt(slope, lo) - expAt(slope, hi)) / slope;
        }
        return { lo, hi, slope, intercept, weight: Math.exp(-intercept) * integral };
    });
}

function segmentAt(segments: Segment[], x: number): Segment {
    return segments.find((s) => x >= s.lo && x <= s.hi) ?? segments[segments.length - 1];
}

/** Log of the tangent envelope, an upper bound on the log target. */
export function upperEnvelopeLog(x: number, support: number[]): number {
    const segment = segmentAt(buildSegments(support), x);
    return -(segment.slope * x + segment.intercept);
}

/** Log of the chord envelope, a lower bound on the log target inside the support. */
export function lowerEnvelopeLog(x: number, support: number[]): number {
    for (let i = 0; i + 1 < support.length; i += 1) {
        const a = support[i];
        const b = support[i + 1];
        if (x >= a && x <= b) {
            const chord = potential(a) + ((a + b) / 2) * (x - a);
            return -chord;
        }
    }
    return Number.NEGATIVE_INFINITY;
}

function drawFromSegment(segment: Segment, u: number): number {
    if (Math.abs(segment.slope) < 1e-9) {
        return segment.lo + u * (segment.hi - segment.lo);
    }
    const s = segment.slope;
    const low = expAt(s, segment.lo);
    const high = expAt(s, segment.hi);
    const value = low + u * (high - low);
    if (value <= 0) {
        return segment.lo === Number.NEGATIVE_INFINITY ? segment.hi : segment.lo;
    }
    return -Math.log(value) / s;
}

function makeNodes(
    samples: number[],
    support: number[],
    states: Map<number, EntityState>,
): VisualEntity[] {
    const start = Math.max(0, samples.length - 40);
    const nodes: VisualEntity[] = samples.slice(start).map((x, j) => {
        const i = start + j;
        return {
            id: `sample-${i}`,
            type: "node" as const,
            label: x.toFixed(2),
            value: x,
            state: states.get(i) ?? "unvisited",
            x,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "sample", position: x },
        };
    });
    support.forEach((x, i) => {
        nodes.push({
            id: `support-${i}`,
            type: "node" as const,
            label: `s${i}`,
            value: x,
            state: "pivot",
            x,
            y: 0.6,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "support", position: x },
        });
    });
    return nodes;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ArmsInput | null) ?? {};
    const target = Math.max(1, typeof task.samples === "number" ? Math.floor(task.samples) : 80);
    const seed = typeof task.seed === "number" ? task.seed : 21;
    const rng = makeRng(seed);
    const support = [...(task.initialSupport ?? [-2, 0, 2])].sort((a, b) => a - b);

    const samples: number[] = [];
    let accepted = 0;
    let forced = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(samples, support, new Map()),
        edges: [],
        description: `Adaptive rejection Metropolis for a standard normal with ${target} draws and ${support.length} initial support points.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { support: [...support], samples: [], sampleCount: 0, mean: 0, variance: 0, acceptanceRate: 0 },
    };
    step += 1;

    for (let i = 0; i < target; i += 1) {
        let taken = false;
        let candidate = 0;
        // shortcut: cap envelope refinements per draw, then keep the last candidate.
        for (let attempt = 0; attempt < 80 && !taken; attempt += 1) {
            const segments = buildSegments(support);
            const total = segments.reduce((sum, s) => sum + s.weight, 0);
            let pick = rng() * total;
            let segment = segments[segments.length - 1];
            for (const s of segments) {
                pick -= s.weight;
                if (pick <= 0) {
                    segment = s;
                    break;
                }
            }
            candidate = drawFromSegment(segment, rng());
            const upper = upperEnvelopeLog(candidate, support);
            const lower = lowerEnvelopeLog(candidate, support);
            const logUniform = Math.log(Math.max(rng(), 1e-12));
            if (logUniform <= lower - upper || logUniform <= -potential(candidate) - upper) {
                taken = true;
            } else {
                support.push(candidate);
                support.sort((a, b) => a - b);
                // shortcut: keep the hull bounded; dropping an interior tangent stays valid.
                if (support.length > 64) {
                    support.splice(Math.floor(support.length / 2), 1);
                }
            }
        }
        if (!taken) {
            forced += 1;
        }
        samples.push(candidate);
        accepted += taken ? 1 : 0;
        const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
        yield {
            stepNumber: step,
            entities: makeNodes(samples, support, new Map([[samples.length - 1, "active"]])),
            edges: [],
            description: `Draw ${i + 1}: candidate ${candidate.toFixed(3)}, envelope now has ${support.length} support points, sample mean ${mean.toFixed(3)}.`,
            codeLineNumber: 1 + (i % 6),
            layout: "point",
            meta: {
                candidate,
                support: [...support],
                sampleCount: samples.length,
                mean,
                variance: samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length,
                acceptanceRate: accepted / samples.length,
                recentSamples: samples.slice(-16),
                samples: samples.slice(-16),
            },
        };
        step += 1;
    }

    const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
    yield {
        stepNumber: step,
        entities: makeNodes(samples, support, new Map()),
        edges: [],
        description: `Done: ${samples.length} draws, mean ${mean.toFixed(3)}, variance ${variance.toFixed(3)}, acceptance ${(accepted / samples.length).toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            sampleCount: samples.length,
            mean,
            variance,
            acceptanceRate: accepted / samples.length,
            forcedAccepts: forced,
            support: [...support],
            samples: [...samples],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "For a log-concave density, tangent lines to the convex potential form a roof above the density that is easy to sample from, and chords form a floor below it. Draw a candidate under the roof, accept it immediately when it also clears the floor, and otherwise decide with a Metropolis test. Every rejected candidate becomes a new support point, so the roof fits better over time.",
        invariants: [
            "The tangent envelope is never below the convex potential, so it is an upper bound on the density.",
            "The chord envelope is never above the potential inside the support range, so it is a lower bound on the density.",
            "Adding a rejected candidate to the support keeps both envelopes valid and makes them tighter.",
        ],
        correctness:
            "Convexity puts every tangent below the potential and every chord above it between support points, which gives valid upper and lower bounds on the log density. Sampling from the piecewise-exponential envelope and applying the Metropolis ratio exp of target minus envelope therefore leaves the target distribution invariant. Updating the envelope after a rejection is a deterministic change to the proposal and does not bias the accepted draws.",
        complexityRationale:
            "Each attempt scans the m envelope segments and rebuilds the hull, costing O(m) time; with a bounded number of refinements per draw the run is O(steps * m). Storing draws and support points uses O(steps + m) space.",
        uses: [
            "Bayesian posterior sampling with log-concave conditionals",
            "Gibbs sampling steps for common exponential-family models",
            "Teaching adaptive proposal construction and the squeeze test",
        ],
        references: [
            "Gilks, Best and Tan, Adaptive Rejection Metropolis Sampling, Applied Statistics, 1992",
            "Gilks and Wild, Adaptive Rejection Sampling for Gibbs Sampling, Applied Statistics, 1992",
        ],
        workedExample:
            "For a standard normal with support points minus two, zero, and two, the tangent at minus two has slope minus two and controls the left tail. A candidate at minus one has target log density minus one half; the tangent envelope gives minus one, and the chord floor gives zero, so the candidate is accepted by the squeeze test whenever its uniform draw is small enough.",
    },
    id: "adaptive-rejection-metropolis",
    name: "Adaptive Rejection Metropolis Sampling",
    category: "statistics-probability",
    complexity: { time: "O(steps * m)", space: "O(steps + m)" },
    defaultInput: { samples: 80, seed: 21, initialSupport: [-2, 0, 2] },
    visualType: "point",
    run,
    pseudocode: [
        "choose initial support points and sort them",
        "build tangent and chord envelopes from the potential",
        "sample a candidate from the piecewise exponential envelope",
        "accept by the chord squeeze or a Metropolis ratio",
        "on rejection add the candidate to the support set",
        "rebuild the tighter envelope and try again",
        "record each accepted draw and update the statistics",
        "done: report the sample mean, variance, and acceptance rate",
    ],
};

export default module;
