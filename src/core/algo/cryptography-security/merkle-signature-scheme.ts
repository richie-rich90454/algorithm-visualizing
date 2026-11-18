/**
 * merkle-signature-scheme.ts - Merkle Signature Scheme (small toy model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Merkle signature scheme turns many one-time signatures into one public key.
 * Each leaf of a binary hash tree is the public key of a Winternitz one-time
 * signature; hashing pairs of leaves upward gives a root that commits to all of
 * them. To sign once, reveal a one-time signature plus the sibling hashes along
 * the path to the root. A verifier rebuilds the leaf and folds the path up to
 * compare with the published root.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL TEACHING MODEL with a 32-bit FNV-1a checksum as the hash,
 * four one-time keys, and a four-digit base-four Winternitz chain. FNV-1a is not
 * collision resistant and the parameters are far too small for security; no
 * production-security claim is made. The tree, chain, and path arithmetic are
 * exact for the toy parameters. Real schemes use a cryptographic hash and many
 * more leaves, and never reuse a one-time key.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * w) to sign or verify, plus O(log N) path hashing
 *   Space: O(N) for the tree of N one-time public keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes are circles with parent-to-child edges.
 *   - The authentication path lights up one level at a time.
 *   - The final frame reports whether verification succeeded.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface SignatureInput {
    message?: string;
    seed?: number;
    leafIndex?: number;
    sigDigits?: number[];
    authPath?: string[];
}

const LEAVES = 4;
const DIGITS = 4;
const BASE = 4;
const MAX_DIGIT = BASE - 1;

const hexOf = (value: number): string => (value >>> 0).toString(16).padStart(8, "0");

/** Deterministic 32-bit FNV-1a over a string (toy hash, not secure). */
function hStr(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

/** Hash a uint32 as its hexadecimal text. */
function hNum(value: number): number {
    return hStr(hexOf(value));
}

/** Apply the hash chain `steps` times. */
function chain(value: number, steps: number): number {
    let current = value >>> 0;
    for (let i = 0; i < steps; i += 1) {
        current = hNum(current);
    }
    return current >>> 0;
}

/** Turn a message digest into four base-four digits, most significant first. */
function digitsOf(message: string): number[] {
    const value = hStr(message) & 0xff;
    const digits: number[] = Array(DIGITS).fill(0);
    let rest = value;
    for (let i = DIGITS - 1; i >= 0; i -= 1) {
        digits[i] = rest % BASE;
        rest = Math.floor(rest / BASE);
    }
    return digits;
}

interface Scheme {
    digits: number[];
    secrets: number[][];
    sigDigits: number[];
    leafHashes: string[];
    levels: string[][];
    root: string;
    authPath: string[];
    leafIndex: number;
}

/** Build the toy scheme for a given message and one-time key index. */
export function buildScheme(message: string, seed: number, leafIndex: number): Scheme {
    const digits = digitsOf(message);
    const secrets: number[][] = [];
    const sigDigits: number[] = [];
    const leafKeys: string[] = [];
    for (let leaf = 0; leaf < LEAVES; leaf += 1) {
        const secret: number[] = [];
        const pub: string[] = [];
        for (let j = 0; j < DIGITS; j += 1) {
            const sk = hStr(`${seed}:${leaf}:${j}`);
            secret.push(sk);
            pub.push(hexOf(chain(sk, MAX_DIGIT)));
        }
        secrets.push(secret);
        leafKeys.push(pub.join("|"));
        if (leaf === leafIndex) {
            for (let j = 0; j < DIGITS; j += 1) {
                sigDigits.push(chain(skOf(secret, j), digits[j] ?? 0));
            }
        }
    }
    const leafHashes = leafKeys.map((key) => hexOf(hStr(key)));
    const levels: string[][] = [leafHashes];
    while (levels[levels.length - 1]?.length !== 1) {
        const upper: string[] = [];
        const lower = levels[levels.length - 1] ?? [];
        for (let i = 0; i + 1 < lower.length; i += 2) {
            upper.push(hexOf(hStr((lower[i] ?? "") + "|" + (lower[i + 1] ?? ""))));
        }
        levels.push(upper);
    }
    const root = levels[levels.length - 1]?.[0] ?? "";
    const authPath: string[] = [];
    const sibling0 = leafHashes[leafIndex ^ 1] ?? "";
    authPath.push(sibling0);
    const sibling1 = (levels[1] ?? [])[(leafIndex >> 1) ^ 1] ?? "";
    authPath.push(sibling1);
    return { digits, secrets, sigDigits, leafHashes, levels, root, authPath, leafIndex };
}

function skOf(row: number[], j: number): number {
    return row[j] ?? 0;
}

/** Verify a signature by rebuilding its leaf and folding the path to the root. */
export function verifyScheme(
    message: string,
    root: string,
    sigDigits: number[],
    authPath: string[],
    leafIndex: number,
): boolean {
    const digits = digitsOf(message);
    const pub: string[] = [];
    for (let j = 0; j < DIGITS; j += 1) {
        pub.push(hexOf(chain(sigDigits[j] ?? 0, MAX_DIGIT - (digits[j] ?? 0))));
    }
    let node = hexOf(hStr(pub.join("|")));
    for (let level = 0; level < authPath.length; level += 1) {
        const sibling = authPath[level] ?? "";
        const goesLeft = ((leafIndex >> level) & 1) === 0;
        node = hexOf(hStr(goesLeft ? node + "|" + sibling : sibling + "|" + node));
    }
    return node === root;
}

function drawing(highlighted: Set<number>): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    for (let i = 0; i < LEAVES; i += 1) {
        entities.push({
            id: `node-${i}`,
            type: "node",
            label: `leaf ${i}`,
            value: i,
            state: (highlighted.has(i) ? "path" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: `node-${4 + Math.floor(i / 2)}`, depth: 0, leaf: i },
        });
    }
    for (let i = 4; i < 6; i += 1) {
        entities.push({
            id: `node-${i}`,
            type: "node",
            label: "hash",
            value: i,
            state: (highlighted.has(i) ? "path" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: "node-6", depth: 1 },
        });
    }
    entities.push({
        id: "node-6",
        type: "node",
        label: "root",
        value: 6,
        state: (highlighted.has(6) ? "path" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: "", depth: 2 },
    });
    for (let i = 0; i < LEAVES; i += 1) {
        edges.push({
            id: `edge-${i}-${4 + Math.floor(i / 2)}`,
            sourceId: `node-${i}`,
            targetId: `node-${4 + Math.floor(i / 2)}`,
            label: "",
            state: "idle",
            directed: true,
        });
    }
    edges.push({
        id: "edge-4-6",
        sourceId: "node-4",
        targetId: "node-6",
        label: "",
        state: "idle",
        directed: true,
    });
    edges.push({
        id: "edge-5-6",
        sourceId: "node-5",
        targetId: "node-6",
        label: "",
        state: "idle",
        directed: true,
    });
    return { entities, edges };
}

/** The Merkle signature generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SignatureInput | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "sign this";
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 77;
    const leafIndex =
        typeof task.leafIndex === "number"
            ? Math.max(0, Math.min(LEAVES - 1, Math.trunc(task.leafIndex)))
            : 0;
    const scheme = buildScheme(message, seed, leafIndex);
    const sigDigits = Array.isArray(task.sigDigits)
        ? Array.from({ length: DIGITS }, (_v, i) => Math.trunc(task.sigDigits?.[i] ?? 0) >>> 0)
        : scheme.sigDigits;
    const authPath = Array.isArray(task.authPath)
        ? Array.from({ length: 2 }, (_v, i) => String(task.authPath?.[i] ?? ""))
        : scheme.authPath;
    const verified = verifyScheme(message, scheme.root, sigDigits, authPath, leafIndex);

    let step = 0;
    const baseMeta = {
        leaves: LEAVES,
        root: scheme.root,
        leafIndex,
        message,
        digits: scheme.digits,
        sigDigits,
        authPath,
    };
    const frame = (highlighted: Set<number>, description: string, line: number): VisualFrame => {
        const picture = drawing(highlighted);
        return {
            stepNumber: step,
            entities: picture.entities,
            edges: picture.edges,
            description,
            codeLineNumber: line,
            layout: "tree",
            meta: { ...baseMeta, verified: false },
        };
    };

    yield frame(new Set(), `Built ${LEAVES} one-time public keys; root ${scheme.root} commits to all of them.`, 0);
    step += 1;

    const sibling0 = leafIndex ^ 1;
    yield frame(
        new Set([leafIndex, sibling0]),
        `Signature reveals leaf ${leafIndex} and the first sibling hash ${(authPath[0] ?? "").slice(0, 8)}.`,
        3,
    );
    step += 1;

    const parent = 4 + Math.floor(leafIndex / 2);
    const parentSibling = 4 + (Math.floor(leafIndex / 2) ^ 1);
    yield frame(
        new Set([leafIndex, sibling0, parent, parentSibling]),
        `Fold the first pair into node ${parent}, then combine with sibling ${parentSibling} at the next level.`,
        4,
    );
    step += 1;

    const final = frame(new Set([leafIndex, sibling0, parent, parentSibling, 6]), "", verified ? 6 : 5);
    yield {
        ...final,
        description: verified
            ? "Accepted: the rebuilt leaf folds to the published root."
            : "Rejected: the rebuilt leaf does not match the published root.",
        meta: { ...baseMeta, verified, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Make many one-time signatures and put their public keys at the leaves of a hash tree. Hash pairs of leaves together until one root remains, and publish only that root. To sign, use one leaf once and send the sibling hashes needed to climb back to the root. Anyone can rebuild the leaf from the signature and check the climb, but a leaf can never be safely reused.",
        invariants: [
            "Each internal node hashes the ordered pair of its two children.",
            "The authentication path has exactly log base two of the leaf count hashes.",
            "A valid signature rebuilds a leaf that folds to the published root.",
        ],
        correctness:
            "A Winternitz signature reveals chain(sk, digit) and the verifier applies chain(sk, maxDigit minus digit) more hash steps, returning chain(sk, maxDigit), which is the stored public digit; this holds because hash chains compose additively. Hashing the rebuilt digits reproduces the leaf, and the authentication path contains each missing sibling, so the fold recomputes every ancestor and ends at the root. Any tampered digit or sibling changes the rebuilt leaf or an internal hash and breaks the final comparison.",
        complexityRationale:
            "Signing and verification each evaluate d short hash chains of length at most w, costing O(d * w), plus log N hashes for the path. The tree stores N one-time public keys, which is O(N) space.",
        uses: [
            "Hash-based digital signatures with a small public key",
            "Post-quantum signatures that rely only on hash security",
            "Teaching one-time signatures and authentication paths",
        ],
        references: [
            "Merkle, Method of Providing Digital Signatures, 1988",
            "Buchmann, Dahmen, and Klintsevich, Key Reuse Security of Merkle-Damgard-Based Signatures, 2007",
        ],
        workedExample:
            "With four leaves, a message signed with leaf two includes four Winternitz chain values and two sibling hashes. The verifier rebuilds leaf two's public key, hashes it with leaf three to form the right internal node, then hashes that with the left internal node to obtain the root and compares it with the published digest.",
    },
    id: "merkle-signature-scheme",
    name: "Merkle Signature Scheme",
    category: "cryptography-security",
    complexity: { time: "O(d * w + log N)", space: "O(N)" },
    defaultInput: { message: "sign this", seed: 77, leafIndex: 2 },
    visualType: "tree",
    run,
    pseudocode: [
        "generate N one-time key pairs and hash each public key to a leaf",
        "hash sibling pairs upward until a single root remains",
        "select an unused leaf index for this message",
        "compute base-four digits of the message digest",
        "sign each digit with a Winternitz hash chain",
        "collect one sibling hash per tree level",
        "verify by rebuilding the leaf and folding to the root",
        "done: accept only when the folded root matches",
    ],
};

export default module;
