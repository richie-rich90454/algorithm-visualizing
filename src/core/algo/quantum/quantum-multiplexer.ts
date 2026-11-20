/**
 * quantum-multiplexer.ts - Uniformly Controlled Rotations (Multiplexer)
 *
 * A three-qubit exact simulation of a multiplexed gate: two control qubits
 * select one of four rotation angles, and a single rotation R_y(theta_j) acts
 * on the target qubit for the selected branch. The operator is block diagonal
 * in the control register, so its action is computed exactly for every branch.
 * This ideal model assumes perfect gates and exact real amplitudes; it does not
 * model pulse-level implementation, noise, or more than four branches.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface MultiplexerInput {
    angles?: number[];
}

function makeBars(amps: Complex[], highlight: number[], final: boolean): VisualEntity[] {
    return amps.map((z, index) => {
        const probability = z[0] * z[0] + z[1] * z[1];
        const branch = Math.floor(index / 2);
        return {
            id: `basis-${index}`,
            type: "bar" as const,
            label: `|${branch.toString(2).padStart(2, "0")}${index % 2}>: ${probability.toFixed(4)}`,
            value: probability,
            state: final ? "sorted" : highlight.includes(index) ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, branch, target: index % 2, probability },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MultiplexerInput | null) ?? {};
    const raw = Array.isArray(task.angles) && task.angles.length === 4 ? task.angles : [0.3, 0.9, -0.5, 1.4];
    const angles = raw.map((a) => (typeof a === "number" && Number.isFinite(a) ? Math.max(-Math.PI * 2, Math.min(Math.PI * 2, a)) : 0));
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const metaFor = (amps: Complex[], applied: number, done: boolean) => {
        const branchReal: number[] = [];
        const branchImag: number[] = [];
        for (let j = 0; j < 4; j += 1) {
            branchReal.push(amps[2 * j]![0], amps[2 * j + 1]![0]);
            branchImag.push(amps[2 * j]![1], amps[2 * j + 1]![1]);
        }
        return {
            angles,
            amplitudes: flat(amps),
            probabilities: amps.map((z) => z[0] * z[0] + z[1] * z[1]),
            branchesApplied: applied,
            branchReal,
            branchImag,
            norm: amps.reduce((sum, z) => sum + z[0] * z[0] + z[1] * z[1], 0),
            done,
        };
    };

    let state: Complex[] = Array.from({ length: 8 }, (_, i) => [i === 0 ? 1 : 0, 0] as Complex);
    yield {
        stepNumber: 0,
        entities: makeBars(state, [0], false),
        edges: [],
        description: "The two control qubits and the target start in the basis state |000>.",
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(state, 0, false),
    };

    state = Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? [0.5, 0] : [0, 0]) as Complex);
    yield {
        stepNumber: 1,
        entities: makeBars(state, [0, 2, 4, 6], false),
        edges: [],
        description: "Hadamards on both control qubits create an equal superposition over the four branch selectors.",
        codeLineNumber: 1,
        layout: "array",
        meta: metaFor(state, 0, false),
    };

    for (let j = 0; j < 4; j += 1) {
        const cosine = Math.cos(angles[j]! / 2);
        const sine = Math.sin(angles[j]! / 2);
        const a = state[2 * j]!;
        const b = state[2 * j + 1]!;
        state[2 * j] = [cosine * a[0] - sine * b[0], cosine * a[1] - sine * b[1]];
        state[2 * j + 1] = [sine * a[0] + cosine * b[0], sine * a[1] + cosine * b[1]];
        yield {
            stepNumber: j + 2,
            entities: makeBars(state, [2 * j, 2 * j + 1], false),
            edges: [],
            description: `Branch ${j.toString(2).padStart(2, "0")} rotates the target by R_y with angle ${angles[j]!.toFixed(3)}; the other branches are untouched.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { ...metaFor(state, j + 1, false), activeBranch: j },
        };
    }

    yield {
        stepNumber: 6,
        entities: makeBars(state, [], true),
        edges: [],
        description: "All four branches are applied: the multiplexed gate is unitary because each block is its own rotation.",
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor(state, 4, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A multiplexed gate is a switch statement for quantum circuits: a control register decides which single-qubit rotation is applied to a target. Because the control states are orthogonal, the four rotations never mix; the whole operator is just a stack of independent blocks. Putting the control into a superposition applies all four rotations at once to different branches of the wavefunction.",
        invariants: [
            "Each control branch keeps its own target state; no amplitude moves between branches.",
            "Every block is a real rotation matrix, so its determinant is one and the full operator is unitary.",
            "The total probability over all eight basis states stays equal to one.",
        ],
        correctness:
            "Index the state by control value j and target bit t. The multiplexer maps amplitudes (a_0, a_1) in block j to R_y(theta_j) times that pair, and R_y is the rotation matrix with cosine and sine of half the angle. Since different j values occupy disjoint pairs of indices, the global operator is the direct sum of the four rotations, and a direct sum of unitaries is unitary. Starting with the control in an equal superposition therefore yields one quarter of the probability in each branch, exactly as reported.",
        complexityRationale:
            "Each of the four branches updates a constant-size pair of amplitudes, so the whole simulation is constant time and constant memory. A general multiplexer with m select qubits has 2^m blocks and costs O(2^m) to simulate directly, which is why compilers decompose it into a ladder of singly controlled rotations.",
        uses: [
            "State preparation with different rotations per basis branch",
            "Parameterized quantum circuits and quantum neural networks",
            "Qubitization and block-encoding circuits that select branch unitaries",
        ],
        references: [
            "Barenco et al., Elementary Gates for Quantum Computation, 1995",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
        ],
        workedExample:
            "With branch angles at zero, pi over two, pi, and three pi over two, and controls in an equal superposition, the target amplitudes for the four branches are (1, 0), (0.7071, 0.7071), (0, 1), and (-0.7071, 0.7071). Each branch keeps one quarter of the total probability.",
    },
    id: "quantum-multiplexer",
    name: "Quantum Multiplexer (Uniformly Controlled Rotations)",
    category: "quantum",
    complexity: { time: "O(2^m)", space: "O(2^m)" },
    defaultInput: { angles: [0.3, 0.9, -0.5, 1.4] },
    visualType: "array",
    run,
    pseudocode: [
        "choose the four rotation angles for the control branches",
        "prepare the target in |0> and all controls in |0>",
        "apply Hadamard to each control qubit",
        "for each branch j apply R_y(angle_j) to the target in that block",
        "leave the other three blocks unchanged while updating block j",
        "accumulate the eight resulting amplitudes",
        "done: report branch states and verify the norm is one",
    ],
};

export default module;
