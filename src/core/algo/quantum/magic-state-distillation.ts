/**
 * magic-state-distillation.ts - Fifteen-to-One Magic State Distillation (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Noisy T magic states can be purified by measuring stabilizers of a classical
 * error-detecting code and keeping only the rounds with a zero syndrome. This
 * module uses the [15,11,3] Hamming code as that detector: fifteen input states
 * are indexed by the nonzero four-bit vectors, and the syndrome is the XOR of
 * the indices that carry an error. A zero syndrome means the error pattern is a
 * codeword; the lightest codewords have weight three and are the logical errors
 * that survive detection. A brute-force enumeration over all 2^15 patterns
 * gives the exact post-selection and output-error probabilities.
 *
 * This is a combinatorial teaching model of the Bravyi-Kitaev idea, not a full
 * stabilizer-circuit simulation. It assumes independent T errors of known
 * probability, perfect syndrome measurements, and the simplified Hamming-code
 * detector; it ignores correlated errors, circuit noise, and finite overhead.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^15) to enumerate all error patterns
 *   Space: O(15) for one pattern and its syndrome
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Fifteen bars represent the fifteen input magic states.
 *   - A red bar carries an error; yellow marks a rejected pattern.
 *   - The final frame reports acceptance and output-error probabilities.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DistillationInput {
    p?: number;
}

const N = 15;

/** Popcount of a 15-bit error pattern. */
function weight(mask: number): number {
    let count = 0;
    let value = mask;
    while (value !== 0) {
        value &= value - 1;
        count += 1;
    }
    return count;
}

/** Hamming syndrome: XOR of the four-bit indices of erroneous inputs. */
function syndrome(mask: number): number {
    let result = 0;
    for (let i = 0; i < N; i += 1) {
        if (((mask >> i) & 1) === 1) result ^= i + 1;
    }
    return result;
}

/** A surviving logical error is an odd multiple of the weight-three logical. */
function isLogical(patternWeight: number): boolean {
    return patternWeight % 4 === 3;
}

/** Exact probabilities under independent errors with probability p. */
function statistics(p: number): { accept: number; logical: number; weight3: number } {
    let accept = 0;
    let logical = 0;
    let weight3 = 0;
    for (let mask = 0; mask < 1 << N; mask += 1) {
        const w = weight(mask);
        const errorPattern = p ** w * (1 - p) ** (N - w);
        if (syndrome(mask) !== 0) continue;
        accept += errorPattern;
        if (w === 3) weight3 += 1;
        if (isLogical(w)) logical += errorPattern;
    }
    return { accept, logical, weight3 };
}

function makeBars(errorMask: number, state: EntityState): VisualEntity[] {
    return Array.from({ length: N }, (_, i) => {
        const error = ((errorMask >> i) & 1) === 1;
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `T${i + 1}${error ? " error" : ""}`,
            value: error ? 1 : 0,
            state: error ? state : "idle",
            x: i,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, indexVector: i + 1, error },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DistillationInput | null) ?? {};
    const p = Math.min(0.1, Math.max(0, Number(task.p ?? 0.01)));
    const stats = statistics(p);
    const logicalGivenAccept = stats.accept > 0 ? stats.logical / stats.accept : 0;
    const leading = 35 * p ** 3;

    const metaBase = {
        p,
        acceptProbability: stats.accept,
        outputErrorProbability: logicalGivenAccept,
        weightThreeCodewords: stats.weight3,
        leadingTerm: leading,
    };

    yield {
        stepNumber: 0,
        entities: makeBars(0, "idle"),
        edges: [],
        description: `Preparing ${N} noisy T magic states, each with independent error probability ${p.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, syndrome: 0, accepted: true },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(0b000000000000111, "sorted"),
        edges: [],
        description: "Inputs 1, 2, and 3 have index vectors 1, 2, and 3, which XOR to zero: a weight-three logical error.",
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase, syndrome: 0, accepted: true },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(1, "error"),
        edges: [],
        description: "A single error has syndrome equal to its index, which is nonzero, so this round is rejected.",
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, syndrome: 1, accepted: false },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(0b11, "comparing"),
        edges: [],
        description: "Two errors on inputs 1 and 2 give syndrome 3, also nonzero, so the round is rejected again.",
        codeLineNumber: 3,
        layout: "array",
        meta: { ...metaBase, syndrome: 3, accepted: false },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(0b000000000000111, "sorted"),
        edges: [],
        description: `Enumerated all ${1 << N} patterns: acceptance ${stats.accept.toFixed(6)}, conditional output error ${logicalGivenAccept.toFixed(8)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...metaBase, syndrome: 0, accepted: true, exact: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Distillation trades many mediocre magic states for one better state. You measure a code's parity checks and throw away every round whose answer is not all clear. The cheapest mistakes that slip through are weight-three patterns, so the surviving error rate falls roughly as the cube of the starting error rate.",
        invariants: [
            "The syndrome is the XOR of the four-bit indices of all erroneous inputs.",
            "A round is accepted exactly when its syndrome is zero.",
            "The leading surviving error term comes from the weight-three codewords of the detector.",
        ],
        correctness:
            "The Hamming code has minimum distance three, so every error of weight one or two has a distinct nonzero syndrome and is discarded. Its weight-three codewords are the triples a, b, a xor b for distinct nonzero four-bit vectors, of which there are fifteen times fourteen divided by six, namely thirty-five. Those are the least likely undetectable patterns, so the conditional error probability has leading term thirty-five p cubed, which the brute-force enumeration over all 2^15 patterns reproduces exactly.",
        complexityRationale:
            "Enumerating all 2^15 error patterns and computing a four-bit syndrome for each costs O(2^15) time, while a single pattern needs only fifteen bits of storage. A real implementation would use a decoder rather than enumeration.",
        uses: [
            "Purifying T states for fault-tolerant non-Clifford gates",
            "Estimating magic-state overhead in a surface-code architecture",
            "A teaching example of post-selected error detection",
        ],
        references: [
            "Bravyi and Kitaev, Magic State Distillation with Low Overhead, 2005",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "With error probability p = 0.01, the three inputs with index vectors 1, 2, and 3 all wrong produce XOR zero and pass detection. The chance of that pattern is about p cubed, and thirty-five such triples exist, so the output error is about thirty-five times p cubed while almost every single or double error is rejected.",
    },
    id: "magic-state-distillation",
    name: "Magic State Distillation (15-to-1 Toy Model)",
    category: "quantum",
    complexity: { time: "O(2^15)", space: "O(15)" },
    defaultInput: { p: 0.01 },
    visualType: "array",
    run,
    pseudocode: [
        "index the fifteen inputs by nonzero four-bit vectors",
        "for every error pattern compute its probability",
        "compute the syndrome as the XOR of erroneous indices",
        "reject every pattern with a nonzero syndrome",
        "count accepted weight-three logical patterns",
        "divide surviving error mass by acceptance mass",
        "done: report acceptance and output error probability",
    ],
};

export default module;
