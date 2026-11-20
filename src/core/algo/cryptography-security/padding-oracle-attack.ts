/**
 * padding-oracle-attack.ts - Padding Oracle Attack (Toy CBC Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A padded block cipher in CBC mode reveals a one-bit signal: whether the
 * decrypted plaintext has valid PKCS#7 padding. That signal is enough to
 * decrypt without the key. For the last ciphertext block, forge an IV byte by
 * byte from the end. For each position, set the already recovered trailing
 * bytes so the corresponding plaintext bytes form a valid pad length, then try
 * all 256 values of the current IV byte until the oracle says the padding is
 * valid. The current intermediate byte is the guess XOR the desired pad value.
 * Once all intermediate bytes are known, XOR them with the real IV to obtain
 * the plaintext block. The block cipher here is a small invertible toy, so the
 * attack is faithful in structure but uses demonstration parameters only.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b * 256) oracle calls for a b-byte block
 *   Space: O(b) for the recovered intermediate bytes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per byte position; the guessed byte is highlighted.
 *   - A successful oracle probe is green, a failed one red.
 *   - meta carries the intermediate bytes, recovered plaintext and verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface OracleInput {
    plaintext?: string;
    key?: number[];
    iv?: number[];
}

/** Toy 8-bit S-box: multiplication by an odd constant is a bijection mod 256. */
function sbox(x: number): number {
    return (7 * x + 13) & 0xff;
}

/** Inverse of the toy S-box (183 is the inverse of 7 mod 256). */
function inverseSbox(y: number): number {
    return (183 * (y - 13)) & 0xff;
}

/** Toy block encryption: substitute each byte after XORing the key. */
function encryptBlock(block: number[], key: number[]): number[] {
    return block.map((value, i) => sbox(value ^ (key[i] ?? 0)));
}

/** Toy block decryption: invert the substitution, then XOR the key. */
function decryptBlock(block: number[], key: number[]): number[] {
    return block.map((value, i) => inverseSbox(value) ^ (key[i] ?? 0));
}

/** PKCS#7 padding check for a four-byte block. */
function validPadding(bytes: number[]): boolean {
    const last = bytes[bytes.length - 1] ?? 0;
    if (last < 1 || last > bytes.length) return false;
    for (let i = bytes.length - last; i < bytes.length; i += 1) {
        if (bytes[i] !== last) return false;
    }
    return true;
}

/** The one-bit leak: does the forged block decrypt to a well-padded plaintext? */
function oracle(cipher: number[], forgedIv: number[], key: number[], expectedPad: number): boolean {
    const plain = decryptBlock(cipher, key).map((value, i) => value ^ (forgedIv[i] ?? 0));
    return (plain[plain.length - 1] ?? 0) === expectedPad && validPadding(plain);
}

/** Build one bar per byte position. */
function makeBars(values: number[], focus: number, state: EntityState): VisualEntity[] {
    return values.map((value, i) => ({
        id: `byte-${i}`,
        type: "bar" as const,
        label: `${i}:${value}`,
        value,
        state: (i === focus ? state : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OracleInput | null) ?? {};
    const key = Array.isArray(task.key) && task.key.length === 4
        ? task.key.map((v) => Math.floor(Number(v) || 0) & 0xff)
        : [0x11, 0x23, 0x47, 0x65];
    const iv = Array.isArray(task.iv) && task.iv.length === 4
        ? task.iv.map((v) => Math.floor(Number(v) || 0) & 0xff)
        : [0x0a, 0x14, 0x1e, 0x28];
    const text = String(task.plaintext ?? "SECRET!").slice(0, 4).padEnd(4, "A");
    const plain = [...text].map((ch) => ch.charCodeAt(0) & 0xff);
    const cipher = encryptBlock(plain.map((value, i) => value ^ (iv[i] ?? 0)), key);
    const intermediate = new Array<number>(4).fill(0);
    const forged = new Array<number>(4).fill(0);
    let step = 0;
    const emit = (description: string, codeLine: number, focus: number, state: EntityState, extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeBars(forged, focus, state),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "array" as const,
        meta: {
            key: key.slice(),
            iv: iv.slice(),
            cipher: cipher.slice(),
            intermediate: intermediate.slice(),
            recovered: intermediate.slice(),
            plaintext: plain.slice(),
            ...extra,
        },
    });

    yield emit(`Padding oracle attack on a four-byte CBC block with key ${key.join(",")}.`, 0, -1, "idle", { phase: "setup" });

    for (let position = 3; position >= 0; position -= 1) {
        const padValue = 4 - position;
        for (let j = position + 1; j < 4; j += 1) forged[j] = (intermediate[j] ?? 0) ^ padValue;
        let found = -1;
        for (let guess = 0; guess < 256; guess += 1) {
            forged[position] = guess;
            if (oracle(cipher, forged, key, padValue)) {
                found = guess;
                break;
            }
        }
        if (found < 0) {
            yield emit(`No valid guess at byte ${position}; the toy oracle is inconsistent.`, 6, position, "error", { phase: "fail", position });
            return;
        }
        intermediate[position] = found ^ padValue;
        yield emit(
            `Byte ${position}: guess ${found} made padding valid, so intermediate byte is ${intermediate[position]}.`,
            4,
            position,
            "sorted",
            { phase: "byte", position, guess: found, padValue },
        );
    }

    const recovered = intermediate.map((value, i) => value ^ (iv[i] ?? 0));
    const match = recovered.every((value, i) => value === plain[i]);
    yield emit(
        match
            ? `Recovered plaintext [${recovered.join(", ")}] equals the original block without using the key.`
            : `Recovered [${recovered.join(", ")}] differs from the original [${plain.join(", ")}].`,
        8,
        -1,
        match ? "sorted" : "error",
        { phase: "done", recovered, match: match ? 1 : 0 },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A service that reports whether decrypted padding is valid is leaking information even though it hides the key. In CBC, changing the IV changes the decrypted plaintext in the same byte positions. Fix the trailing bytes so they already look like a valid pad length, then try every value of the next IV byte until the service accepts. The accepted value reveals the intermediate byte before the XOR with the IV, and repeating from the end recovers the whole block.",
        invariants: [
            "A forged IV byte changes only the plaintext byte at that position.",
            "The oracle returns exactly one bit: validity of the four-byte PKCS#7 padding.",
            "The intermediate byte equals the accepted guess XOR the desired pad value.",
        ],
        correctness:
            "In CBC the plaintext byte equals the cipher block decrypted byte XOR the IV byte. While probing position k with IV bytes at larger positions already set to produce a valid pad, the oracle accepts exactly when the current plaintext byte equals the required pad value. There is a unique IV byte that achieves this for each intermediate value, so the brute-force search finds it and intermediate = guess XOR padValue. After all positions are known, XORing the intermediate with the genuine IV returns the original plaintext block. The toy S-box is invertible, so the block layer behaves like a real cipher for the attack.",
        complexityRationale:
            "Each of the b byte positions needs at most 256 oracle calls and each call decrypts a constant-size block, so the attack takes O(b * 256) time. It stores the b recovered intermediate bytes, giving O(b) space.",
        uses: [
            "Demonstrating why padding validity must never be reported to a client",
            "Understanding chosen-ciphertext attacks against CBC with PKCS#7",
            "Motivating encrypt-then-MAC and authenticated encryption",
        ],
        references: [
            "Vaudenay, Security Flaws Induced by CBC Padding, EUROCRYPT 2002",
            "Bleichenbacher, Chosen Ciphertext Attacks Against RSA with PKCS#1 v1.5, CRYPTO 1998",
        ],
        workedExample:
            "For the last byte, set the desired pad length to one and try IV values 0 through 255. The one value that makes the decrypted last byte equal one is accepted; XOR it with one to get the intermediate byte. For the next position, set the last IV byte to make its plaintext byte equal two, then search for the byte that makes the second-to-last byte also two. After four positions, XOR the intermediates with the original IV to read SECRET in ASCII.",
    },
    id: "padding-oracle-attack",
    name: "Padding Oracle Attack",
    category: "cryptography-security",
    complexity: { time: "O(b * 256)", space: "O(b)" },
    defaultInput: {
        plaintext: "SECRET!",
        key: [0x11, 0x23, 0x47, 0x65],
        iv: [0x0a, 0x14, 0x1e, 0x28],
    },
    visualType: "array",
    run,
    pseudocode: [
        "encrypt a four-byte block with a toy invertible S-box cipher",
        "define the oracle as a valid PKCS#7 padding verdict",
        "for each byte position from last to first",
        "set trailing forged bytes to form the current pad length",
        "try every candidate byte until the oracle accepts",
        "set the intermediate byte to the guess XOR the pad value",
        "after all bytes, XOR the intermediates with the real IV",
        "compare the recovered block with the original plaintext",
        "done: report the recovered bytes and the verdict",
    ],
};

export default module;
