/**
 * hkdf.ts - HKDF Extract and Expand With a Toy Keyed Hash
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * HKDF turns a short shared secret into one or more strong-looking output keys
 * in two phases. Extract compresses the input key material and a salt into a
 * pseudorandom key. Expand then chains that key through a keyed hash once per
 * output block, mixing in context information and a block counter. This demo
 * is a toy: it uses a small deterministic keyed fold instead of HMAC, so the
 * two-phase structure and the chaining math are exact but the result is not
 * cryptographically secure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((inputWords + outputBlocks) * wordCount)
 *   Space: O(outputBlocks) for the expanded key material
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero shows the input key material words.
 *   - Row one shows the extracted pseudorandom key.
 *   - Later rows show each expanded output block.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HKDFInput {
    ikm?: number[];
    salt?: number;
    info?: number;
    length?: number;
}

/** A deterministic toy keyed hash (FNV-style fold), not a real HMAC. */
function prf(key: number, data: number[]): number {
    let hash = key >>> 0;
    for (const value of data) {
        hash = Math.imul(hash ^ (value >>> 0), 16777619) >>> 0;
    }
    return hash >>> 0;
}

function cell(row: number, col: number, label: string, value: number, state: EntityState): VisualEntity {
    return {
        id: `word-${row}-${col}`,
        type: "cell",
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    };
}

/** Derive output blocks with extract-then-expand. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HKDFInput | null) ?? {};
    const ikm: number[] =
        Array.isArray(task.ikm) && task.ikm.length > 0
            ? task.ikm.slice(0, 8).map((v) => v >>> 0)
            : [1, 2, 3, 4];
    const salt = typeof task.salt === "number" ? task.salt >>> 0 : 0xa0;
    const info = typeof task.info === "number" ? task.info >>> 0 : 0x11;
    const blocks = Math.max(1, Math.min(typeof task.length === "number" ? task.length : 3, 6));

    const prk = prf(salt, ikm);
    const outputs: number[] = [];
    for (let i = 1; i <= blocks; i += 1) {
        const previous = i === 1 ? [] : [outputs[i - 2]!];
        const next = prf(prk, [...previous, info, i]);
        outputs.push(next);
    }

    const cols = Math.max(ikm.length, 3);
    const rows = 2 + blocks;

    function cellsUpTo(stage: number): VisualEntity[] {
        const entities: VisualEntity[] = [];
        for (let i = 0; i < ikm.length; i += 1) {
            entities.push(cell(0, i, `ikm ${i}=${ikm[i]}`, ikm[i]!, "sorted"));
        }
        if (stage >= 1) {
            entities.push(cell(1, 0, `prk=${prk}`, prk, "active"));
        }
        for (let i = 1; i <= blocks && i <= stage - 1; i += 1) {
            entities.push(cell(1 + i, 0, `T${i}=${outputs[i - 1]}`, outputs[i - 1]!, "sorted"));
        }
        return entities;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: cellsUpTo(0),
        edges: [],
        description: `HKDF toy: extract a pseudorandom key and expand ${blocks} output block(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, prk: -1, okm: [], blocks },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cellsUpTo(1),
        edges: [],
        description: `Extract: hash the salt ${salt} with the input key material to get PRK ${prk}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows, cols, prk, okm: [], blocks },
    };
    step += 1;

    for (let i = 1; i <= blocks; i += 1) {
        yield {
            stepNumber: step,
            entities: cellsUpTo(1 + i),
            edges: [],
            description: `Expand block ${i}: hash PRK with the previous block, info ${info}, and counter ${i} to get ${outputs[i - 1]}.`,
            codeLineNumber: i === blocks ? 6 : 4,
            layout: "grid",
            meta: { rows, cols, prk, okm: outputs.slice(0, i), blocks },
        };
        step += 1;
    }
}

/** The toy HKDF module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Key derivation takes one shared secret and stretches it into all the keys an application needs. HKDF first extracts a single pseudorandom key from the input secret and salt, then expands it by hashing that key together with a counter and some context for each output block. The counter makes every block different even from the same input secret.",
        invariants: [
            "The extract step hashes the salt and all input key material words into one pseudorandom key.",
            "Block one hashes the pseudorandom key with context and counter one.",
            "Each later block also includes the previously produced block, chaining the expansion.",
        ],
        correctness:
            "Because the keyed hash is deterministic, identical salt and input material always reproduce the same pseudorandom key. Feeding the previous output into the next call makes the outputs a chain, so computing block i requires exactly the inputs listed in the pseudocode. The reference implementation reproduces every block by that same chain; the toy hash is not a pseudorandom function and offers no real security.",
        complexityRationale:
            "Extract hashes the input words once and each of the output blocks hashes a small fixed list, so time is linear in the input length plus the number of blocks. Only the output blocks must be kept, giving O(outputBlocks) space.",
        uses: [
            "Deriving traffic keys after a key exchange",
            "Splitting one shared secret into encryption and authentication keys",
            "A teaching model for the extract-and-expand construction",
        ],
        references: [
            "Krawczyk, Cryptographic Extraction and Key Derivation: The HKDF Scheme, 2010",
            "RFC 5869, HMAC-based Extract-and-Expand Key Derivation Function, 2010",
        ],
        workedExample:
            "With input words 1, 2, 3, 4, salt 0xA0, and info 0x11, the extract step produces a single PRK. Expanding block one hashes PRK with 0x11 and counter one; block two hashes PRK with block one, 0x11, and counter two. The three resulting words form the output key material.",
    },
    id: "hkdf",
    name: "HKDF (Toy Keyed Hash)",
    category: "cryptography-security",
    complexity: { time: "O((inputWords + blocks) * words)", space: "O(blocks)" },
    defaultInput: { ikm: [1, 2, 3, 4], salt: 0xa0, info: 0x11, length: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the input key material, salt, and context",
        "PRK equals the keyed hash of salt and input material",
        "block one equals the keyed hash of PRK, context, and counter one",
        "for each later block",
        "hash PRK with the previous block, context, and the counter",
        "collect the blocks as output key material",
        "done: report the pseudorandom key and output blocks",
    ],
};

export default module;
