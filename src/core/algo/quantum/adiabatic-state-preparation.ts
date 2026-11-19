/**
 * adiabatic-state-preparation.ts - Adiabatic State Preparation (one qubit)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adiabatic state preparation starts a system in the ground state of a simple
 * Hamiltonian and slowly deforms it into a Hamiltonian whose ground state is
 * the target. If the change is slow compared with the inverse spectral gap,
 * the adiabatic theorem keeps the system in the instantaneous ground state.
 * This module interpolates a single qubit from H(0) = Z to H(1) = X and
 * integrates the Schrodinger equation exactly in small constant-Hamiltonian
 * pieces, watching the ground-state overlap grow.
 *
 * Limits: exact two-dimensional simulation of one qubit, diagonal-free real
 * Hamiltonians in the X-Z plane, no noise or decoherence, and a linear schedule.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) for the simulated evolution
 *   Space: O(snapshots) for the recorded overlap curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show ground-state probability at evenly spaced points in the sweep.
 *   - The newest snapshot is gold; completed ones are green.
 *   - meta carries the curve, the final overlap, and schedule parameters.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

function cScale(value: Complex, factor: number): Complex {
    return [value[0] * factor, value[1] * factor];
}
function cAdd(left: Complex, right: Complex): Complex {
    return [left[0] + right[0], left[1] + right[1]];
}
function cAbs2(value: Complex): number {
    return value[0] * value[0] + value[1] * value[1];
}
function cConj(value: Complex): Complex {
    return [value[0], -value[1]];
}
function cMul(left: Complex, right: Complex): Complex {
    return [left[0] * right[0] - left[1] * right[1], left[0] * right[1] + left[1] * right[0]];
}

/** Ground eigenstate of H(s) = (1-s) Z + s X (real vector, negative eigenvalue). */
function groundState(s: number): [Complex, Complex] {
    const vx = s;
    const vz = 1 - s;
    const norm = Math.hypot(vx, vz);
    if (norm < 1e-14) return [[0, 0], [1, 0]];
    const a = vx;
    const b = -vz - norm;
    const length = Math.hypot(a, b);
    if (length < 1e-14) return [[0, 0], [1, 0]];
    return [
        [a / length, 0],
        [b / length, 0],
    ];
}

/** Apply exp(-i H dt) for fixed H = vx X + vz Z using the closed-form 2x2 exponential. */
function evolve(
    a: Complex,
    b: Complex,
    vx: number,
    vz: number,
    dt: number,
): [Complex, Complex] {
    const norm = Math.hypot(vx, vz);
    if (norm < 1e-14) return [a, b];
    const cosine = Math.cos(norm * dt);
    const sine = Math.sin(norm * dt) / norm;
    const combo0 = cAdd(cScale(b, vx), cScale(a, vz));
    const combo1 = cAdd(cScale(a, vx), cScale(b, -vz));
    const negI0: Complex = [combo0[1], -combo0[0]];
    const negI1: Complex = [combo1[1], -combo1[0]];
    return [
        cAdd(cScale(a, cosine), cScale(negI0, sine)),
        cAdd(cScale(b, cosine), cScale(negI1, sine)),
    ];
}

/** Ground-state probability of a state relative to the eigenstate at s. */
function groundProbability(
    a: Complex,
    b: Complex,
    s: number,
): number {
    const [g0, g1] = groundState(s);
    const overlap = cAdd(cMul(g0, cConj(a)), cMul(g1, cConj(b)));
    return cAbs2(overlap);
}

function makeBars(curve: number[], current: number, done: boolean): VisualEntity[] {
    return curve.map((value, index) => {
        let state: EntityState = "idle";
        if (index === current) {
            state = "comparing";
        } else if (done || index < current) {
            state = "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, progress: index / Math.max(1, curve.length - 1) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { steps?: number; totalTime?: number } | null) ?? {};
    const steps = Math.max(4, Math.min(2000, Math.floor(Number(task.steps ?? 120)) || 120));
    const totalTime = Math.max(0.1, Math.min(200, Number(task.totalTime ?? 20) || 20));
    const dt = totalTime / steps;
    const snapshots = 12;

    let [a, b] = groundState(0);
    const curve = Array.from({ length: snapshots }, () => 0);
    const sampleSteps = Array.from({ length: snapshots }, (_, k) =>
        Math.round((k * (steps - 1)) / (snapshots - 1)),
    );
    const sampleSet = new Set(sampleSteps);

    const metaFor = (phase: string, current: number) => ({
        phase,
        steps,
        totalTime,
        dt,
        snapshots,
        groundProbs: curve.slice(),
        finalGroundProb: curve[snapshots - 1] ?? 0,
        targetOverlap: groundProbability(a, b, 1),
        current,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(curve, -1, false),
        edges: [],
        description: `Begin in the ground state of H(0) = Z and sweep to H(1) = X over ${steps} steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor("setup", -1),
    };
    step += 1;

    for (let k = 0; k < steps; k += 1) {
        const s = steps > 1 ? k / (steps - 1) : 1;
        if (sampleSet.has(k)) {
            const index = sampleSteps.indexOf(k);
            if (index >= 0) curve[index] = groundProbability(a, b, s);
        }
        [a, b] = evolve(a, b, s, 1 - s, dt);

        if (sampleSet.has(k)) {
            const index = sampleSteps.indexOf(k);
            yield {
                stepNumber: step,
                entities: makeBars(curve, index, false),
                edges: [],
                description: `At s = ${s.toFixed(3)} the instantaneous ground-state probability is ${(curve[index] ?? 0).toFixed(4)}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: metaFor("sweep", index),
            };
            step += 1;
        }
    }

    const finalProb = groundProbability(a, b, 1);
    curve[snapshots - 1] = finalProb;
    yield {
        stepNumber: step,
        entities: makeBars(curve, -1, true),
        edges: [],
        description: `Sweep complete: final target-ground overlap is ${finalProb.toFixed(4)}${finalProb > 0.9 ? ", so evolution stayed adiabatic" : ", so some excitation occurred"}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor("complete", -1),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you change a quantum system gently enough, it stays in the ground state of whatever Hamiltonian is currently in front of it. Start with a Hamiltonian whose ground state is easy to prepare, then slowly morph it into one whose ground state encodes the answer. A fast change kicks the system into excited states; a slow change keeps it tracking the moving ground state.",
        invariants: [
            "Sixteen amplitudes stay normalized because each small step is an exact unitary evolution.",
            "At s = 0 the initial state is already the ground state of Z.",
            "The spectral gap never vanishes during the linear interpolation between Z and X.",
        ],
        correctness:
            "For H(s) = (1-s) Z + s X the eigenvalues are plus and minus the norm of the coefficient vector, so the gap is two times that norm and stays positive on the whole schedule. The adiabatic theorem then bounds the transition probability by terms proportional to the sweep rate divided by the gap squared. Integrating exp(-i H dt) in small pieces uses the exact closed form for a Pauli-channel Hamiltonian, so the simulated state is the true continuous evolution up to the small time-step discretization, and its overlap with the final ground state approaches one as the total time grows.",
        complexityRationale:
            "There are O(steps) constant-time two-component updates, and O(snapshots) values are kept for the visualization, so the time is O(steps) and space O(snapshots).",
        uses: [
            "Preparing ground states in adiabatic quantum optimization",
            "State initialization for quantum annealers",
            "A teaching model for the adiabatic theorem and spectral gaps",
        ],
        references: [
            "Farhi, Goldstone, and Gutmann, A Quantum Adiabatic Evolution Algorithm, 2000",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "Start in the ground state of Z, which is the spin-down state. Slowly rotate the Hamiltonian toward X over a long sweep. The ground state rotates into the symmetric-minus state; with a long total time the final overlap exceeds 0.99, while a very short sweep leaves substantial probability in the excited state.",
    },
    id: "adiabatic-state-preparation",
    name: "Adiabatic State Preparation",
    category: "quantum",
    complexity: { time: "O(steps)", space: "O(snapshots)" },
    defaultInput: { steps: 120, totalTime: 20 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the qubit in the ground state of the starting Hamiltonian",
        "divide the total time into small steps",
        "for each step set s from zero to one along the schedule",
        "evolve exactly under the instantaneous Hamiltonian for one time step",
        "record the ground-state overlap at sampled points",
        "compare the final state with the target ground state",
        "done: report the adiabaticity curve and final overlap",
    ],
};

export default module;
