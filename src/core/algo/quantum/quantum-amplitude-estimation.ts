/**
 * quantum-amplitude-estimation.ts - Quantum Amplitude Estimation (exact toy model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum amplitude estimation estimates the amplitude a of the good subspace
 * prepared by an operator A. It applies phase estimation to the Grover operator
 * G, whose eigenphases are plus or minus 2*theta with sin^2(theta) = a. A t-qubit
 * counting register holds uniform superposition, controlled powers of G kick
 * the phase back, and an inverse quantum Fourier transform reads out an integer
 * m near 2^t * theta / pi. The amplitude estimate is sin^2(pi * m / 2^t), with
 * quadratic speedup over ordinary sampling.
 *
 * This is an exact state-vector simulation for small t (up to 6). It chooses
 * theta = pi*k/2^t so the phase is representable and the answer is exact. It
 * models the two-dimensional Grover rotation and ignores physical noise and
 * fault tolerance; that limit is stated rather than hidden.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t * 2^t) for the simulated Fourier transform
 *   Space: O(2^(t+1)) complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement probability of each counting outcome.
 *   - The peak outcome is yellow; the final measured outcome is green.
 *   - The true amplitude, estimate, and success probability are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

function cAdd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

function cScale(a: Complex, factor: number): Complex {
    return [a[0] * factor, a[1] * factor];
}

function cRotate(a: Complex, cos: number, sin: number): Complex {
    return [a[0] * cos - a[1] * sin, a[0] * sin + a[1] * cos];
}

function magnitudeSquared(a: Complex): number {
    return a[0] * a[0] + a[1] * a[1];
}

/** Apply controlled powers of the Grover rotation to the work qubit. */
function applyControlledGrover(
    state: Complex[],
    dimension: number,
    theta: number,
): void {
    for (let j = 0; j < Math.log2(dimension); j += 1) {
        const angle = 2 ** j * 2 * theta;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const bit = 1 << j;
        for (let counting = 0; counting < dimension; counting += 1) {
            if ((counting & bit) === 0) continue;
            const i0 = counting * 2;
            const i1 = i0 + 1;
            const a0 = state[i0]!;
            const a1 = state[i1]!;
            state[i0] = cAdd(cScale(a0, cos), cScale(a1, -sin));
            state[i1] = cAdd(cScale(a0, sin), cScale(a1, cos));
        }
    }
}

/** Exact inverse quantum Fourier transform on the counting register. */
function inverseQft(state: Complex[], dimension: number, t: number): Complex[] {
    const inv = 1 / Math.sqrt(dimension);
    const result: Complex[] = Array.from({ length: state.length }, () => [0, 0]);
    for (let y = 0; y < dimension; y += 1) {
        for (let x = 0; x < dimension; x += 1) {
            const angle = (-2 * Math.PI * x * y) / dimension;
            const cos = Math.cos(angle) * inv;
            const sin = Math.sin(angle) * inv;
            for (let work = 0; work < 2; work += 1) {
                const source = state[x * 2 + work]!;
                const target = y * 2 + work;
                result[target] = cAdd(result[target]!, cRotate(source, cos, sin));
            }
        }
    }
    return result;
}

/** Counting-outcome probability distribution of a joint state. */
function probabilitiesOf(state: Complex[], dimension: number): number[] {
    return Array.from({ length: dimension }, (_, y) =>
        magnitudeSquared(state[y * 2]!) + magnitudeSquared(state[y * 2 + 1]!),
    );
}

function makeBars(probabilities: number[], highlighted: number, done: boolean): VisualEntity[] {
    return probabilities.map((probability, index) => {
        const state: EntityState = done
            ? index === highlighted
                ? "sorted"
                : "idle"
            : index === highlighted
              ? "comparing"
              : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(index),
            value: probability,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, probability },
        };
    });
}

/** The quantum amplitude estimation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { t?: number; k?: number } | null) ?? {};
    const t = Math.min(6, Math.max(1, typeof task.t === "number" ? Math.floor(task.t) : 5));
    const dimension = 1 << t;
    const k = Math.min(dimension - 1, Math.max(1, typeof task.k === "number" ? Math.floor(task.k) : 2));
    const theta = (Math.PI * k) / dimension;
    const trueAmplitude = Math.sin(theta) ** 2;
    const phase = theta / Math.PI;

    const state: Complex[] = Array.from({ length: dimension * 2 }, () => [0, 0]);
    const amplitudeEach = 1 / Math.sqrt(dimension * 2);
    for (let counting = 0; counting < dimension; counting += 1) {
        state[counting * 2] = [amplitudeEach, 0];
        state[counting * 2 + 1] = [0, -amplitudeEach];
    }

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(probabilitiesOf(state, dimension), -1, false),
        edges: [],
        description: `Estimating amplitude a = sin^2(${k}*pi/${dimension}) with a ${t}-qubit counting register.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { t, k, dimension, phase, amplitude: trueAmplitude, estimate: 0, probability: 0 },
    };

    // Controlled powers of G write the eigenphase into the counting register.
    applyControlledGrover(state, dimension, theta);
    const phaseProbabilities = probabilitiesOf(state, dimension);
    yield {
        stepNumber: step++,
        entities: makeBars(phaseProbabilities, -1, false),
        edges: [],
        description: "Controlled powers of the Grover operator imprint the eigenphase on the counting register.",
        codeLineNumber: 2,
        layout: "array",
        meta: { t, k, dimension, phase, amplitude: trueAmplitude, estimate: 0, probability: 0 },
    };

    const transformed = inverseQft(state, dimension, t);
    const probabilities = probabilitiesOf(transformed, dimension);
    let measured = 0;
    for (let index = 1; index < dimension; index += 1) {
        if ((probabilities[index] ?? 0) > (probabilities[measured] ?? 0)) measured = index;
    }
    yield {
        stepNumber: step++,
        entities: makeBars(probabilities, measured, false),
        edges: [],
        description: `The inverse quantum Fourier transform concentrates probability on outcome ${measured}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            t,
            k,
            dimension,
            phase,
            amplitude: trueAmplitude,
            estimate: Math.sin((Math.PI * measured) / dimension) ** 2,
            probability: probabilities[measured]!,
        },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(probabilities, measured, true),
        edges: [],
        description: `Measured ${measured}, giving the phase estimate ${(measured / dimension).toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            t,
            k,
            dimension,
            phase,
            amplitude: trueAmplitude,
            estimate: Math.sin((Math.PI * measured) / dimension) ** 2,
            probability: probabilities[measured]!,
        },
    };

    const estimate = Math.sin((Math.PI * measured) / dimension) ** 2;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, measured, true),
        edges: [],
        description: `Amplitude estimate ${estimate.toFixed(6)} versus true amplitude ${trueAmplitude.toFixed(6)} (success probability ${probabilities[measured]!.toFixed(4)}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            t,
            k,
            dimension,
            phase,
            amplitude: trueAmplitude,
            estimate,
            probability: probabilities[measured]!,
            measured,
        },
    };
}

/** The quantum amplitude estimation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Amplitude estimation is phase estimation in disguise. The Grover operator rotates a two-dimensional subspace by an angle whose sine squared is the amplitude you want. Estimating that rotation angle to t bits of precision therefore estimates the amplitude, and the precision improves quadratically faster than repeated sampling would allow.",
        invariants: [
            "The joint state stays normalized because every operation is unitary.",
            "For theta = pi*k/2^t the eigenphase k/2^t is exactly representable.",
            "The reported estimate is sin squared of pi times the measured integer over 2 to the t.",
        ],
        correctness:
            "The Grover rotation on the subspace spanned by the good and bad states has eigenvalues exp(plus or minus 2i*theta), so its eigenphase is theta/pi when sin squared theta equals the amplitude. Controlled powers followed by the inverse Fourier transform produce a measurement distribution peaked at the integer nearest 2^t times that phase. When theta is chosen as pi*k/2^t the peak is exactly k with probability one, and sin squared of pi*k/2^t recovers the amplitude exactly.",
        complexityRationale:
            "A physical run uses O(t) Grover applications and a Fourier transform. The exact classical simulation evolves 2^(t+1) complex amplitudes and performs a dense Fourier transform costing O(t * 2^t) time and O(2^t) space, which is why t is limited to six in this teaching model.",
        uses: [
            "Quadratically faster Monte Carlo integration",
            "Estimating probabilities in quantum counting and search",
            "Risk analysis and finance workloads proposed for early quantum computers",
        ],
        references: [
            "Brassard, Hoyer, Mosca, and Tapp, Quantum Amplitude Amplification and Estimation, 2002",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
        ],
        workedExample:
            "With t = 3 and k = 2, theta = pi/4 and the amplitude is sin squared of pi/4, namely 0.5. The eigenphase is 2/8, so the counting register peaks at outcome 2 and the estimate sin squared of 2*pi/8 is again 0.5.",
    },
    id: "quantum-amplitude-estimation",
    name: "Quantum Amplitude Estimation",
    category: "quantum",
    complexity: { time: "O(t * 2^t) simulated", space: "O(2^t) simulated" },
    defaultInput: { t: 5, k: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose theta so that sin squared theta is the amplitude",
        "prepare a uniform superposition on t counting qubits",
        "apply controlled powers of the Grover operator",
        "kick back the eigenphase into the counting register",
        "apply the inverse quantum Fourier transform",
        "measure the counting register as an integer m",
        "set the amplitude estimate to sin squared of pi times m over 2 to the t",
        "done: report the estimate and the success probability",
    ],
};

export default module;
