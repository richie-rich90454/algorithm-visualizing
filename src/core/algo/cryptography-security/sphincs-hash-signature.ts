/**
 * sphincs-hash-signature.ts - SPHINCS-Style Hash Signature (Toy WOTS+ and Merkle Tree)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SPHINCS and SPHINCS+ build stateless digital signatures from hash functions.
 * Their ingredients include a Winternitz one-time signature (WOTS+) and a
 * Merkle tree that compresses many one-time public keys into one root. This
 * teaching model implements those two ingredients exactly with a small toy
 * hash: a message is split into base-16 digits, each digit advances a hash
 * chain, and the resulting one-time public key sits at a Merkle leaf. A
 * signature carries the chain values and the sibling path needed to recompute
 * the root.
 *
 * This is NOT SPHINCS+ and is not secure. It omits FORS, masking with
 * pseudorandom keys, many-time trees, and a cryptographic hash. It only makes
 * the exact mathematical steps of WOTS+ chains and Merkle authentication
 * visible and verifiable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(w * L + log t) hash calls with Winternitz w and L chains
 *   Space: O(L * log t) for the signature and authentication path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A seven-node Merkle tree: root, two internal nodes, four leaves.
 *   - The signed leaf and its authentication path are highlighted.
 *   - meta carries the root, digits, signature chains, and verification result.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Input {
    message?: string;
    leafIndex?: number;
}

const W = 16;
const L = 4;
const LEAVES = 4;

/** A small deterministic avalanche mixer used as the toy hash function. */
function toyHash(x: number): number {
    let z = (x + 0x9e3779b9) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
}

const combine = (a: number, b: number): number => toyHash((a ^ Math.imul(b, 0x9e3779b1)) >>> 0);

function chain(seed: number, steps: number): number {
    let v = seed >>> 0;
    for (let i = 0; i < steps; i += 1) {
        v = toyHash(v);
    }
    return v >>> 0;
}

const seedOf = (leaf: number, j: number): number => toyHash(leaf * 100 + j + 1);
const hex = (v: number): string => (v >>> 0).toString(16).padStart(8, "0");

interface Signature {
    digits: number[];
    sig: number[];
    leafHash: number;
    authPath: number[];
}

/** Build the toy WOTS+ public keys and the Merkle tree over them. */
function buildTree() {
    const leafPk: number[][] = [];
    const leafHash: number[] = [];
    for (let i = 0; i < LEAVES; i += 1) {
        const pk: number[] = [];
        for (let j = 0; j < L; j += 1) {
            pk.push(chain(seedOf(i, j), W - 1));
        }
        leafPk.push(pk);
        let v = pk[0] ?? 0;
        for (let j = 1; j < L; j += 1) {
            v = combine(v, pk[j] ?? 0);
        }
        leafHash.push(v);
    }
    const n1 = combine(leafHash[0] ?? 0, leafHash[1] ?? 0);
    const n2 = combine(leafHash[2] ?? 0, leafHash[3] ?? 0);
    const root = combine(n1, n2);
    return { leafPk, leafHash, n1, n2, root };
}

/** Sign a message's digits with the WOTS+ chains of a chosen leaf. */
function sign(message: string, leaf: number, tree: ReturnType<typeof buildTree>): Signature {
    const mh = toyHash(Array.from(message).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7));
    const digits = Array.from({ length: L }, (_, j) => (mh >>> (4 * j)) & 15);
    const sig = digits.map((digit, j) => chain(seedOf(leaf, j), digit));
    let leafHash = sig[0] ?? 0;
    for (let j = 1; j < L; j += 1) {
        leafHash = combine(leafHash, sig[j] ?? 0);
    }
    const authPath = leaf < 2 ? [tree.leafHash[leaf === 0 ? 1 : 0] ?? 0, tree.n2] : [tree.leafHash[leaf === 2 ? 3 : 2] ?? 0, tree.n1];
    return { digits, sig, leafHash, authPath };
}

/** Recompute the Merkle root from a reconstructed leaf hash and its auth path. */
function rootFromPath(leafHash: number, leaf: number, authPath: number[]): number {
    const sibling = authPath[0] ?? 0;
    const parent = leaf % 2 === 0 ? combine(leafHash, sibling) : combine(sibling, leafHash);
    return leaf < 2 ? combine(parent, authPath[1] ?? 0) : combine(authPath[1] ?? 0, parent);
}

/** Reconstruct a one-time public key from a signature and its digits. */
function pkFromSig(sig: number[], digits: number[]): number[] {
    return sig.map((s, j) => chain(s, W - 1 - (digits[j] ?? 0)));
}

const NODE_DEFS = [
    { id: "root", parent: "root", label: "root" },
    { id: "n1", parent: "root", label: "n1" },
    { id: "n2", parent: "root", label: "n2" },
    { id: "leaf0", parent: "n1", label: "leaf0" },
    { id: "leaf1", parent: "n1", label: "leaf1" },
    { id: "leaf2", parent: "n2", label: "leaf2" },
    { id: "leaf3", parent: "n2", label: "leaf3" },
];

function makeNodes(tree: ReturnType<typeof buildTree>, states: Map<string, EntityState>): VisualEntity[] {
    const values: Record<string, number> = {
        root: tree.root,
        n1: tree.n1,
        n2: tree.n2,
        leaf0: tree.leafHash[0] ?? 0,
        leaf1: tree.leafHash[1] ?? 0,
        leaf2: tree.leafHash[2] ?? 0,
        leaf3: tree.leafHash[3] ?? 0,
    };
    return NODE_DEFS.map((def) => ({
        id: `node-${def.id}`,
        type: "node" as const,
        label: `${def.label}:${hex(values[def.id] ?? 0).slice(0, 6)}`,
        value: values[def.id] ?? 0,
        state: states.get(def.id) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: def.parent, hash: values[def.id] ?? 0 },
    }));
}

function makeEdges(states: Map<string, EntityState>): VisualEdge[] {
    return [
        ["root", "n1"],
        ["root", "n2"],
        ["n1", "leaf0"],
        ["n1", "leaf1"],
        ["n2", "leaf2"],
        ["n2", "leaf3"],
    ].map(([parent, child]) => ({
        id: `edge-${parent}-${child}`,
        sourceId: `node-${parent}`,
        targetId: `node-${child}`,
        label: "",
        state: states.get(child) ?? "idle",
        directed: false,
    }));
}

/** The toy SPHINCS-style signature generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const message = String(task.message ?? "hello");
    const leaf = Math.max(0, Math.min(LEAVES - 1, Math.floor(typeof task.leafIndex === "number" ? task.leafIndex : 0)));
    const tree = buildTree();
    const signature = sign(message, leaf, tree);
    const reconstructedPk = pkFromSig(signature.sig, signature.digits);
    let reconstructedLeafHash = reconstructedPk[0] ?? 0;
    for (let j = 1; j < L; j += 1) {
        reconstructedLeafHash = combine(reconstructedLeafHash, reconstructedPk[j] ?? 0);
    }
    const verified = reconstructedPk.every((v, j) => v === (tree.leafPk[leaf]?.[j] ?? -1)) &&
        rootFromPath(reconstructedLeafHash, leaf, signature.authPath) === tree.root;

    const badDigits = signature.digits.slice();
    badDigits[0] = (badDigits[0]! + 1) % W;
    const tamperedPk = pkFromSig(signature.sig, badDigits);
    const tamperedHash = tamperedPk.reduce((v, pk, j) => (j === 0 ? pk : combine(v, pk)), 0);
    const tamperedVerified = rootFromPath(tamperedHash, leaf, signature.authPath) === tree.root;

    const pathNodes = new Set([`leaf${leaf}`, leaf < 2 ? "n1" : "n2", "root"]);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(tree, new Map()),
        edges: makeEdges(new Map()),
        description: `Toy SPHINCS tree with ${LEAVES} WOTS+ leaves; four base-16 chains of ${W} steps each. Root ${hex(tree.root)}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { root: hex(tree.root), leafIndex: leaf, message, digits: [], verified: "pending", tamperedVerified: "pending" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(tree, new Map([[`leaf${leaf}`, "comparing"]])),
        edges: makeEdges(new Map()),
        description: `Sign message "${message}" from leaf ${leaf}; hash splits into digits ${signature.digits.join(", ")}.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { root: hex(tree.root), leafIndex: leaf, message, digits: signature.digits, verified: "pending", tamperedVerified: "pending" },
    };
    step += 1;

    const signStates = new Map<string, EntityState>();
    for (const n of pathNodes) {
        signStates.set(n, "path");
    }
    yield {
        stepNumber: step,
        entities: makeNodes(tree, signStates),
        edges: makeEdges(signStates),
        description: `Signature holds the chain values and the sibling path [${signature.authPath.map(hex).join(", ")}].`,
        codeLineNumber: 4,
        layout: "tree",
        meta: {
            root: hex(tree.root),
            leafIndex: leaf,
            message,
            digits: signature.digits,
            sig: signature.sig.map(hex),
            authPath: signature.authPath.map(hex),
            verified: "pending",
            tamperedVerified: "pending",
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(tree, new Map([[`leaf${leaf}`, "sorted"], ["root", "sorted"]])),
        edges: makeEdges(signStates),
        description: `Verification: rebuilt leaf key and authentication path reproduce root ${hex(tree.root)}; verified = ${verified}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: {
            root: hex(tree.root),
            leafIndex: leaf,
            message,
            digits: signature.digits,
            verified,
            tamperedVerified: "pending",
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(tree, new Map([[`leaf${leaf}`, "error"], ["root", "highlight"]])),
        edges: makeEdges(signStates),
        description: `Tampering with one digit changes the leaf hash, so the root no longer matches; verified = ${tamperedVerified}. This toy is not secure.`,
        codeLineNumber: 8,
        layout: "tree",
        meta: {
            root: hex(tree.root),
            leafIndex: leaf,
            message,
            digits: badDigits,
            sig: signature.sig.map(hex),
            authPath: signature.authPath.map(hex),
            verified,
            tamperedVerified,
            note: "toy hash and construction, not secure",
        },
    };
}

/** The toy SPHINCS-style signature module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Stateless hash-based signatures avoid number theory and rely only on hashing. A Winternitz one-time signature encodes a message as digits and publishes the result of hashing a secret many times; signing reveals intermediate hash values. A Merkle tree then compresses many such one-time public keys into a single root. This toy shows both pieces: hash chains for the one-time key and an authentication path up the tree.",
        invariants: [
            "Each WOTS+ chain value is obtained by repeatedly applying a one-way hash to a secret seed.",
            "A verifier can advance a revealed chain value the remaining number of steps to reach the public key.",
            "The Merkle root commits to every leaf, so changing any leaf hash changes the recomputed root.",
        ],
        correctness:
            "For each digit d, the signature reveals the d-th value of a chain whose public endpoint is the (W-1)-th value. Applying the hash W-1-d more steps reaches that endpoint, so an honest signature reconstructs the leaf public key exactly. The authentication path then recombines sibling hashes up the tree; because the root is a deterministic hash combination, an untampered signature reproduces it while a changed digit produces a different root and fails verification.",
        complexityRationale:
            "Each of the L chains is advanced at most W-1 times for key generation, signing, and verification, and the tree authentication path has log base two of t nodes, giving O(w * L + log t) hash calls. The signature stores L chain values plus the path, so space is O(L * log t) in the stated teaching terms.",
        uses: [
            "A teaching model for hash-based one-time signatures and Merkle trees",
            "An introduction to post-quantum signature design",
            "A stepping stone to SPHINCS+ and XMSS",
        ],
        references: [
            "Merkle, A Digital Signature Based on a Conventional Encryption Function, 1987",
            "Bernstein et al., SPHINCS+: Static Hash-Based Signatures, 2019",
        ],
        workedExample:
            "For the message hello, the toy hash splits into four base-16 digits. Leaf 0 reveals the corresponding chain values; a verifier continues each chain to the public endpoint, rebuilds the leaf hash, and follows the sibling hashes to the root. Changing one digit by one step makes the rebuilt root differ, so verification fails.",
    },
    id: "sphincs-hash-signature",
    name: "SPHINCS-Style Hash Signature (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(w * L + log t)", space: "O(L * log t)" },
    defaultInput: { message: "hello", leafIndex: 0 },
    visualType: "tree",
    run,
    pseudocode: [
        "derive four hash-chain seeds for each Merkle leaf",
        "hash each chain to its public endpoint to form a one-time public key",
        "combine the leaf public keys into a Merkle root",
        "split the message hash into four base-16 digits",
        "sign by revealing the chain value after each digit's steps",
        "list the sibling hashes along the path to the root",
        "verify by extending chains and recomputing the root",
        "repeat verification with a changed digit to test tamper detection",
        "done: report whether the signature validates and whether tampering is detected",
    ],
};

export default module;
