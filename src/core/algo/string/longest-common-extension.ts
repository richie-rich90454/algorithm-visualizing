/**
 * longest-common-extension.ts - Longest Common Extension by Rolling Hash
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An LCE query asks for the length of the longest shared prefix of the two
 * suffixes of a text that start at positions i and j. This module answers each
 * query with a binary search over the answer length, using a double rolling
 * hash to compare two substrings in constant time. It is a distinct primitive
 * from longest-common-prefix-dp (whole strings from index zero) and from lcp
 * arrays (adjacent suffixes only): here any two positions may be queried.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) preprocessing, O(log n) per query
 *   Space: O(n) for the two prefix-hash arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The text is drawn as a row of character boxes.
 *   - The suffix at i is CYAN (active); the suffix at j is YELLOW (comparing).
 *   - The highlighted span grows as the binary search probes longer lengths.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

type Query = [number, number];

const MOD1 = 1000000007n;
const MOD2 = 1000000009n;
const BASE = 911382323n;

/** Return the char code used in the hash for a character. */
function codeOf(ch: string): bigint {
    return BigInt((ch.charCodeAt(0) % 256) + 1);
}

/** Build the hashed entities for the current probe of a query. */
function makeEntities(
    text: string,
    leftStart: number,
    rightStart: number,
    span: number,
): VisualEntity[] {
    const states = new Map<number, EntityState>();
    for (let k = 0; k < span; k += 1) {
        if (leftStart + k < text.length) {
            states.set(leftStart + k, "active");
        }
        if (rightStart + k < text.length) {
            states.set(rightStart + k, "comparing");
        }
    }
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

/** The Longest Common Extension generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; queries?: Query[] } | null) ?? {};
    const text = task.text ?? "abababacabab";
    const queries: Query[] = task.queries ?? [
        [0, 2],
        [1, 3],
        [2, 6],
        [4, 7],
        [0, 8],
    ];
    const n = text.length;

    // Double prefix hashes, built with BigInt to avoid 64-bit overflow.
    const h1 = new Array<bigint>(n + 1).fill(0n);
    const h2 = new Array<bigint>(n + 1).fill(0n);
    const p1 = new Array<bigint>(n + 1).fill(1n);
    const p2 = new Array<bigint>(n + 1).fill(1n);
    for (let i = 0; i < n; i += 1) {
        const c = codeOf(text[i] ?? "\0");
        h1[i + 1] = (h1[i]! * BASE + c) % MOD1;
        h2[i + 1] = (h2[i]! * BASE + c) % MOD2;
        p1[i + 1] = (p1[i]! * BASE) % MOD1;
        p2[i + 1] = (p2[i]! * BASE) % MOD2;
    }

    /** True when the two substrings of the given length are identical. */
    const equal = (a: number, b: number, length: number): boolean => {
        const ha = (h1[a + length]! - h1[a]! * p1[length]! + MOD1 * MOD1) % MOD1;
        const hb = (h1[b + length]! - h1[b]! * p1[length]! + MOD1 * MOD1) % MOD1;
        const ga = (h2[a + length]! - h2[a]! * p2[length]! + MOD2 * MOD2) % MOD2;
        const gb = (h2[b + length]! - h2[b]! * p2[length]! + MOD2 * MOD2) % MOD2;
        return ha === hb && ga === gb;
    };

    let step = 0;
    const results: number[] = [];

    yield {
        stepNumber: step,
        entities: makeCharacters(text),
        edges: [],
        description: `LCE on "${text}" - double rolling hash ready for ${queries.length} query/queries.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { textLength: n, queries: queries.length, results: [] },
    };
    step += 1;

    for (let q = 0; q < queries.length; q += 1) {
        const pair = queries[q];
        if (!pair) {
            continue;
        }
        const i = Math.max(0, Math.min(n, Math.floor(pair[0])));
        const j = Math.max(0, Math.min(n, Math.floor(pair[1])));
        const high = Math.min(n - i, n - j);
        let low = 0;
        let top = high;

        yield {
            stepNumber: step,
            entities: makeEntities(text, i, j, 1),
            edges: [],
            description: `Query ${q + 1}: suffixes start at ${i} (cyan) and ${j} (yellow); maximum span ${high}.`,
            codeLineNumber: 1,
            layout: "text",
            meta: { query: q + 1, i, j, low, high: top, results: [...results] },
        };
        step += 1;

        while (low < top) {
            const mid = Math.ceil((low + top) / 2);
            const same = equal(i, j, mid);
            if (same) {
                low = mid;
            } else {
                top = mid - 1;
            }
            yield {
                stepNumber: step,
                entities: makeEntities(text, i, j, mid),
                edges: [],
                description: `Query ${q + 1}: probe length ${mid} - substrings ${same ? "match" : "differ"}; search range [${low}, ${top}].`,
                codeLineNumber: 4,
                layout: "text",
                meta: { query: q + 1, i, j, low, high: top, results: [...results] },
            };
            step += 1;
        }

        results.push(low);
        yield {
            stepNumber: step,
            entities: makeEntities(text, i, j, low),
            edges: [],
            description: `Query ${q + 1}: longest common extension of suffixes at ${i} and ${j} is ${low}.`,
            codeLineNumber: 6,
            layout: "text",
            meta: { query: q + 1, i, j, answer: low, results: [...results] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCharacters(text),
        edges: [],
        description: `All queries answered: LCE results ${results.join(", ") || "(none)"}.`,
        codeLineNumber: 7,
        layout: "text",
        meta: { textLength: n, queries: queries.length, results },
    };
}

/** The Longest Common Extension module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two suffixes of the same text share some initial characters. Rather than comparing them one character at a time, hash each substring and binary search for the longest length whose two hashes agree. Hashing makes one length comparison constant time, so each query costs only a logarithmic number of probes.",
        invariants: [
            "The answer for a query lies in the closing interval [low, high].",
            "Every tested length that matched is at most the true LCE; every length that failed is greater than it.",
            "A double hash makes two different substrings collide with negligible probability.",
        ],
        correctness:
            "The predicate 'the two substrings of length L starting at i and j are equal' is monotone: if it holds for L it also holds for every smaller length, and if it fails for L it fails for every larger length. Binary search on a monotone predicate therefore returns the maximum L for which equality holds, which is exactly the longest common extension. With two independent primes the chance that unequal substrings share both hashes is negligible.",
        complexityRationale:
            "Building the prefix-hash and power arrays scans the text once, O(n) time and space. Each query performs a binary search over at most n lengths with constant-time hash comparisons, so a query costs O(log n).",
        uses: [
            "Genome repeat and tandem-repeat analysis",
            "Fast pattern matching as the inner loop of kangaroo methods",
            "Suffix-tree and suffix-array construction subroutines",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 7",
            "Karp and Rabin, Efficient Randomized Pattern-Matching Algorithms, 1987",
        ],
        workedExample:
            'For text "abababacabab", the suffixes at 0 ("abababacabab") and 2 ("ababacabab") share "ababa" but differ at the next character, so LCE(0,2) = 5. The suffixes at 1 and 3 are "bababacabab" and "babacabab", which share "baba", giving 4.',
    },
    id: "longest-common-extension",
    name: "Longest Common Extension (Rolling Hash)",
    category: "string",
    complexity: { time: "O(n + q log n)", space: "O(n)" },
    defaultInput: {
        text: "abababacabab",
        queries: [
            [0, 2],
            [1, 3],
            [2, 6],
            [4, 7],
            [0, 8],
        ],
    },
    visualType: "text",
    run,
    pseudocode: [
        "build double prefix-hash and power arrays for the text",
        "for each query with start positions i and j",
        "set low to zero and high to the shorter remaining length",
        "while low is less than high choose the midpoint length",
        "compare the two hashed substrings of that length",
        "if they match set low to midpoint else set high below it",
        "record low as the longest common extension",
        "done: report every query answer",
    ],
};

export default module;
