/**
 * signal-protocol.ts - Signal Protocol (Symmetric-Key Ratchet Core)
 *
 * TEACHING MODEL, NOT THE SIGNAL PROTOCOL. The double ratchet advances a
 * symmetric chain key for every message and derives a distinct message key
 * from each chain state, so compromising one message key does not reveal the
 * others. Out-of-order messages are handled by storing skipped message keys.
 * This module uses a small deterministic toy key derivation function and shows
 * exactly those steps. It makes no production security claim.
 *
 * Complexity:
 *   Time:  O(n) for n messages advanced
 *   Space: O(n) for the skipped message keys
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

/** A small deterministic avalanche function standing in for a real KDF. */
function hash32(value: number): number {
    let h = value >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
}

function kdf(key: number, label: number): number {
    return hash32((key ^ Math.imul(label, 0x9e3779b1)) >>> 0);
}

const CHAIN_LABEL = 1;
const MESSAGE_LABEL = 2;

function makeCells(matrix: Cell[][], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealed || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : String(value ?? 0),
                value: value ?? -1,
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
    const task = (
        input as { chainKey?: number; messages?: number; plain?: number[]; deliver?: number[] } | null
    ) ?? {};
    const messages = Math.max(1, Math.min(10, Math.floor(task.messages ?? 5)));
    let chain = (task.chainKey ?? 12345) >>> 0;
    const chainKeys: number[] = [];
    const messageKeys: number[] = [];
    for (let i = 0; i < messages; i += 1) {
        chainKeys.push(chain);
        messageKeys.push(kdf(chain, MESSAGE_LABEL));
        chain = kdf(chain, CHAIN_LABEL);
    }
    const plain = Array.from({ length: messages }, (_, i) => task.plain?.[i] ?? 1000 + i);
    const ciphertext = plain.map((value, i) => (value ^ messageKeys[i]!) >>> 0);

    const deliver = (task.deliver?.length ? task.deliver : [0, 1, 3, 2, 4]).map((i) =>
        Math.max(0, Math.min(messages - 1, Math.floor(i))),
    );
    const skipped = new Map<number, number>();
    const receivedFlags = new Array<number>(messages).fill(0);
    let received = 0;
    for (const index of deliver) {
        if (index === received) {
            receivedFlags[index] = 1;
            received += 1;
            while (skipped.has(received)) {
                skipped.delete(received);
                receivedFlags[received] = 1;
                received += 1;
            }
        } else if (index > received) {
            skipped.set(index, messageKeys[index]!);
            receivedFlags[index] = 1;
        }
    }

    const matrix: Cell[][] = [
        Array.from({ length: messages }, (_, i) => i),
        chainKeys,
        messageKeys,
        receivedFlags,
    ];
    const base = { rows: 4, cols: messages, messages, chainKey: task.chainKey ?? 12345 };
    const captions = [
        "A sending chain starts from a secret chain key.",
        "Each step stores the current chain key before advancing it.",
        "A distinct message key is derived from each chain state.",
        "Out-of-order messages are delivered from stored skipped keys.",
        `Done: ${messages} message key(s) derived; ${skipped.size} still skipped.`,
    ];
    for (let frame = 0; frame < captions.length; frame += 1) {
        yield {
            stepNumber: frame,
            entities: makeCells(matrix, frame + 1, frame),
            edges: [],
            description: captions[frame] ?? "",
            codeLineNumber: frame,
            layout: "grid",
            meta: {
                ...base,
                phase: frame === 0 ? "init" : frame === 4 ? "done" : "ratchet",
                messageKeys: messageKeys.slice(0, 16),
                ciphertext: ciphertext.slice(0, 16),
                skipped: skipped.size,
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The symmetric ratchet of the Signal protocol turns one shared secret into a long stream of independent message keys. After deriving a message key it immediately advances the chain key, so learning one message key reveals nothing about the next. If a message arrives out of order, its key is saved until the missing messages arrive.",
        invariants: [
            "Every message key is derived from the chain state before that state is advanced.",
            "The chain key advances with a different label than the message key, so the two streams differ.",
            "A delivered out-of-order key is stored and used later when the gap is filled.",
        ],
        correctness:
            "Because each chain state is the result of a one-way derivation from the previous state, and the message key uses a separate derivation label, each message key depends on a unique chain state. XOR encryption with a message key is inverted by XOR with the same key, so a stored key recovers exactly the plaintext of a delayed message. The skipped-key table supplies the key for any index below the current receiving counter.",
        complexityRationale:
            "Deriving keys for n messages performs a constant number of hash evaluations per message, so the time is O(n). The skipped-key map holds at most one entry per message, giving O(n) space.",
        uses: [
            "End-to-end encrypted messaging with forward secrecy",
            "Handling delayed or reordered ciphertexts",
            "A teaching model of a symmetric key ratchet",
        ],
        references: [
            "Marlinspike and Perrin, The Signal Protocol, 2013",
            "Marlinspike and Perrin, The Double Ratchet Algorithm, 2016",
        ],
        workedExample:
            "From chain key 12345 the first message key is the KDF of that key with the message label, and the chain advances with the chain label. If message 3 arrives before messages 1 and 2, its key is stored; once the gap is filled, the stored key decrypts message 3 in order.",
    },
    id: "signal-protocol",
    name: "Signal Protocol (Symmetric-Key Ratchet Core)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { chainKey: 12345, messages: 5, deliver: [0, 1, 3, 2, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "start from a secret chain key and a receiving counter",
        "for each message derive a message key from the current chain key",
        "advance the chain key with a separate derivation label",
        "encrypt the plaintext by XOR with the message key",
        "if a message arrives early, store its key until the gap is filled",
        "when the counter reaches a stored index, retrieve and use that key",
        "done: report the derived keys and delivered messages",
    ],
};

export default module;
