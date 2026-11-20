/**
 * gin-index.ts - GIN Generalized Inverted Index
 *
 * A GIN index speeds up containment queries over composite values such as
 * token arrays. Each document gets a compact signature that is the bitwise OR
 * of the bits of its tokens. A query first uses the signature to discard
 * documents that cannot match, then verifies the few remaining candidates
 * against the exact token list. This model demonstrates the filter and verify
 * stages and their correctness.
 *
 * Time: O(documents + tokens) build, O(documents) per query; Space: O(tokens + documents).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Document { id: string; tokens: string[] }

function tokenBit(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
        hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    return 1 << (hash % 28);
}

function signature(tokens: string[]): number {
    let sig = 0;
    for (const token of tokens) { sig |= tokenBit(token); }
    return sig >>> 0;
}

function makeEntities(documents: Document[], sigs: number[], candidates: Set<number>): VisualEntity[] {
    return documents.map((doc, index) => ({
        id: `doc-${index}`,
        type: "bar" as const,
        label: `${doc.id}:${(sigs[index] ?? 0).toString(2)}`,
        value: sigs[index] ?? 0,
        state: candidates.has(index) ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { document: doc.id },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { documents?: Document[]; query?: string } | null) ?? {};
    const documents: Document[] = (task.documents ?? [
        { id: "d1", tokens: ["cat", "dog"] },
        { id: "d2", tokens: ["dog", "bird"] },
        { id: "d3", tokens: ["cat", "fish"] },
        { id: "d4", tokens: ["bird", "fish"] },
    ]).map((doc) => ({ id: doc.id, tokens: [...doc.tokens] }));
    const query = task.query ?? "cat";

    const sigs = documents.map((doc) => signature(doc.tokens));
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(documents, sigs, new Set()),
        edges: [],
        description: `Built a ${documents.length}-document GIN index by OR-ing token bits into signatures.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "build", query, candidates: [] as string[], results: [] as string[], signatures: [...sigs] },
    };
    step += 1;

    const queryBit = tokenBit(query);
    const candidateIndices: number[] = [];
    for (let i = 0; i < documents.length; i += 1) {
        if (((sigs[i] ?? 0) & queryBit) !== 0) {
            candidateIndices.push(i);
        }
    }
    yield {
        stepNumber: step,
        entities: makeEntities(documents, sigs, new Set(candidateIndices)),
        edges: [],
        description: `Signature filter kept ${candidateIndices.length} candidate document(s) for token ${query}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "filter", query, candidates: candidateIndices.map((i) => documents[i]?.id ?? ""), results: [] as string[], signatures: [...sigs] },
    };
    step += 1;

    const results: string[] = [];
    for (const index of candidateIndices) {
        const doc = documents[index];
        if (doc && doc.tokens.includes(query)) {
            results.push(doc.id);
        }
    }
    yield {
        stepNumber: step,
        entities: makeEntities(documents, sigs, new Set(candidateIndices)),
        edges: [],
        description: `Exact verification kept ${results.length} match(es) for token ${query}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { phase: "verify", query, candidates: candidateIndices.map((i) => documents[i]?.id ?? ""), results, signatures: [...sigs] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A GIN index is like a quick sieve before a careful check. Each document stores a small signature summarizing its tokens. To answer a containment query, discard documents whose signature lacks the query's bit, then inspect only the survivors to confirm the token really appears. False positives are fine because verification removes them, but false negatives are impossible.",
        invariants: [
            "A document's signature has a bit set for every token it contains.",
            "If a token is present, the query bit is present in the signature, so it can never be filtered out.",
            "Returned documents are exactly those candidates whose full token list contains the query.",
        ],
        correctness:
            "The signature test is a necessary condition for containment, so filtering never removes a true match. The verification step then applies the exact definition of containment to every survivor. Together the two stages return precisely the documents containing the token, which the test checks against a brute-force scan.",
        complexityRationale:
            "Building computes one OR per token, and a query scans every signature once then verifies only candidates, giving O(documents plus tokens) build time and O(documents) query time with O(tokens plus documents) space.",
        uses: [
            "Full-text and array containment search in PostgreSQL GIN indexes",
            "Tag and label lookups over composite documents",
            "Teaching filter-then-verify index designs with bounded false positives",
        ],
        references: [
            "PostgreSQL Documentation, GIN Indexes",
            "Chang and Garcia-Molina, The Design and Analysis of Inverted Indexes for Text and Feature Values, 2006",
        ],
        workedExample:
            "Four documents with token pairs cat-dog, dog-bird, cat-fish, and bird-fish produce signatures whose bits include each token. Querying cat filters to the first and third documents and exact verification returns both, matching a full scan.",
    },
    id: "gin-index",
    name: "GIN Generalized Inverted Index",
    category: "production-systems",
    complexity: { time: "O(documents + tokens) build", space: "O(tokens + documents)" },
    defaultInput: {
        documents: [
            { id: "d1", tokens: ["cat", "dog"] },
            { id: "d2", tokens: ["dog", "bird"] },
            { id: "d3", tokens: ["cat", "fish"] },
            { id: "d4", tokens: ["bird", "fish"] },
        ],
        query: "cat",
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the documents and the query token",
        "for each document compute its signature as the OR of token bits",
        "compute the query token's bit",
        "keep documents whose signature contains that bit",
        "verify each candidate against the exact token list",
        "collect the document ids that truly contain the token",
        "report the candidates and final matches",
    ],
};

export default module;
