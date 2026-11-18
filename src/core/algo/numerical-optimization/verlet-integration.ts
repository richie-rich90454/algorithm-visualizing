/**
 * verlet-integration.ts - Velocity Verlet Integration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Velocity Verlet integrates Newton's equations of motion with a symplectic,
 * time-reversible scheme. It advances position using the current velocity and
 * acceleration, computes the new acceleration from the new position, and then
 * updates velocity with the average of the old and new accelerations. Because
 * it is symplectic it conserves a nearby "shadow" Hamiltonian, so energy
 * oscillates but does not drift for conservative forces.
 *
 * This module integrates a one-dimensional harmonic oscillator with unit mass,
 * where acceleration is -k*x. The closed-form solution x = A*cos(omega*t + phi)
 * provides an exact reference for verification.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) with O(1) work per step
 *   Space: O(steps) for the recorded trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per time step shows the particle's position.
 *   - The newest position is yellow; the completed trajectory is green.
 *   - Energy and energy drift are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface VerletStep {
    t: number;
    x: number;
    v: number;
    acceleration: number;
    energy: number;
}

export interface VerletResult {
    steps: VerletStep[];
    energyDrift: number;
}

/** Integrate a unit-mass harmonic oscillator with velocity Verlet. */
export function velocityVerlet(
    x0: number,
    v0: number,
    k: number,
    dt: number,
    stepCount: number,
): VerletResult {
    const steps: VerletStep[] = [];
    let x = x0;
    let v = v0;
    let a = -k * x;
    const energy = (pos: number, vel: number): number => 0.5 * vel * vel + 0.5 * k * pos * pos;
    const firstEnergy = energy(x, v);
    for (let n = 0; n < stepCount; n += 1) {
        const t = n * dt;
        steps.push({ t, x, v, acceleration: a, energy: energy(x, v) });
        x = x + v * dt + 0.5 * a * dt * dt;
        const newAcceleration = -k * x;
        v = v + 0.5 * (a + newAcceleration) * dt;
        a = newAcceleration;
    }
    const finalEnergy = energy(x, v);
    return { steps, energyDrift: Math.abs(finalEnergy - firstEnergy) };
}

/** Exact closed-form position of the harmonic oscillator. */
export function analyticOscillator(x0: number, v0: number, k: number, t: number): number {
    const omega = Math.sqrt(k);
    return x0 * Math.cos(omega * t) + (v0 / omega) * Math.sin(omega * t);
}

/** Bars for the position trajectory. */
function makeBars(steps: VerletStep[], active: boolean, done: boolean): VisualEntity[] {
    return steps.map((step, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: step.x.toFixed(4),
        value: step.x,
        state: done
            ? "sorted"
            : active && index === steps.length - 1
              ? "comparing"
              : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, time: step.t, position: step.x, velocity: step.v },
    }));
}

/** The velocity Verlet generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { x0?: number; v0?: number; k?: number; dt?: number; steps?: number } | null
    ) ?? {};
    const x0 = typeof task.x0 === "number" ? task.x0 : 1;
    const v0 = typeof task.v0 === "number" ? task.v0 : 0;
    const k = typeof task.k === "number" && task.k > 0 ? task.k : 1;
    const dt = typeof task.dt === "number" && task.dt > 0 ? task.dt : 0.1;
    const stepCount = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 40;
    const result = velocityVerlet(x0, v0, k, dt, stepCount);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(result.steps.slice(0, 1), false, false),
        edges: [],
        description: `Integrating a harmonic oscillator with k = ${k}, dt = ${dt}, for ${stepCount} step(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, dt, steps: 0, energy: result.steps[0]?.energy ?? 0, drift: 0 },
    };

    for (let i = 1; i < result.steps.length; i += 1) {
        const current = result.steps[i]!;
        yield {
            stepNumber: step++,
            entities: makeBars(result.steps.slice(0, i + 1), true, false),
            edges: [],
            description: `Step ${i}: t = ${current.t.toFixed(2)}, x = ${current.x.toFixed(6)}, v = ${current.v.toFixed(6)}, energy = ${current.energy.toFixed(6)}.`,
            codeLineNumber: i === 1 ? 1 : 3,
            layout: "array",
            meta: {
                k,
                dt,
                steps: i,
                time: current.t,
                position: current.x,
                velocity: current.v,
                energy: current.energy,
                drift: result.energyDrift,
            },
        };
    }

    const last = result.steps[result.steps.length - 1]!;
    yield {
        stepNumber: step,
        entities: makeBars(result.steps, false, true),
        edges: [],
        description: `Integration complete: final x = ${last.x.toFixed(6)}, energy drift ${result.energyDrift.toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            k,
            dt,
            steps: stepCount,
            position: last.x,
            velocity: last.v,
            energy: last.energy,
            drift: result.energyDrift,
        },
    };
}

/** The velocity Verlet module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Predict where the particle goes using its current speed and a half step of its current acceleration. Recompute the force at that new place, then finish the velocity update with the average of the old and new accelerations. This symmetric arrangement is what makes the method stable over long runs instead of slowly gaining or losing energy.",
        invariants: [
            "Position advances by v*dt plus one half of a*dt squared.",
            "Velocity advances by the average of the old and new accelerations times dt.",
            "For a conservative force the total energy stays close to its initial value without secular drift.",
        ],
        correctness:
            "Expanding the update in powers of dt shows that position and velocity agree with the Taylor solutions through order dt squared and dt respectively, so the method is second-order accurate. The map is symplectic because it is a composition of exact kicks and drifts, which keeps the numerical trajectory on a perturbed Hamiltonian close to the true one; for the harmonic oscillator the exact discrete solution tracks the closed form x = x0 cos(omega t) + (v0/omega) sin(omega t) with error O(dt^2), and energy remains bounded.",
        complexityRationale:
            "Each step does a constant number of arithmetic operations, so the whole trajectory costs O(steps). Recording the position, velocity, and energy at every step uses O(steps) space.",
        uses: [
            "Molecular dynamics simulations of particles and materials",
            "Game and robotics physics engines needing stable long runs",
            "Celestial-mechanics and orbital integration",
        ],
        references: [
            "Verlet, Computer Experiments on Classical Fluids, Physical Review, 1967",
            "Hairer, Lubich, and Wanner, Geometric Numerical Integration, Chapter 1",
        ],
        workedExample:
            "For x0 = 1, v0 = 0, k = 1, and dt = 0.1, the first step gives x = 0.995 and v = -0.0998. After 40 steps the position is near cos(4) and the total energy stays within a few ten-thousandths of its initial value of 0.5.",
    },
    id: "verlet-integration",
    name: "Velocity Verlet Integration",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { x0: 1, v0: 0, k: 1, dt: 0.1, steps: 40 },
    visualType: "array",
    run,
    pseudocode: [
        "set the initial position, velocity, and acceleration",
        "record the initial energy of the system",
        "advance position by v times dt plus half a times dt squared",
        "compute the new acceleration from the new position",
        "advance velocity by the average acceleration times dt",
        "record position, velocity, and energy for this step",
        "repeat until the requested number of steps is reached",
        "done: report the trajectory and the energy drift",
    ],
};

export default module;
