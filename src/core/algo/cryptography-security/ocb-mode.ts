/**
 * ocb-mode.ts - OCB Authenticated Encryption (Toy Model)
 *
 * OCB is a parallelizable authenticated-encryption mode. Each plaintext block
 * is masked with a keyed block cipher under a per-block offset, and a checksum
 * of the plaintext produces a short authentication tag. This teaching version
 * uses one-byte blocks and a keyed bijection instead of a full AES block cipher
 * and a Gray-code offset schedule, but keeps the mask, checksum, and tag
 * structure. Not cryptographically secure.
 *
 * Time: O(blocks); Space: O(blocks).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function sbox(value: number): number {
    return (value * 13 + 7) & 0xff;
}

function encryptBlock(block: number, key: number): number {
    return sbox((block ^ key) & 0xff);
}

function offsets(nonce: number, key: number, count: number): number[] {
    const l = encryptBlock(0, key);
    const base = encryptBlock(nonce ^ l, key);
    return Array.from({ length: count + 1 }, (_, index) => (base + index * l) & 0xff);
}

function makeEntities(bytes: number[], active: number): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `block-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: index === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { position: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: number[]; key?: number; nonce?: number } | null) ?? {};
    const plaintext = task.plaintext ?? [72, 105, 33, 42, 68, 69, 83];
    const key = (task.key ?? 0x2b) & 0xff;
    const nonce = (task.nonce ?? 7) & 0xff;

    const off = offsets(nonce, key, plaintext.length);
    const ciphertext: number[] = [];
    let checksum = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(plaintext, -1),
        edges: [],
        description: `Preparing OCB-style authenticated encryption of ${plaintext.length} one-byte blocks.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", ciphertext: [] as number[], tag: null as number | null, decrypted: [] as number[], tagValid: false },
    };
    step += 1;

    for (let i = 0; i < plaintext.length; i += 1) {
        const mask = encryptBlock(off[i] ?? 0, key);
        const cipherByte = (plaintext[i] ?? 0) ^ mask;
        ciphertext.push(cipherByte);
        checksum ^= plaintext[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeEntities(ciphertext, i),
            edges: [],
            description: `Masked block ${i + 1} under offset ${off[i] ?? 0} to form ciphertext byte ${cipherByte}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { phase: "encrypt", ciphertext: [...ciphertext], tag: null, decrypted: [] as number[], tagValid: false },
        };
        step += 1;
    }

    const tag = encryptBlock(checksum ^ (off[plaintext.length] ?? 0), key);
    const decrypted = ciphertext.map((value, i) => (value ^ encryptBlock(off[i] ?? 0, key)) & 0xff);
    const recomputedChecksum = decrypted.reduce((acc, value) => acc ^ value, 0);
    const recomputedTag = encryptBlock(recomputedChecksum ^ (off[plaintext.length] ?? 0), key);
    const tagValid = recomputedTag === tag;

    yield {
        stepNumber: step,
        entities: makeEntities(ciphertext, -1),
        edges: [],
        description: `Computed authentication tag ${tag}; verifying the decrypted checksum yields a ${tagValid ? "valid" : "invalid"} tag.`,
        codeLineNumber: plaintext.length === 0 ? 3 : 5,
        layout: "array",
        meta: { phase: "done", ciphertext: [...ciphertext], tag, decrypted, tagValid },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Authenticated encryption must both hide the message and prove it was not changed. OCB masks each block with a keyed function under a different offset, and folds all plaintext blocks into a checksum that becomes a short tag. A receiver recomputes the tag after decrypting and rejects any mismatch.",
        invariants: [
            "Each block uses a distinct offset derived from the nonce and the master key.",
            "The checksum is the XOR of all plaintext blocks.",
            "Decryption XORs the same mask back, then the recomputed tag must equal the transmitted tag.",
        ],
        correctness:
            "Because XOR with the same mask is an involution, decrypting correctly recovered ciphertext returns the original plaintext and the checksum matches. Any change to a ciphertext block flips the recovered plaintext and therefore the checksum, so the recomputed tag differs and tampering is detected.",
        complexityRationale:
            "Encryption and decryption each apply one keyed block operation per block plus one for the tag, so both are linear in the number of blocks with linear storage.",
        uses: [
            "Protecting network packets with confidentiality and integrity together",
            "Teaching offset-based authenticated encryption without a full AES dependency",
            "Designing protocols where a wrong key or altered ciphertext must be rejected",
        ],
        references: [
            "Rogaway, Bellare, and Black, OCB Mode of Operation, 2003",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, chapter 7",
        ],
        workedExample:
            "Encrypting the bytes hello world under key 0x2B and nonce 7 produces a mask for each block and a checksum tag. Decryption restores the bytes and recomputes the same tag; flipping one ciphertext byte makes the recomputed tag differ.",
    },
    id: "ocb-mode",
    name: "OCB Authenticated Encryption (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(blocks)", space: "O(blocks)" },
    defaultInput: { plaintext: [72, 105, 33, 42, 68, 69, 83], key: 0x2b, nonce: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "derive the offset base from the nonce and keyed constant",
        "for each plaintext block compute its block offset",
        "mask the block and append the ciphertext byte",
        "fold the plaintext block into a running checksum",
        "form the tag from the checksum and the final offset",
        "decrypt by XORing the same masks back",
        "recompute the tag and accept only on equality",
    ],
};

export default module;
