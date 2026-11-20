/**
 * fasttext.ts - FastText Subword N-gram Hashing
 *
 * FastText represents a word by its character n-grams in addition to the whole
 * word, so misspellings and rare words still share features with similar words.
 * Each n-gram is wrapped with word-boundary markers, hashed, and reduced modulo
 * a fixed number of buckets. The model then learns one embedding per bucket.
 *
 * Time O(L * k) for a word of length L and n-gram sizes up to k,
 * space O(L * k) for the emitted feature table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FastTextInput {
    word?: string;
    minN?: number;
    maxN?: number;
    buckets?: number;
}

/** 32-bit FNV-1a hash of an ASCII string, used by FastText for its buckets. */
export function fnv1a(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

export interface NgramFeature {
    n: number;
    padded: string;
    hash: number;
    bucket: number;
}

/** Enumerate boundary-marked character n-grams and their hash buckets. */
export function subwordFeatures(word: string, minN: number, maxN: number, buckets: number): NgramFeature[] {
    const paddedWord = `^${word}#`;
    const features: NgramFeature[] = [];
    for (let n = minN; n <= maxN; n += 1) {
        for (let i = 0; i + n <= paddedWord.length; i += 1) {
            const padded = paddedWord.slice(i, i + n);
            const hash = fnv1a(padded);
            features.push({ n, padded, hash, bucket: hash % buckets });
        }
    }
    return features;
}

const COLUMNS = ["n-gram", "hash", "bucket"];

function makeCells(features: NgramFeature[], revealed: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    features.forEach((feature, row) => {
        const values = [feature.padded, feature.hash, feature.bucket];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active ? "comparing" : shown ? "sorted" : "idle";
            const value = values[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${typeof value === "string" ? value : value.toString()}` : "?",
                value: shown ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FastTextInput | null) ?? {};
    const word = typeof task.word === "string" && task.word.length > 0 ? task.word : "visualize";
    const minN = Math.max(1, Math.floor(Number(task.minN ?? 3)) || 3);
    const maxN = Math.max(minN, Math.min(6, Math.floor(Number(task.maxN ?? 4)) || 4));
    const buckets = Math.max(1, Math.floor(Number(task.buckets ?? 1000)) || 1000);
    const features = subwordFeatures(word, minN, maxN, buckets);
    const unique = [...new Set(features.map((f) => f.bucket))].sort((a, b) => a - b);
    const base = { rows: features.length, cols: COLUMNS.length, buckets, word, minN, maxN };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(features, -1, -1),
        edges: [],
        description: `FastText hashes ${features.length} boundary-marked n-grams of "${word}" into ${buckets} buckets.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, ngrams: features.map((f) => f.padded), hashes: features.map((f) => f.hash), bucketIds: features.map((f) => f.bucket), features: unique },
    };
    step += 1;

    for (let i = 0; i < features.length; i += 1) {
        const feature = features[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(features, i, i),
            edges: [],
            description: `n-gram ${i}: "${feature.padded}" hashes to ${feature.hash} then bucket ${feature.bucket}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...base, active: i, ngrams: features.map((f) => f.padded), hashes: features.map((f) => f.hash), bucketIds: features.map((f) => f.bucket), features: unique },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(features, features.length - 1, -1),
        edges: [],
        description: `Done: ${features.length} n-grams map to ${unique.length} distinct embedding buckets.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, features: unique, ngrams: features.map((f) => f.padded), hashes: features.map((f) => f.hash), bucketIds: features.map((f) => f.bucket), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A word is more than its whole-token identity: its spelling carries meaning. FastText chops a word into every character n-gram of a chosen size, adds explicit start and end markers, and hashes each piece into one of a fixed number of buckets. A word is represented by the sum of those bucket embeddings, so two words that share many n-grams automatically get similar vectors even if one was never seen in training.",
        invariants: [
            "Every n-gram is a slice of the word wrapped once with a start marker and an end marker.",
            "The FNV-1a hash is deterministic for a given ASCII string.",
            "Each bucket index is the hash reduced modulo the bucket count and therefore lies in range.",
        ],
        correctness:
            "The enumeration visits every starting position for each n-gram size whose window fits inside the boundary-wrapped word, so no valid substring is skipped and none is repeated out of range. Taking slices from the wrapped word distinguishes a prefix n-gram from a substring in the middle. FNV-1a folds each character's code into a 32-bit state with an XOR and a multiply by the prime 16777619, a deterministic bijection-free hash whose modulo reduction is the standard FastText bucket assignment. The tests reimplement the hash and enumeration independently and verify determinism, bucket bounds, and feature coverage.",
        complexityRationale:
            "For each of at most k n-gram sizes there are O(L) starting positions, giving O(L times k) features; storing the padded strings, hashes, and buckets uses the same linear space.",
        uses: [
            "Text classification with misspellings and rare words",
            "Subword embeddings for morphologically rich languages",
            "Out-of-vocabulary word representation in NLP pipelines",
        ],
        references: [
            "Bojanowski, Grave, Joulin, and Mikolov, Enriching Word Vectors with Subword Information, ACL, 2017",
            "Joulin et al., Bag of Tricks for Efficient Text Classification, EACL, 2017",
        ],
        workedExample:
            "For the word cat with sizes three and four and 1000 buckets, the size-three grams are ^ca, cat, and at#, and the size-four grams are ^cat and cat#. Each padded string is hashed with FNV-1a and reduced modulo 1000, producing the list of embedding bucket ids that represent the word.",
    },
    id: "fasttext",
    name: "FastText Subword Hashing",
    category: "ml-ai",
    complexity: { time: "O(L * k)", space: "O(L * k)" },
    defaultInput: { word: "visualize", minN: 3, maxN: 4, buckets: 1000 },
    visualType: "grid",
    run,
    pseudocode: [
        "wrap the word once with start and end boundary markers",
        "for each n-gram size from minN to maxN",
        "for each starting position whose window fits in the wrapped word",
        "extract the substring and hash its marked form using FNV-1a",
        "reduce the hash modulo the bucket count to get a feature id",
        "collect the distinct bucket ids as the word representation",
        "done: report the n-grams, hashes, and bucket ids",
    ],
};

export default module;
