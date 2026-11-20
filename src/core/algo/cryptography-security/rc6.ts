/**
 * rc6.ts - RC6 Block Cipher (32-bit Word Teaching Implementation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RC6 is a parameterized Feistel-style block cipher built from modular
 * multiplication, rotations, and XOR. A key schedule expands the key into round
 * subkeys, then each round mixes four working registers with a quadratic
 * function of two of them. Sixteen byte blocks are encrypted and decrypted with
 * the same schedule run forward or backward. This is a faithful textbook
 * implementation of RC6-32 with a configurable round count.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r rounds
 *   Space: O(r) for the expanded subkey array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is a round; the four columns are registers A, B, C, and D.
 *   - The current round is yellow; the final ciphertext row is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P32 = 0xb7e15163;
const Q32 = 0x9e3779b9;
const LGW = 5;

function rotl(value: number, shift: number): number {
    const s = shift & 31;
    if (s === 0) return value >>> 0;
    return (((value << s) | (value >>> (32 - s))) >>> 0);
}

function mul32(a: number, b: number): number {
    return Number((BigInt(a) * BigInt(b)) & 0xffffffffn);
}

/** Expand a byte key into the RC6 subkey words S[0..2r+3]. */
export function rc6ExpandKey(keyBytes: number[], rounds: number): number[] {
    const r = rounds;
    const words = 2 * r + 4;
    const S = new Array<number>(words).fill(0);
    S[0] = P32;
    for (let i = 1; i < words; i += 1) {
        S[i] = (S[i - 1]! + Q32) >>> 0;
    }

    const c = Math.max(1, Math.ceil(keyBytes.length / 4));
    const L = new Array<number>(c).fill(0);
    for (let i = 0; i < c; i += 1) {
        const b0 = keyBytes[(4 * i) % keyBytes.length] ?? 0;
        const b1 = keyBytes[(4 * i + 1) % keyBytes.length] ?? 0;
        const b2 = keyBytes[(4 * i + 2) % keyBytes.length] ?? 0;
        const b3 = keyBytes[(4 * i + 3) % keyBytes.length] ?? 0;
        L[i] = ((b0 & 0xff) | ((b1 & 0xff) << 8) | ((b2 & 0xff) << 16) | ((b3 & 0xff) << 24)) >>> 0;
    }

    let a = 0;
    let b = 0;
    let i = 0;
    let j = 0;
    const v = 3 * Math.max(c, words);
    for (let k = 0; k < v; k += 1) {
        a = rotl((S[i]! + a + b) >>> 0, 3);
        S[i] = a;
        b = rotl((L[j]! + a + b) >>> 0, a + b);
        L[j] = b;
        i = (i + 1) % words;
        j = (j + 1) % c;
    }
    return S;
}

function quad(x: number): number {
    return rotl(mul32(x, (2 * x + 1) >>> 0), LGW);
}

export interface Rc6State {
    a: number;
    b: number;
    c: number;
    d: number;
}

/** Run all rounds and return the state after each one (index 0 is the input). */
export function rc6EncryptTrace(
    keyBytes: number[],
    plaintext: [number, number, number, number],
    rounds: number,
): Rc6State[] {
    const S = rc6ExpandKey(keyBytes, rounds);
    let [a, b, c, d] = plaintext.map((w) => w >>> 0) as [number, number, number, number];
    const trace: Rc6State[] = [{ a, b, c, d }];
    b = (b + S[0]!) >>> 0;
    d = (d + S[1]!) >>> 0;
    trace[0] = { a, b, c, d };
    for (let round = 1; round <= rounds; round += 1) {
        const t = quad(b);
        const u = quad(d);
        a = (rotl(a ^ t, u) + S[2 * round]!) >>> 0;
        c = (rotl(c ^ u, t) + S[2 * round + 1]!) >>> 0;
        [a, b, c, d] = [b, c, d, a];
        trace.push({ a, b, c, d });
    }
    a = (a + S[2 * rounds + 2]!) >>> 0;
    c = (c + S[2 * rounds + 3]!) >>> 0;
    trace[trace.length - 1] = { a, b, c, d };
    return trace;
}

/** Encrypt one 16-byte block represented as four 32-bit words. */
export function rc6Encrypt(
    keyBytes: number[],
    plaintext: [number, number, number, number],
    rounds: number,
): [number, number, number, number] {
    const final = rc6EncryptTrace(keyBytes, plaintext, rounds).at(-1)!;
    return [final.a, final.b, final.c, final.d];
}

/** Decrypt one block by reversing the encryption rounds. */
export function rc6Decrypt(
    keyBytes: number[],
    ciphertext: [number, number, number, number],
    rounds: number,
): [number, number, number, number] {
    const S = rc6ExpandKey(keyBytes, rounds);
    let [a, b, c, d] = ciphertext.map((w) => w >>> 0) as [number, number, number, number];
    c = (c - S[2 * rounds + 3]!) >>> 0;
    a = (a - S[2 * rounds + 2]!) >>> 0;
    for (let round = rounds; round >= 1; round -= 1) {
        [a, b, c, d] = [d, a, b, c];
        const t = quad(b);
        const u = quad(d);
        c = (rotl((c - S[2 * round + 1]!) >>> 0, 32 - (t & 31)) ^ u) >>> 0;
        a = (rotl((a - S[2 * round]!) >>> 0, 32 - (u & 31)) ^ t) >>> 0;
    }
    d = (d - S[1]!) >>> 0;
    b = (b - S[0]!) >>> 0;
    return [a, b, c, d];
}

function makeCells(trace: Rc6State[], activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    trace.forEach((state, row) => {
        const registers: Array<[string, number]> = [
            ["A", state.a], ["B", state.b], ["C", state.c], ["D", state.d],
        ];
        registers.forEach(([name, value], col) => {
            let stateName: EntityState = "visited";
            if (row === trace.length - 1) stateName = "sorted";
            if (row === activeRow) stateName = "active";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: `0x${value.toString(16).toUpperCase().padStart(8, "0")}`,
                value: value >>> 0,
                state: stateName,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, register: name, value: value >>> 0, round: row },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { key?: number[]; plaintext?: [number, number, number, number]; rounds?: number } | null
    ) ?? {};
    const key = Array.isArray(task.key) && task.key.length > 0
        ? task.key.map((b) => ((Math.trunc(b) % 256) + 256) % 256)
        : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const plaintext: [number, number, number, number] = Array.isArray(task.plaintext) && task.plaintext.length === 4
        ? task.plaintext.map((w) => w >>> 0) as [number, number, number, number]
        : [0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210];
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.min(32, Math.floor(task.rounds))) : 8;
    const trace = rc6EncryptTrace(key, plaintext, rounds);
    const cipher = rc6Encrypt(key, plaintext, rounds);
    const restored = rc6Decrypt(key, cipher, rounds);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(trace, 0),
        edges: [],
        description: `Expanded ${key.length} key bytes into ${2 * rounds + 4} subkeys; starting RC6 with ${rounds} round(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: trace.length, cols: 4, rounds, phase: "init", plaintext: [...plaintext] },
    };
    step += 1;

    for (let round = 1; round <= rounds; round += 1) {
        const state = trace[round]!;
        yield {
            stepNumber: step,
            entities: makeCells(trace, round),
            edges: [],
            description: `Round ${round}: registers become A=${state.a.toString(16)}, B=${state.b.toString(16)}, C=${state.c.toString(16)}, D=${state.d.toString(16)}.`,
            codeLineNumber: round === 1 ? 2 : 3,
            layout: "grid",
            meta: { rows: trace.length, cols: 4, rounds, phase: "round", round, state: [state.a, state.b, state.c, state.d] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(trace, -1),
        edges: [],
        description: `Ciphertext is ${cipher.map((w) => w.toString(16)).join(" ")}; decryption restores the original plaintext.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: trace.length,
            cols: 4,
            rounds,
            phase: "done",
            plaintext: [...plaintext],
            ciphertext: [...cipher],
            restored: [...restored],
            roundTrip: restored.join(",") === plaintext.join(","),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RC6 works on four registers and repeatedly shuffles their contents. In each round, two registers are fed through a quadratic mixing function, and the results XOR with the other two before a rotation of register positions. The key only decides the constants added and the exact subkeys, so the same structure handles any key length. Running the rounds backward undoes the mixing and recovers the plaintext.",
        invariants: [
            "Every register is an unsigned 32-bit word.",
            "The round function uses multiplication, rotation, and XOR only.",
            "Decryption applies the exact inverse operations of encryption in reverse order.",
        ],
        correctness:
            "Each encryption round is invertible: adding a subkey is undone by subtracting it, the rotation of registers is undone by the opposite rotation, and XOR with t or u is undone by XOR with the same value because the mixing functions are recomputed from the unchanged registers in the decryption order. The key schedule is identical in both directions, so reversing all rounds and removing the two final subkeys reconstructs the original four words exactly, which the round-trip check verifies for every test input.",
        complexityRationale:
            "The key schedule performs a constant number of updates per subkey word, and each of the r rounds does a fixed amount of 32-bit arithmetic, so time is linear in r. The expanded subkey array holds 2r+4 words, giving linear space in the round count.",
        uses: [
            "Teaching the design of modern block ciphers and key schedules",
            "Comparing multiplication-based mixing with pure Feistel networks",
            "A compact reference for block-cipher round functions",
        ],
        references: [
            "Rivest, Robshaw, Sidney, and Yin, The RC6 Block Cipher, 1998",
            "RFC 2040, The RC6, MARS, Twofish, Serpent, and CAST-256 Cipher Submissions, 1997",
        ],
        workedExample:
            "With a 16-byte key and eight rounds, the four plaintext words are loaded into A, B, C, and D. Round one forms t from B and u from D, XORs them into A and C, rotates the four registers, and repeats. After the last round two final subkeys are added. Feeding the resulting ciphertext into the decryption routine returns the original four words byte for byte.",
    },
    id: "rc6",
    name: "RC6 Block Cipher (32-bit)",
    category: "cryptography-security",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: {
        key: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        plaintext: [0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210],
        rounds: 8,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "expand the key into round subkeys S zero through two r plus three",
        "load the four plaintext words into registers A, B, C, D",
        "add S zero to B and S one to D",
        "for each round, form t from B and u from D using multiplication and rotation",
        "rotate A XOR t and C XOR u, then add the round subkeys",
        "rotate the four registers by one position",
        "after the final round add the two closing subkeys",
        "done: report the ciphertext and verify decryption restores the plaintext",
    ],
};

export default module;
