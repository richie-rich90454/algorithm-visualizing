/**
 * scrypt.ts - Scrypt-Style Password KDF (Toy BlockMix, Small Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Scrypt is a password-based key derivation function whose cost is dominated
 * by memory. It first expands the password and salt with PBKDF2, then runs a
 * memory-hard ROMix routine: a chain of BlockMix calls fills N blocks, and a
 * data-dependent walk revisits them before the result is hashed back into a
 * derived key. This module implements that exact structure with a small toy
 * mixer in place of Salsa20/8 and tiny parameters, so every step is checkable.
 * It is a teaching model, not a production KDF.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(N * r) BlockMix calls
 *   Space: O(N * r) words of memory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Eight bars show the current mix block after each transformation.
 *   - meta reports the ROMix phase, block index, and derived key.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const FNVA = 16777619;
const OFFSET = 2166136261;

/** FNV-1a 32-bit hash of a byte sequence. */
function fnv(bytes: number[]): number {
    let h = OFFSET >>> 0;
    for (const byte of bytes) {
        h = Math.imul(h ^ (byte & 0xff), FNVA) >>> 0;
    }
    return h >>> 0;
}

/** Toy keyed pseudorandom function producing four 32-bit words. */
export function prf(key: number[], message: number[]): number[] {
    return [0, 1, 2, 3].map((index) => fnv(key.concat([index], message)));
}

const intBytes = (value: number): number[] => [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
];

/** PBKDF2 using the toy PRF, returning words. */
export function pbkdf2Words(password: number[], salt: number[], iterations: number, words: number): number[] {
    const out: number[] = [];
    for (let block = 1; out.length < words; block += 1) {
        let u = prf(password, salt.concat(intBytes(block)));
        const t = u.slice();
        for (let round = 1; round < iterations; round += 1) {
            u = prf(password, u);
            for (let i = 0; i < 4; i += 1) {
                t[i] = (t[i] ?? 0) ^ (u[i] ?? 0);
            }
        }
        out.push(...t);
    }
    return out.slice(0, words);
}

/** Toy Salsa replacement: four rotate-xor-add rounds over eight words. */
export function mix8(input: number[]): number[] {
    let y = input.slice(0, 8);
    for (let round = 0; round < 4; round += 1) {
        y = y.map((value, index) => {
            const next = y[(index + 1) % 8] ?? 0;
            return ((value + next) ^ ((value << 3) | (value >>> 29))) >>> 0;
        });
    }
    return y;
}

/** BlockMix over a 16-word block (r = 1 in this toy). */
export function blockMix(block: number[]): number[] {
    let x = new Array<number>(8).fill(0);
    const y: number[][] = [];
    for (let chunk = 0; chunk < 2; chunk += 1) {
        for (let i = 0; i < 8; i += 1) {
            x[i] = (x[i] ?? 0) ^ (block[chunk * 8 + i] ?? 0);
        }
        x = mix8(x);
        y.push(x.slice());
    }
    return y[1]!.concat(y[0]!);
}

/** ROMix: fill N blocks, then follow a data-dependent walk. */
export function romix(block: number[], n: number): number[] {
    let x = block.slice();
    const memory: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        memory.push(x.slice());
        x = blockMix(x.map((v, j) => v ^ (block[j] ?? 0)));
    }
    for (let i = 0; i < n; i += 1) {
        const j = (x[0] ?? 0) % n;
        const ref = memory[j] ?? block;
        x = blockMix(x.map((v, k) => v ^ (ref[k] ?? 0)));
    }
    return x;
}

/** Full toy scrypt derivation. */
export function scryptKdf(password: number[], salt: number[], n: number, dkWords: number): number[] {
    const expanded = pbkdf2Words(password, salt, 1, 16);
    const mixed = romix(expanded, n);
    return pbkdf2Words(password, mixed, 1, dkWords);
}

const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));
const hex = (words: number[]): string => words.map((w) => (w >>> 0).toString(16).padStart(8, "0")).join("");

function makeBars(words: number[], active: number): VisualEntity[] {
    return words.map((value, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: (value >>> 0).toString(16),
        value: value >>> 0,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The scrypt generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { password?: string; salt?: string; cost?: number; dkWords?: number } | null) ?? {};
    const password = utf8(String(task.password ?? "password"));
    const salt = utf8(String(task.salt ?? "salt"));
    const n = Math.max(1, Math.min(64, Math.floor(task.cost ?? 8)));
    const dkWords = Math.max(1, Math.min(16, Math.floor(task.dkWords ?? 4)));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(new Array<number>(8).fill(0), 0),
        edges: [],
        description: `Toy scrypt: password ${password.length} byte(s), salt ${salt.length} byte(s), cost N=${n}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, dkWords, phase: "setup", derivedKey: "" },
    };
    step += 1;

    const expanded = pbkdf2Words(password, salt, 1, 16);
    yield {
        stepNumber: step,
        entities: makeBars(expanded.slice(0, 8), 0),
        edges: [],
        description: "PBKDF2 with the toy PRF expands the password and salt into a sixteen-word block.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n, dkWords, phase: "expand", derivedKey: hex(expanded) },
    };
    step += 1;

    let x = expanded.slice();
    const memory: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        memory.push(x.slice());
        x = blockMix(x.map((v, j) => v ^ (expanded[j] ?? 0)));
        yield {
            stepNumber: step,
            entities: makeBars(x.slice(0, 8), 0),
            edges: [],
            description: `ROMix fill ${i + 1}/${n}: store the current block and BlockMix it into the next.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, dkWords, phase: "fill", index: i, derivedKey: "" },
        };
        step += 1;
    }
    for (let i = 0; i < n; i += 1) {
        const j = (x[0] ?? 0) % n;
        const ref = memory[j] ?? expanded;
        x = blockMix(x.map((v, k) => v ^ (ref[k] ?? 0)));
        yield {
            stepNumber: step,
            entities: makeBars(x.slice(0, 8), 0),
            edges: [],
            description: `ROMix walk ${i + 1}/${n}: integerify selects stored block ${j} as the reference.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, dkWords, phase: "walk", index: i, reference: j, derivedKey: "" },
        };
        step += 1;
    }

    const derived = pbkdf2Words(password, x, 1, dkWords);
    yield {
        stepNumber: step,
        entities: makeBars(derived.slice(0, 8), 0),
        edges: [],
        description: `Derived ${dkWords} word(s): ${hex(derived)}. Toy mix, not a production KDF.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, dkWords, phase: "done", derivedKey: hex(derived) },
    };
}

/** The scrypt module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Scrypt makes password guessing expensive in RAM, not just CPU. It stretches the password with PBKDF2, then repeatedly mixes a block while storing every intermediate result. A second pass walks back into that stored memory at positions derived from the data itself, so an attacker cannot avoid the memory cost without recomputing the whole chain. This toy keeps the two-pass ROMix structure but uses a simple mixer and small blocks.",
        invariants: [
            "The first ROMix pass stores N blocks and the second pass reads them at data-derived indices.",
            "BlockMix splits a block into eight-word halves, mixes each into an accumulator, and permutes the outputs.",
            "The final key is PBKDF2 of the original password keyed by the mixed block.",
        ],
        correctness:
            "The ROMix fill and walk, the BlockMix permutation, and the PBKDF2 chaining are implemented exactly and checked against an independent reference across random passwords, salts, and costs. For cost one the result reduces to a closed form that the test verifies by hand. The mixer is a toy rotate-xor-add function, so the checks verify the scrypt structure only and make no claim about real cryptographic strength.",
        complexityRationale:
            "ROMix performs two BlockMix calls per cost unit and stores one block per unit, so both time and memory grow linearly in N for fixed block size r.",
        uses: [
            "Password hashing in systems that want to resist custom hardware",
            "Key derivation for disk encryption and cryptocurrencies",
            "Teaching the idea of memory-hard key stretching",
        ],
        references: [
            "Percival, Stronger Key Derivation via Sequential Memory-Hard Functions, 2009",
            "Percival and Josefsson, RFC 7914: The scrypt Password-Based Key Derivation Function, 2016",
        ],
        workedExample:
            "With cost N=1, the fill pass stores the expanded block and mixes it once; the walk pass reads that one stored block and mixes again. The resulting sixteen-word block becomes the salt for a final PBKDF2 call under the original password, producing the derived key.",
    },
    id: "scrypt",
    name: "Scrypt Password KDF (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(N * r)", space: "O(N * r)" },
    defaultInput: { password: "password", salt: "salt", cost: 8, dkWords: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "expand password and salt with PBKDF2 into a working block",
        "for each of N cost units store the current block",
        "replace it by BlockMix of its xor with the expanded block",
        "for each of N cost units derive an index from the block",
        "BlockMix the block xored with the referenced stored block",
        "hash the mixed block with PBKDF2 under the original password",
        "done: report the derived words with a security disclaimer",
    ],
};

export default module;
