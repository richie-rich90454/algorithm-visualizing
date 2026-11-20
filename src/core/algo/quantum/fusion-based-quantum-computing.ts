/**
 * fusion-based-quantum-computing.ts - Fusion-Based Quantum Computing (small exact model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fusion-based quantum computing builds a graph-state resource from small
 * entangled primitives by measuring chosen qubits with fusion gates. A type-I
 * fusion places a controlled-Z between one qubit of each resource and measures
 * both in the X basis; the successful branch removes those qubits and joins
 * their former neighbors into a single larger graph state.
 *
 * This module simulates two two-qubit graph states fused into one two-qubit
 * graph state on the surviving qubits. It enumerates amplitudes exactly for at
 * most six qubits and conditions on the successful measurement branch. It is a
 * teaching model: it does not sample measurement shots, model photon loss, or
 * include the local Clifford corrections of a physical fusion device.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) per operation on an n-qubit register
 *   Space: O(2^n) for the amplitude vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show measurement probabilities of the current register.
 *   - The register after the fusion CZ is yellow; the surviving graph is green.
 *   - meta carries the edge list, the fused pair, and the output fidelity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(probabilities: number[], state: EntityState): VisualEntity[] {
    return probabilities.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Apply a controlled-Z between two qubits of a real amplitude vector. */
function applyCZ(amplitudes: number[], qubits: number, a: number, b: number): void {
    const dimension = 1 << qubits;
    for (let index = 0; index < dimension; index += 1) {
        if (((index >> a) & 1) === 1 && ((index >> b) & 1) === 1) {
            amplitudes[index] = -(amplitudes[index] ?? 0);
        }
    }
}

/** Project two qubits onto |+>|+> and keep the remaining qubits. */
function fuseOnPlus(
    amplitudes: number[],
    qubits: number,
    first: number,
    second: number,
    remaining: number[],
): number[] {
    const dimension = 1 << qubits;
    const reduced: number[] = Array.from({ length: 1 << remaining.length }, () => 0);
    for (let index = 0; index < dimension; index += 1) {
        let reducedIndex = 0;
        for (let position = 0; position < remaining.length; position += 1) {
            reducedIndex |= (((index >> remaining[position]!) & 1) << position);
        }
        reduced[reducedIndex] = (reduced[reducedIndex] ?? 0) + 0.5 * (amplitudes[index] ?? 0);
    }
    const norm = Math.sqrt(reduced.reduce((sum, value) => sum + value * value, 0));
    return norm > 0 ? reduced.map((value) => value / norm) : reduced;
}

/** Build the graph state of a given edge set on n qubits (real amplitudes). */
function graphState(qubits: number, edges: number[][]): number[] {
    const dimension = 1 << qubits;
    const amplitudes: number[] = Array.from({ length: dimension }, () => 1 / Math.sqrt(dimension));
    for (const edge of edges) applyCZ(amplitudes, qubits, edge[0] ?? 0, edge[1] ?? 0);
    return amplitudes;
}

/** Simulate a type-I fusion of two small graph states. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { qubits?: number; edges?: number[][]; fuse?: number[] } | null) ?? {};
    const qubits = Math.min(6, Math.max(2, typeof task.qubits === "number" ? Math.floor(task.qubits) : 4));
    const edges: number[][] = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges.map((edge) => [Number(edge?.[0]) || 0, Number(edge?.[1]) || 0])
        : [
              [0, 1],
              [2, 3],
          ];
    const fuse: number[] = Array.isArray(task.fuse) && task.fuse.length === 2 ? task.fuse.map((value) => Number(value) || 0) : [1, 2];
    const remaining: number[] = Array.from({ length: qubits }, (_, index) => index).filter(
        (index) => index !== fuse[0] && index !== fuse[1],
    );
    const dimension = 1 << qubits;
    const amplitudes: number[] = Array.from({ length: dimension }, () => 1 / Math.sqrt(dimension));
    const probabilities = (values: number[]): number[] => values.map((value) => value * value);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(amplitudes), "idle"),
        edges: [],
        description: `Starting with ${qubits} qubits in the uniform plus state.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { qubits, count: dimension, phase: "init", fused: false, fidelity: 0, edges: edges.flat() },
    };
    step += 1;

    for (const edge of edges) applyCZ(amplitudes, qubits, edge[0] ?? 0, edge[1] ?? 0);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(amplitudes), "comparing"),
        edges: [],
        description: `Controlled-Z gates create the two small graph states from ${edges.length} edge(s).`,
        codeLineNumber: 2,
        layout: "array",
        meta: { qubits, count: dimension, phase: "resources", fused: false, fidelity: 0, edges: edges.flat() },
    };
    step += 1;

    applyCZ(amplitudes, qubits, fuse[0] ?? 0, fuse[1] ?? 0);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(amplitudes), "comparing"),
        edges: [],
        description: `The fusion controlled-Z links qubits ${fuse[0]} and ${fuse[1]} across the resources.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { qubits, count: dimension, phase: "link", fused: false, fidelity: 0, edges: [...edges.flat(), fuse[0], fuse[1]] },
    };
    step += 1;

    const reduced = fuseOnPlus(amplitudes, qubits, fuse[0] ?? 0, fuse[1] ?? 0, remaining);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(reduced), "comparing"),
        edges: [],
        description: `An X-basis fusion measurement removes qubits ${fuse[0]} and ${fuse[1]}; ${remaining.length} qubits survive.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { qubits, count: 1 << remaining.length, phase: "fused", fused: true, fidelity: 0, edges: remaining.flatMap((node) => remaining.filter((other) => other > node).flatMap((other) => [node, other])) },
    };
    step += 1;

    const expectedEdges: number[][] = [];
    for (let a = 0; a < remaining.length; a += 1) {
        for (let b = a + 1; b < remaining.length; b += 1) expectedEdges.push([a, b]);
    }
    const expected = graphState(remaining.length, expectedEdges);
    const fidelity = reduced.reduce((sum, value, index) => sum + value * (expected[index] ?? 0), 0) ** 2;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(reduced), "sorted"),
        edges: [],
        description: `Fused resource matches the target graph state with fidelity ${fidelity.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            qubits,
            count: 1 << remaining.length,
            phase: "done",
            fused: true,
            fidelity,
            edges: expectedEdges.flat(),
            amplitudes: reduced,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Large entangled resource states are hard to make in one shot, so fusion-based computing builds them from small Bell-pair-like pieces. A fusion gate entangles one qubit from each piece and then measures both, which effectively splices the remaining pieces together. When the measurement succeeds, the untouched qubits form a bigger graph state ready for computation by measurements alone.",
        invariants: [
            "Every controlled-Z is diagonal and preserves the normalization of the state.",
            "Conditioning on the plus outcome is a projective measurement followed by renormalization.",
            "For the successful branch the surviving qubits form a graph state on the joined neighborhood.",
        ],
        correctness:
            "Graph states are generated by applying controlled-Z gates to the uniform plus state. Adding a controlled-Z across the two resources and projecting the fusion qubits onto the plus state implements the stabilizer measurement of the fusion. Expanding the projection shows the remaining amplitudes equal the uniform state with a sign flip on the basis label where both surviving qubits are one, which is exactly the graph state whose edge joins the two former neighbors. The reported fidelity with that independently built state is therefore one.",
        complexityRationale:
            "Each controlled-Z and the projection scan all 2 to the n amplitudes once, so each operation costs O(2 to the n) time. The amplitude vector is the only storage, O(2 to the n) space.",
        uses: [
            "Building photonic cluster states for measurement-based quantum computation",
            "Modular entanglement distribution between quantum processing units",
            "Resource-state generation in linear optical quantum computing",
        ],
        references: [
            "Bartolucci et al., Fusion-Based Quantum Computation, Nature Communications, 2023",
            "Anders and Briegel, Fast simulation of stabilizer circuits, 2006",
        ],
        workedExample:
            "Start with graph states on qubits zero-one and two-three. Fusing qubits one and two adds a controlled-Z between them and measures both in the X basis. The survivors zero and three end in the two-qubit graph state with amplitudes one half, one half, one half, minus one half, matching the target with fidelity one.",
    },
    id: "fusion-based-quantum-computing",
    name: "Fusion-Based Quantum Computing",
    category: "quantum",
    complexity: { time: "O(2^n) simulated", space: "O(2^n) simulated" },
    defaultInput: { qubits: 4, edges: [[0, 1], [2, 3]], fuse: [1, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize all qubits in the uniform plus state",
        "apply controlled-Z gates for each resource edge",
        "add a controlled-Z across the two fusion qubits",
        "project the fusion qubits onto the plus state",
        "renormalize the amplitudes of the surviving qubits",
        "build the target graph state on the survivors",
        "compute the overlap fidelity with the target",
        "done: report the fused state and fidelity",
    ],
};

export default module;
