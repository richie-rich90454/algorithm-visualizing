/**
 * quantum-born-machine.ts - Two-Qubit Quantum Born Machine Trained by Grid Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A quantum Born machine is a parameterized quantum circuit whose measurement
 * probabilities define a probability distribution. This module uses two
 * qubits with one rotation angle per qubit followed by a controlled-NOT. The
 * resulting four probabilities are compared with a target distribution using
 * total variation distance, and a brute-force grid search over both angles
 * finds the best settings.
 *
 * This is an exact small simulation with a fixed grid of angles. It trains two
 * parameters on four outcomes only; it does not use gradients, shot noise, a
 * classical network, or the many-layer circuits used in practical Born machines.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(G^2) for G grid points per angle
 *   Space: O(1) for the four probabilities and the running best candidate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the current candidate probabilities.
 *   - The best candidate found so far is yellow; the final fit is green.
 *   - The final frame reports the learned angles and total variation loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BornInput {
    target?: number[];
    gridPoints?: number;
}

const LABELS = ["00", "01", "10", "11"];

function angles(gridPoints: number): number[] {
    const g = Math.max(2, Math.min(24, Math.floor(gridPoints)));
    return Array.from({ length: g }, (_, i) => (Math.PI * i) / (g - 1));
}

/** Exact Born probabilities of RY(theta0), RY(theta1), then CNOT(0->1). */
function distribution(theta0: number, theta1: number): number[] {
    const c0 = Math.cos(theta0 / 2);
    const s0 = Math.sin(theta0 / 2);
    const c1 = Math.cos(theta1 / 2);
    const s1 = Math.sin(theta1 / 2);
    const amplitudes = [c0 * c1, c0 * s1, s0 * s1, s0 * c1];
    return amplitudes.map((value) => value * value);
}

function totalVariation(a: number[], b: number[]): number {
    return 0.5 * a.reduce((sum, value, i) => sum + Math.abs(value - (b[i] ?? 0)), 0);
}

function makeBars(values: number[], highlight: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${LABELS[index] ?? String(index)}: ${value.toFixed(4)}`,
        value,
        state: done ? "sorted" : index === highlight ? "comparing" : "idle",
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: LABELS[index] ?? String(index), probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BornInput | null) ?? {};
    const grid = angles(Number(task.gridPoints ?? 9));
    const rawTarget = Array.isArray(task.target) && task.target.length === 4
        ? task.target.map((value) => Math.max(0, Number(value ?? 0)))
        : [0.1, 0.2, 0.3, 0.4];
    const targetSum = rawTarget.reduce((sum, value) => sum + value, 0) || 1;
    const target = rawTarget.map((value) => value / targetSum);

    let bestTheta0 = 0;
    let bestTheta1 = 0;
    let bestLoss = Number.POSITIVE_INFINITY;
    let bestDistribution = distribution(0, 0);
    const snapshots: Array<{ theta0: number; theta1: number; loss: number; distribution: number[] }> = [];

    for (const theta0 of grid) {
        for (const theta1 of grid) {
            const candidate = distribution(theta0, theta1);
            const loss = totalVariation(candidate, target);
            if (loss < bestLoss) {
                bestLoss = loss;
                bestTheta0 = theta0;
                bestTheta1 = theta1;
                bestDistribution = candidate;
            }
        }
    }

    // Show a readable subset of candidates spanning the search grid.
    const sampleIndices = [0, Math.floor(grid.length / 3), Math.floor((2 * grid.length) / 3), grid.length - 1];
    for (const index of sampleIndices) {
        const theta = grid[index] ?? 0;
        snapshots.push({ theta0: theta, theta1: theta, loss: totalVariation(distribution(theta, theta), target), distribution: distribution(theta, theta) });
    }

    yield {
        stepNumber: 0,
        entities: makeBars(target, -1, false),
        edges: [],
        description: `Target distribution ${target.map((value) => value.toFixed(3)).join(", ")} with a ${grid.length} by ${grid.length} angle grid.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { target, bestTheta0, bestTheta1, bestLoss, gridPoints: grid.length, loss: 0 },
    };

    for (let i = 0; i < snapshots.length; i += 1) {
        const snapshot = snapshots[i];
        yield {
            stepNumber: i + 1,
            entities: makeBars(snapshot?.distribution ?? target, -1, false),
            edges: [],
            description: `Candidate angles (${(snapshot?.theta0 ?? 0).toFixed(3)}, ${(snapshot?.theta1 ?? 0).toFixed(3)}) give total variation ${(snapshot?.loss ?? 0).toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { target, bestTheta0, bestTheta1, bestLoss, gridPoints: grid.length, loss: snapshot?.loss ?? 0 },
        };
    }

    yield {
        stepNumber: snapshots.length + 1,
        entities: makeBars(bestDistribution, -1, true),
        edges: [],
        description: `Best angles (${bestTheta0.toFixed(3)}, ${bestTheta1.toFixed(3)}) fit the target with total variation ${bestLoss.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            target,
            bestTheta0,
            bestTheta1,
            bestLoss,
            gridPoints: grid.length,
            distribution: bestDistribution,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A small quantum circuit can be treated as a probability generator. Rotating each qubit changes the chances of measuring each bit string, and measuring the circuit many times samples that distribution. You tune the rotation angles until the sampled distribution matches a target, which is the same idea as fitting a model in machine learning.",
        invariants: [
            "The four Born probabilities always sum to one because the circuit is unitary.",
            "Each candidate is scored by half the sum of absolute probability differences.",
            "The grid search keeps the smallest loss seen so far.",
        ],
        correctness:
            "Applying RY rotations to the two starting zero states gives amplitudes whose squares sum to one, and the controlled-NOT only permutes two amplitudes, so the output distribution is normalized. Exhaustively scoring every pair of grid angles and keeping the minimum by definition returns the global optimum on that grid. The test repeats the search independently and checks that the reported angles and loss agree.",
        complexityRationale:
            "There are G squared angle pairs and each evaluation constructs four probabilities, so training takes O(G squared) time and constant space beyond the stored target.",
        uses: [
            "Generative modeling with parameterized quantum circuits",
            "A teaching model of quantum machine learning loss landscapes",
            "Benchmarking variational circuits on small distributions",
        ],
        references: [
            "Benedetti et al., A Generative Modeling Approach for Training Variational Quantum Circuits, 2019",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
        ],
        workedExample:
            "With target probabilities 0.1, 0.2, 0.3, 0.4 and a nine-point grid, the search tries eighty-one angle pairs. Candidate angles near zero concentrate probability on 00, while angles near pi shift it toward the CNOT-swapped states, and the best pair minimizes the total variation distance.",
    },
    id: "quantum-born-machine",
    name: "Quantum Born Machine (Two Qubits)",
    category: "quantum",
    complexity: { time: "O(G^2)", space: "O(1)" },
    defaultInput: { target: [0.1, 0.2, 0.3, 0.4], gridPoints: 9 },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the target distribution",
        "build the grid of rotation angles",
        "for each pair of angles prepare the circuit",
        "compute the four Born probabilities",
        "score with total variation distance",
        "keep the angles with the smallest loss",
        "done: report the learned distribution",
    ],
};

export default module;
