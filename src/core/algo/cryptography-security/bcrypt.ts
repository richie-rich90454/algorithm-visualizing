/**
 * bcrypt.ts - Bcrypt-Style Password Hashing (Toy EksBlowfish, Small Cost)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bcrypt is a password hashing scheme built on an expensive variant of
 * Blowfish called EksBlowfish. It derives the cipher's P-array and S-boxes by
 * repeatedly encrypting a constant, where the number of repetitions is 2^cost,
 * then encrypts a fixed 64-bit plaintext many times and hashes the result into
 * a stored string. The deliberate setup cost is what slows password guessing.
 * This module implements that structure with a small toy Feistel cipher and
 * tiny cost, so every round is checkable. It is a teaching model, not a secure
 * password hash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(2^cost) setup encryptions plus a fixed final pass
 *   Space: O(1) state words
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Four bars show the live Feistel halves and two state words.
 *   - meta reports the cost, setup round, and final hash string.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const STATE_LEN = 18;
const ROUNDS = 6;

/** Initial toy state, derived deterministically so no table is needed. */
function initialState(): number[] {
    return Array.from({ length: STATE_LEN }, (_, i) =>
        Math.imul(i + 1, 0x9e3779b9) >>> 0,
    );
}

/** One toy Feistel encryption of a two-word block under the expanded state. */
export function toyEncrypt(state: number[], leftInput: number, rightInput: number): [number, number] {
    let left = leftInput >>> 0;
    let right = rightInput >>> 0;
    for (let round = 0; round < ROUNDS; round += 1) {
        const key = state[round] ?? 0;
        const sbox = state[ROUNDS + (right & 0xff)] ?? 0;
        const f = ((((right ^ key) << 3) | ((right ^ key) >>> 29)) + sbox) >>> 0;
        const nextLeft = right;
        const nextRight = (left ^ f) >>> 0;
        left = nextLeft;
        right = nextRight;
    }
    return [left >>> 0, right >>> 0];
}

/** Mix password and salt into the state, then run the costly key expansion. */
export function expandKey(password: number[], salt: number[], cost: number): number[] {
    const state = initialState();
    for (let i = 0; i < STATE_LEN; i += 1) {
        const p = password[i % Math.max(1, password.length)] ?? 0;
        const s = salt[i % Math.max(1, salt.length)] ?? 0;
        state[i] = (state[i]! ^ Math.imul(p + 1, 0x01010101) ^ Math.imul(s + 1, 0x1b873593)) >>> 0;
    }
    let left = 0;
    let right = state.reduce((acc, value, index) => (acc + Math.imul(value, index + 1)) >>> 0, 0);
    const iterations = 2 ** cost;
    for (let c = 0; c < iterations; c += 1) {
        [left, right] = toyEncrypt(state, left, right);
        for (let i = 0; i < STATE_LEN; i += 2) {
            state[i] = left;
            state[i + 1] = right;
            [left, right] = toyEncrypt(state, left, right);
        }
    }
    return state;
}

/** Final bcrypt-style hash of a fixed plaintext under the expanded state. */
export function bcryptHash(password: number[], salt: number[], cost: number): string {
    const state = expandKey(password, salt, cost);
    let left = 0x42424242;
    let right = 0x4f796265;
    for (let round = 0; round < 64; round += 1) {
        [left, right] = toyEncrypt(state, left, right);
    }
    return (left >>> 0).toString(16).padStart(8, "0") + (right >>> 0).toString(16).padStart(8, "0");
}

const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));
const hex = (x: number): string => (x >>> 0).toString(16).padStart(8, "0");

function makeBars(left: number, right: number, a: number, b: number, active: number): VisualEntity[] {
    const values = [left, right, a, b];
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: hex(value),
        value: value >>> 0,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, hex: hex(value) },
    }));
}

/** The bcrypt generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { password?: string; salt?: string; cost?: number } | null) ?? {};
    const password = utf8(String(task.password ?? "password"));
    const saltBytes = utf8(String(task.salt ?? "salt"));
    const cost = Math.max(0, Math.min(6, Math.floor(task.cost ?? 3)));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(0, 0, 0, 0, 0),
        edges: [],
        description: `Toy bcrypt: password ${password.length} byte(s), salt ${saltBytes.length} byte(s), cost ${cost} (2^cost rounds).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { cost, phase: "setup", round: 0, hash: "" },
    };
    step += 1;

    const state = initialState();
    for (let i = 0; i < STATE_LEN; i += 1) {
        const p = password[i % Math.max(1, password.length)] ?? 0;
        const s = saltBytes[i % Math.max(1, saltBytes.length)] ?? 0;
        state[i] = (state[i]! ^ Math.imul(p + 1, 0x01010101) ^ Math.imul(s + 1, 0x1b873593)) >>> 0;
    }
    yield {
        stepNumber: step,
        entities: makeBars(0, 0, state[0] ?? 0, state[1] ?? 0, 2),
        edges: [],
        description: "Xor the password and salt into the initial P-array and S-box state.",
        codeLineNumber: 1,
        layout: "array",
        meta: { cost, phase: "keys", round: 0, hash: "" },
    };
    step += 1;

    let left = 0;
    let right = state.reduce((acc, value, index) => (acc + Math.imul(value, index + 1)) >>> 0, 0);
    const iterations = 2 ** cost;
    for (let c = 0; c < iterations; c += 1) {
        [left, right] = toyEncrypt(state, left, right);
        for (let i = 0; i < STATE_LEN; i += 2) {
            state[i] = left;
            state[i + 1] = right;
            [left, right] = toyEncrypt(state, left, right);
        }
        yield {
            stepNumber: step,
            entities: makeBars(left, right, state[0] ?? 0, state[1] ?? 0, 0),
            edges: [],
            description: `Expensive key setup round ${c + 1}/${iterations}: encrypt a block and overwrite state words.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { cost, phase: "expand", round: c + 1, iterations, hash: "" },
        };
        step += 1;
    }

    let finalLeft = 0x42424242;
    let finalRight = 0x4f796265;
    for (let round = 0; round < 64; round += 1) {
        [finalLeft, finalRight] = toyEncrypt(state, finalLeft, finalRight);
        if (round % 16 === 15) {
            yield {
                stepNumber: step,
                entities: makeBars(finalLeft, finalRight, state[0] ?? 0, state[1] ?? 0, 0),
                edges: [],
                description: `Encrypt the fixed plaintext, pass ${round + 1}/64, with the expanded state.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cost, phase: "final", round: round + 1, hash: "" },
            };
            step += 1;
        }
    }
    const hash = hex(finalLeft) + hex(finalRight);
    yield {
        stepNumber: step,
        entities: makeBars(finalLeft, finalRight, finalLeft, finalRight, 3),
        edges: [],
        description: `Stored hash ${hash}. Toy Feistel and small cost, not a production password hash.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { cost, phase: "done", round: 64, hash },
    };
}

/** The bcrypt module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Bcrypt turns a fast block cipher into a slow password hash by making the cipher's key schedule itself expensive. It first folds the password and salt into the cipher state, then encrypts a constant block thousands of times while overwriting the state with the results. Only after that work does it encrypt a fixed plaintext and keep the result. Raising the cost doubles the work, which is the knob administrators tune as hardware gets faster.",
        invariants: [
            "The number of key-expansion rounds is exactly 2^cost.",
            "Each expansion round overwrites every pair of state words with successive Feistel outputs.",
            "The final hash is the fixed plaintext encrypted 64 times under the expanded state.",
        ],
        correctness:
            "The key-schedule loop, state overwrites, and final 64-round encryption are implemented exactly and compared with an independent reference over several passwords, salts, and costs. Increasing the cost changes the hash, which reflects the extra rounds, and the hash is deterministic for a fixed triple. The toy Feistel cipher is not Blowfish, so the test verifies bcrypt's structure and cost behavior, not production password security.",
        complexityRationale:
            "The setup performs 2^cost rounds, each encrypting roughly STATE_LEN/2 blocks, so time is exponential in the cost parameter and linear in the state size. The state is a fixed number of words, so space is constant.",
        uses: [
            "Password storage in legacy authentication systems",
            "Tuning verification cost as hardware improves",
            "Teaching the difference between a cipher and a password hash",
        ],
        references: [
            "Provos and Mazières, A Future-Adaptable Password Scheme, 1999",
            "Schneier, Blowfish: A Fast, Compact Block Cipher, 1994",
        ],
        workedExample:
            "With cost three, the setup runs eight rounds. Each round encrypts a block, writes the two halves into the first state pair, encrypts again, writes the next pair, and so on through all eighteen words. The final plaintext 0x424242424f796265 is then encrypted 64 times and its two halves are written as a 16-digit hexadecimal hash.",
    },
    id: "bcrypt",
    name: "Bcrypt Password Hash (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(2^cost)", space: "O(1)" },
    defaultInput: { password: "password", salt: "salt", cost: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the P-array and S-box state from constants",
        "xor password and salt bytes cyclically into the state",
        "repeat two to the cost times",
        "encrypt a block and overwrite state pairs with the output",
        "encrypt a fixed plaintext sixty-four times under the final state",
        "concatenate the two halves into the stored hash",
        "done: report the hash with a security disclaimer",
    ],
};

export default module;
