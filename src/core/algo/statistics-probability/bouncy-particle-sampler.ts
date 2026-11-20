/**
 * bouncy-particle-sampler.ts - Bouncy Particle Sampler (1D Gaussian)
 *
 * The bouncy particle sampler is a continuous-time non-reversible Markov chain.
 * A particle moves at fixed speed along a straight line until an event, at
 * which point its velocity is reflected. For a standard normal target the
 * event rate is the positive part of v times x, and the first event time is
 * found in closed form by inverting the cumulative hazard.
 *
 * Time: O(steps). Space: O(steps).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Bounce rate for velocity v at position x under a standard normal target. */
export function bounceRate(x: number, v: number): number {
  return Math.max(0, v * x);
}

/** Inverse-CDF event time for cumulative hazard with initial rate a = v*x. */
export function eventTime(a: number, uniform: number): number {
  const e = -Math.log(Math.max(1e-15, Math.min(1, uniform)));
  if (a >= 0) return -a + Math.sqrt(a * a + 2 * e);
  return -a + Math.sqrt(2 * e);
}

export interface BpsStep {
  tau: number;
  newX: number;
  newV: number;
}

/** Move the particle to its next bounce and reflect its velocity. */
export function bpsStep(x: number, v: number, uniform: number): BpsStep {
  const tau = eventTime(v * x, uniform);
  return { tau, newX: x + v * tau, newV: -v };
}

export interface BpsState {
  x: number;
  v: number;
  tau: number;
}

/** Run a deterministic seeded bounce trajectory. */
export function bpsTrajectory(steps: number, x0: number, v0: number, seed: number): BpsState[] {
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const trajectory: BpsState[] = [];
  let x = x0;
  let v = v0 >= 0 ? 1 : -1;
  for (let i = 0; i < steps; i += 1) {
    const next = bpsStep(x, v, random());
    x = next.newX;
    v = next.newV;
    trajectory.push({ x, v, tau: next.tau });
  }
  return trajectory;
}

function bars(values: number[], active: number): VisualEntity[] {
  return values.map((value, i) => ({
    id: `bounce-${i}`,
    type: "bar" as const,
    label: `b${i}: x=${value.toFixed(2)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { bounce: i, position: value },
  }));
}

/** Numerical cumulative hazard used by the test to verify eventTime. */
export function cumulativeHazard(a: number, tau: number): number {
  const slices = 2000;
  let total = 0;
  for (let i = 0; i <= slices; i += 1) {
    const t = (i / slices) * tau;
    const w = i === 0 || i === slices ? 0.5 : 1;
    total += w * Math.max(0, a + t);
  }
  return (total * tau) / slices;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { steps?: number; x0?: number; v0?: number; seed?: number } | null) ?? {};
  const steps = Math.max(4, Math.min(200, Math.floor(Number(task.steps ?? 30)) || 30));
  const x0 = Number.isFinite(Number(task.x0)) ? Number(task.x0) : 0.5;
  const v0 = Number.isFinite(Number(task.v0)) ? Number(task.v0) : 1;
  const seed = Math.floor(Number(task.seed ?? 31)) || 31;

  const trajectory = bpsTrajectory(steps, x0, v0, seed);
  const positions = trajectory.map((state) => state.x);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(positions, -1),
    edges: [],
    description: `Bouncy particle sampler with ${steps} bounces starting at x=${x0}, velocity ${v0}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { steps, x0, v0, seed },
  };
  index += 1;

  const shown = Math.min(steps, 12);
  for (let i = 0; i < shown; i += 1) {
    const state = trajectory[i] as BpsState;
    yield {
      stepNumber: index,
      entities: bars(positions, i),
      edges: [],
      description: `Bounce ${i}: waited ${state.tau.toFixed(3)}, arrived at x=${state.x.toFixed(3)}, reflected to velocity ${state.v}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { bounce: i, x: state.x, v: state.v, tau: state.tau, rate: bounceRate(state.x, state.v) },
    };
    index += 1;
  }

  const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
  yield {
    stepNumber: index,
    entities: bars(positions, steps - 1),
    edges: [],
    description: `Completed ${steps} bounces; trajectory average position ${mean.toFixed(4)} near the target mean zero.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { mean, positions, bounces: steps, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Imagine a particle gliding at constant speed through a landscape and bouncing off invisible walls wherever the target density is steep. Between bounces the path is a straight line, so no acceptance test is needed. The bounce rate depends on how quickly the potential rises in the direction of travel; for a Gaussian target the rate is the positive part of velocity times position.",
    invariants: [
      "The speed magnitude stays one; only the direction flips at an event.",
      "The bounce rate is the positive part of v times x.",
      "The event time inverts the cumulative hazard exactly.",
    ],
    correctness:
      "For a piecewise-deterministic Markov process the event intensity is lambda(x,v) = max(0, grad U dot v) plus a refreshment term. Along a straight flight x(t) = x + v t the rate is max(0, a + t) with a = v x, whose integral is a quadratic. Inverting that cumulative hazard by the quadratic formula gives an exact first event time, and reflecting the velocity preserves the skew-detailed-balance condition that leaves the Gaussian target invariant.",
    complexityRationale:
      "Each bounce needs one logarithm, one square root and a few arithmetic operations, so a trajectory of B bounces costs O(B) time and O(B) space for the displayed positions.",
    uses: [
      "Sampling continuous distributions without rejections",
      "Markov chain Monte Carlo with non-reversible dynamics",
      "Physics-informed simulation of piecewise-determinial processes",
    ],
    references: [
      "Peters and Withers, The Bouncy Particle Sampler, 2017",
      "Bierkens and Fearnhead, Stochastic Processes with Piecewise Deterministic Dynamics, 2017",
    ],
    workedExample:
      "Starting at x = 0.5 with velocity +1, the initial rate is 0.5. For a uniform draw of 0.2 the exponential variate is about 1.609 and the event time is minus 0.5 plus the square root of 0.25 plus 3.219, about 1.612. The particle reaches x about 2.112 and its velocity flips to -1.",
  },
  id: "bouncy-particle-sampler",
  name: "Bouncy Particle Sampler",
  category: "statistics-probability",
  complexity: { time: "O(bounces)", space: "O(bounces)" },
  defaultInput: { steps: 30, x0: 0.5, v0: 1, seed: 31 },
  visualType: "array",
  run,
  pseudocode: [
    "input starting position, velocity, and bounce count",
    "set the current bounce rate to max(0, v times x)",
    "draw a uniform variate and form the exponential E = -ln(u)",
    "solve the cumulative hazard for the event time tau",
    "move to x + v tau and reflect the velocity",
    "record the new position and repeat",
    "done: report the trajectory and its average position",
  ],
};

export default module;
