/**
 * fri-commitment.ts - FRI Low-Degree Commitment (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching toy of the FRI (Fast Reed-Solomon IOPP) low-degree test,
 * not a secure cryptographic primitive. A polynomial is evaluated on a small
 * domain and the evaluations are committed with a Merkle tree. Each FRI round
 * folds the evaluation vector in half using a public challenge and recomputes
 * a Merkle root. Verification compares the folded result with the value
 * expected from the honest polynomial; a tampered evaluation changes the root
 * and fails the check.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for N domain points across all rounds
 *   Space: O(N) for the evaluation vectors and Merkle levels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per evaluation in the current FRI layer.
 *   - The fold pairs are highlighted as the rounds proceed.
 *   - The final frame reports the Merkle root and the verification verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const DEFAULT_MODULUS = 65521;

/** Toy 32-bit avalanche used only to build a deterministic Merkle root. */
function hashPair(a: number, b: number): number {
    let h = (a ^ b) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12;
    h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic Merkle root of a leaf vector. */
function merkleRoot(values: number[]): number {
    if (values.length === 0) return 0;
    let level = values.map((v) => v >>> 0);
    while (level.length > 1) {
        const next: number[] = [];
        for (let i = 0; i < level.length; i += 2) {
            next.push(hashPair(level[i] as number, (level[i + 1] ?? 0) as number));
        }
        level = next;
    }
    return level[0] as number;
}

/** Evaluate a polynomial with Horner's rule in a prime field. */
function evaluate(coefficients: number[], x: number, modulus: number): number {
    let acc = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
        acc = (acc * x + (coefficients[i] as number)) % modulus;
    }
    return ((acc % modulus) + modulus) % modulus;
}

/** One FRI fold: combine adjacent pairs with challenge alpha. */
function fold(values: number[], alpha: number, modulus: number): number[] {
    const next: number[] = [];
    for (let i = 0; i < values.length; i += 2) {
        const a = values[i] as number;
        const b = (values[i + 1] ?? 0) as number;
        next.push((a + b + alpha * a) % modulus);
    }
    return next;
}

function buildEntities(layer: number[], highlighted: number): VisualEntity[] {
    return layer.map((value, index) => ({
        id: `eval-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === highlighted ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        coefficients?: number[];
        modulus?: number;
        alpha?: number;
        domainSize?: number;
        tamperIndex?: number;
    } | null) ?? {};
    const coefficients = task.coefficients ?? [3, 5, 2, 7];
    const modulus = typeof task.modulus === "number" ? task.modulus : DEFAULT_MODULUS;
    const alpha = typeof task.alpha === "number" ? task.alpha : 12345;
    const domainSize = typeof task.domainSize === "number" && task.domainSize >= 2 ? task.domainSize : 16;

    const honest: number[] = [];
    for (let i = 0; i < domainSize; i += 1) honest.push(evaluate(coefficients, i + 1, modulus));
    const committed = [...honest];
    const tamperIndex = typeof task.tamperIndex === "number" ? task.tamperIndex : -1;
    if (tamperIndex >= 0 && tamperIndex < committed.length) {
        committed[tamperIndex] = ((committed[tamperIndex] as number) + 1) % modulus;
    }

    let layer = [...committed];
    let expectedLayer = [...honest];
    let step = 0;
    const roots: number[] = [merkleRoot(layer)];

    yield {
        stepNumber: step++,
        entities: buildEntities(layer, -1),
        edges: [],
        description: `Committed ${domainSize} polynomial evaluations with a Merkle root; begin FRI folding.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            coefficients,
            modulus,
            alpha,
            domainSize,
            evaluations: [...committed],
            root: roots[0],
            phase: "start",
        },
    };

    let round = 0;
    while (layer.length > 1) {
        layer = fold(layer, alpha, modulus);
        expectedLayer = fold(expectedLayer, alpha, modulus);
        roots.push(merkleRoot(layer));
        yield {
            stepNumber: step++,
            entities: buildEntities(layer, 0),
            edges: [],
            description: `FRI round ${round}: folded ${layer.length * 2} values to ${layer.length}; new Merkle root ${roots[roots.length - 1]}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                round,
                layer: [...layer],
                root: roots[roots.length - 1],
                roots: [...roots],
                phase: "fold",
            },
        };
        round += 1;
    }

    const finalValue = layer[0] as number;
    const expectedValue = expectedLayer[0] as number;
    const verified = finalValue === expectedValue;
    yield {
        stepNumber: step++,
        entities: buildEntities(layer, 0),
        edges: [],
        description: verified
            ? `FRI check passed: final value ${finalValue} matches the honest folding.`
            : `FRI check failed: final value ${finalValue} differs from the honest folding ${expectedValue}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            verified,
            finalValue,
            expectedValue,
            roots: [...roots],
            rounds: round,
            phase: "done",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "FRI tests whether a committed vector really comes from a low-degree polynomial. Each round pairs values and folds them with a random challenge, halving both the domain and the claimed degree. If the vector is far from any low-degree polynomial, the folded vectors diverge from the honest ones and the final check fails.",
        invariants: [
            "Every fold reduces the layer length by exactly half.",
            "The honest folding and the committed folding use the same public challenge.",
            "An honest commitment produces the same final value as the reference polynomial.",
        ],
        correctness:
            "Folding a vector of evaluations of a degree d polynomial with the challenge rule produces evaluations of a polynomial of degree about d/2 on a smaller domain. After enough rounds an honest codeword collapses to a single value determined by the polynomial and the challenges. Any changed evaluation perturbs the fold chain, so the committed final value differs from the honest one and verification rejects it. This toy uses a simple deterministic hash and fold, so it demonstrates the structure rather than providing security.",
        complexityRationale:
            "Each round touches every element once to build the next layer and once more for the Merkle tree, so across log N rounds the work is O(N). Only the current and reference layers plus the roots are kept, giving O(N) space.",
        uses: [
            "Teaching interactive oracle proofs and low-degree testing",
            "Understanding the folding step behind modern succinct proofs",
            "A small model for comparing commitment schemes",
        ],
        references: [
            "Ben-Sasson, Bentov, Horesh and Riabzev, Fast Reed-Solomon IOPP, 2018",
            "Galactos, FRI and STARKs: a survey",
        ],
        workedExample:
            "With four evaluations [a, b, c, d] and challenge alpha, one fold produces [(a + b + alpha*a), (c + d + alpha*c)]. Repeating folds reduces the vector to one value that is compared with the same fold applied to the honest polynomial evaluations.",
    },
    id: "fri-commitment",
    name: "FRI Low-Degree Commitment (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: { coefficients: [3, 5, 2, 7], modulus: 65521, alpha: 12345, domainSize: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "evaluate the polynomial on a domain of N points",
        "commit to the evaluations with a Merkle tree root",
        "while more than one evaluation remains",
        "fold adjacent pairs with the public challenge and recompute a root",
        "fold the honest evaluations with the same challenge",
        "compare the final committed value with the honest final value",
        "done: report the verification verdict and roots",
    ],
};

export default module;
