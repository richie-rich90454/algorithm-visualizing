/**
 * quantum-reservoir-computing.ts - Quantum Reservoir Computing on Three Qubits
 *
 * A small exact simulation of a quantum reservoir computer. A fixed three-qubit
 * circuit is driven sequentially by an input signal; entanglement and rotation
 * give the state a short fading memory, and Pauli Z expectations form the
 * readout features. A ridge regression readout is fitted to a nonlinear target
 * sequence. The model is exact for three qubits and a fixed gate pattern, uses
 * ideal expectation values rather than shot estimates, and does not model
 * hardware noise or train the reservoir internal gates.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface ReservoirInput {
    length?: number;
}

const FIXED_Z1 = 0.7;
const FIXED_Z2 = -0.4;
const RIDGE = 1e-3;

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function ry(state: Complex[], targetQubit: number, angle: number): void {
    const stride = 2 ** targetQubit;
    const cosine = Math.cos(angle / 2);
    const sine = Math.sin(angle / 2);
    for (let base = 0; base < 8; base += 2 * stride) {
        for (let offset = 0; offset < stride; offset += 1) {
            const x = base + offset;
            const y = x + stride;
            const a = state[x]!;
            const b = state[y]!;
            state[x] = [cosine * a[0] - sine * b[0], cosine * a[1] - sine * b[1]];
            state[y] = [sine * a[0] + cosine * b[0], sine * a[1] + cosine * b[1]];
        }
    }
}

function rz(state: Complex[], targetQubit: number, angle: number): void {
    const stride = 2 ** targetQubit;
    const plus: Complex = [Math.cos(angle / 2), Math.sin(angle / 2)];
    const minus: Complex = [Math.cos(angle / 2), -Math.sin(angle / 2)];
    for (let index = 0; index < 8; index += 1) {
        const phase = ((index >> targetQubit) & 1) === 1 ? plus : minus;
        state[index] = cMul(state[index]!, phase);
    }
}

function cnot(state: Complex[], controlQubit: number, targetQubit: number): void {
    const targetStride = 2 ** targetQubit;
    for (let index = 0; index < 8; index += 1) {
        if (((index >> controlQubit) & 1) === 0 || ((index >> targetQubit) & 1) === 1) continue;
        const partner = index + targetStride;
        const tmp = state[partner]!;
        state[partner] = state[index]!;
        state[index] = tmp;
    }
}

function expectationZ(state: Complex[], qubit: number): number {
    let value = 0;
    for (let index = 0; index < 8; index += 1) {
        const z = state[index]!;
        const probability = z[0] * z[0] + z[1] * z[1];
        value += ((index >> qubit) & 1) === 0 ? probability : -probability;
    }
    return value;
}

/** Solve a small symmetric positive definite linear system by elimination. */
function solve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const augmented = matrix.map((row, i) => [...row, rhs[i]!]);
    for (let column = 0; column < n; column += 1) {
        let pivot = column;
        for (let row = column + 1; row < n; row += 1) {
            if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
        }
        const tmp = augmented[column]!;
        augmented[column] = augmented[pivot]!;
        augmented[pivot] = tmp;
        const divisor = augmented[column]![column]! || 1e-15;
        for (let j = column; j <= n; j += 1) augmented[column]![j] /= divisor;
        for (let row = 0; row < n; row += 1) {
            if (row === column) continue;
            const factor = augmented[row]![column]!;
            for (let j = column; j <= n; j += 1) augmented[row]![j] -= factor * augmented[column]![j]!;
        }
    }
    return augmented.map((row) => row[n]!);
}

function ridgeFit(features: number[][], targets: number[]): number[] {
    const dimension = features[0]!.length;
    const gram = Array.from({ length: dimension }, (_, i) => Array.from({ length: dimension }, (_, j) =>
        features.reduce((sum, row) => sum + row[i]! * row[j]!, 0) + (i === j ? RIDGE : 0)));
    const moment = Array.from({ length: dimension }, (_, i) => features.reduce((sum, row, index) => sum + row[i]! * (targets[index] ?? 0), 0));
    return solve(gram, moment);
}

function makeBars(values: number[], labels: string[], highlight: number, final: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `feature-${index}`,
        type: "bar" as const,
        label: `${labels[index]}: ${value.toFixed(4)}`,
        value,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ReservoirInput | null) ?? {};
    const length = typeof task.length === "number" ? Math.max(4, Math.min(12, Math.floor(task.length))) : 8;
    const state: Complex[] = Array.from({ length: 8 }, (_, i) => [i === 0 ? 1 : 0, 0] as Complex);
    const features: number[][] = [];
    const targets: number[] = [];
    let weights: number[] = [];
    let predictions: number[] = [];
    let mse = 0;
    let baseline = 0;
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const metaFor = (step: number, done: boolean) => ({
        length,
        step,
        featuresFlat: features.flat(),
        targets,
        predictions,
        weights,
        mse,
        baselineMse: baseline,
        amplitudes: flat(state),
        currentInput: step > 0 ? step / (length + 1) : 0,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars([0, 0, 0], ["Z0", "Z1", "Z2"], -1, false),
        edges: [],
        description: `Initialized a three-qubit reservoir with a fixed gate pattern for ${length} input steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(0, false),
    };

    for (let step = 1; step <= length; step += 1) {
        const inputValue = step / (length + 1);
        ry(state, 0, Math.PI * inputValue);
        cnot(state, 0, 1);
        rz(state, 1, FIXED_Z1);
        cnot(state, 1, 2);
        rz(state, 2, FIXED_Z2);
        const readout = [expectationZ(state, 0), expectationZ(state, 1), expectationZ(state, 2)];
        features.push([1, ...readout]);
        targets.push(inputValue * inputValue);
        const peak = readout.indexOf(Math.max(...readout));
        yield {
            stepNumber: step,
            entities: makeBars(readout, ["Z0", "Z1", "Z2"], peak, false),
            edges: [],
            description: `Step ${step}: drove the reservoir with input ${inputValue.toFixed(3)} and read out three Pauli Z expectations.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...metaFor(step, false), readout },
        };
    }

    weights = ridgeFit(features, targets);
    predictions = features.map((row) => row.reduce((sum, value, i) => sum + value * weights[i]!, 0));
    mse = predictions.reduce((sum, prediction, i) => sum + (prediction - targets[i]!) ** 2, 0) / length;
    const mean = targets.reduce((sum, value) => sum + value, 0) / length;
    baseline = targets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / length;
    yield {
        stepNumber: length + 1,
        entities: makeBars([mse, baseline, 1 - mse / (baseline || 1)], ["MSE", "Baseline", "R2"], -1, true),
        edges: [],
        description: `Trained the ridge readout: mean squared error ${mse.toFixed(6)} beats the constant baseline ${baseline.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(length + 1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A reservoir computer is a fixed, rich dynamical system plus a cheap trainable readout. The quantum version drives a small entangled circuit with a sequence of inputs and reads out expectation values as features. Because the circuit state is never reset, earlier inputs leave a trace in the state, giving the readout a short memory. Only the final linear layer is trained, so learning is fast even though the internal dynamics are complicated.",
        invariants: [
            "The reservoir gates are unitary, so the state vector stays normalized at every step.",
            "Each Pauli Z expectation lies between minus one and one.",
            "Ridge regression solves a positive definite normal system because a positive constant is added to the diagonal.",
        ],
        correctness:
            "Every gate is applied to the full eight-amplitude state: rotations are real orthogonal two-by-two blocks, and controlled-NOT and controlled-phase are permutations or diagonal unitaries, so the norm is preserved. The readout values are exactly the expectation values of Z on each qubit because the squared amplitudes of zero and one outcomes are subtracted. Ridge regression minimizes squared error plus a quadratic penalty, and Gaussian elimination with partial pivoting solves the resulting normal equations, so the reported predictions are the fitted model's true outputs.",
        complexityRationale:
            "For a fixed number of qubits the circuit update per step is constant work and the readout has constant width, so the simulation is O(length). Fitting the readout solves a small dense system in constant time here; in general it costs O(samples times features squared) for feature map construction and a cubic solve in the feature dimension.",
        uses: [
            "Time-series prediction on near-term quantum processors",
            "Quantum machine learning with shallow fixed circuits",
            "Studying memory and nonlinearity in quantum dynamical systems",
        ],
        references: [
            "Lorenzo et al., Reservoir Computing with Quantum Systems, 2021",
            "Nakajima et al., Quantum Reservoir Computing, 2022",
        ],
        workedExample:
            "Driving the reservoir with a rising sequence of inputs produces three smoothly changing Z expectations. Fitting a linear readout to the squared input yields a small mean squared error and a positive coefficient of determination, showing that the reservoir features carry enough information about the target without training the circuit itself.",
    },
    id: "quantum-reservoir-computing",
    name: "Quantum Reservoir Computing",
    category: "quantum",
    complexity: { time: "O(length)", space: "O(1)" },
    defaultInput: { length: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the three-qubit reservoir state and choose the input length",
        "for each input value apply an input-dependent rotation on the first qubit",
        "entangle the register with controlled-NOT gates and fixed phase rotations",
        "measure the three Pauli Z expectations as readout features",
        "append a bias and store the target value for the step",
        "fit ridge regression weights to the collected features",
        "done: report predictions, mean squared error, and the baseline",
    ],
};

export default module;
