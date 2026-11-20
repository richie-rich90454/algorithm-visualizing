/**
 * quantum-decision-tree.ts - Quantum Decision Tree Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A balanced binary decision tree ends in leaves that are labeled accept or
 * reject. A classical walk would have to inspect many leaves before finding an
 * accepting one. The quantum decision-tree search prepares a uniform
 * superposition over the leaves, flips the phase of accepting leaves with an
 * oracle, reflects about the uniform amplitude with a diffusion operator, and
 * repeats. Amplitude concentrates on accepting leaves in about the square root
 * of the number of leaves. The bit pattern of the measured leaf gives the path
 * from the root to that decision.
 *
 * This is an exact small amplitude simulation with real numbers, limited to a
 * complete binary tree of two to eight leaves. It models the state vector and
 * the Grover-style iterates exactly; it does not model noise, fault tolerance,
 * or a physical oracle circuit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * leaves) for the oracle and diffusion updates
 *   Space: O(leaves) for the amplitude vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the amplitude of each leaf in the superposition.
 *   - The accepting leaves are marked in the metadata and final probabilities.
 *   - meta carries the path, the selected leaf, and the success probability.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DecisionTreeInput {
    leaves?: number[];
}

function makeBars(values: number[], marked: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = done
            ? marked.includes(index) ? "sorted" : "visited"
            : index === active ? "active" : marked.includes(index) ? "highlight" : "idle";
        return {
            id: `leaf-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, leaf: index, amplitude: value, marked: marked.includes(index) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DecisionTreeInput | null) ?? {};
    const provided = Array.isArray(task.leaves) && task.leaves.length >= 2
        ? task.leaves.map((value) => (value ? 1 : 0))
        : [0, 0, 1, 0];
    const leaves = provided.slice(0, 8);
    const size = leaves.length;
    const marked: number[] = [];
    for (let index = 0; index < size; index += 1) {
        if (leaves[index] === 1) {
            marked.push(index);
        }
    }
    const uniform = 1 / Math.sqrt(size);
    const amplitudes: number[] = Array.from({ length: size }, () => uniform);
    const height = Math.round(Math.log2(size));
    const iterations = marked.length === 0
        ? 0
        : Math.min(4, Math.max(0, Math.floor((Math.PI / 4) * Math.sqrt(size / marked.length))));
    let step = 0;

    const pathFor = (leaf: number) => {
        const path: string[] = [];
        for (let level = height - 1; level >= 0; level -= 1) {
            path.push((leaf >> level) & 1 ? "right" : "left");
        }
        return path;
    };
    const probabilities = () => amplitudes.map((value) => value * value);
    const success = () => marked.reduce((sum, index) => sum + (amplitudes[index] ?? 0) ** 2, 0);

    yield {
        stepNumber: step,
        entities: makeBars(amplitudes, marked, -1, false),
        edges: [],
        description: `Prepared a uniform superposition over ${size} leaves; ${marked.length} leaf or leaves accept.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { size, leaves, marked, amplitudes: [...amplitudes], probabilities: probabilities(), iteration: 0, success: success(), path: [], selected: -1, done: false },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        for (const index of marked) {
            amplitudes[index] = -(amplitudes[index] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: makeBars(amplitudes, marked, -1, false),
            edges: [],
            description: `Iteration ${iteration + 1} oracle: flipped the phase of each accepting leaf.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { size, leaves, marked, amplitudes: [...amplitudes], probabilities: probabilities(), iteration: iteration + 1, success: success(), path: [], selected: -1, done: false },
        };
        step += 1;

        const average = amplitudes.reduce((sum, value) => sum + value, 0) / size;
        for (let index = 0; index < size; index += 1) {
            amplitudes[index] = 2 * average - (amplitudes[index] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: makeBars(amplitudes, marked, -1, false),
            edges: [],
            description: `Iteration ${iteration + 1} diffusion: reflected amplitudes about the mean; acceptance probability ${success().toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { size, leaves, marked, amplitudes: [...amplitudes], probabilities: probabilities(), iteration: iteration + 1, success: success(), path: [], selected: -1, done: false },
        };
        step += 1;
    }

    let selected = 0;
    for (let index = 1; index < size; index += 1) {
        if ((amplitudes[index] ?? 0) ** 2 > (amplitudes[selected] ?? 0) ** 2) {
            selected = index;
        }
    }
    if (marked.length === 0) {
        selected = -1;
    }
    const finalProbabilities = probabilities();
    yield {
        stepNumber: step,
        entities: makeBars(amplitudes, marked, -1, true),
        edges: [],
        description: marked.length === 0
            ? "No accepting leaf exists, so the search reports no decision."
            : `Measured leaf ${selected} along path ${pathFor(selected).join(" -> ")} with acceptance probability ${success().toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            size,
            leaves,
            marked,
            amplitudes,
            probabilities: finalProbabilities,
            iterations,
            success: success(),
            path: selected >= 0 ? pathFor(selected) : [],
            selected,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a complete binary tree whose leaves say accept or reject. A quantum computer can look at many leaves at once by putting them in a superposition. Each round, a phase flip tags the accepting leaves and a reflection pushes amplitude toward them. After a number of rounds proportional to the square root of the leaf count, measuring the state usually returns an accepting leaf, and its binary index spells out the route from the root.",
        invariants: [
            "The amplitude vector stays normalized after every oracle and diffusion step.",
            "The diffusion operator is a reflection about the uniform superposition.",
            "The acceptance probability is the sum of squared amplitudes on accepting leaves.",
        ],
        correctness:
            "Let theta equal arcsin of the square root of the fraction of accepting leaves. One oracle-and-diffusion round rotates the two-dimensional space spanned by the uniform accepting and rejecting states by two theta. After k rounds the acceptance amplitude is sin((2k+1)theta), which the chosen k near pi over four times the square root of the leaf-to-accept ratio drives close to one. Measuring therefore returns an accepting leaf with high probability, and reading its index bits recovers the root-to-leaf path exactly.",
        complexityRationale:
            "Each round touches all leaves once in the oracle and once in the diffusion step, so the run is O(iterations times leaves). With about the square root of the leaf count rounds this is O(leaves to the three halves) in this direct simulation, while only one amplitude vector is stored, giving O(leaves) space.",
        uses: [
            "Predicate evaluation on search trees with a quadratic query advantage",
            "Amplitude amplification applied to decision and game trees",
            "A teaching model for oracle-based quantum search circuits",
        ],
        references: [
            "Farhi, Gutmann and Gutmann, A Quantum Algorithm for Finding the Minimum, 1998",
            "Grover, A Fast Quantum Mechanical Algorithm for Database Search, 1996",
        ],
        workedExample:
            "On four leaves with labels 0, 0, 1, 0 the uniform amplitudes are all one half. The oracle flips leaf two to minus one half, and diffusion about the mean pushes the other three down while lifting leaf two. After one round leaf two is the most likely measurement, giving the path right then left from the root.",
    },
    id: "quantum-decision-tree",
    name: "Quantum Decision Tree Search",
    category: "quantum",
    complexity: { time: "O(iterations * leaves)", space: "O(leaves)" },
    defaultInput: {
        leaves: [0, 0, 1, 0],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the accept and reject labels of the leaves",
        "prepare the uniform superposition over all leaves",
        "flip the phase of every accepting leaf with the oracle",
        "reflect all amplitudes about their mean",
        "repeat the oracle and reflection a chosen number of rounds",
        "measure the leaf with the largest probability",
        "decode the leaf index into a root-to-leaf path",
        "done: report the selected leaf and acceptance probability",
    ],
};

export default module;
