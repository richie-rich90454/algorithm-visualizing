/**
 * inverted-index.ts - Inverted Index for Text Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An inverted index flips documents into a term-to-postings map: for each word
 * it stores the sorted list of documents containing it. Tokenizing each
 * document builds the map, and a query is answered by merging the postings
 * lists of its terms. Intersection implements AND search, union implements OR
 * search, and both merges run in linear time because each postings list is
 * sorted. This is the core data structure behind web and enterprise search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total tokens) to build, O(sum of query postings lengths) per query
 *   Space: O(total distinct term-document pairs)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells form a term-by-document incidence matrix.
 *   - Present cells are GREEN; a queried term's row is CYAN.
 *   - Matching documents in the final frame are HIGHLIGHTED.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Split text into lowercase word tokens. */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 0);
}

/** Merge two sorted lists by intersection or union. */
function merge(a: number[], b: number[], intersect: boolean): number[] {
    const out: number[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        const av = a[i] ?? 0;
        const bv = b[j] ?? 0;
        if (av === bv) {
            out.push(av);
            i += 1;
            j += 1;
        } else if (av < bv) {
            if (!intersect) out.push(av);
            i += 1;
        } else {
            if (!intersect) out.push(bv);
            j += 1;
        }
    }
    if (!intersect) {
        while (i < a.length) out.push(a[i++] ?? 0);
        while (j < b.length) out.push(b[j++] ?? 0);
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { documents?: string[]; query?: string; operator?: "AND" | "OR" } | null) ?? {};
    const documents = task.documents ?? [
        "the quick brown fox",
        "the lazy brown dog",
        "quick red fox jumps",
        "the quick red fox",
    ];
    const query = task.query ?? "quick fox";
    const operator = task.operator === "OR" ? "OR" : "AND";
    const queryTerms = tokenize(query);

    const postings = new Map<string, number[]>();
    for (let d = 0; d < documents.length; d += 1) {
        for (const term of new Set(tokenize(documents[d] ?? ""))) {
            const list = postings.get(term) ?? [];
            list.push(d);
            postings.set(term, list);
        }
    }
    const terms = [...postings.keys()].sort();

    const cells = (
        activeDoc: number,
        activeTerm: string,
        matchedDocs: number[],
    ): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let r = 0; r < terms.length; r += 1) {
            for (let c = 0; c < documents.length; c += 1) {
                const term = terms[r] ?? "";
                const present = (postings.get(term) ?? []).includes(c);
                let state: EntityState = present ? "sorted" : "idle";
                if (term === activeTerm) state = "active";
                if (matchedDocs.includes(c) && present) state = "path";
                if (c === activeDoc && activeDoc >= 0) state = "comparing";
                entities.push({
                    id: `cell-${r}-${c}`,
                    type: "cell" as const,
                    label: present ? "1" : "0",
                    value: present ? 1 : 0,
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c, term, doc: c },
                });
            }
        }
        return entities;
    };

    const commonMeta = {
        termCount: terms.length,
        docCount: documents.length,
        rows: terms.length,
        cols: documents.length,
        query,
        operator,
    };

    yield {
        stepNumber: 0,
        entities: cells(-1, "", []),
        edges: [],
        description: `Indexed ${documents.length} documents into ${terms.length} unique terms; matrix of term by document is ready.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...commonMeta, postings: terms.map((t) => `${t}:[${(postings.get(t) ?? []).join(",")}]`) },
    };

    let step = 1;
    for (let d = 0; d < documents.length; d += 1) {
        yield {
            stepNumber: step,
            entities: cells(d, "", []),
            edges: [],
            description: `Tokenized document ${d}: "${(documents[d] ?? "").slice(0, 40)}" and added its terms to the postings.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...commonMeta, buildingDoc: d },
        };
        step += 1;
    }

    for (const term of queryTerms) {
        yield {
            stepNumber: step,
            entities: cells(-1, term, []),
            edges: [],
            description: `Query term "${term}" has postings [${(postings.get(term) ?? []).join(",")}].`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { ...commonMeta, activeTerm: term },
        };
        step += 1;
    }

    const lists = queryTerms.map((term) => postings.get(term) ?? []);
    let matches = lists[0] ?? [];
    for (let i = 1; i < lists.length; i += 1) matches = merge(matches, lists[i] ?? [], operator === "AND");
    if (queryTerms.length === 0) matches = [];

    yield {
        stepNumber: step,
        entities: cells(-1, "", matches),
        edges: [],
        description: `${operator} query "${query}" matches document(s) [${matches.join(",")}] after merging ${queryTerms.length} postings list(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...commonMeta, matches },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Scanning every document for every query is slow. An inverted index precomputes, for each word, exactly which documents contain it. A query then looks up a short list per word and merges those sorted lists: intersection for words that must all appear, union for words where any may appear. This single idea is why search engines can answer queries over billions of pages.",
        invariants: [
            "Each postings list is sorted and contains no duplicate document ids.",
            "A cell is present exactly when its term appears in its document.",
            "The AND result is the intersection of the query postings; OR is their union.",
        ],
        correctness:
            "Tokenizing and inserting each document once makes a term's postings list the exact set of documents containing it, in increasing order because documents are visited in order. Merging two sorted lists with two pointers produces their intersection or union in linear time and preserves sortedness. Inductively folding the merge over all query terms therefore yields precisely the documents that contain every query term for AND, or at least one for OR.",
        complexityRationale:
            "Building touches every token once, so construction is linear in the total token count. A query scans only the postings lists of its terms, costing the sum of their lengths, and the term-to-list map gives O(1) lookup. Storage is one entry per distinct term-document pair.",
        uses: [
            "Full-text search engines and document retrieval systems",
            "Database text indexes and keyword filters",
            "Tag and label lookup in content management systems",
        ],
        references: [
            "Salton, The SMART Retrieval System, 1971",
            "Manning, Raghavan and Schuetze, Introduction to Information Retrieval, chapter 1",
        ],
        workedExample:
            "Indexing 'the quick brown fox' and 'the quick red fox' gives postings quick:[0,1] and fox:[0,1] while red:[1] and brown:[0]. The AND query 'quick fox' intersects [0,1] with [0,1] and returns documents 0 and 1; adding 'red' intersects with [1] and narrows the result to document 1.",
    },
    id: "inverted-index",
    name: "Inverted Index",
    category: "production-systems",
    complexity: { time: "O(total tokens + query postings)", space: "O(term-document pairs)" },
    defaultInput: {
        documents: [
            "the quick brown fox",
            "the lazy brown dog",
            "quick red fox jumps",
            "the quick red fox",
        ],
        query: "quick fox",
        operator: "AND",
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty term to postings map",
        "for each document tokenize its text into words",
        "append the document id to each unique word's postings",
        "sort the postings lists by document id",
        "for a query fetch the postings of each term",
        "merge the lists by intersection for AND or union for OR",
        "done: report the matching document ids",
    ],
};

export default module;
