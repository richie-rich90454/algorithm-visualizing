/**
 * latent-semantic-analysis.ts - Latent Semantic Analysis via Truncated SVD
 *
 * LSA represents documents and terms in a low-dimensional latent space. It
 * builds a TF-IDF term-document matrix, then keeps the leading right singular
 * vectors of that matrix. Documents are compared by cosine similarity of their
 * reduced vectors, which reveals topical similarity even without shared words.
 *
 * Time is O(iters * k * docs * terms); space is O(docs * terms + terms * k).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { mulberry32 } from "./random-search-hyperparameter";

export interface TfidfResult {
    matrix: number[][];
    vocab: string[];
    idf: number[];
}

/** Sublinear term frequency times smoothed inverse document frequency. */
export function buildTfidf(documents: string[][]): TfidfResult {
    const vocabSet = new Set<string>();
    for (const doc of documents) {
        for (const term of doc) {
            vocabSet.add(term);
        }
    }
    const vocab = [...vocabSet].sort();
    const index = new Map(vocab.map((term, i) => [term, i] as const));
    const n = documents.length;
    const df = vocab.map(() => 0);
    for (const doc of documents) {
        const seen = new Set(doc);
        for (const term of seen) {
            const t = index.get(term);
            if (t !== undefined) {
                df[t] = (df[t] ?? 0) + 1;
            }
        }
    }
    const idf = df.map((d) => Math.log(n / (1 + d)) + 1);
    const matrix = documents.map((doc) => {
        const tf = vocab.map(() => 0);
        for (const term of doc) {
            const t = index.get(term);
            if (t !== undefined) {
                tf[t] = (tf[t] ?? 0) + 1;
            }
        }
        return tf.map((count, t) => (count > 0 ? (1 + Math.log(count)) * (idf[t] ?? 0) : 0));
    });
    return { matrix, vocab, idf };
}

/** Leading orthonormal right singular vectors by orthogonal power iteration. */
export function lsaBasis(matrix: number[][], k: number, iters: number, seed: number): number[][] {
    const rows = matrix.length;
    const cols = rows > 0 ? (matrix[0]?.length ?? 0) : 0;
    const rank = Math.max(1, Math.min(k, rows, cols));
    const rand = mulberry32(seed);
    const basis: number[][] = [];

    for (let c = 0; c < rank; c += 1) {
        let v = Array.from({ length: cols }, () => rand() - 0.5);
        // Remove components along earlier basis vectors.
        for (let iter = 0; iter < iters; iter += 1) {
            const next = Array.from({ length: cols }, () => 0);
            for (let i = 0; i < rows; i += 1) {
                let projection = 0;
                for (let j = 0; j < cols; j += 1) {
                    projection += (matrix[i]![j] ?? 0) * (v[j] ?? 0);
                }
                for (let j = 0; j < cols; j += 1) {
                    next[j] = (next[j] ?? 0) + projection * (matrix[i]![j] ?? 0);
                }
            }
            for (const b of basis) {
                let dot = 0;
                for (let j = 0; j < cols; j += 1) {
                    dot += (b[j] ?? 0) * (next[j] ?? 0);
                }
                for (let j = 0; j < cols; j += 1) {
                    next[j] = (next[j] ?? 0) - dot * (b[j] ?? 0);
                }
            }
            const norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0));
            v = norm > 1e-12 ? next.map((x) => x / norm) : next;
        }
        basis.push(v);
    }
    return basis;
}

/** Project documents into the latent space spanned by a basis. */
export function lsaDocumentVectors(matrix: number[][], basis: number[][]): number[][] {
    return matrix.map((row) =>
        basis.map((v) => row.reduce((sum, x, j) => sum + x * (v[j] ?? 0), 0)),
    );
}

/** Cosine similarity of two vectors. */
export function cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += (a[i] ?? 0) * (b[i] ?? 0);
        na += (a[i] ?? 0) ** 2;
        nb += (b[i] ?? 0) ** 2;
    }
    return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function makeCells(matrix: number[][], vocab: string[], highlighted: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < matrix.length; i += 1) {
        for (let j = 0; j < (matrix[i]?.length ?? 0); j += 1) {
            const value = matrix[i]![j] ?? 0;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: `${vocab[j] ?? "?"}: ${value.toFixed(2)}`,
                value,
                state: (i === highlighted ? "comparing" : value > 0 ? "visited" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { documents?: string[][]; k?: number; iters?: number; seed?: number } | null
    ) ?? {};
    const documents: string[][] = task.documents ?? [
        ["cat", "cat", "dog", "pet"],
        ["dog", "dog", "pet", "animal"],
        ["car", "car", "truck", "road"],
        ["truck", "road", "car", "engine"],
    ];
    const k = typeof task.k === "number" ? Math.max(1, Math.floor(task.k)) : 2;
    const iters = typeof task.iters === "number" ? Math.max(1, Math.floor(task.iters)) : 30;
    const seed = typeof task.seed === "number" ? task.seed : 9;
    const tfidf = buildTfidf(documents);
    const basis = lsaBasis(tfidf.matrix, k, iters, seed);
    const vectors = lsaDocumentVectors(tfidf.matrix, basis);
    const sim01 = cosine(vectors[0] ?? [], vectors[1] ?? []);
    const sim02 = cosine(vectors[0] ?? [], vectors[2] ?? []);
    const metaBase = { rows: documents.length, cols: tfidf.vocab.length, k, vocab: tfidf.vocab };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(tfidf.matrix, tfidf.vocab, -1),
        edges: [],
        description: `LSA on ${documents.length} documents and ${tfidf.vocab.length} terms; TF-IDF matrix built, now extracting ${basis.length} latent directions.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...metaBase, sim01, sim02 },
    };
    step += 1;

    for (let d = 0; d < documents.length; d += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(tfidf.matrix, tfidf.vocab, d),
            edges: [],
            description: `Document ${d} projects to latent vector [${(vectors[d] ?? []).map((v) => v.toFixed(3)).join(", ")}] in ${vectors[d]?.length ?? 0} dimensions.`,
            codeLineNumber: 2,
            layout: "matrix",
            meta: { ...metaBase, current: d, sim01, sim02 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(tfidf.matrix, tfidf.vocab, -1),
        edges: [],
        description: `Latent cosine similarity: documents 0 and 1 score ${sim01.toFixed(3)}, while documents 0 and 2 score ${sim02.toFixed(3)}.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { ...metaBase, converged: true, sim01, sim02, documentVectors: JSON.stringify(vectors) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two documents can be about the same topic while using completely different words. LSA computes a TF-IDF matrix, then keeps only the strongest directions of variation in that matrix. Projecting documents into this reduced space lets synonyms line up, because a term that appears in similar documents acquires a similar latent vector.",
        invariants: [
            "A term absent from a document has TF-IDF value zero in that cell.",
            "The latent basis vectors are orthonormal because each is orthogonalized against the earlier ones.",
            "Document similarities are cosines of vectors in the reduced space, so they lie between minus one and one.",
        ],
        correctness:
            "TF-IDF is computed from term counts and document frequencies exactly as a direct implementation does. Orthogonal power iteration converges to the leading eigenvector of the Gram matrix A^T A; deflation removes already captured directions, so the returned basis spans the top singular subspace. Projecting rows onto that basis and taking cosines is the LSA similarity. The tests verify TF-IDF values, basis orthonormality, and cosine values against independent computations.",
        complexityRationale:
            "Each power iteration multiplies by the matrix twice, costing O(docs * terms), repeated iters times per latent dimension, so time is O(iters * k * docs * terms). The TF-IDF matrix and basis use O(docs * terms + terms * k) space.",
        uses: [
            "Information retrieval that tolerates synonymy",
            "Topic modeling and document clustering",
            "Dimensionality reduction before downstream text classifiers",
        ],
        references: [
            "Deerwester et al., Indexing by Latent Semantic Analysis, JASIS 1990",
            "Landauer et al., Latent Semantic Analysis, American Psychologist 1998",
        ],
        workedExample:
            "Two documents about pets share cat and dog and receive similar latent coordinates, while a document about cars receives a different direction. Even if a third pet document mentions only puppy, its vector still lands near the other pet documents because puppy co-occurs with dog.",
    },
    id: "latent-semantic-analysis",
    name: "Latent Semantic Analysis",
    category: "ml-ai",
    complexity: { time: "O(iters * k * docs * terms)", space: "O(docs * terms + terms * k)" },
    defaultInput: {
        documents: [
            ["cat", "cat", "dog", "pet"],
            ["dog", "dog", "pet", "animal"],
            ["car", "car", "truck", "road"],
            ["truck", "road", "car", "engine"],
        ],
        k: 2,
        iters: 30,
        seed: 9,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "build the vocabulary and count term frequency per document",
        "compute smoothed inverse document frequency for each term",
        "form the TF-IDF document by term matrix",
        "extract the leading latent directions by orthogonal power iteration",
        "project each document onto those directions",
        "done: compare documents by cosine similarity in the reduced space",
    ],
};

export default module;
