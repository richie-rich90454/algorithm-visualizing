/**
 * slh-dsa.ts - SLH-DSA Teaching Core: FORS Trees and a Merkle Commitment (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SLH-DSA (FIPS 205, formerly SPHINCS+) builds stateless signatures from hash
 * functions. Its FORS component splits a message digest into short index
 * chunks and reveals one secret per chunk; a verifier hashes each revealed
 * value forward to a public leaf and authenticates that leaf through a small
 * Merkle tree. This teaching model implements that FORS sign-and-verify loop
 * exactly with a small deterministic avalanche mixer in place of a real hash.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is NOT SLH-DSA or SPHINCS+ and is not secure. It omits WOTS+, FORS
 * bitmasks, tree layers, hypertrees, pseudorandom key generation, and any
 * cryptographic hash. It uses two four-leaf trees and a base-four digest. Only
 * the FORS reveal, forward-hash, and Merkle authentication steps are shown, and
 * those are exact for the toy hash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * 2^a) hash calls to build keys, O(k * a) to sign and verify
 *   Space: O(k * 2^a) for the secret and public leaves
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two rows of four cells show the public leaves of each FORS tree.
 *   - The signed leaf and its authentication siblings are highlighted.
 *   - meta carries the digest chunks, the FORS root, and both verify results.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    message?: string;
    chunks?: number[];
}

const K = 2;
const A = 2;
const LEAVES = 2 ** A;

/** Small deterministic avalanche mixer, not a cryptographic hash. */
function toyHash(x: number): number {
    let z = (x + 0x9e3779b9) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
}
const combine = (a: number, b: number): number => toyHash((a ^ Math.imul(b, 0x9e3779b1)) >>> 0);
const chain = (seed: number, steps: number): number => {
    let v = seed >>> 0;
    for (let i = 0; i < steps; i += 1) v = toyHash(v);
    return v >>> 0;
};
const seedOf = (tree: number, leaf: number): number => toyHash(tree * 1000 + leaf * 17 + 3);
const publicLeaf = (tree: number, leaf: number): number => chain(seedOf(tree, leaf), LEAVES - 1 - leaf);
const hex = (v: number): string => (v >>> 0).toString(16).padStart(8, "0");

/** Merkle root of four leaves and the two sibling hashes for a given index. */
function treeRootWithPath(leaves: number[], index: number) {
    const n0 = combine(leaves[0] ?? 0, leaves[1] ?? 0);
    const n1 = combine(leaves[2] ?? 0, leaves[3] ?? 0);
    const root = combine(n0, n1);
    const bottom = index % 2 === 0 ? leaves[index + 1] ?? 0 : leaves[index - 1] ?? 0;
    const top = index < 2 ? n1 : n0;
    return { root, path: [bottom, top] };
}

/** Recompute a tree root from a claimed leaf hash and its authentication path. */
function rootFromPath(leafHash: number, index: number, path: number[]): number {
    const bottom = index % 2 === 0 ? combine(leafHash, path[0] ?? 0) : combine(path[0] ?? 0, leafHash);
    return index < 2 ? combine(bottom, path[1] ?? 0) : combine(path[1] ?? 0, bottom);
}

function digestChunks(message: string): number[] {
    const h = toyHash(Array.from(message).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7));
    return [h & 3, (h >>> 2) & 3];
}

function forPublicKey(): { leaves: number[][]; roots: number[]; pk: number } {
    const leaves: number[][] = [];
    const roots: number[] = [];
    for (let t = 0; t < K; t += 1) {
        const row = Array.from({ length: LEAVES }, (_, j) => publicLeaf(t, j));
        leaves.push(row);
        roots.push(treeRootWithPath(row, 0).root);
    }
    return { leaves, roots, pk: combine(roots[0] ?? 0, roots[1] ?? 0) };
}

function sign(chunks: number[]) {
    const sig = chunks.map((chunk, t) => seedOf(t, chunk));
    const paths = chunks.map((chunk, t) => treeRootWithPath(Array.from({ length: LEAVES }, (_, j) => publicLeaf(t, j)), chunk).path);
    return { sig, paths };
}

function verify(sig: number[], chunks: number[], paths: number[][], pk: number): boolean {
    const roots: number[] = [];
    for (let t = 0; t < K; t += 1) {
        const leaf = chain(sig[t] ?? 0, LEAVES - 1 - (chunks[t] ?? 0));
        roots.push(rootFromPath(leaf, chunks[t] ?? 0, paths[t] ?? []));
    }
    return combine(roots[0] ?? 0, roots[1] ?? 0) === pk;
}

function makeCells(leaves: number[][], signed: number[], focus: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let t = 0; t < K; t += 1) {
        for (let j = 0; j < LEAVES; j += 1) {
            const isSigned = signed[t] === j;
            const sibling = isSigned && focus === t;
            cells.push({
                id: `leaf-${t}-${j}`,
                type: "cell",
                label: hex(leaves[t]?.[j] ?? 0).slice(0, 6),
                value: leaves[t]?.[j] ?? 0,
                state: sibling ? "active" : isSigned ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: t, col: j, tree: t, leaf: j, signed: isSigned },
            });
        }
    }
    return cells;
}

/** The toy SLH-DSA FORS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const supplied = task.chunks;
    const chunks = supplied && supplied.length === K && supplied.every((c) => c >= 0 && c < LEAVES)
        ? supplied.slice()
        : digestChunks(String(task.message ?? "hello"));
    const forPk = forPublicKey();
    const { sig, paths } = sign(chunks);
    const verified = verify(sig, chunks, paths, forPk.pk);
    const bad = chunks.slice();
    bad[0] = ((bad[0] ?? 0) + 1) % LEAVES;
    const tampered = verify(sig, bad, paths, forPk.pk);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(forPk.leaves, [], -1),
        edges: [],
        description: `FORS teaching model: ${K} trees of ${LEAVES} leaves; FORS public root ${hex(forPk.pk)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: K, cols: LEAVES, K, A, leaves: LEAVES, chunks: [], pk: hex(forPk.pk), verified: "pending", tamperedVerified: "pending" },
    };
    step += 1;

    for (let t = 0; t < K; t += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(forPk.leaves, chunks, t),
            edges: [],
            description: `Digest chunk ${t} equals ${chunks[t]}; reveal secret at leaf ${chunks[t]} and hash it ${LEAVES - 1 - (chunks[t] ?? 0)} time(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: K,
                cols: LEAVES,
                K,
                A,
                leaves: LEAVES,
                chunks,
                pk: hex(forPk.pk),
                sig: sig.map(hex),
                paths: paths.flat().map(hex),
                verified: "pending",
                tamperedVerified: "pending",
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(forPk.leaves, chunks, -1),
        edges: [],
        description: `Verification: reconstructed both tree roots and recombined them; verified = ${verified}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: K,
            cols: LEAVES,
            K,
            A,
            leaves: LEAVES,
            chunks,
            pk: hex(forPk.pk),
            sig: sig.map(hex),
            paths: paths.flat().map(hex),
            verified,
            tamperedVerified: "pending",
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(forPk.leaves, bad, -1),
        edges: [],
        description: `Changing chunk 0 to ${bad[0]} makes the rebuilt root differ; tamperedVerified = ${tampered}. This toy is not secure.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: K,
            cols: LEAVES,
            K,
            A,
            leaves: LEAVES,
            chunks: bad,
            pk: hex(forPk.pk),
            sig: sig.map(hex),
            paths: paths.flat().map(hex),
            verified,
            tamperedVerified: tampered,
            note: "toy FORS and toy hash, not secure",
        },
    };
}

/** The toy SLH-DSA FORS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A stateless hash signature cannot keep a counter, so it commits to many one-time keys at once. FORS does this by giving each message chunk its own tiny Merkle tree: the chunk value selects a leaf, and the signature reveals that leaf's secret. The verifier hashes the revealed secret forward to a public leaf and walks a sibling path back to a committed root. Changing even one chunk selects a different leaf and breaks the path.",
        invariants: [
            "A public leaf is the secret at index j hashed forward (2^a - 1 - j) times.",
            "A signature reveals exactly one secret per digest chunk.",
            "The FORS public key commits to every tree root through a final hash combination.",
        ],
        correctness:
            "For an honest signature, the revealed secret is seed(t, chunk_t). Hashing it forward 2^a - 1 - chunk_t times reproduces publicLeaf(t, chunk_t) by definition. The authentication path contains the sibling at the bottom of the tree and the opposite subtree root; recombining them with the index-dependent order yields the same tree root used to build the FORS key. A changed chunk hashes the same secret a different number of steps and authenticates at a different index, so the reconstructed root differs and verification fails.",
        complexityRationale:
            "Building each tree hashes every leaf up to 2^a - 1 times, O(k * 2^a). Signing reveals k seeds and collecting paths is O(k * a); verification hashes each revealed seed and combines a path of a siblings, also O(k * a). Storage holds k times 2^a leaves.",
        uses: [
            "A teaching model for stateless hash-based signatures",
            "Understanding FORS before studying SPHINCS+ and SLH-DSA",
            "An introduction to Merkle authentication paths",
        ],
        references: [
            "Bernstein et al., SPHINCS+: Static Hash-Based Signatures, 2019",
            "NIST FIPS 205, Stateless Hash-Based Digital Signature Standard, 2024",
        ],
        workedExample:
            "With two trees of four leaves and digest chunks (1, 2), the signer reveals seed(0, 1) and seed(1, 2). Verification hashes the first secret two times and the second one time, recombines each through its two-step sibling path, hashes the two roots together, and matches the committed FORS key. Changing the first chunk to 2 breaks that match.",
    },
    id: "slh-dsa",
    name: "SLH-DSA Teaching Core (Toy FORS)",
    category: "cryptography-security",
    complexity: { time: "O(k * 2^a + k * a)", space: "O(k * 2^a)" },
    defaultInput: { message: "hello" },
    visualType: "grid",
    run,
    pseudocode: [
        "derive two base-four chunks from the message digest",
        "build each FORS tree of four public leaves",
        "hash the four leaves together into a tree root",
        "combine the tree roots into the FORS public key",
        "sign by revealing the secret at each chunk's leaf",
        "verify by hashing each secret forward to its public leaf",
        "rebuild both roots through their sibling paths",
        "done: report validity and a tamper-detection check",
    ],
};

export default module;
