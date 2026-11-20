/**
 * xmss.ts - XMSS Teachable Core: Winternitz Chain plus Merkle Root (Toy)
 *
 * XMSS is a hash-based signature scheme built from a Winternitz one-time
 * signature whose public keys are committed in a Merkle tree. This toy model
 * implements the exact chain, digit encoding, one-time signature, and Merkle
 * root steps on small integers. The parameters are far too small for security;
 * this is a teaching model, not a production hash-based signature.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 2147483647;

/** A deterministic toy mixing function standing in for a cryptographic hash. */
export function toyHash(x: number): number {
    const value = (Math.imul(x >>> 0, 1103515245) + 12345) >>> 0;
    return value % P;
}

/** Combine two child values into one parent value. */
export function combine(left: number, right: number): number {
    const mixed = (Math.imul(left >>> 0, 31) + (right >>> 0)) >>> 0;
    return toyHash(mixed);
}

/** Iterate the toy hash `steps` times. */
export function chain(secret: number, steps: number): number {
    let value = secret >>> 0;
    for (let i = 0; i < steps; i += 1) {
        value = toyHash(value);
    }
    return value;
}

export interface XmssToy {
    w: number;
    digits: number[];
    secret: number[];
    publicKey: number[];
    signature: number[];
    leaf: number;
    root: number;
    authPath: number[];
    recoveredLeaf: number;
    recoveredRoot: number;
    verified: boolean;
}

/** Encode a message as base-w digits. */
export function encodeDigits(message: number, w: number, digits: number): number[] {
    const result: number[] = [];
    let remainder = Math.max(0, Math.floor(message)) % Math.pow(w, digits);
    for (let d = 0; d < digits; d += 1) {
        result.push(remainder % w);
        remainder = Math.floor(remainder / w);
    }
    return result;
}

/** Fold a one-time public key into a single Merkle leaf value. */
export function leafOf(publicKey: number[]): number {
    return publicKey.reduce((acc, value) => combine(acc, value), 0);
}

/** Build the toy Merkle tree over all one-time public keys. */
function buildTree(w: number, digits: number, leaves: number): number[][] {
    const level = Array.from({ length: leaves }, (_, l) =>
        leafOf(Array.from({ length: digits }, (_, d) => chain(toyHash(1000 + l * 100 + d), w - 1))),
    );
    const tree: number[][] = [level];
    while (tree[tree.length - 1]!.length > 1) {
        const current = tree[tree.length - 1]!;
        const parent: number[] = [];
        for (let i = 0; i < current.length; i += 2) {
            parent.push(combine(current[i] ?? 0, current[i + 1] ?? 0));
        }
        tree.push(parent);
    }
    return tree;
}

/** Verify a toy signature against a message and a committed root. */
export function verifyToyXmss(
    signature: number[],
    message: number,
    w: number,
    digits: number,
    leaves: number,
    leafIndex: number,
    root: number,
): boolean {
    const idx = Math.max(0, Math.min(leaves - 1, leafIndex));
    const msgDigits = encodeDigits(message, w, digits);
    const recovered = signature.map((s, d) => chain(s, w - 1 - (msgDigits[d] ?? 0)));
    const recoveredLeaf = leafOf(recovered);
    const tree = buildTree(w, digits, leaves);
    let node = recoveredLeaf;
    let position = idx;
    for (let layer = 0; layer < tree.length - 1; layer += 1) {
        const current = tree[layer]!;
        const sibling = position % 2 === 0 ? position + 1 : position - 1;
        node = position % 2 === 0 ? combine(node, current[sibling] ?? 0) : combine(current[sibling] ?? 0, node);
        position = Math.floor(position / 2);
    }
    return node === root && recoveredLeaf === tree[0]?.[idx];
}

/** Build a toy WOTS chain, sign a message, and verify against a Merkle root. */
export function buildToyXmss(message: number, leafIndex: number, w: number, digits: number, leaves: number): XmssToy {
    const idx = Math.max(0, Math.min(leaves - 1, leafIndex));
    const secret: number[] = [];
    for (let d = 0; d < digits; d += 1) {
        secret.push(toyHash(1000 + idx * 100 + d));
    }
    const publicKey = secret.map((s) => chain(s, w - 1));
    const msgDigits: number[] = [];
    let remainder = Math.max(0, Math.floor(message)) % Math.pow(w, digits);
    for (let d = 0; d < digits; d += 1) {
        msgDigits.push(remainder % w);
        remainder = Math.floor(remainder / w);
    }
    const signature = secret.map((s, d) => chain(s, msgDigits[d] ?? 0));

    const leafOf = (pk: number[]): number => pk.reduce((acc, value) => combine(acc, value), 0);
    const leaf = leafOf(publicKey);
    const level: number[] = [];
    for (let l = 0; l < leaves; l += 1) {
        const pk = Array.from({ length: digits }, (_, d) => chain(toyHash(1000 + l * 100 + d), w - 1));
        level.push(leafOf(pk));
    }
    const tree: number[][] = [level.slice()];
    while (tree[tree.length - 1]!.length > 1) {
        const current = tree[tree.length - 1]!;
        const parent: number[] = [];
        for (let i = 0; i < current.length; i += 2) {
            parent.push(combine(current[i] ?? 0, current[i + 1] ?? 0));
        }
        tree.push(parent);
    }
    const root = tree[tree.length - 1]?.[0] ?? 0;
    const authPath: number[] = [];
    let cursor = idx;
    for (let layer = 0; layer < tree.length - 1; layer += 1) {
        const current = tree[layer]!;
        const sibling = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
        authPath.push(current[sibling] ?? 0);
        cursor = Math.floor(cursor / 2);
    }

    const recovered = signature.map((s, d) => chain(s, w - 1 - (msgDigits[d] ?? 0)));
    const recoveredLeaf = leafOf(recovered);
    let node = recoveredLeaf;
    let position = idx;
    for (const sibling of authPath) {
        node = position % 2 === 0 ? combine(node, sibling) : combine(sibling, node);
        position = Math.floor(position / 2);
    }
    const recoveredRoot = node;
    return {
        w,
        digits: msgDigits,
        secret,
        publicKey,
        signature,
        leaf,
        root,
        authPath,
        recoveredLeaf,
        recoveredRoot,
        verified: recoveredRoot === root && recoveredLeaf === leaf,
    };
}

/** Render a key/value table of the toy XMSS computation. */
function makeCells(rows: Array<[string, string]>, revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    rows.forEach(([label, value], row) => {
        const state: EntityState = row === current ? "comparing" : row <= revealed ? "sorted" : "idle";
        for (let col = 0; col < 2; col += 1) {
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: col === 0 ? label : row <= revealed ? value : "?",
                value: col === 0 ? label : value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { message?: number; leafIndex?: number; w?: number; digits?: number; leaves?: number } | null
    ) ?? {};
    const message = typeof task.message === "number" ? Math.max(0, Math.floor(task.message)) : 5;
    const leafIndex = typeof task.leafIndex === "number" ? Math.max(0, Math.floor(task.leafIndex)) : 0;
    const w = typeof task.w === "number" ? Math.max(2, Math.min(8, Math.floor(task.w))) : 4;
    const digits = typeof task.digits === "number" ? Math.max(1, Math.floor(task.digits)) : 2;
    const leaves = typeof task.leaves === "number" ? Math.max(2, Math.min(8, Math.pow(2, Math.floor(Math.log2(task.leaves))))) : 4;
    const data = buildToyXmss(message, leafIndex, w, digits, leaves);
    const rows: Array<[string, string]> = [
        ["message", String(message)],
        ["base-w digits", data.digits.join(", ")],
        ["secret sk", data.secret.join(", ")],
        ["one-time public pk", data.publicKey.join(", ")],
        ["leaf = hash(pk)", String(data.leaf)],
        ["signature", data.signature.join(", ")],
        ["auth path", data.authPath.join(", ")],
        ["Merkle root", String(data.root)],
        ["recovered root", String(data.recoveredRoot)],
        ["verified", String(data.verified)],
    ];
    const metaBase = { rows: rows.length, cols: 2, w, digits, leaves, leafIndex, message };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, -1),
        edges: [],
        description: `Toy XMSS: Winternitz-(${w}) one-time signature committed in a ${leaves}-leaf Merkle tree. Parameters are not secure (teaching model).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase },
    };
    step += 1;

    for (let i = 0; i < rows.length - 1; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(rows, i, i),
            edges: [],
            description: `${rows[i]?.[0]}: ${rows[i]?.[1]}.`,
            codeLineNumber: i === 1 ? 2 : i < 5 ? 3 : 5,
            layout: "grid",
            meta: { ...metaBase, root: data.root, verified: data.verified },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, rows.length - 1, rows.length - 1),
        edges: [],
        description: `Done: signature ${data.verified ? "verifies" : "fails"} against the Merkle root (toy parameters, no security claim).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...metaBase, root: data.root, recoveredRoot: data.recoveredRoot, verified: data.verified, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "XMSS signs with a hash chain instead of a hard math problem. A Winternitz secret is hashed a fixed number of times to make a public value; the signature reveals only a message-dependent prefix of that chain. Many one-time public keys are then committed as leaves of a Merkle tree, so one small root authenticates them all.",
        invariants: [
            "A public-key element is the secret element hashed w-1 times.",
            "A signature element is the secret hashed the message digit number of times.",
            "Continuing each signature chain to w-1 reconstructs the public key and hence the leaf and Merkle root.",
        ],
        correctness:
            "The chain function is deterministic, so continuing a signature element by (w-1 - digit) applications necessarily reaches the public element that was defined as (w-1) applications from the same secret. Reconstructing the leaf and combining it with the authentication path reproduces the committed root exactly for an honest signature; a changed message or signature breaks one of these equalities, which the verifier detects.",
        complexityRationale:
            "With w-1 chain steps, d digits, and L leaves, key generation and signing use O(L*d*w) hash calls and the tree uses O(L) space. Only a logarithmic authentication path is stored per signature. Real XMSS uses full cryptographic hashes and 2^h leaves.",
        uses: [
            "Hash-based digital signatures resistant to quantum adversaries",
            "Long-lived signing keys where state is carefully managed",
            "A teaching model for one-time signatures and Merkle commitments",
        ],
        references: [
            "Buchmann, Dahmen, and Eichler, On Secure Implementation of Winternitz One-Time Signatures, 2008",
            "NIST SP 800-208, Recommendation for Stateful Hash-Based Signature Schemes, 2020",
        ],
        workedExample:
            "With w=4 and two base-4 digits, message 5 becomes digits (1, 1). Each secret is hashed once for the signature; the verifier hashes each signature element three more times to reach the four-step public value, rebuilds the leaf, follows the sibling path to the root, and accepts when the roots match.",
    },
    id: "xmss",
    name: "XMSS (Toy Hash-Based Signature)",
    category: "cryptography-security",
    complexity: { time: "O(L*d*w)", space: "O(L)" },
    defaultInput: { message: 5, leafIndex: 0, w: 4, digits: 2, leaves: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose chain length w, digit count, and a Merkle leaf count",
        "derive secret elements for the chosen one-time key",
        "hash each secret w-1 times to form the public key",
        "encode the message as base-w digits",
        "sign by hashing each secret by its digit count",
        "hash the public key into a leaf and build the Merkle root",
        "rebuild the leaf from the signature and follow the auth path",
        "done: accept when the recovered root matches the committed root",
    ],
};

export default module;
