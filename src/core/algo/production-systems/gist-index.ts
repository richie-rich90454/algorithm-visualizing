/**
 * gist-index.ts - GiST-Style Signature Index (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This teaching toy models a generalized search tree over grouped records.
 * Each disk page stores a lossy signature: the bitwise OR of the hashes of all
 * tags on that page. A query computes the OR of its tags and only visits pages
 * whose signature contains every query bit. Because signatures are lossy the
 * candidate set can contain false positives, which are removed by an exact tag
 * check, but it never drops a genuine match.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(totalTags + pages * queryTags) for build and query
 *   Space: O(pages + totalTags)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per page shows how many signature bits are set.
 *   - Pages whose signature covers the query are highlighted.
 *   - The final frame lists the exact matches after verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const SIGNATURE_BITS = 32;

/** FNV-1a hash reduced to a 32-bit signature bitmask. */
function hashTag(tag: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < tag.length; i += 1) {
        hash ^= tag.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    let mask = 0;
    for (let i = 0; i < SIGNATURE_BITS; i += 1) {
        if (((hash >>> i) & 1) === 1) mask |= 1 << i;
    }
    return mask >>> 0;
}

/** Bitwise OR of all tag signatures in a record. */
function recordSignature(tags: string[]): number {
    let signature = 0;
    for (const tag of tags) signature = (signature | hashTag(tag)) >>> 0;
    return signature >>> 0;
}

/** Number of set bits in a 32-bit word. */
function popcount(value: number): number {
    let v = value >>> 0;
    let count = 0;
    while (v !== 0) {
        v &= v - 1;
        count += 1;
    }
    return count;
}

function buildEntities(signatures: number[], candidates: Set<number>): VisualEntity[] {
    return signatures.map((signature, page) => ({
        id: `page-${page}`,
        type: "bar" as const,
        label: `p${page}:${popcount(signature)}`,
        value: popcount(signature),
        state: (candidates.has(page) ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { page, bitCount: popcount(signature), candidate: candidates.has(page) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        records?: string[][];
        groupSize?: number;
        query?: string[];
    } | null) ?? {};
    const records: string[][] = Array.isArray(task.records)
        ? task.records
        : [
              ["red", "round"],
              ["blue", "square"],
              ["red", "sweet"],
              ["green", "round"],
              ["blue", "sweet"],
              ["red", "square"],
          ];
    const groupSize = typeof task.groupSize === "number" && task.groupSize > 0 ? task.groupSize : 2;
    const query: string[] = Array.isArray(task.query) ? task.query : ["red"];

    const pageCount = Math.ceil(records.length / groupSize);
    const signatures: number[] = [];
    for (let page = 0; page < pageCount; page += 1) {
        let signature = 0;
        for (let i = page * groupSize; i < Math.min(records.length, (page + 1) * groupSize); i += 1) {
            signature = (signature | recordSignature(records[i] as string[])) >>> 0;
        }
        signatures.push(signature >>> 0);
    }
    const querySignature = recordSignature(query);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: buildEntities(signatures, new Set()),
        edges: [],
        description: `Built ${pageCount} page signatures over ${records.length} records; probing query [${query.join(", ")}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { pageCount, query, signatures, phase: "start" },
    };

    const candidates = new Set<number>();
    for (let page = 0; page < pageCount; page += 1) {
        const signature = signatures[page] as number;
        if (((signature & querySignature) >>> 0) === (querySignature >>> 0)) candidates.add(page);
        yield {
            stepNumber: step++,
            entities: buildEntities(signatures, new Set([...candidates])),
            edges: [],
            description: `Page ${page}: signature ${signature >>> 0} ${candidates.has(page) ? "covers" : "misses"} the query signature; ${candidates.size} candidate page(s) so far.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { page, signature, querySignature, candidates: [...candidates], phase: "probe" },
        };
    }

    const matches: number[] = [];
    for (const page of candidates) {
        for (let i = page * groupSize; i < Math.min(records.length, (page + 1) * groupSize); i += 1) {
            const tags = records[i] as string[];
            if (query.every((tag) => tags.includes(tag))) matches.push(i);
        }
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(signatures, candidates),
        edges: [],
        description: `Verified ${candidates.size} candidate page(s): records [${matches.join(", ")}] match the query.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { query, candidates: [...candidates], matches, pageCount, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A generalized search index trades a little extra work for much less I/O. Each page stores a compact summary of the values it contains. A query first checks the summaries and skips any page that cannot possibly contain a match, then verifies only the surviving pages against the real records. A lossy summary may suggest extra pages, but it must never hide a true match.",
        invariants: [
            "A page signature is the bitwise OR of every tag signature on that page.",
            "A query only visits pages whose signature contains all query bits.",
            "Exact verification follows every candidate page, removing false positives.",
        ],
        correctness:
            "If a record on a page contains every query tag, each query tag's signature bits are set in that record and therefore in the page OR, so the page signature contains the query signature and the page is a candidate. The candidate set is thus a superset of the pages holding true matches, which is the no-false-negative property. Scanning every candidate record and testing tag containment removes any false positives introduced by hash collisions, leaving exactly the matching records.",
        complexityRationale:
            "Building hashes every tag once, O(totalTags). Probing compares each page signature with the query in constant time, O(pages), and verification is proportional to the records on candidate pages. All signatures and the page list fit in O(pages) space.",
        uses: [
            "Explaining signature files and generalized search trees",
            "Indexing multi-attribute records in databases",
            "Teaching the false-positive versus no-false-negative trade-off",
        ],
        references: [
            "Hellerstein, Naughton and Pfeffer, Generalized Search Trees for Database Systems, 1995",
            "Salton, Wong and Yang, A Vector Space Model for Automatic Indexing (signature files)",
        ],
        workedExample:
            "With a page holding tags red and round and a query for red, the page signature contains all bits of hash(red), so the page is a candidate. A page holding only blue and square lacks those bits and is skipped without reading its records.",
    },
    id: "gist-index",
    name: "GiST-Style Signature Index (Toy)",
    category: "production-systems",
    complexity: { time: "O(totalTags + pages)", space: "O(pages)" },
    defaultInput: {
        records: [
            ["red", "round"],
            ["blue", "square"],
            ["red", "sweet"],
            ["green", "round"],
            ["blue", "sweet"],
            ["red", "square"],
        ],
        groupSize: 2,
        query: ["red"],
    },
    visualType: "array",
    run,
    pseudocode: [
        "hash every record tag into a 32-bit signature mask",
        "OR the signatures of all records on each page",
        "compute the query signature as the OR of its tags",
        "for each page, mark it a candidate if its signature covers the query",
        "scan candidate pages and test exact tag containment",
        "discard false positives found during verification",
        "done: report the matching record ids",
    ],
};

export default module;
