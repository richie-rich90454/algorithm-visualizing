/**
 * feistel-network.ts - Toy Feistel Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Feistel network builds a reversible block cipher from any round function,
 * even one that is not itself invertible. Each round splits the block into two
 * halves, feeds one half through the round function, and XORs the result into
 * the other half before swapping. Decryption replays the same rounds with the
 * keys in reverse order. This module uses 16-bit halves and a small mixing
 * function, so it is a teaching model and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(rounds) round evaluations
 *   Space: O(rounds) for the round keys and the trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the left half, right half, and round-function output per round.
 *   - The active round is highlighted; the final frame reports the ciphertext.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = 0xffff;

/** A deterministic 16-bit mixing function used as the toy round function. */
export function roundFunction(half: number, key: number): number {
    let h = Math.imul((half ^ key) & MASK, 0x9e3779b1) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    return h & MASK;
}

/** Derive a fixed list of round keys from a seed. */
export function makeRoundKeys(seed: number, rounds: number): number[] {
    const keys: number[] = [];
    let k = seed & MASK;
    for (let i = 0; i < rounds; i += 1) {
        k = roundFunction(k, i + 1);
        keys.push(k);
    }
    return keys;
}

export interface FeistelRound {
    round: number;
    left: number;
    right: number;
    f: number;
}

export interface FeistelResult {
    left: number;
    right: number;
    trace: FeistelRound[];
}

/** Encrypt a two-half block with the given round keys. */
export function feistelEncrypt(leftIn: number, rightIn: number, keys: number[]): FeistelResult {
    let left = leftIn & MASK;
    let right = rightIn & MASK;
    const trace: FeistelRound[] = [];
    for (let i = 0; i < keys.length; i += 1) {
        const f = roundFunction(right, keys[i] ?? 0);
        const nextLeft = right;
        const nextRight = left ^ f;
        left = nextLeft;
        right = nextRight;
        trace.push({ round: i + 1, left, right, f });
    }
    return { left, right, trace };
}

/** Decrypt a two-half block by replaying the round keys in reverse. */
export function feistelDecrypt(leftIn: number, rightIn: number, keys: number[]): FeistelResult {
    let left = leftIn & MASK;
    let right = rightIn & MASK;
    const trace: FeistelRound[] = [];
    for (let i = keys.length - 1; i >= 0; i -= 1) {
        const f = roundFunction(left, keys[i] ?? 0);
        const nextLeft = right ^ f;
        const nextRight = left;
        left = nextLeft;
        right = nextRight;
        trace.push({ round: keys.length - i, left, right, f });
    }
    return { left, right, trace };
}

function makeBars(left: number, right: number, f: number, active: number): VisualEntity[] {
    const values = [left, right, f];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: ["left", "right", "round function"][index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { left?: number; right?: number; seed?: number; rounds?: number } | null) ?? {};
    const left = typeof task.left === "number" ? task.left & MASK : 0x1234;
    const right = typeof task.right === "number" ? task.right & MASK : 0xabcd;
    const seed = typeof task.seed === "number" ? task.seed & MASK : 0x42;
    const rounds = Math.min(16, Math.max(1, Math.floor(Number(task.rounds ?? 4)) || 4));
    const keys = makeRoundKeys(seed, rounds);
    const encrypted = feistelEncrypt(left, right, keys);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(left, right, 0, -1),
        edges: [],
        description: `Feistel network with ${rounds} rounds: plaintext halves ${left} and ${right}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rounds, seed, left, right, round: 0 },
    };
    step += 1;

    for (const entry of encrypted.trace) {
        yield {
            stepNumber: step,
            entities: makeBars(entry.left, entry.right, entry.f, 2),
            edges: [],
            description: `Round ${entry.round}: round function gives ${entry.f}; swap and XOR produce halves ${entry.left}, ${entry.right}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { rounds, seed, round: entry.round, left: entry.left, right: entry.right, f: entry.f },
        };
        step += 1;
    }

    const decrypted = feistelDecrypt(encrypted.left, encrypted.right, keys);
    yield {
        stepNumber: step,
        entities: makeBars(decrypted.left, decrypted.right, 0, -1),
        edges: [],
        description: `Replaying the keys in reverse recovers halves ${decrypted.left}, ${decrypted.right}; the network is invertible regardless of the round function.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            rounds,
            seed,
            round: rounds,
            cipherLeft: encrypted.left,
            cipherRight: encrypted.right,
            recoveredLeft: decrypted.left,
            recoveredRight: decrypted.right,
            roundTrips: decrypted.left === left && decrypted.right === right,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Feistel network is a clever way to turn any mixing function into a reversible cipher. Split the block in half, run one half through the mixing function, XOR that into the other half, and swap the halves. Repeating this several times diffuses the input, yet decryption needs only the same rounds played backward because each round can be undone without inverting the mixing function.",
        invariants: [
            "Each round swaps the halves and XORs the round-function output into one side.",
            "Decryption uses the identical round function with the keys in reverse order.",
            "The network is invertible for any round function, invertible or not.",
        ],
        correctness:
            "Consider one round mapping (L, R) to (R, L xor F(R, k)). Given the output, the original right half is the current left half, and the original left half is the current right half xor F(current left, k), so the round is perfectly reversible. Composing reversible rounds and then undoing them in reverse order returns the original block; an exhaustive round-trip test over many random blocks and keys confirms this for the toy parameters.",
        complexityRationale:
            "Encryption and decryption each evaluate the round function once per round, giving O(rounds) time. The round keys and the per-round trace both scale linearly with the number of rounds, so space is O(rounds).",
        uses: [
            "The structural basis of block ciphers such as DES and Camellia",
            "Teaching reversible mixing and substitution-permutation design",
            "Format-preserving and disk-encryption constructions built on Feistel networks",
        ],
        references: [
            "Feistel, Cryptography and Computer Privacy, 1973",
            "Luby and Rackoff, How to Construct Pseudorandom Permutations from Pseudorandom Functions, 1988",
        ],
        workedExample:
            "With left 0x1234, right 0xabcd, seed 0x42, and four rounds, round one computes F(0xabcd, key1), swaps the halves, and XORs that value into the left side. After four rounds the ciphertext halves differ completely from the plaintext. Decrypting from the ciphertext with keys in reverse order reproduces 0x1234 and 0xabcd exactly.",
    },
    id: "feistel-network",
    name: "Feistel Network (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { left: 0x1234, right: 0xabcd, seed: 0x42, rounds: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "split the plaintext into a left and a right half",
        "derive one round key per round from the seed",
        "for each round compute f from the right half and the round key",
        "set the new left half to the old right half",
        "set the new right half to the old left half XOR f",
        "to decrypt replay rounds with keys in reverse order",
        "done: report the ciphertext and the recovered plaintext",
    ],
};

export default module;
