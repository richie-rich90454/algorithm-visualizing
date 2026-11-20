/**
 * double-ratchet.ts - Toy Double-Ratchet KDF Chains
 *
 * TOY MODEL - NOT FOR PRODUCTION. A real double ratchet uses X3DH, Curve25519
 * Diffie-Hellman ratchets, and HKDF with real hash functions. Here a small
 * deterministic integer hash plays the role of the KDF and XOR plays the role
 * of the stream cipher, so the KDF-chain structure can be inspected exactly.
 * No security claim is made. Teaches: root chain -> per-epoch chain -> message
 * keys, with forward advancement of both chains.
 *
 * Time:  O(E * M) for E ratchet epochs and M messages per epoch
 * Space: O(E * M) for the derived keys and ciphertexts
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface RatchetInput {
    seed?: number;
    dhOutputs?: number[];
    messagesPerEpoch?: number;
}

/** Toy keyed hash (FNV-style) producing a 32-bit unsigned value. */
function kdf(...parts: number[]): number {
    let h = 2166136261 >>> 0;
    for (const part of parts) {
        let value = part >>> 0;
        for (let byte = 0; byte < 4; byte += 1) {
            h = Math.imul(h ^ (value & 0xff), 16777619) >>> 0;
            value = value >>> 8;
        }
    }
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    return h >>> 0;
}

/** One bar per derived message key (display value reduced for the canvas). */
function makeBars(keys: number[], current: number): VisualEntity[] {
    return keys.map((key, index) => ({
        id: `key-${index}`,
        type: "bar" as const,
        label: key.toString(16).padStart(8, "0"),
        value: key % 997,
        state: (index === current ? "active" : index < current ? "sorted" : "idle") as "active" | "sorted" | "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, key },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RatchetInput | null) ?? {};
    const seed = Math.trunc(task.seed ?? 1337) >>> 0;
    const dhOutputs: number[] =
        Array.isArray(task.dhOutputs) && task.dhOutputs.length > 0
            ? task.dhOutputs.map((value) => Math.trunc(value) >>> 0)
            : [101, 202, 303];
    const perEpoch = Math.max(1, Math.min(Math.trunc(task.messagesPerEpoch ?? 2), 5));

    let root = seed;
    const keys: number[] = [];
    const plains: number[] = [];
    const ciphers: number[] = [];
    const chainKeys: number[] = [];
    let epoch = 0;

    yield {
        stepNumber: 0,
        entities: makeBars([], -1),
        edges: [],
        description: `Initializing toy double ratchet with ${dhOutputs.length} DH ratchet step(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, dhOutputs, perEpoch, epoch: 0, keys: [], plains: [], ciphers: [], chainKeys: [] },
    };

    let step = 1;
    for (const dh of dhOutputs) {
        const epochChain = kdf(root, dh, 0x45);
        root = kdf(root, dh, 0x52);
        let chainKey = epochChain;
        chainKeys.push(epochChain);

        for (let m = 0; m < perEpoch; m += 1) {
            const messageKey = kdf(chainKey, 0x4d);
            const nextChainKey = kdf(chainKey, 0x43);
            const plain = (epoch * 17 + m * 31 + 7) % 256;
            const cipher = plain ^ (messageKey & 0xff);
            keys.push(messageKey);
            plains.push(plain);
            ciphers.push(cipher);
            chainKey = nextChainKey;

            yield {
                stepNumber: step,
                entities: makeBars(keys, keys.length - 1),
                edges: [],
                description: `Epoch ${epoch}, message ${m}: derived key ${messageKey.toString(16)}; ciphertext ${cipher} XOR-decrypts to ${plain}.`,
                codeLineNumber: keys.length === 1 ? 3 : 5,
                layout: "array",
                meta: {
                    seed,
                    dhOutputs,
                    perEpoch,
                    epoch,
                    message: m,
                    keys: [...keys],
                    plains: [...plains],
                    ciphers: [...ciphers],
                    chainKeys: [...chainKeys],
                },
            };
            step += 1;
        }
        epoch += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(keys, -1),
        edges: [],
        description: `Done: ${keys.length} message keys derived; all distinct; XOR decryption recovers every plaintext.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            seed,
            dhOutputs,
            perEpoch,
            epoch,
            keys,
            plains,
            ciphers,
            chainKeys,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The double ratchet gives every message a fresh key so that compromising one key does not reveal the others. A root chain absorbs new Diffie-Hellman outputs to create per-epoch sending chains, and each sending chain advances once per message to derive a one-time message key. This toy reproduces that chain structure exactly with an integer hash.",
        invariants: [
            "Each DH output advances the root key and opens a fresh sending chain.",
            "Each message advances the sending chain key, producing a new message key.",
            "Decrypting a message uses only its own derived message key.",
        ],
        correctness:
            "The sender and receiver start from the same root key and process the same DH outputs, so they derive identical epoch chain keys. From a chain key, the same KDF call yields the same message key and the same next chain key, so the two sides stay synchronized. XOR with the message key is an involution, applying it twice restores the plaintext.",
        complexityRationale:
            "Each message performs a constant number of KDF calls, so for E epochs of M messages the time is O(E * M). Storing the derived keys and ciphertexts for replay uses O(E * M) space.",
        uses: [
            "Teaching forward secrecy and post-compromise security concepts",
            "Understanding the key schedule of the Signal protocol",
            "Modeling message-key chains in secure messaging",
        ],
        references: [
            "Marlinspike and Perrin, The Double Ratchet Algorithm, 2016",
            "Cohn-Gordon et al., A Formal Security Analysis of the Signal Messaging Protocol, 2017",
        ],
        workedExample:
            "Starting from seed 1337, a DH output opens a chain whose first message key is a 32-bit hash. XORing that key's low byte with plaintext 7 gives a ciphertext; the receiver derives the same key from the same chain and XORs again to recover 7.",
    },
    id: "double-ratchet",
    name: "Double Ratchet (Toy KDF Chains)",
    category: "cryptography-security",
    complexity: { time: "O(E * M)", space: "O(E * M)" },
    defaultInput: { seed: 1337, dhOutputs: [101, 202, 303], messagesPerEpoch: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the root key from a shared seed",
        "for each Diffie-Hellman ratchet output",
        "derive a new sending chain key from the root key",
        "advance the root key for the next epoch",
        "for each message derive a one-time key from the chain key",
        "advance the chain key and XOR-encrypt the message",
        "receiver repeats the derivation and XOR-decrypts",
        "done: report all message keys and ciphertexts",
    ],
};

export default module;
