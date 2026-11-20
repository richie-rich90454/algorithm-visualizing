/**
 * simhash.ts - SimHash Locality-Sensitive Fingerprinting.
 *
 * SimHash maps a set of tokens to a compact fingerprint such that similar sets
 * produce fingerprints with few differing bits. Each token votes on every bit
 * position according to the bits of its own hash; the fingerprint keeps a bit
 * when the majority of tokens voted for one. Comparing fingerprints by Hamming
 * distance then approximates how similar two documents are.
 *
 * Time:  O(t * b) for t tokens and b fingerprint bits
 * Space: O(b)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const BITS = 32;

/** FNV-1a 32-bit hash, returned as an unsigned integer. */
function fnv1a(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i) as number;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

function fingerprint(tokens: string[]): number {
    const vector = new Array<number>(BITS).fill(0);
    for (const token of tokens) {
        const hash = fnv1a(token);
        for (let bit = 0; bit < BITS; bit += 1) {
            vector[bit] = (vector[bit] as number) + ((hash & (1 << bit)) !== 0 ? 1 : -1);
        }
    }
    let result = 0;
    for (let bit = 0; bit < BITS; bit += 1) {
        if ((vector[bit] as number) > 0) {
            result = (result | (1 << bit)) >>> 0;
        }
    }
    return result >>> 0;
}

function hamming(a: number, b: number): number {
    let x = (a ^ b) >>> 0;
    let count = 0;
    while (x > 0) {
        count += x & 1;
        x >>>= 1;
    }
    return count;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { tokens?: string[]; compareTokens?: string[][] } | null) ?? {};
    const tokens: string[] = task.tokens ?? ["cat", "dog", "pet", "animal", "fur", "paw", "tail", "kitten"];
    const compareTokens: string[][] = task.compareTokens ?? [
        ["cat", "dog", "pet", "animal", "fur", "paw", "tail", "puppy"],
        ["rocket", "orbit", "planet", "engine", "gravity", "star", "thrust", "comet"],
    ];

    const vector = new Array<number>(BITS).fill(0);
    let step = 0;
    const emit = (message: string, codeLine: number, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const entities: VisualEntity[] = vector.map((sum, bit) => ({
            id: `bit-${bit}`,
            type: "bar" as const,
            label: `b${bit}:${sum > 0 ? "+" : ""}${sum}`,
            value: sum,
            state: sum > 0 ? ("sorted" as const) : sum < 0 ? ("active" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { bit, sum },
        }));
        const frame: VisualFrame = {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: codeLine,
            layout: "array",
            meta,
        };
        step += 1;
        return frame;
    };

    yield emit(`All ${BITS} simhash bit counters start at zero, ready for ${tokens.length} tokens.`, 0, { tokens: tokens.length, bits: BITS, vector: [...vector] });

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i] as string;
        const hash = fnv1a(token);
        for (let bit = 0; bit < BITS; bit += 1) {
            vector[bit] = (vector[bit] as number) + ((hash & (1 << bit)) !== 0 ? 1 : -1);
        }
        yield emit(
            `Token "${token}" voted on all ${BITS} bits from its FNV-1a hash ${hash.toString(16)}.`,
            3,
            { tokens: tokens.length, processed: i + 1, token, vector: [...vector] },
        );
    }

    const own = fingerprint(tokens);
    const bits = own.toString(2).padStart(BITS, "0");
    const distances = compareTokens.map((set) => hamming(own, fingerprint(set)));
    yield emit(
        `Fingerprint ${bits} is ready; similar token sets differ in only a few bits.`,
        6,
        { tokens: tokens.length, fp: own, bits, distances, compares: compareTokens.length },
    );

    yield emit(
        `Done: Hamming distances to the comparison sets are ${distances.join(", ") || "none"}.`,
        7,
        { tokens: tokens.length, fp: own, bits, distances, compares: compareTokens.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SimHash turns a document into a short bit string by letting every word vote on each bit. Words with similar hashes tend to push the same bits in the same direction, so two documents that share most of their words end up with fingerprints that differ in only a handful of positions. Counting those differing bits is a fast proxy for how alike the documents are.",
        invariants: [
            "Each token contributes exactly one vote of plus or minus one to every bit.",
            "A fingerprint bit is one when the majority of token votes for it are positive.",
            "Identical token sets always produce identical fingerprints.",
        ],
        correctness:
            "The fingerprint is a deterministic function of the token set because the hash and the majority rule are deterministic, so equal sets give equal fingerprints. A token shared by two documents casts the same votes in both, while an unshared token affects only about half of the bits, so the expected Hamming distance grows with the fraction of differing tokens, which is the locality-sensitive property.",
        complexityRationale:
            "Each of the t tokens is hashed once in O(length) and votes on b bits, giving O(t * b) time; computing and comparing fingerprints is O(b) per document. Only the b element vote vector is stored, O(b) space, plus the fingerprint itself.",
        uses: [
            "Detecting near-duplicate web pages in search engines",
            "Clustering similar documents by compact signatures",
            "Fast approximate nearest-neighbor search on text",
        ],
        references: [
            "A. Z. Broder, On the Resemblance and Containment of Documents, 1997",
            "M. Charikar, Similarity Estimation Techniques from Rounding Algorithms, STOC 2002",
        ],
        workedExample:
            "For tokens cat, dog, and pet, each word's FNV-1a hash raises about half of the 32 bit counters and lowers the rest. If 20 counters end positive and 12 negative, the fingerprint keeps those 20 bits set. Replacing pet with puppy changes roughly one third of the votes, so the new fingerprint differs in only a few bits, signaling high similarity.",
    },
    id: "simhash",
    name: "SimHash",
    category: "geometry",
    complexity: { time: "O(t * b)", space: "O(b)" },
    defaultInput: {
        tokens: ["cat", "dog", "pet", "animal", "fur", "paw", "tail", "kitten"],
        compareTokens: [
            ["cat", "dog", "pet", "animal", "fur", "paw", "tail", "puppy"],
            ["rocket", "orbit", "planet", "engine", "gravity", "star", "thrust", "comet"],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize b bit counters to zero",
        "for each token compute its FNV-1a hash",
        "for each bit add one when the hash bit is set else subtract one",
        "after all tokens set a fingerprint bit when its counter is positive",
        "pack the chosen bits into the fingerprint integer",
        "for each comparison set compute its fingerprint the same way",
        "count differing bits with a Hamming distance",
        "done: report the fingerprint and all distances",
    ],
};

export default module;
