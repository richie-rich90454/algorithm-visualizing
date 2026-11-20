/**
 * dual-ec-drbg.ts - Dual_EC_DRBG Structure and Backdoor (Toy Group)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dual_EC_DRBG updated an internal state s by multiplying an elliptic-curve
 * point P to get the output and a second point Q to get the next state. When Q
 * equals d times P for a known d, seeing one output leaks the state and all
 * future outputs: the x-coordinate of sQ is the x-coordinate of (output/d)P.
 * That suspected backdoor is the reason this generator was withdrawn. This
 * module reproduces the exact update and recovery algebra in a tiny
 * multiplicative group instead of an elliptic curve, keeping the structure and
 * the backdoor analysis while dropping the curve arithmetic. It is a teaching
 * model and must never be used as a random source.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(2^bits) to brute-force the dropped output bits during recovery
 *   Space: O(1) working state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the internal state, the full group output, and the truncated
 *     value an observer actually sees.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export const PRIME = 1009;
export const P = 2;
export const BACKDOOR_D = 37;
export const DROP_BITS = 2;

export function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1 % modulus;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

export function modInverse(value: number, modulus: number): number {
    let [oldR, r] = [((value % modulus) + modulus) % modulus, modulus];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % modulus) + modulus) % modulus;
}

export const Q = modPow(P, BACKDOOR_D, PRIME);

function fullOutput(state: number): number {
    return (state * P) % PRIME;
}

function nextState(state: number): number {
    return (state * Q) % PRIME;
}

export interface DrbgStep {
    state: number;
    full: number;
    truncated: number;
}

export class DualEcDrbg {
    state: number;

    constructor(seed: number) {
        this.state = ((seed % (PRIME - 1)) + PRIME - 1) % (PRIME - 1) + 1;
    }

    step(): DrbgStep {
        const full = fullOutput(this.state);
        const truncated = Math.floor(full / 2 ** DROP_BITS);
        this.state = nextState(this.state);
        return { state: this.state, full, truncated };
    }

    generate(count: number): number[] {
        const out: number[] = [];
        for (let i = 0; i < count; i += 1) {
            out.push(this.step().truncated);
        }
        return out;
    }
}

/**
 * Recover the state from one truncated output and verify it against the next
 * truncated output by brute-forcing the dropped low bits.
 */
export function recoverState(firstTruncated: number, secondTruncated: number, d = BACKDOOR_D): number | null {
    const inverseP = modInverse(P, PRIME);
    const q = modPow(P, d, PRIME);
    for (let low = 0; low < 2 ** DROP_BITS; low += 1) {
        const full = firstTruncated * 2 ** DROP_BITS + low;
        const candidate = (full * inverseP) % PRIME;
        const nextFull = (candidate * q * P) % PRIME;
        if (Math.floor(nextFull / 2 ** DROP_BITS) === secondTruncated) {
            return candidate;
        }
    }
    return null;
}

function bytesOf(value: number): number[] {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff, 0, 0, 0, 0];
}

function rowCells(row: number, value: number, state: EntityState): VisualEntity[] {
    return bytesOf(value).map((v, col) => ({
        id: `byte-${row}-${col}`,
        type: "cell" as const,
        label: v.toString(16).toUpperCase().padStart(2, "0"),
        value: v,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; outputs?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed : 23;
    const count = typeof task.outputs === "number" ? Math.max(2, Math.min(8, task.outputs)) : 4;

    const drbg = new DualEcDrbg(seed);
    const initialState = drbg.state;
    const first = drbg.step();
    const second = drbg.step();
    const remaining = drbg.generate(count - 2);
    const recovered = recoverState(first.truncated, second.truncated);
    let step = 0;

    const frame = (phase: number, value: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, phase >= 1 ? first.state : 0, phase >= 1 ? "pivot" : "unvisited"),
            ...rowCells(1, phase >= 2 ? first.full : 0, phase >= 2 ? "active" : "unvisited"),
            ...rowCells(2, phase >= 3 ? first.truncated : 0, phase >= 3 ? "sorted" : "unvisited"),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 8,
            prime: PRIME,
            backdoorD: BACKDOOR_D,
            q: Q,
            outputs: [first.truncated, second.truncated, ...remaining],
            fullOutput: first.full,
            truncatedOutput: first.truncated,
            recoveredState: recovered ?? -1,
            backdoorWorks: recovered !== null,
        },
    });

    yield frame(0, 0, "Load the seed into the internal state.", 0);
    yield frame(1, initialState, "Multiply state by P to form the full output.", 1);
    yield frame(2, first.full, "Multiply state by Q to advance to the next state.", 2);
    yield frame(3, first.truncated, `Drop the low ${DROP_BITS} bits and publish the truncated output.`, 3);
    yield frame(4, first.truncated, `With the backdoor d, brute-force the dropped bits: state ${recovered ?? "not found"}.`, 4);
}

const module: AlgorithmModule = {
    id: "dual-ec-drbg",
    name: "Dual_EC_DRBG Backdoor (Toy Group)",
    category: "cryptography-security",
    complexity: { time: "O(2^bits) recovery", space: "O(1)" },
    defaultInput: { seed: 23, outputs: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose generator P and a second point Q equal to P raised to d",
        "load the seed into the internal state s",
        "output the top bits of s multiplied by P",
        "update s to s multiplied by Q",
        "an observer sees only the truncated output",
        "blind guess the dropped low bits and recover s using the inverse of P",
        "predict the next output and accept the guess when it matches",
    ],
    education: {
        intuition:
            "A backdoored generator can look perfectly random while letting someone with a secret d predict every future output from one observed output. The relation Q = dP means multiplying the output by the inverse of P and then by Q is the same as multiplying by Q/P, a value the backdoor holder knows. Guessing the bits that were dropped from the output is enough to try each possibility.",
        invariants: [
            "Q is derived from P and the secret d, so Q raised to any exponent is determined by d.",
            "The output is a deterministic function of the state, and the state update is deterministic.",
            "Recovering the state is equivalent to guessing the dropped low bits correctly.",
        ],
        correctness:
            "For a candidate full output f, the candidate state is f times P inverse. Advancing gives f times P inverse times Q, which equals f times Q/P. If the candidate low bits are correct, this equals the true next state, so its truncated output matches the observed next output. Only the correct low-bit guess passes this check with high probability, proving that the backdoor reveals the state.",
        complexityRationale:
            "Generating each output is constant time in this toy group; recovering the state tries 2^bits candidates, each a few modular multiplications, so recovery is O(2^bits).",
        uses: [
            "Explaining why Dual_EC_DRBG was withdrawn from NIST standards",
            "Teaching backdoors in deterministic random bit generators",
            "Demonstrating small-subgroup and state-recovery analysis",
        ],
        references: [
            "NIST Special Publication 800-90A, Dual_EC_DRBG construction",
            "Shumow and Ferguson, On the Possibility of a Back Door in the NIST SP800-90 Dual Ec Prng, 2007",
        ],
        workedExample:
            "With seed 23, backdoor d = 37, and two dropped bits, the tool publishes truncated outputs. An observer who knows d tries the four possible low-bit values for the first output, computes the candidate state with P inverse, and checks which one predicts the second output; the matching candidate is the true state.",
    },
};

export default module;
