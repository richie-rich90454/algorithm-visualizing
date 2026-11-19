/**
 * hash-commitment.ts - Hash-Based Commitment Scheme (Toy Hash)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hash commitment fixes a secret value by publishing the hash of the secret
 * concatenated with a random nonce. The commitment hides the value and binds
 * the committer: opening reveals the preimage, and anyone can rehash it to
 * check that it matches. This module uses FNV-1a, a fast non-cryptographic
 * hash, so it demonstrates the commitment pattern but is not secure; a real
 * scheme would use SHA-256 or a similar cryptographic hash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(L) over the L characters of the preimage
 *   Space: O(L) for the displayed characters and one hash word
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Characters of the preimage are shown in a text row.
 *   - Each character is highlighted as it enters the rolling hash.
 *   - meta carries the commitment word and the opening verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** FNV-1a 32-bit rolling hash used only as a teaching stand-in. */
export function fnv1a(text: string): number {
    let hash = 2166136261 >>> 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = (hash ^ text.charCodeAt(index)) >>> 0;
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

/** Commit to a secret by hashing it together with a nonce. */
export function commit(secret: string, nonce: string): number {
    return fnv1a(`${secret}|${nonce}`);
}

/** Verify that a revealed preimage reproduces the published commitment. */
export function open(commitment: number, secret: string, nonce: string): boolean {
    return commit(secret, nonce) === commitment;
}

/** Build one character entity per symbol of the preimage. */
function makeChars(preimage: string, hashedThrough: number, final: boolean): VisualEntity[] {
    return Array.from(preimage).map((character, index) => {
        let state: EntityState = "idle";
        if (final) {
            state = "sorted";
        } else if (index < hashedThrough) {
            state = "visited";
        }
        return {
            id: `char-${index}`,
            type: "character" as const,
            label: character,
            value: character,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, character },
        };
    });
}

/** The hash commitment generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { secret?: string | number; nonce?: string | number } | null) ?? {};
    const secret = String(task.secret ?? "42");
    const nonce = String(task.nonce ?? "nonce-7");
    const preimage = `${secret}|${nonce}`;
    const commitment = commit(secret, nonce);
    const opened = open(commitment, secret, nonce);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeChars(preimage, 0, false),
        edges: [],
        description: `Hash commitment to a secret of ${secret.length} character(s) with a random nonce.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { preimage, commitment: 0, hashed: 0, opened: false, toyHash: true },
    };
    step += 1;

    for (let index = 0; index < preimage.length; index += 1) {
        yield {
            stepNumber: step,
            entities: makeChars(preimage, index + 1, false),
            edges: [],
            description: `Fold character ${index + 1} into the rolling hash.`,
            codeLineNumber: 1,
            layout: "text",
            meta: { preimage, commitment: 0, hashed: index + 1, opened: false, toyHash: true },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeChars(preimage, preimage.length, false),
        edges: [],
        description: `Publish the commitment word ${commitment}.`,
        codeLineNumber: 2,
        layout: "text",
        meta: { preimage, commitment, hashed: preimage.length, opened: false, toyHash: true },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeChars(preimage, preimage.length, true),
        edges: [],
        description: `Rehash the revealed preimage: opening ${opened ? "matches" : "fails"}; FNV is not secure.`,
        codeLineNumber: 3,
        layout: "text",
        meta: { preimage, commitment, hashed: preimage.length, opened, toyHash: true, done: true },
    };
}

/** The hash commitment module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A commitment is a digital sealed envelope. Combine the secret with a random nonce, hash the pair, and publish only the hash. The nonce makes different commitments to the same secret look unrelated, and the hash pins the value so the committer cannot later claim a different preimage. Revealing the secret and nonce lets anyone repeat the hash and confirm the match.",
        invariants: [
            "The commitment is the hash of the secret, a separator, and the nonce.",
            "The same preimage always gives the same commitment word.",
            "Opening succeeds exactly when the rehashed preimage equals the published word.",
        ],
        correctness:
            "Hashing is a deterministic function, so recomputing the commitment from the revealed preimage always reproduces the stored word for an honest opening and differs for a wrong secret or nonce in the tested domain. The nonce ensures two commitments to the same secret with different nonces are distinct unless the toy hash collides. This establishes the mechanics of commit and open; it does not provide real hiding or binding because FNV-1a is a fast non-cryptographic hash with easy collisions.",
        complexityRationale:
            "The hash processes one character per step, so commit and open each take O(L) time for an L-character preimage. The displayed characters and a single hash word use O(L) space.",
        uses: [
            "Sealed bids and commit-reveal auctions",
            "Rock-paper-scissors and other simultaneous-move protocols",
            "Teaching the pattern before introducing SHA-based commitments",
        ],
        references: [
            "Goldreich, Foundations of Cryptography, Volume 1, section on commitment schemes",
            "Fowler, Noll, and Vo, The FNV Non-Cryptographic Hash Algorithm",
        ],
        workedExample:
            "Committing to secret 42 with nonce nonce-7 hashes the string 42|nonce-7 into a 32-bit word. Publishing only that word hides the secret. Revealing 42 and nonce-7 lets a verifier rehash the same string and confirm the commitment; revealing 43 would hash a different string and fail.",
    },
    id: "hash-commitment",
    name: "Hash Commitment (Toy Hash)",
    category: "cryptography-security",
    complexity: { time: "O(L)", space: "O(L)" },
    defaultInput: { secret: "42", nonce: "nonce-7" },
    visualType: "text",
    run,
    pseudocode: [
        "choose a secret value and a random nonce",
        "concatenate them into a preimage string",
        "start a rolling hash at the FNV offset basis",
        "for each character XOR it in and multiply by the FNV prime",
        "publish the resulting hash as the commitment",
        "on opening reveal the secret and nonce",
        "rehash the preimage and compare with the commitment",
        "done: report the opening verdict",
    ],
};

export default module;
