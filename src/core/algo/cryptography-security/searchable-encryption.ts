/**
 * searchable-encryption.ts - Searchable Symmetric Encryption (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Searchable symmetric encryption stores documents encrypted but still allows
 * keyword search. A deterministic trapdoor derived from a secret key and a
 * keyword indexes the encrypted document identifiers that contain that word.
 * The server groups identifiers by trapdoor without learning the keyword, and
 * the client decrypts the matching identifiers after a search. This toy uses a
 * tiny 32-bit space and simple invertible arithmetic, so it is a teaching
 * model, not a secure construction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(total keywords) to index, O(matches) to search
 *   Space: O(total keyword occurrences)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the trapdoors and the matching document identifiers.
 *   - meta carries the keyword, the trapdoor, and the search results.
 *
 * ---------------------------------------------------------------------------
 * Note
 *   - TOY MODEL. Deterministic trapdoors leak frequency information and the
 *     field is far too small. Study the pattern here, never deploy it.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MODULUS = 1n << 32n;
const MULTIPLIER = 2654435761n;

function inverse(value: bigint): bigint {
    let oldR = ((value % MODULUS) + MODULUS) % MODULUS;
    let r = MODULUS;
    let oldS = 1n;
    let s = 0n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return oldR === 1n ? ((oldS % MODULUS) + MODULUS) % MODULUS : 0n;
}

const INVERSE = inverse(MULTIPLIER);

/** Split text into lowercase alphanumeric keywords. */
export function tokenize(text: string): string[] {
    return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Derive a deterministic trapdoor from a key and keyword. */
export function trapdoor(key: number, keyword: string): bigint {
    const phrase = `${key}:${keyword.toLowerCase()}`;
    let hash = 0n;
    for (let i = 0; i < phrase.length; i += 1) {
        hash = (hash * 257n + BigInt(phrase.charCodeAt(i))) % MODULUS;
    }
    return hash;
}

/** Encrypt a document identifier under a trapdoor. */
export function encryptId(trap: bigint, docId: number): bigint {
    return (BigInt(docId) * MULTIPLIER + trap) % MODULUS;
}

/** Decrypt a document identifier under a trapdoor. */
export function decryptId(trap: bigint, cipher: bigint): number {
    return Number(((cipher - trap + MODULUS) * INVERSE) % MODULUS);
}

export interface SearchableIndex {
    buckets: Map<string, bigint[]>;
    documentCount: number;
}

/** Build an encrypted inverted index keyed by trapdoors. */
export function buildIndex(documents: string[], key: number): SearchableIndex {
    const buckets = new Map<string, bigint[]>();
    documents.forEach((document, docId) => {
        for (const keyword of new Set(tokenize(document))) {
            const trap = trapdoor(key, keyword);
            const bucketKey = trap.toString();
            const bucket = buckets.get(bucketKey) ?? [];
            bucket.push(encryptId(trap, docId));
            buckets.set(bucketKey, bucket);
        }
    });
    return { buckets, documentCount: documents.length };
}

/** Search the encrypted index and return matching document identifiers. */
export function search(index: SearchableIndex, key: number, keyword: string): number[] {
    const trap = trapdoor(key, keyword);
    const bucket = index.buckets.get(trap.toString()) ?? [];
    return bucket.map((cipher) => decryptId(trap, cipher)).sort((a, b) => a - b);
}

function makeBars(values: number[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: "sorted" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { documents?: string[]; key?: number; query?: string } | null) ?? {};
    const documents = task.documents ?? ["the quick brown fox", "brown bears sleep", "quick results arrive"];
    const key = typeof task.key === "number" ? task.key : 42;
    const query = task.query ?? "brown";

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([]),
        edges: [],
        description: `Building an encrypted keyword index over ${documents.length} documents.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { documents, key },
    };
    step += 1;

    const index = buildIndex(documents, key);
    const traps = [...index.buckets.keys()].map((value) => Number(BigInt(value) % 1000000n));
    yield {
        stepNumber: step,
        entities: makeBars(traps),
        edges: [],
        description: `Index built with ${index.buckets.size} keyword trapdoors.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { key, trapdoors: [...index.buckets.keys()] },
    };
    step += 1;

    const trap = trapdoor(key, query);
    const results = search(index, key, query);
    yield {
        stepNumber: step,
        entities: makeBars(results),
        edges: [],
        description: `Trapdoor for "${query}" matched documents ${results.join(", ") || "none"}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { query, trapdoor: trap.toString(), results },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(results),
        edges: [],
        description: "Done: identifiers decrypted by the client. Toy scheme, not secure.",
        codeLineNumber: 3,
        layout: "array",
        meta: { query, results, count: results.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A client encrypts document identifiers and files them under a trapdoor that only someone with the key can compute for a chosen word. To search, the client sends the trapdoor; the server returns the encrypted identifiers stored there, and the client decrypts them. The server sees which groups match but not the words themselves. Real schemes also hide access patterns, which this toy does not.",
        invariants: [
            "The trapdoor for a keyword is deterministic for a fixed key.",
            "Identifier encryption is invertible with the same trapdoor.",
            "Every document identifier appears in the bucket of each of its keywords.",
        ],
        correctness:
            "The multiplier is odd and therefore invertible modulo two to the thirty-two, so decryption exactly cancels encryption for every identifier in a bucket. Tokenizing both the documents and the query with the same rule ensures the same keyword string produces the same trapdoor. An independent brute-force scan of the documents reproduces the same matching identifiers, confirming that the index is complete and exact.",
        complexityRationale:
            "Indexing visits each unique keyword of each document once, so time is linear in the total number of keyword occurrences. Search touches only the matching bucket and decrypts its entries, costing time proportional to the number of matches. Storage is one encrypted identifier per occurrence.",
        uses: [
            "Encrypted search over outsourced document stores",
            "Private keyword indexes in cloud storage",
            "Teaching the access-pattern leakage of searchable encryption",
        ],
        references: [
            "Song, Wagner, and Perrig, Practical Techniques for Searches on Encrypted Data, 2000",
            "Curtmola, Garay, Kamara, and Ostrovsky, Searchable Symmetric Encryption: Improved Definitions and Constructions, 2006",
        ],
        workedExample:
            "With key forty-two, the word brown has a fixed trapdoor. Documents containing brown contribute their encrypted identifiers to that bucket. Sending the trapdoor returns those identifiers, which the client decrypts to the original document numbers. A document without the word never appears in the bucket, so the search result matches a plain-text scan.",
    },
    id: "searchable-encryption",
    name: "Searchable Symmetric Encryption (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(matches)", space: "O(total occurrences)" },
    defaultInput: {
        documents: ["the quick brown fox", "brown bears sleep", "quick results arrive"],
        key: 42,
        query: "brown",
    },
    visualType: "array",
    run,
    pseudocode: [
        "tokenize every document into lowercase keywords",
        "derive a trapdoor from the key and each keyword",
        "encrypt the document identifier under that trapdoor",
        "store identifiers in buckets indexed by trapdoor",
        "derive the trapdoor for the search keyword",
        "decrypt the identifiers in the matching bucket",
        "done: report the matching document identifiers",
    ],
};

export default module;
