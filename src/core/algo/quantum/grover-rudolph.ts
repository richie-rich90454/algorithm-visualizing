/**
 * grover-rudolph.ts - Grover-Rudolph State Preparation (exact simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Grover-Rudolph preparation builds a quantum state whose measurement
 * probabilities match a desired classical distribution. It works from the
 * most significant bit inward: at each node of a binary partition tree a
 * controlled rotation splits the amplitude mass between the two halves in
 * proportion to the target probabilities. Carrying the rotations down to the
 * leaves yields amplitudes equal to the square roots of the target
 * probabilities.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact classical simulation of the amplitude vector produced by
 * the rotation tree for up to eight outcomes. It does not simulate physical
 * gates, controlled ancillas, noise, or finite-precision rotation synthesis;
 * the result is the ideal state the circuit would prepare.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(n) for n outcomes; Space: O(n) for the amplitude vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the probabilities accumulated at each rotation level.
 *   - The group finalized by the current rotation is highlighted.
 *   - The final frame compares the prepared distribution with the target.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function bars(probs: number[], highlight: number[], target: number[]): VisualEntity[] {
    return probs.map((p, index) => ({
        id: `amp-${index}`,
        type: "bar" as const,
        label: `|${index.toString(2).padStart(Math.log2(probs.length), "0")}>: ${p.toFixed(3)}`,
        value: p,
        state: (highlight.includes(index) ? "active" : Math.abs(p - (target[index] ?? 0)) < 1e-9 ? "sorted" : "idle") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: p, target: target[index] ?? 0 },
    }));
}

function normalize(input: number[]): number[] {
    const clean = input.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
    const total = clean.reduce((sum, x) => sum + x, 0);
    return total > 0 ? clean.map((x) => x / total) : clean.map(() => 1 / clean.length);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { probs?: number[] } | null) ?? {};
    const raw = Array.isArray(task.probs) && task.probs.length >= 2 ? task.probs.slice(0, 8) : [0.4, 0.1, 0.3, 0.2];
    let size = 1;
    while (size < raw.length) {
        size *= 2;
    }
    const target = normalize([...raw, ...new Array<number>(size - raw.length).fill(0)]);
    const state = new Array<number>(size).fill(0);
    const snapshots: Array<{ probs: number[]; highlight: number[]; start: number; len: number }> = [];

    const build = (start: number, len: number): number[] => {
        if (len === 1) {
            state[start] = Math.sqrt(target[start] ?? 0);
            snapshots.push({
                probs: state.map((a) => a * a),
                highlight: [start],
                start,
                len,
            });
            return [state[start] ?? 0];
        }
        const half = len / 2;
        const left = build(start, half);
        const right = build(start + half, half);
        let leftMass = 0;
        let rightMass = 0;
        for (let i = 0; i < half; i += 1) {
            leftMass += target[start + i] ?? 0;
            rightMass += target[start + half + i] ?? 0;
        }
        const total = leftMass + rightMass;
        const cosine = total > 0 ? Math.sqrt(leftMass / total) : 0;
        const sine = total > 0 ? Math.sqrt(rightMass / total) : 0;
        const leftNorm = Math.sqrt(left.reduce((sum, a) => sum + a * a, 0));
        const rightNorm = Math.sqrt(right.reduce((sum, a) => sum + a * a, 0));
        const combined: number[] = [];
        for (let i = 0; i < half; i += 1) {
            state[start + i] = leftNorm > 0 ? (cosine * (left[i] ?? 0)) / leftNorm : 0;
            state[start + half + i] = rightNorm > 0 ? (sine * (right[i] ?? 0)) / rightNorm : 0;
            combined.push(state[start + i] ?? 0);
        }
        for (let i = 0; i < half; i += 1) {
            combined.push(state[start + half + i] ?? 0);
        }
        snapshots.push({
            probs: state.map((a) => a * a),
            highlight: Array.from({ length: len }, (_, i) => start + i),
            start,
            len,
        });
        return combined;
    };
    build(0, size);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(new Array<number>(size).fill(0), [], target),
        edges: [],
        description: `Prepare a ${size}-outcome distribution with a binary tree of controlled rotations, one per partition node.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { outcomes: size, target: [...target] },
    };
    step += 1;

    for (let i = 0; i < snapshots.length; i += 1) {
        const snap = snapshots[i];
        if (!snap) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: bars(snap.probs, snap.highlight, target),
            edges: [],
            description: i === snapshots.length - 1
                ? `Final rotation sets the amplitudes so measurement matches the target distribution.`
                : `Rotation at partition starting at index ${snap.start} splits amplitude mass across ${snap.len} outcomes.`,
            codeLineNumber: i === snapshots.length - 1 ? 5 : 3,
            layout: "array",
            meta: { outcomes: size, rotation: i + 1, start: snap.start, len: snap.len, target: [...target] },
        };
        step += 1;
    }

    const finalProbs = state.map((a) => a * a);
    const norm = finalProbs.reduce((sum, p) => sum + p, 0);
    const error = finalProbs.reduce((sum, p, i) => sum + Math.abs(p - (target[i] ?? 0)), 0);
    yield {
        stepNumber: step,
        entities: bars(finalProbs, [], target),
        edges: [],
        description: `Prepared probabilities ${finalProbs.map((p) => p.toFixed(3)).join(", ")} with total error ${error.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            outcomes: size,
            prepared: [...finalProbs],
            target: [...target],
            norm,
            error,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To build a desired distribution, split the set of outcomes in half and decide how much probability mass goes to each half with a rotation. Then recurse inside each half. Because the rotation angle is chosen from the cumulative target mass, the amplitude at every leaf ends up equal to the square root of its target probability, which is exactly what measurement needs.",
        invariants: [
            "At every tree node the two rotation coefficients square to the fraction of mass assigned to each half.",
            "Amplitudes at a node are the leaf amplitudes of its group rescaled by that node's coefficient.",
            "The prepared probabilities sum to one whenever the target distribution sums to one.",
        ],
        correctness:
            "At a leaf the recursion sets the amplitude to the square root of that outcome's target mass within its group. Consider a parent whose left and right groups have target masses L and R inside the parent's mass L plus R. Its cosine and sine are the square roots of L over L plus R and R over L plus R, so multiplying a left leaf amplitude by the cosine gives the square root of the leaf mass divided by the parent mass. By induction from the leaves upward, the root amplitudes are the square roots of the global target probabilities, and their squares reproduce the target distribution exactly.",
        complexityRationale:
            "The binary partition tree has one node per outcome and each node does constant work, so preparation takes O(n) time and O(n) space for n outcomes. A physical circuit uses O(n) rotations as well.",
        uses: [
            "Initializing probability distributions in quantum machine learning",
            "Loading classical data into amplitude-encoded quantum states",
            "Preparing input states for amplitude estimation",
        ],
        references: [
            "Grover and Rudolph, Creating Superpositions That Correspond to Efficiently Integrable Probability Distributions (2002)",
            "Nielsen and Chuang, Quantum Computation and Quantum Information (2010), Chapter 4",
        ],
        workedExample:
            "For the target probabilities 0.4, 0.1, 0.3, 0.2, the root split gives left mass 0.5 and right mass 0.5, so the first rotation is balanced. Inside the left half the split is 0.4 versus 0.1, giving coefficients 0.894 and 0.447, which scale the leaf amplitudes to 0.632 and 0.316 and hence probabilities 0.4 and 0.1.",
    },
    id: "grover-rudolph",
    name: "Grover-Rudolph State Preparation",
    category: "quantum",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { probs: [0.4, 0.1, 0.3, 0.2] },
    visualType: "array",
    run,
    pseudocode: [
        "read and normalize the target probabilities",
        "pad the distribution to a power of two outcomes",
        "recurse on the left and right halves of the outcomes",
        "compute the mass of each half at the current node",
        "set the rotation coefficients from the square roots of the mass fractions",
        "scale the child amplitudes by those coefficients",
        "report the prepared probabilities and their error",
    ],
};

export default module;
