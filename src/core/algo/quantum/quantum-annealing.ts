/**
 * quantum-annealing.ts - First-Order Trotterized Quantum Annealing on an Ising Chain
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum annealing starts in the ground state of a transverse-field Hamiltonian
 * H0 = -sum of X on each qubit, then slowly transforms to a problem Hamiltonian
 * H1 whose diagonal energies encode an Ising optimization problem. The adiabatic
 * theorem keeps the system near the ground state, so a final measurement tends
 * to land on the best classical solution.
 *
 * This module simulates the schedule with a first-order Trotter split: each step
 * applies the exact transverse-field rotation and the exact diagonal phase for
 * that step's schedule weights. It is an ideal, small simulation (up to four
 * qubits), not a physical annealer and not a higher-order Trotter or open-system
 * model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S * n * 2^n) for S steps on n qubits
 *   Space: O(2^n) for the complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement probability of each classical bit string.
 *   - The true minimum-energy state is highlighted in the final frame.
 *   - Metadata reports the current schedule weight, energy, and ground success.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AnnealingInput {
    n?: number;
    h?: number[];
    couplings?: Array<[number, number, number]>;
    steps?: number;
    totalTime?: number;
}

function normalize(input: unknown) {
    const task = (input as AnnealingInput | null) ?? {};
    const n = Math.min(4, Math.max(1, Math.floor(Number(task.n ?? 2)) || 2));
    const N = 1 << n;
    const h = Array.from({ length: n }, (_, i) => Number(task.h?.[i] ?? 0));
    const couplings: Array<[number, number, number]> = Array.isArray(task.couplings) && task.couplings.length > 0
        ? task.couplings.map(([i, j, jij]) => [i, j, Number(jij ?? 0)])
        : [[0, 1, 1]];
    const steps = Math.min(1200, Math.max(1, Math.floor(Number(task.steps ?? 120)) || 120));
    const totalTime = Math.max(1, Number(task.totalTime ?? 8));
    const zOf = (x: number, q: number) => (((x >> (n - 1 - q)) & 1) === 0 ? 1 : -1);
    const energyOf = (x: number): number => {
        let e = 0;
        for (let q = 0; q < n; q += 1) e += (h[q] ?? 0) * zOf(x, q);
        for (const [i, j, jij] of couplings) e += jij * zOf(x, i) * zOf(x, j);
        return e;
    };
    const energies = Array.from({ length: N }, (_, x) => energyOf(x));
    let ground = 0;
    for (let x = 1; x < N; x += 1) if ((energies[x] ?? 0) < (energies[ground] ?? 0)) ground = x;
    return { n, N, h, couplings, steps, totalTime, energies, ground };
}

function basisLabel(x: number, n: number): string {
    return x.toString(2).padStart(n, "0");
}

function makeBars(probabilities: number[], highlight: number, done: boolean, n: number): VisualEntity[] {
    return probabilities.map((p, index) => {
        let state: EntityState = "idle";
        if (index === highlight) state = done ? "sorted" : "highlight";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `|${basisLabel(index, n)}> ${p.toFixed(3)}`,
            value: p,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: basisLabel(index, n), probability: p },
        };
    });
}

/** The quantum annealing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const { n, N, steps, totalTime, energies, ground } = normalize(input);
    const dt = totalTime / steps;
    const re = new Array<number>(N).fill(1 / Math.sqrt(N));
    const im = new Array<number>(N).fill(0);
    const probabilities = (): number[] => re.map((r, i) => r * r + im[i]! * im[i]!);
    const expectation = (ps: number[]) => ps.reduce((sum, p, x) => sum + p * (energies[x] ?? 0), 0);

    yield {
        stepNumber: 0,
        entities: makeBars(probabilities(), -1, false, n),
        edges: [],
        description: `Annealing ${n} qubits over ${steps} steps; starting in the uniform ground state of the transverse field.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            n,
            steps,
            schedule: 0,
            energy: expectation(probabilities()),
            groundEnergy: energies[ground],
            ground,
            groundProb: probabilities()[ground],
            done: false,
        },
    };

    let emitted = 1;
    for (let s = 0; s < steps; s += 1) {
        const schedule = (s + 1) / steps;
        const A = 1 - schedule;
        const B = schedule;
        const angle = A * dt;

        // Transverse field: apply exp(i * angle * X) on each qubit.
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        for (let q = 0; q < n; q += 1) {
            const mask = 1 << (n - 1 - q);
            for (let i = 0; i < N; i += 1) {
                if ((i & mask) !== 0) continue;
                const j = i | mask;
                const ar = re[i]!;
                const ai = im[i]!;
                const br = re[j]!;
                const bi = im[j]!;
                re[i] = cos * ar - sin * bi;
                im[i] = cos * ai + sin * br;
                re[j] = cos * br - sin * ai;
                im[j] = cos * bi + sin * ar;
            }
        }

        // Problem Hamiltonian diagonal phase exp(-i * B * dt * E_x).
        for (let x = 0; x < N; x += 1) {
            const theta = B * dt * (energies[x] ?? 0);
            const c = Math.cos(theta);
            const sn = -Math.sin(theta);
            const r = re[x]!;
            const i = im[x]!;
            re[x] = r * c - i * sn;
            im[x] = r * sn + i * c;
        }

        // Emit a readable subset of frames to keep the replay compact.
        const emit = s === 0 || s === steps - 1 || s % Math.max(1, Math.floor(steps / 20)) === 0;
        if (emit) {
            const ps = probabilities();
            yield {
                stepNumber: emitted,
                entities: makeBars(ps, ground, false, n),
                edges: [],
                description: `Step ${s + 1}/${steps}: problem weight ${schedule.toFixed(3)}, expectation energy ${expectation(ps).toFixed(4)}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: {
                    n,
                    steps,
                    schedule,
                    step: s + 1,
                    energy: expectation(ps),
                    groundEnergy: energies[ground],
                    ground,
                    groundProb: ps[ground],
                },
            };
            emitted += 1;
        }
    }

    const ps = probabilities();
    yield {
        stepNumber: emitted,
        entities: makeBars(ps, ground, true, n),
        edges: [],
        description: `Measurement favors |${basisLabel(ground, n)}> with probability ${ps[ground]!.toFixed(3)}; minimum energy is ${energies[ground]!.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            n,
            steps,
            schedule: 1,
            energy: expectation(ps),
            groundEnergy: energies[ground],
            ground,
            groundProb: ps[ground],
            probabilities: ps,
            probSum: ps.reduce((a, b) => a + b, 0),
            done: true,
        },
    };
}

/** The quantum annealing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Start with a quantum state that is easy to prepare and slowly morph the rules it obeys into the problem you actually care about. If the change is slow enough, the system stays in its ground state, which by the end encodes the best solution. The simulation alternates a transverse-field rotation with a phase from the problem's energy landscape.",
        invariants: [
            "The state vector stays normalized because both Trotter factors are unitary.",
            "The schedule weight grows from zero to one over the anneal.",
            "The diagonal phase applies a shift proportional to each bit string's Ising energy.",
        ],
        correctness:
            "The adiabatic theorem says a system initialized in the ground state of H0 and evolved slowly under H(s) = (1-s) H0 + s H1 remains near the instantaneous ground state when the spectral gap stays open. The Trotter step applies each exact factor for a small slice of time with error O(dt squared). For a small gapped problem and a long enough schedule, the final measurement therefore concentrates on the minimum-energy bit string.",
        complexityRationale:
            "Each of the S steps applies n two-amplitude rotations and one diagonal phase over the 2 to the n amplitudes, costing O(S times n times 2 to the n) time. Only the amplitude vector and problem energies are stored, O(2 to the n) space.",
        uses: [
            "Approximate solutions to small combinatorial optimization problems",
            "A teaching model of adiabatic quantum computation",
            "Studying how schedule speed affects success probability",
        ],
        references: [
            "Farhi et al., A Quantum Adiabatic Evolution Algorithm Applied to Random Instances of an NP-Complete Problem, 2001",
            "Kadowaki and Nishimori, Quantum Annealing in the Transverse Ising Model, 1998",
        ],
        workedExample:
            "For two qubits with a small local bias and an antiferromagnetic coupling, the minimum-energy string is 01. Starting uniform, the anneal gradually suppresses high-energy strings, and a long schedule ends with most probability on 01.",
    },
    id: "quantum-annealing",
    name: "Quantum Annealing",
    category: "quantum",
    complexity: { time: "O(S * n * 2^n)", space: "O(2^n)" },
    defaultInput: {
        n: 2,
        h: [0.8, -0.5],
        couplings: [[0, 1, 1]],
        steps: 200,
        totalTime: 10,
    },
    visualType: "array",
    run,
    pseudocode: [
        "compute the classical energy of every bit string",
        "initialize the uniform ground state of the transverse field",
        "for each anneal step set the schedule weight",
        "apply the transverse-field rotation on every qubit",
        "apply the diagonal phase from the problem energy",
        "repeat through the full schedule",
        "done: measure and report the favored solution",
    ],
};

export default module;
