/**
 * speck-cipher.ts - SPECK Block Cipher (Teaching Core)
 *
 * A small additive-rotate-xor block cipher that keeps the ARX round structure
 * of SPECK: rotate, add, rotate, xor. The toy version uses two eight-bit words
 * and a sixteen-bit key so every round fits on screen. All operations are
 * invertible modulo 256. It is a faithful teaching model, not a standardized
 * SPECK parameter set and not suitable for protecting real data.
 *
 * Complexity:
 *   Time:  O(rounds) per block
 *   Space: O(rounds) for the displayed round states
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function rotl8(value: number, shift: number): number {
    const s = ((shift % 8) + 8) % 8;
    return (((value << s) | (value >>> (8 - s))) & 0xff);
}

function rotr8(value: number, shift: number): number {
    const s = ((shift % 8) + 8) % 8;
    return (((value >>> s) | (value << (8 - s))) & 0xff);
}

function keySchedule(key: number, rounds: number): Array<[number, number]> {
    let a = (key >>> 8) & 0xff;
    let b = key & 0xff;
    const roundKeys: Array<[number, number]> = [];
    for (let i = 0; i < rounds; i += 1) {
        a = rotr8(a, 3);
        a = (a + b) & 0xff;
        b = rotl8(b, 2) ^ a;
        roundKeys.push([a, b]);
    }
    return roundKeys;
}

function forwardRound(x: number, y: number, ka: number, kb: number): [number, number] {
    let a = rotr8(x, 3);
    a = (a + y) & 0xff;
    const b = rotl8(y, 2) ^ a;
    return [(a ^ ka) & 0xff, (b ^ kb) & 0xff];
}

function inverseRound(x: number, y: number, ka: number, kb: number): [number, number] {
    const a2 = x ^ ka;
    const b2 = y ^ kb;
    const originalY = rotr8(b2 ^ a2, 2);
    const originalX = rotl8((a2 - originalY + 256) & 0xff, 3);
    return [originalX, originalY];
}

function encrypt(block: number, key: number, rounds: number): Array<[number, number]> {
    const keys = keySchedule(key, rounds);
    let x = (block >>> 8) & 0xff;
    let y = block & 0xff;
    const states: Array<[number, number]> = [[x, y]];
    for (let i = 0; i < rounds; i += 1) {
        const [ka, kb] = keys[i] ?? [0, 0];
        [x, y] = forwardRound(x, y, ka ?? 0, kb ?? 0);
        states.push([x, y]);
    }
    return states;
}

function decrypt(block: number, key: number, rounds: number): number {
    const keys = keySchedule(key, rounds);
    let x = (block >>> 8) & 0xff;
    let y = block & 0xff;
    for (let i = rounds - 1; i >= 0; i -= 1) {
        const [ka, kb] = keys[i] ?? [0, 0];
        [x, y] = inverseRound(x, y, ka ?? 0, kb ?? 0);
    }
    return ((x << 8) | y) & 0xffff;
}

function makeCells(states: Array<[number, number]>, activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < states.length; row += 1) {
        const [x, y] = states[row] ?? [0, 0];
        const nibbles = [
            ((x ?? 0) >>> 4) & 0xf,
            (x ?? 0) & 0xf,
            ((y ?? 0) >>> 4) & 0xf,
            (y ?? 0) & 0xf,
        ];
        for (let col = 0; col < 4; col += 1) {
            const state: EntityState = row === activeRow ? "active" : row === states.length - 1 ? "sorted" : "idle";
            const value = nibbles[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value.toString(16).toUpperCase(),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { block?: number; key?: number; rounds?: number } | null) ?? {};
    const block = (task.block ?? 0x1234) & 0xffff;
    const key = (task.key ?? 0xabcd) & 0xffff;
    const rounds = Math.max(1, Math.min(12, typeof task.rounds === "number" ? task.rounds : 8));
    const states = encrypt(block, key, rounds);
    const [cx, cy] = states[states.length - 1] ?? [0, 0];
    const ciphertext = (((cx ?? 0) << 8) | (cy ?? 0)) & 0xffff;
    const recovered = decrypt(ciphertext, key, rounds);
    const base = { rows: states.length, cols: 4, rounds };

    yield {
        stepNumber: 0,
        entities: makeCells(states, 0),
        edges: [],
        description: "Each ARX round rotates, adds, rotates, and xors two eight-bit words.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "start", ciphertext: ciphertext.toString(16) },
    };
    for (let r = 1; r < states.length; r += 1) {
        yield {
            stepNumber: r,
            entities: makeCells(states, r),
            edges: [],
            description: `Round ${r}: the two words after the add-rotate-xor round and key mixing.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...base, phase: "round", ciphertext: ciphertext.toString(16) },
        };
    }
    yield {
        stepNumber: states.length,
        entities: makeCells(states, states.length - 1),
        edges: [],
        description: `Ciphertext 0x${ciphertext.toString(16).toUpperCase()}; reversing the ARX rounds restores 0x${recovered.toString(16).toUpperCase()}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", ciphertext: ciphertext.toString(16), plaintext: recovered.toString(16) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SPECK is built from only three cheap operations: rotate, add, and exclusive or, abbreviated ARX. A round mixes two half-block words by rotating the first, adding the second, rotating the second, and xoring both with round-key words. Repeating this a handful of times scrambles the block, yet every operation can be undone by subtracting and rotating the other way.",
        invariants: [
            "All additions are modulo 256 and all rotations are on eight-bit words.",
            "Each round key pair is reused unchanged during encryption and decryption.",
            "The inverse round recovers both words exactly because it undoes xor, addition, and rotation in reverse order.",
        ],
        correctness:
            "Decryption starts by xoring out the round-key words, which is self-inverse. The second word is recovered by rotating back and xoring the first word of the round; then the addition is undone by subtracting that word modulo 256, and the initial rotation is undone by rotating forward. Because each step is the exact inverse of its forward counterpart and rounds are processed from last to first, the original block is recovered.",
        complexityRationale:
            "A round performs a constant number of byte operations, so encryption or decryption of one block takes O(rounds) time. Keeping the state of every displayed round uses O(rounds) space, a small number of cells for the teaching parameters.",
        uses: [
            "Teaching additive-rotate-xor cipher design",
            "A compact model of lightweight software-oriented block ciphers",
            "A classroom exercise in invertible modular round functions",
        ],
        references: [
            "Beaulieu et al., The SIMON and SPECK Families of Lightweight Block Ciphers, 2013",
            "Stinson, Cryptography Theory and Practice, Chapter 3",
        ],
        workedExample:
            "With block 0x1234 and key 0xABCD, the first round rotates the high byte, adds the low byte, rotates and xors the low byte, then mixes both with a derived round-key pair. Eight such rounds give the ciphertext; reversing them with subtraction and opposite rotations returns 0x1234.",
    },
    id: "speck-cipher",
    name: "SPECK Block Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { block: 0x1234, key: 0xabcd, rounds: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "split the block and key into two eight-bit words each",
        "derive one round-key pair per round from the key words",
        "for each round rotate the first word right by three",
        "add the second word to the first modulo 256",
        "rotate the second word left by two and xor the first",
        "xor both words with the round-key pair",
        "to decrypt subtract, rotate the other way, and xor in reverse",
        "done: report ciphertext and recovered block",
    ],
};

export default module;
