/**
 * lms-signature.ts - Toy LMS: Hash Chains Authenticated by a Merkle Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LMS signs with a Merkle tree whose leaves are one-time hash-chain public
 * keys. Each message digit is signed by revealing part of a hash chain; a
 * verifier hashes the revealed value forward to the public leaf. A Merkle
 * authentication path proves that the leaf belongs to the published root. This
 * module implements that exact structure with a small affine hash over the
 * integers modulo 1000003, four base-16 digits, and a four-leaf tree. It is a
 * teaching model of the LMS algebraic steps only: it is stateless in a toy
 * sense, has no resizeable tree, and provides no production security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(LEN * BASE + log LEN) for chain buildup and authentication
 *   Space: O(LEN) for keys, signatures, and the Merkle tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes show the Merkle levels; the authentication path is colored.
 *   - The final frame reports the one-time and Merkle verification verdicts.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const P = 1000003;
const BASE = 16;
const LEN = 4;
const MAX_CHAIN = BASE - 1;

interface LmsInput {
    messageDigits?: number[];
    seed?: number;
    verifyDigits?: number[];
    tamperAuth?: boolean;
}

type TreeNode = { id: string; parent: string; level: number; index: number; value: number };

/** A deterministic affine hash used as the one-way chain step. */
function h(x: number): number {
    return (x * 48271 + 11) % P;
}

/** Hash the pair of Merkle children into their parent. */
function h2(left: number, right: number): number {
    return (left * 31 + right * 17 + 1) % P;
}

/** Apply the chain step n times. */
function chain(seedValue: number, n: number): number {
    let value = ((seedValue % P) + P) % P;
    for (let i = 0; i < n; i += 1) {
        value = h(value);
    }
    return value;
}

function nodeEntities(nodes: TreeNode[], path: Set<string>, auth: Set<string>, phase: number): VisualEntity[] {
    return nodes.map((node) => {
        let state: EntityState = "unvisited";
        if (phase >= 3) {
            if (path.has(node.id)) {
                state = "path";
            } else if (auth.has(node.id)) {
                state = "comparing";
            } else {
                state = "visited";
            }
        } else if (phase >= 1) {
            state = node.level === 0 ? "active" : "visited";
        }
        return {
            id: node.id,
            type: "node",
            label: String(node.value),
            value: node.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { depth: node.level, parentId: node.parent ? node.parent : "", level: node.level, index: node.index },
        };
    });
}

function nodeEdges(nodes: TreeNode[]): VisualEdge[] {
    return nodes
        .filter((node) => node.parent !== "")
        .map((node) => ({
            id: `edge-${node.parent}-${node.id}`,
            sourceId: node.parent,
            targetId: node.id,
            label: "",
            state: "visited" as EntityState,
            directed: true,
        }));
}

/** Sign a four-digit message and verify it against a Merkle root. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LmsInput | null) ?? {};
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 7;
    const digits: number[] = Array.isArray(task.messageDigits) && task.messageDigits.length === LEN
        ? task.messageDigits.map((d) => Math.max(0, Math.min(MAX_CHAIN, Math.trunc(d))))
        : [3, 7, 1, 12];
    const verifyDigits: number[] = Array.isArray(task.verifyDigits) && task.verifyDigits.length === LEN
        ? task.verifyDigits.map((d) => Math.max(0, Math.min(MAX_CHAIN, Math.trunc(d))))
        : digits.slice();
    const tamperAuth = task.tamperAuth === true;

    const secret = Array.from({ length: LEN }, (_v, i) => (seed + i * 123457) % P);
    const publicKeys = secret.map((s) => chain(s, MAX_CHAIN));
    const signature = digits.map((d, i) => chain(secret[i] ?? 0, d));

    const level0: TreeNode[] = publicKeys.map((value, i) => ({ id: `leaf-${i}`, parent: `node-1-${Math.floor(i / 2)}`, level: 0, index: i, value }));
    const level1: TreeNode[] = [
        { id: "node-1-0", parent: "root", level: 1, index: 0, value: h2(publicKeys[0] ?? 0, publicKeys[1] ?? 0) },
        { id: "node-1-1", parent: "root", level: 1, index: 1, value: h2(publicKeys[2] ?? 0, publicKeys[3] ?? 0) },
    ];
    const rootNode: TreeNode = { id: "root", parent: "", level: 2, index: 0, value: h2(level1[0]!.value, level1[1]!.value) };
    const nodes = [...level0, ...level1, rootNode];
    const root = rootNode.value;

    const signIndex = 0;
    const authPath: number[] = [publicKeys[1] ?? 0, level1[1]!.value];
    const usedAuth = tamperAuth ? authPath.map((v, i) => (i === 0 ? (v + 1) % P : v)) : authPath.slice();

    const wotsValid = signature.every((sig, i) => chain(sig, MAX_CHAIN - verifyDigits[i]!) === publicKeys[i]);
    let recomputed = publicKeys[signIndex] ?? 0;
    recomputed = h2(recomputed, usedAuth[0] ?? 0);
    recomputed = h2(recomputed, usedAuth[1] ?? 0);
    const merkleValid = recomputed === root;
    const accept = wotsValid && merkleValid;

    const path = new Set(["leaf-0", "node-1-0", "root"]);
    const auth = new Set(["leaf-1", "node-1-1"]);

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodeEntities(nodes, path, auth, 0),
        edges: nodeEdges(nodes),
        description: `Toy LMS: ${LEN} base-${BASE} hash chains authenticated by a four-leaf Merkle tree.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { p: P, base: BASE, len: LEN, digits: digits.slice(), root: 0, accept: false, wotsValid: false, merkleValid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodeEntities(nodes, path, auth, 1),
        edges: nodeEdges(nodes),
        description: `Key generation: each chain runs ${MAX_CHAIN} hash steps; its endpoint is a Merkle leaf.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { p: P, base: BASE, len: LEN, digits: digits.slice(), publicKeys: publicKeys.slice(), root: 0, accept: false, wotsValid: false, merkleValid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodeEntities(nodes, path, auth, 2),
        edges: nodeEdges(nodes),
        description: `Merkle root ${root} commits to all four one-time public keys.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { p: P, base: BASE, len: LEN, digits: digits.slice(), publicKeys: publicKeys.slice(), root, accept: false, wotsValid: false, merkleValid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodeEntities(nodes, path, auth, 3),
        edges: nodeEdges(nodes),
        description: `Signature reveals chain prefixes for digits ${digits.join(", ")} plus the sibling authentication path.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { p: P, base: BASE, len: LEN, digits: digits.slice(), publicKeys: publicKeys.slice(), signature: signature.slice(), authPath: authPath.slice(), root, accept: false, wotsValid: false, merkleValid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodeEntities(nodes, path, auth, 3),
        edges: nodeEdges(nodes),
        description: accept
            ? `Verified: all one-time chains match and the authentication path rebuilds the root.`
            : `Rejected: ${!wotsValid ? "a one-time chain failed" : ""}${!wotsValid && !merkleValid ? " and " : ""}${!merkleValid ? "the Merkle path failed" : ""}.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: {
            p: P,
            base: BASE,
            len: LEN,
            digits: digits.slice(),
            verifyDigits: verifyDigits.slice(),
            publicKeys: publicKeys.slice(),
            signature: signature.slice(),
            authPath: authPath.slice(),
            root,
            recomputed,
            wotsValid,
            merkleValid,
            accept,
        },
    };
}

/** The toy LMS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A one-time signature can be built from hash chains: to sign the number k, reveal the kth value in a chain whose endpoint is public, and let the verifier hash forward the remaining steps. LMS puts many such one-time public keys at the leaves of a Merkle tree so a single short root authenticates all of them. The signature carries the revealed chain values plus the sibling path needed to rebuild the root.",
        invariants: [
            "Each chain endpoint is obtained by applying the hash a fixed maximum number of times.",
            "A signature value for digit d hashes forward to the leaf after BASE minus one minus d steps.",
            "The authentication path plus the leaf must recompute exactly the published root.",
        ],
        correctness:
            "For leaf i, hashing the revealed value sig_i forward by MAX_CHAIN minus d_i applications gives h to the MAX_CHAIN power of the secret, which is the public key at that leaf, so a matching digit passes and a changed digit fails. Combining the leaf with each sibling in the authentication path follows the Merkle tree upward; the result equals the root exactly when every path value is correct. The signature is accepted only when both the one-time check and the Merkle check pass.",
        complexityRationale:
            "Building each chain takes BASE minus one hash steps and there are LEN chains, while the Merkle tree over LEN leaves costs O(LEN) hashes and verification follows log LEN siblings. Space is O(LEN) for keys, signature values, and tree nodes.",
        uses: [
            "Understanding hash-based signatures selected for post-quantum standardization",
            "Teaching one-time signatures and Merkle authentication",
            "Comparing stateful hash signatures with SPHINCS-style stateless schemes",
        ],
        references: [
            "Leighton and Micali, Large, Provably Secure and Efficient Digital Signature Schemes, 1995",
            "RFC 8554, Leighton-Micali Signature, 2019",
        ],
        workedExample:
            "With base 16, four digits and message 3, 7, 1, 12, the signer reveals the third hash of the first secret, the seventh of the second, and so on. The verifier hashes each revealed value forward 12, 8, 14 and 3 steps respectively to reach the four leaves. Hashing the first leaf with its sibling and then with the other subtree root reproduces the published root, so the signature is accepted; changing one digit breaks its chain check.",
    },
    id: "lms-signature",
    name: "LMS Signature (Toy Hash-Chain Merkle Model)",
    category: "cryptography-security",
    complexity: { time: "O(LEN * BASE + log LEN)", space: "O(LEN)" },
    defaultInput: { messageDigits: [3, 7, 1, 12], seed: 7 },
    visualType: "tree",
    run,
    pseudocode: [
        "set a small prime, a base, and a chain length",
        "derive one secret per digit and hash each to its public leaf",
        "combine leaves pairwise into a Merkle root",
        "sign each message digit by revealing part of its chain",
        "collect the sibling authentication path for the signed leaf",
        "hash each revealed value forward to check the one-time key",
        "rebuild the root from the leaf and its authentication path",
        "accept only when both checks pass",
    ],
};

export default module;
