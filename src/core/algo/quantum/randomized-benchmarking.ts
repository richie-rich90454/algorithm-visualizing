/**
 * randomized-benchmarking.ts - Single-Qubit Clifford Randomized Benchmarking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Randomized benchmarking estimates gate error without depending on how each
 * gate is calibrated. Random Clifford sequences are followed by the inverse of
 * their product, so the ideal operation is always the identity. Depolarizing
 * noise shrinks the Bloch vector by a factor p after every gate, and the return
 * probability decays as (1 + p^(m+1))/2 for a sequence of m Cliffords. Fitting
 * that curve recovers p and the average gate fidelity.
 *
 * This is an exact small simulation over the 24-element single-qubit Clifford
 * group represented as signed permutations of X, Y, and Z. It uses a fixed
 * seed for reproducible sequences and an ideal depolarizing channel; it does
 * not model leakage, coherent errors, shot noise, or multi-qubit gates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(24 * m_max) to build the group and evaluate the decay points
 *   Space: O(24) for the Clifford group elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measured return probability at each sequence length.
 *   - A bar is yellow while its length is being evaluated, green at the end.
 *   - The final frame reports the fitted depolarizing parameter.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BenchmarkInput {
    p?: number;
}

interface Clifford {
    perm: [number, number, number];
    sign: [number, number, number];
}

const IDENTITY: Clifford = { perm: [0, 1, 2], sign: [1, 1, 1] };
const H: Clifford = { perm: [2, 1, 0], sign: [1, -1, 1] };
const S: Clifford = { perm: [1, 0, 2], sign: [1, -1, 1] };
const LENGTHS = [1, 2, 4, 8, 16];

/** Compose two Cliffords: apply a, then b. */
function compose(a: Clifford, b: Clifford): Clifford {
    const perm = a.perm.map((target) => b.perm[target] ?? 0) as [number, number, number];
    const sign = a.perm.map((target, i) => (a.sign[i] ?? 1) * (b.sign[target] ?? 1)) as [number, number, number];
    return { perm, sign };
}

function keyOf(c: Clifford): string {
    return `${c.perm.join("")}:${c.sign.join("")}`;
}

/** Generate the full single-qubit Clifford group by closure under H and S. */
function buildGroup(): Clifford[] {
    const seen = new Map<string, Clifford>([[keyOf(IDENTITY), IDENTITY]]);
    const queue: Clifford[] = [IDENTITY];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        for (const generator of [H, S]) {
            const next = compose(current, generator);
            const key = keyOf(next);
            if (seen.has(key)) continue;
            seen.set(key, next);
            queue.push(next);
        }
    }
    return [...seen.values()];
}

function inverseOf(c: Clifford): Clifford {
    const perm = [0, 0, 0] as [number, number, number];
    const sign = [1, 1, 1] as [number, number, number];
    for (let i = 0; i < 3; i += 1) {
        const target = c.perm[i] ?? 0;
        perm[target] = i;
        sign[target] = c.sign[i] ?? 1;
    }
    return { perm, sign };
}

function isIdentity(c: Clifford): boolean {
    return c.perm.every((value, i) => value === i) && c.sign.every((value) => value === 1);
}

/** Deterministic linear-congruential generator for the random sequences. */
function nextIndex(state: number, count: number): [number, number] {
    const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return [next % count, next];
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `m=${LENGTHS[index] ?? 0}: F=${value.toFixed(4)}`,
        value,
        state: done ? "sorted" : index === active ? "comparing" : "idle",
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, length: LENGTHS[index] ?? 0, fidelity: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BenchmarkInput | null) ?? {};
    const p = Math.min(0.99, Math.max(0, Number(task.p ?? 0.02)));
    const group = buildGroup();
    let seed = 12345;
    const fidelities: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(LENGTHS.map(() => 0), -1, false),
        edges: [],
        description: `Benchmarking the 24 Cliffords with depolarizing parameter ${p.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, groupSize: group.length, fidelities: [...fidelities], fittedP: 0 },
    };

    for (let i = 0; i < LENGTHS.length; i += 1) {
        const m = LENGTHS[i] ?? 0;
        let product = IDENTITY;
        for (let gate = 0; gate < m; gate += 1) {
            const [index, nextSeed] = nextIndex(seed, group.length);
            seed = nextSeed;
            product = compose(product, group[index] ?? IDENTITY);
        }
        const sequence = compose(product, inverseOf(product));
        const returnsIdentity = isIdentity(sequence);
        const fidelity = returnsIdentity ? (1 + p ** (m + 1)) / 2 : 0;
        fidelities.push(fidelity);

        yield {
            stepNumber: i + 1,
            entities: makeBars([...fidelities, ...LENGTHS.slice(fidelities.length).map(() => 0)], i, false),
            edges: [],
            description: `Sequence length ${m}: the inverse restores the identity and return probability is ${fidelity.toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { p, groupSize: group.length, fidelities: [...fidelities], fittedP: 0, length: m, returnsIdentity },
        };
    }

    const first = fidelities[0] ?? 0;
    const second = fidelities[1] ?? 0;
    const ratio = (2 * second - 1) / (2 * first - 1);
    const fittedP = ratio > 0 ? Math.pow(ratio, 1 / ((LENGTHS[1] ?? 2) - (LENGTHS[0] ?? 1))) : 0;
    const gateFidelity = (1 + fittedP) / 2;

    yield {
        stepNumber: LENGTHS.length + 1,
        entities: makeBars(fidelities, -1, true),
        edges: [],
        description: `Fitted depolarizing parameter ${fittedP.toFixed(4)}, giving an average gate fidelity of ${gateFidelity.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            p,
            groupSize: group.length,
            fidelities: [...fidelities],
            fittedP,
            gateFidelity,
            lengths: [...LENGTHS],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Run a random sequence of gates and then undo it exactly. If the gates were perfect you would always return to the start, so any decay you see is caused by error rather than by the sequence itself. Averaging over random sequences turns a messy device into a clean exponential decay whose slope is the error per gate.",
        invariants: [
            "Every sequence is followed by the inverse of its product, so the ideal operation is the identity.",
            "Depolarizing noise multiplies the Bloch vector by p at each gate.",
            "The return probability depends only on the sequence length, not on which Cliffords were drawn.",
        ],
        correctness:
            "The single-qubit Cliffords are signed permutations of the three Pauli axes, closed under composition by H and S, and there are exactly twenty-four of them. Inverting the product of the drawn Cliffords makes the composed operation the identity. A depolarizing channel with parameter p sends the Bloch vector r to p times r, so after m plus one noisy gates the initial z component becomes p to the m plus one. Measuring in the computational basis then gives (1 plus p to the m plus one) over two, and taking the ratio of two decay points recovers p exactly.",
        complexityRationale:
            "Generating the Clifford group costs a constant twenty-four states, and each decay point composes at most m signed permutations, so the work is linear in the longest sequence length. Real benchmarking averages over many random sequences and shot-noise-limited samples.",
        uses: [
            "Measuring average gate fidelity on quantum hardware",
            "Comparing calibration quality across hardware generations",
            "Separating stochastic error from state-preparation and measurement error",
        ],
        references: [
            "Magesan, Gambetta, and Emerson, Scalable and Robust Randomized Benchmarking of Quantum Processes, 2011",
            "Emerson et al., Scalable Noise Estimation with Random Unitary Operators, 2007",
        ],
        workedExample:
            "With p = 0.1, a sequence of one Clifford plus its inverse has two noisy gates, giving return probability (1 + 0.01)/2 = 0.505. A length-four sequence gives (1 + 0.00001)/2. The ratio of the two decay amplitudes recovers p = 0.1.",
    },
    id: "randomized-benchmarking",
    name: "Randomized Benchmarking (Single Qubit)",
    category: "quantum",
    complexity: { time: "O(24 * m_max)", space: "O(24)" },
    defaultInput: { p: 0.05 },
    visualType: "array",
    run,
    pseudocode: [
        "generate the single-qubit Clifford group",
        "for each sequence length draw random Cliffords",
        "append the inverse of their product",
        "apply depolarizing noise after every gate",
        "record the return probability for that length",
        "fit the exponential decay to estimate p",
        "done: report gate fidelity from the fitted slope",
    ],
};

export default module;
