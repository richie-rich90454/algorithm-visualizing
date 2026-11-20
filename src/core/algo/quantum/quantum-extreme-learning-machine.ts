/**
 * quantum-extreme-learning-machine.ts - Quantum Extreme Learning Machine
 *
 * A static supervised-learning simulation: a seeded random two-qubit circuit
 * maps each input point to four features, and the output weights are fitted in
 * one least-squares solve. Unlike the reservoir module there is no temporal
 * evolution or fading memory, and only the final linear layer is trained. This
 * ideal model uses exact expectation values for a small classification task;
 * it does not model sampling noise, trainable circuit parameters, or general
 * data sets.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface ElmInput {
    seed?: number;
}

const RIDGE = 1e-6;
const TRAIN: Array<[number, number]> = [
    [0.1, 0.1], [0.2, 0.8], [0.35, 0.5], [0.5, 0.15],
    [0.65, 0.7], [0.8, 0.2], [0.85, 0.85], [0.15, 0.4],
];
const TEST: Array<[number, number]> = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function randomAngles(seed: number): number[] {
    let value = seed >>> 0 || 1;
    return Array.from({ length: 4 }, () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return (value / 2 ** 32) * Math.PI;
    });
}

function ry(state: Complex[], qubit: number, angle: number): void {
    const stride = 2 ** qubit;
    const cosine = Math.cos(angle / 2);
    const sine = Math.sin(angle / 2);
    for (let base = 0; base < 4; base += 2 * stride) {
        const a = state[base]!;
        const b = state[base + stride]!;
        state[base] = [cosine * a[0] - sine * b[0], cosine * a[1] - sine * b[1]];
        state[base + stride] = [sine * a[0] + cosine * b[0], sine * a[1] + cosine * b[1]];
    }
}

function rz(state: Complex[], qubit: number, angle: number): void {
    const cosine = Math.cos(angle / 2);
    const sine = Math.sin(angle / 2);
    for (let index = 0; index < 4; index += 1) {
        const phase: Complex = ((index >> qubit) & 1) === 1 ? [cosine, sine] : [cosine, -sine];
        state[index] = cMul(state[index]!, phase);
    }
}

function cnot(state: Complex[]): void {
    const tmp = state[1]!;
    state[1] = state[2]!;
    state[2] = tmp;
}

function featuresFor(point: [number, number], angles: number[]): number[] {
    const state: Complex[] = [[1, 0], [0, 0], [0, 0], [0, 0]];
    ry(state, 0, Math.PI * point[0] + angles[0]!);
    ry(state, 1, Math.PI * point[1] + angles[1]!);
    cnot(state);
    rz(state, 0, angles[2]!);
    rz(state, 1, angles[3]!);
    const zOf = (qubit: number): number => {
        let value = 0;
        for (let index = 0; index < 4; index += 1) {
            const z = state[index]!;
            const probability = z[0] * z[0] + z[1] * z[1];
            value += ((index >> qubit) & 1) === 0 ? probability : -probability;
        }
        return value;
    };
    const z0 = zOf(0);
    const z1 = zOf(1);
    return [1, z0, z1, z0 * z1];
}

function label(point: [number, number]): number {
    return (point[0] - 0.5) ** 2 + (point[1] - 0.5) ** 2 < 0.06 ? 1 : -1;
}

function solve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const rows = matrix.map((row, i) => [...row, rhs[i]!]);
    for (let column = 0; column < n; column += 1) {
        let pivot = column;
        for (let r = column + 1; r < n; r += 1) if (Math.abs(rows[r]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = r;
        const tmp = rows[column]!;
        rows[column] = rows[pivot]!;
        rows[pivot] = tmp;
        const divisor = rows[column]![column]! || 1e-15;
        for (let j = column; j <= n; j += 1) rows[column]![j] /= divisor;
        for (let r = 0; r < n; r += 1) {
            if (r === column) continue;
            const factor = rows[r]![column]!;
            for (let j = column; j <= n; j += 1) rows[r]![j] -= factor * rows[column]![j]!;
        }
    }
    return rows.map((row) => row[n]!);
}

function fit(features: number[][], targets: number[]): number[] {
    const gram = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
        features.reduce((sum, row) => sum + row[i]! * row[j]!, 0) + (i === j ? RIDGE : 0)));
    const moment = Array.from({ length: 4 }, (_, i) => features.reduce((sum, row, k) => sum + row[i]! * (targets[k] ?? 0), 0));
    return solve(gram, moment);
}

function makeBars(values: number[], highlight: number, final: boolean): VisualEntity[] {
    const names = ["bias", "Z0", "Z1", "Z0Z1"];
    return values.map((value, index) => ({
        id: `feature-${names[index]}`,
        type: "bar" as const,
        label: `${names[index]}: ${value.toFixed(4)}`,
        value,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, name: names[index]!, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ElmInput | null) ?? {};
    const seed = typeof task.seed === "number" && Number.isFinite(task.seed) ? Math.floor(task.seed) : 7;
    const angles = randomAngles(seed);
    const trainFeatures = TRAIN.map((point) => featuresFor(point, angles));
    const trainLabels = TRAIN.map(label);
    const weights = fit(trainFeatures, trainLabels);
    const predict = (features: number[]): number => features.reduce((sum, value, i) => sum + value * weights[i]!, 0) >= 0 ? 1 : -1;
    const trainPredictions = trainFeatures.map(predict);
    const testFeatures = TEST.map((point) => featuresFor(point, angles));
    const testLabels = TEST.map(label);
    const testPredictions = testFeatures.map(predict);
    const trainAccuracy = trainPredictions.filter((value, i) => value === trainLabels[i]).length / TRAIN.length;
    const testAccuracy = testPredictions.filter((value, i) => value === testLabels[i]).length / TEST.length;
    const metaFor = (step: number, done: boolean) => ({
        seed,
        angles,
        trainFeaturesFlat: trainFeatures.flat(),
        trainLabels,
        trainPredictions,
        testLabels,
        testPredictions,
        weights,
        trainAccuracy,
        testAccuracy,
        step,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(angles, -1, false),
        edges: [],
        description: `Seeded a random two-qubit feature map with four fixed rotation angles for ${TRAIN.length} training points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(0, false),
    };

    for (let index = 0; index < TRAIN.length; index += 1) {
        yield {
            stepNumber: index + 1,
            entities: makeBars(trainFeatures[index]!, index % 4, false),
            edges: [],
            description: `Point ${index + 1} at (${TRAIN[index]![0].toFixed(2)}, ${TRAIN[index]![1].toFixed(2)}) maps to four quantum features including the ZZ correlation.`,
            codeLineNumber: 2,
            layout: "array",
            meta: metaFor(index + 1, false),
        };
    }

    yield {
        stepNumber: TRAIN.length + 1,
        entities: makeBars(weights, -1, true),
        edges: [],
        description: `Fitted output weights in one least-squares solve: training accuracy ${trainAccuracy.toFixed(3)} and test accuracy ${testAccuracy.toFixed(3)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(TRAIN.length + 1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An extreme learning machine uses a random feature map and never trains it. The quantum version sends each input point through a seeded random circuit and reads out the expectations of Z on both qubits plus their product. Those four numbers are the features; a single linear least-squares solve produces the classifier. The randomness supplies nonlinearity, and the training is almost free because nothing is backpropagated through the circuit.",
        invariants: [
            "For a fixed seed the random angles and therefore every feature vector are reproducible.",
            "Each readout feature lies between minus one and one, and the bias feature is one.",
            "Predictions are the sign of a fixed linear score with no further circuit changes.",
        ],
        correctness:
            "The feature circuit consists of single-qubit rotations, one controlled-NOT, and two more rotations, so every feature is an exact expectation value of a Pauli observable on the resulting state. Labeling by a circle rule gives a nonlinear decision problem; the random quantum features lift it into a space where a linear threshold can separate the points. Solving the normal equations with a small diagonal penalty gives the least-squares weights, and the reported predictions are exactly the signs of the resulting scores on training and held-out points.",
        complexityRationale:
            "Generating one feature vector costs a constant-size circuit simulation, so all sample features cost O(samples). The linear solve is cubic in the four features, a constant here, and prediction is linear in the sample count. On hardware the circuit would be shallow and the classical solve negligible, which is the main appeal of the method.",
        uses: [
            "Fast classification with shallow random quantum circuits",
            "Benchmarking quantum feature maps on small data sets",
            "Hybrid machine learning where circuit parameters stay fixed",
        ],
        references: [
            "Huang et al., Power of Data in Quantum Machine Learning, 2021",
            "Liu et al., Quantum Extreme Learning Machine, 2021",
        ],
        workedExample:
            "With seed seven the random angles are fixed once. A point near the origin and a point near a corner produce different ZZ correlations, and the fitted bias and three weights draw a linear boundary in feature space that labels the inner points positive and the outer points negative.",
    },
    id: "quantum-extreme-learning-machine",
    name: "Quantum Extreme Learning Machine",
    category: "quantum",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a seed and derive four fixed rotation angles",
        "for each training point prepare a two-qubit feature state",
        "read out Z0, Z1, and their product as features plus a bias",
        "label the point by a small-circle rule",
        "solve the regularized least-squares problem for output weights",
        "predict training and held-out labels from the sign of the linear score",
        "done: report weights and both accuracies",
    ],
};

export default module;
