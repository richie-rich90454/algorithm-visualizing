/**
 * symplectic-integrator.ts - Symplectic Euler for a Harmonic Oscillator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A symplectic integrator advances a Hamiltonian system while preserving the
 * geometry of phase space: the map has determinant one, so areas in (q, p) are
 * conserved. Symplectic (semi-implicit) Euler updates momentum with the old
 * position and then position with the new momentum. For the harmonic oscillator
 * H = p^2/2 + k q^2/2 the energy wiggles but stays bounded instead of drifting.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S) for S integration steps
 *   Space: O(S) for the stored phase-space trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points trace the orbit in phase space; edges connect successive points.
 *   - The newest point is active and the completed orbit is green.
 *   - Metadata reports energy, energy drift, and the current (q, p).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface SymplecticInput {
    q0?: number;
    p0?: number;
    dt?: number;
    steps?: number;
    omega?: number;
}

function makeEntities(path: Array<{ q: number; p: number }>, done: boolean): VisualEntity[] {
    return path.map((point, index) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (index === path.length - 1) state = "active";
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: `(${point.q.toFixed(2)}, ${point.p.toFixed(2)})`,
            value: [point.q, point.p],
            state,
            x: point.q,
            y: point.p,
            width: 0,
            height: 0,
            metadata: { index, step: index, q: point.q, p: point.p },
        };
    });
}

function makeEdges(pathLength: number): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 1; i < pathLength; i += 1) {
        edges.push({
            id: `edge-${i - 1}-${i}`,
            sourceId: `point-${i - 1}`,
            targetId: `point-${i}`,
            label: "",
            state: "path",
            directed: true,
        });
    }
    return edges;
}

/** The symplectic Euler generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SymplecticInput | null) ?? {};
    const dt = Math.max(1e-6, Number(task.dt ?? 0.05));
    const steps = Math.min(2000, Math.max(1, Math.floor(Number(task.steps ?? 200)) || 200));
    const omega = Math.max(0.01, Number(task.omega ?? 1));
    const k = omega * omega;
    let q = Number(task.q0 ?? 1);
    let p = Number(task.p0 ?? 0);
    if (!Number.isFinite(q)) q = 1;
    if (!Number.isFinite(p)) p = 0;
    const energy = (qq: number, pp: number) => 0.5 * pp * pp + 0.5 * k * qq * qq;
    const h0 = energy(q, p);
    const path = [{ q, p }];
    let maxDrift = 0;

    yield {
        stepNumber: 0,
        entities: makeEntities(path, false),
        edges: makeEdges(path.length),
        description: `Harmonic oscillator with k = ${k.toFixed(3)}; starting at (q, p) = (${q}, ${p}) with energy ${h0.toFixed(6)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { q, p, energy: h0, drift: 0, maxDrift: 0, step: 0, dt, steps, k },
    };

    for (let n = 1; n <= steps; n += 1) {
        // Kick with the old position, then drift with the updated momentum.
        p = p - dt * k * q;
        q = q + dt * p;
        const h = energy(q, p);
        maxDrift = Math.max(maxDrift, Math.abs(h - h0));
        path.push({ q, p });
        yield {
            stepNumber: n,
            entities: makeEntities(path, false),
            edges: makeEdges(path.length),
            description: `Step ${n}: updated momentum then position; energy ${h.toFixed(6)}, drift ${(h - h0).toExponential(2)}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { q, p, energy: h, drift: h - h0, maxDrift, step: n, dt, steps, k },
        };
    }

    yield {
        stepNumber: steps + 1,
        entities: makeEntities(path, true),
        edges: makeEdges(path.length),
        description: `Integrated ${steps} steps; peak energy drift ${maxDrift.toExponential(2)} while phase-space area stays conserved.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { q, p, energy: energy(q, p), drift: energy(q, p) - h0, maxDrift, step: steps, dt, steps, k, done: true },
    };
}

/** The symplectic integrator module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Hamiltonian systems have a special geometry: the flow preserves areas in the position-momentum plane. Ordinary Euler steps ignore that geometry and let energy drift away. Symplectic Euler splits the update into a momentum kick using the old position and a position drift using the new momentum, and that single ordering keeps the map area-preserving and the energy bounded.",
        invariants: [
            "The map (q, p) to (q', p') has Jacobian determinant exactly one.",
            "Each kick uses the current position; each drift uses the updated momentum.",
            "For the oscillator, energy stays close to its initial value rather than growing without bound.",
        ],
        correctness:
            "Writing the update in matrix form gives [[1 - dt^2 k, dt], [-dt k, 1]], whose determinant is one, so the scheme is symplectic and cannot systematically shrink or expand phase-space area. For the harmonic oscillator the update is the exact flow of a nearby modified Hamiltonian, so the true energy oscillates within an O(dt) band instead of drifting, unlike explicit Euler whose energy grows each period.",
        complexityRationale:
            "Each step is a constant number of arithmetic operations, so S steps take O(S) time. Keeping the whole orbit for display uses O(S) space; a streaming integrator would need only O(1).",
        uses: [
            "Long-time molecular-dynamics and celestial-mechanics simulations",
            "Beam physics and accelerator tracking",
            "Any simulation where energy must stay stable over many periods",
        ],
        references: [
            "Hairer, Lubich, and Wanner, Geometric Numerical Integration, Chapter 1",
            "Leimkuhler and Reich, Simulating Hamiltonian Dynamics, Chapter 4",
        ],
        workedExample:
            "From (q, p) = (1, 0) with dt = 0.1 and k = 1, the first kick gives p = -0.1 and the drift gives q = 0.99. The new energy is 0.4951, close to the initial 0.5; over many steps it oscillates in a narrow band instead of growing, and the orbit traces a nearly closed loop.",
    },
    id: "symplectic-integrator",
    name: "Symplectic Integrator",
    category: "numerical-optimization",
    complexity: { time: "O(S)", space: "O(S)" },
    defaultInput: { q0: 1, p0: 0, dt: 0.05, steps: 200, omega: 1 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a step size and the initial (q, p)",
        "compute the force from the current position",
        "update momentum with the force times the step size",
        "update position with the new momentum times the step size",
        "record the point and repeat for all steps",
        "done: report the trajectory and energy drift",
    ],
};

export default module;
