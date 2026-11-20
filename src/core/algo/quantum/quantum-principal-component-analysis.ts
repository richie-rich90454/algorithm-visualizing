/**
 * quantum-principal-component-analysis.ts - Quantum PCA by Density Exponentiation
 *
 * A four-qubit exact simulation of the core of quantum principal component
 * analysis. A two-by-two density matrix is exponentiated by its analytic
 * eigendecomposition, powers exp(2 pi i rho 2^k) are applied under control of
 * three phase-estimation qubits, and an inverse Fourier transform reveals the
 * dominant eigenvalue as a peak in the measurement distribution. This is an
 * ideal small model limited to a 2x2 real density matrix with three-bit phase
 * resolution; it assumes an exact controlled exponentiation oracle and does not
 * model Trotter error, sampling noise, or fault tolerance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];
type Matrix = Complex[][];

interface PcaInput {
    a?: number;
    b?: number;
}

const QUBITS = 3;
const OUTCOMES = 2 ** QUBITS;

function cAdd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function cScale(a: Complex, s: number): Complex {
    return [a[0] * s, a[1] * s];
}

function eigen(a: number, b: number): { lambda0: number; lambda1: number; v0: [number, number] } {
    const d = a - 0.5;
    const r = Math.hypot(d, b);
    const lambda0 = 0.5 + r;
    const lambda1 = 0.5 - r;
    if (Math.abs(b) < 1e-12) {
        return { lambda0, lambda1, v0: d >= 0 ? [1, 0] : [0, 1] };
    }
    const x = b;
    const y = r - d;
    const norm = Math.hypot(x, y);
    return { lambda0, lambda1, v0: [x / norm, y / norm] };
}

function powerMatrix(lambda0: number, lambda1: number, v0: [number, number], k: number): Matrix {
    const v1: [number, number] = [-v0[1], v0[0]!];
    const scale = 2 * Math.PI * 2 ** k;
    const p: Complex = [Math.cos(scale * lambda0), Math.sin(scale * lambda0)];
    const q: Complex = [Math.cos(scale * lambda1), Math.sin(scale * lambda1)];
    const components = [[v0[0]!, v1[0]!], [v0[1]!, v1[1]!]];
    return components.map((row) => components.map((column) => cAdd(cScale(p, row[0]! * column[0]!), cScale(q, row[1]! * column[1]!))));
}

function makeBars(probabilities: number[], highlight: number, final: boolean): VisualEntity[] {
    return probabilities.map((probability, index) => ({
        id: `outcome-${index}`,
        type: "bar" as const,
        label: `m=${index}: ${probability.toFixed(4)}`,
        value: probability,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability, eigenvalueEstimate: index / OUTCOMES },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PcaInput | null) ?? {};
    let a = typeof task.a === "number" && Number.isFinite(task.a) ? Math.max(0.05, Math.min(0.95, task.a)) : 0.7;
    const bound = Math.sqrt(a * (1 - a)) * 0.999;
    let b = typeof task.b === "number" && Number.isFinite(task.b) ? Math.max(-bound, Math.min(bound, task.b)) : 0.2;
    if (Math.abs(b) < 1e-9) b = 0;
    const { lambda0, lambda1, v0 } = eigen(a, b);
    const matrices = [0, 1, 2].map((k) => powerMatrix(lambda0, lambda1, v0, k));
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const probabilitiesOf = (amps: Complex[]): number[] => {
        const probs = Array.from({ length: OUTCOMES }, () => 0);
        for (let index = 0; index < amps.length; index += 1) {
            const outcome = Math.floor(index / 2);
            const z = amps[index]!;
            probs[outcome] = probs[outcome]! + z[0] * z[0] + z[1] * z[1];
        }
        return probs;
    };
    const metaFor = (amps: Complex[], done: boolean) => {
        const probs = probabilitiesOf(amps);
        const peak = probs.indexOf(Math.max(...probs));
        return {
            a,
            b,
            lambda0,
            lambda1,
            principalX: v0[0],
            principalY: v0[1],
            probabilities: probs,
            amplitudes: flat(amps),
            uReal: matrices.flatMap((m) => m.flatMap((row) => row.map((z) => z[0]))),
            uImag: matrices.flatMap((m) => m.flatMap((row) => row.map((z) => z[1]))),
            peak,
            estimate: peak / OUTCOMES,
            estimateError: Math.abs(peak / OUTCOMES - lambda0),
            norm: amps.reduce((sum, z) => sum + z[0] * z[0] + z[1] * z[1], 0),
            done,
        };
    };

    let state: Complex[] = Array.from({ length: 16 }, () => [0, 0] as Complex);
    const factor = 1 / Math.sqrt(OUTCOMES);
    for (let c = 0; c < OUTCOMES; c += 1) {
        state[2 * c] = [factor * v0[0]!, 0];
        state[2 * c + 1] = [factor * v0[1]!, 0];
    }
    yield {
        stepNumber: 0,
        entities: makeBars(probabilitiesOf(state), -1, false),
        edges: [],
        description: `Density matrix entries a=${a.toFixed(3)}, b=${b.toFixed(3)} give eigenvalues ${lambda0.toFixed(4)} and ${lambda1.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaFor(state, false), rhoEntries: [a, b, b, 1 - a] },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(probabilitiesOf(state), -1, false),
        edges: [],
        description: "The counting register is uniform and the system qubit holds the principal eigenvector of rho.",
        codeLineNumber: 1,
        layout: "array",
        meta: metaFor(state, false),
    };

    for (let k = 0; k < QUBITS; k += 1) {
        const matrix = matrices[k]!;
        const bit = k;
        const next = state.map((z) => [...z] as Complex);
        for (let c = 0; c < OUTCOMES; c += 1) {
            if (((c >> bit) & 1) === 0) continue;
            const x = state[2 * c]!;
            const y = state[2 * c + 1]!;
            next[2 * c] = cAdd(cMul(matrix[0]![0]!, x), cMul(matrix[0]![1]!, y));
            next[2 * c + 1] = cAdd(cMul(matrix[1]![0]!, x), cMul(matrix[1]![1]!, y));
        }
        state = next;
        yield {
            stepNumber: k + 2,
            entities: makeBars(probabilitiesOf(state), -1, false),
            edges: [],
            description: `Applied controlled exp(2 pi i rho times ${2 ** k}) on the counting qubit for bit ${k}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: metaFor(state, false),
        };
    }

    const transformed: Complex[] = Array.from({ length: 16 }, () => [0, 0] as Complex);
    for (let output = 0; output < OUTCOMES; output += 1) {
        for (let system = 0; system < 2; system += 1) {
            let real = 0;
            let imag = 0;
            for (let input = 0; input < OUTCOMES; input += 1) {
                const angle = (-2 * Math.PI * output * input) / OUTCOMES;
                const z = state[2 * input + system]!;
                real += Math.cos(angle) * z[0] - Math.sin(angle) * z[1];
                imag += Math.cos(angle) * z[1] + Math.sin(angle) * z[0];
            }
            const inverseScale = Math.sqrt(OUTCOMES);
            transformed[2 * output + system] = [real / inverseScale, imag / inverseScale];
        }
    }
    state = transformed;
    const probs = probabilitiesOf(state);
    yield {
        stepNumber: 5,
        entities: makeBars(probs, probs.indexOf(Math.max(...probs)), false),
        edges: [],
        description: "The inverse Fourier transform converts eigenphases into a peaked distribution over measurement outcomes.",
        codeLineNumber: 4,
        layout: "array",
        meta: metaFor(state, false),
    };

    yield {
        stepNumber: 6,
        entities: makeBars(probs, -1, true),
        edges: [],
        description: `The peak at outcome ${metaFor(state, true).peak} estimates the principal eigenvalue as ${metaFor(state, true).estimate.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor(state, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quantum PCA treats a covariance matrix as a density matrix and exponentiates it. The eigenvectors of that exponent are the principal components, and their eigenvalues appear as phases. By feeding the phase through a phase-estimation register, the dominant eigenvalue shows up as a peak in a measurement histogram, so the leading direction of a data cloud can be found without writing out all eigenvector components.",
        invariants: [
            "Each controlled power exp(2 pi i rho 2^k) is unitary because rho is Hermitian.",
            "The system qubit stays in the principal eigenvector, so the counting register captures only that eigenphase.",
            "Total probability over the eight counting outcomes stays one through the inverse transform.",
        ],
        correctness:
            "For a two-by-two real symmetric rho the analytic eigenvalues are 0.5 plus or minus the radius sqrt((a minus 0.5) squared plus b squared), with orthogonal eigenvectors. The exponentiation power matrix is V times diag(exp(2 pi i lambda_j 2^k)) times V transpose, which is verified by direct multiplication. Phase estimation applies these controlled powers to the eigenstate, and the inverse Fourier transform concentrates amplitude at the integer closest to 8 lambda_0, so the reported peak divided by eight approximates the dominant eigenvalue within one resolution unit.",
        complexityRationale:
            "The simulation holds sixteen complex amplitudes and applies three controlled two-by-two matrices plus an eight-point transform, all in constant time. General qPCA replaces the analytic exponentiation with repeated controlled swaps of purified density matrices, whose cost scales with the number of copies and the desired precision, while the phase-estimation register still needs O(log precision) qubits.",
        uses: [
            "Principal component analysis on quantum data sets",
            "Estimating spectra of covariance and density matrices",
            "Quantum machine learning feature extraction",
        ],
        references: [
            "Lloyd, Mohseni, and Shapiro, Quantum Principal Component Analysis, 2014",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "With a equals 0.7 and b equals 0.2 the radius is about 0.2828, so lambda0 is about 0.7828. Multiplying by eight gives 6.26, so the measurement histogram peaks at outcome 6 and the estimate 0.75 is within one eighth of the true eigenvalue.",
    },
    id: "quantum-principal-component-analysis",
    name: "Quantum Principal Component Analysis",
    category: "quantum",
    complexity: { time: "O(2^n) simulated", space: "O(2^n)" },
    defaultInput: { a: 0.7, b: 0.2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the entries of a two-by-two density matrix",
        "compute its eigenvalues and principal eigenvector analytically",
        "prepare a uniform counting register and place the eigenvector in the system qubit",
        "for each counting bit apply the controlled exponential exp(2 pi i rho 2^k)",
        "apply the inverse Fourier transform to the counting register",
        "find the peak outcome of the measurement distribution",
        "done: report the eigenvalue estimate and its error",
    ],
};

export default module;
