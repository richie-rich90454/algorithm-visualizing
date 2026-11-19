/**
 * tree-count-by-cayley.ts - Cayley's Formula by Prufer Enumeration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cayley's formula says that the number of labeled trees on n vertices is
 * n raised to the power n minus two. This module demonstrates why: every
 * labeled tree corresponds to exactly one Prufer sequence of length n minus
 * two over the n labels, so counting sequences counts trees. It enumerates all
 * sequences, decodes each to an edge set, and verifies the decoded trees are
 * distinct.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(n-2) * n) - one decode per Prufer sequence
 *   Space: O(n^(n-2)) for the set of distinct decoded trees
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the number of labeled trees for small values of n.
 *   - The chosen n is YELLOW (comparing); the enumerated n is GREEN (sorted).
 *   - Each frame reveals the current Prufer sequence and its decoded edges.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { n?: number };

function countFormula(n: number): number {
    if (n <= 0) {
        return 0;
    }
    if (n === 1) {
        return 1;
    }
    let result = 1;
    for (let i = 0; i < n - 2; i += 1) {
        result *= n;
    }
    return result;
}

function pruferToEdges(sequence: number[], n: number): string[] {
    const degree = new Array<number>(n).fill(1);
    for (const value of sequence) {
        degree[value] = (degree[value] ?? 0) + 1;
    }
    const leaves: number[] = [];
    for (let i = 0; i < n; i += 1) {
        if (degree[i] === 1) {
            leaves.push(i);
        }
    }
    const edges: string[] = [];
    for (const value of sequence) {
        leaves.sort((a, b) => a - b);
        const leaf = leaves.shift() as number;
        edges.push(`${Math.min(leaf, value)}-${Math.max(leaf, value)}`);
        degree[leaf] = (degree[leaf] ?? 0) - 1;
        degree[value] = (degree[value] ?? 0) - 1;
        if (degree[value] === 1) {
            leaves.push(value);
        }
    }
    const ends = leaves.sort((a, b) => a - b);
    edges.push(`${Math.min(ends[0] as number, ends[1] as number)}-${Math.max(ends[0] as number, ends[1] as number)}`);
    return edges.sort();
}

function makeBars(targetN: number, activeN: number, doneN: number): VisualEntity[] {
    return Array.from({ length: 6 }, (_, index) => {
        const n = index + 1;
        let state: EntityState = "idle";
        if (n === activeN) {
            state = "comparing";
        }
        if (n === doneN) {
            state = "sorted";
        }
        return {
            id: `bar-${n}`,
            type: "bar" as const,
            label: String(countFormula(n)),
            value: countFormula(n),
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, n, count: countFormula(n), target: n === targetN },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const n = Math.min(5, Math.max(1, typeof task.n === "number" ? Math.floor(task.n) : 4));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(n, n, -1),
        edges: [],
        description: `Cayley's formula: counting labeled trees on ${n} vertices by Prufer sequences.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, formulaCount: countFormula(n), phase: "setup" },
    };
    step += 1;

    const length = n === 1 ? 0 : n - 2;
    const alphabet = Array.from({ length: n }, (_, i) => i);
    const distinct = new Set<string>();
    let enumerated = 0;
    let sequence: number[] = new Array<number>(length).fill(0);
    const queued: Array<{ frame: VisualFrame }> = [];

    const emit = (state: "comparing" | "sorted", description: string, codeLine: number): void => {
        // The generator body below yields through the returned frames list.
        queued.push({
            frame: {
                stepNumber: step,
                entities: makeBars(n, state === "comparing" ? n : -1, state === "sorted" ? n : -1),
                edges: [],
                description,
                codeLineNumber: codeLine,
                layout: "array",
                meta: {
                    n,
                    phase: state,
                    sequence: [...sequence],
                    sequenceIndex: enumerated,
                    distinctCount: distinct.size,
                    formulaCount: countFormula(n),
                },
            },
        });
        step += 1;
    };

    if (n === 2) {
        distinct.add("0-1");
        enumerated = 1;
    } else if (n === 1) {
        distinct.add("single-vertex");
        enumerated = 1;
    } else {
        const increment = (): boolean => {
            for (let i = length - 1; i >= 0; i -= 1) {
                const next = (sequence[i] ?? 0) + 1;
                if (next < n) {
                    sequence[i] = next;
                    return true;
                }
                sequence[i] = 0;
            }
            return false;
        };
        let more = true;
        while (more) {
            const edges = pruferToEdges(sequence, n);
            distinct.add(edges.join("|"));
            enumerated += 1;
            emit("comparing", `Sequence ${enumerated}: [${sequence.join(", ")}] decodes to edges ${edges.join(" ")}.`, 3);
            more = increment();
        }
    }

    while (queued.length > 0) {
        const item = queued.shift();
        if (item) {
            yield item.frame;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(n, -1, n),
        edges: [],
        description: `Done: ${enumerated} Prufer sequences gave ${distinct.size} distinct trees; formula says ${countFormula(n)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            n,
            formulaCount: countFormula(n),
            enumerated,
            distinctCount: distinct.size,
            alphabet: [...alphabet],
        },
    };
}

/** The Cayley Tree Count module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A labeled tree on n vertices can be encoded as a short list of n minus two labels called a Prufer sequence, and the encoding is reversible. Since there are n choices for each of those positions, there are n to the power n minus two sequences, and therefore the same number of trees.",
        invariants: [
            "Each Prufer sequence has length n minus two for n at least two.",
            "Decoding a sequence always produces a tree with n minus one edges.",
            "Different sequences decode to different edge sets, so the map is a bijection.",
        ],
        correctness:
            "The Prufer decode removes the smallest leaf, joins it to the next sequence value, and repeats; it is reversible by re-recording the removed leaf at each step. Because every sequence produces exactly one tree and every tree produces exactly one sequence, counting sequences counts trees. Enumerating all sequences and checking that decoded edge sets are distinct confirms the formula for small n.",
        complexityRationale:
            "There are n^(n-2) sequences, each decoded in O(n) time, so enumeration time is O(n^(n-2) * n). Holding every decoded edge set costs O(n^(n-2)) space; the closed-form computation itself is O(n).",
        uses: [
            "Counting spanning trees of a complete graph in network design",
            "Uniformly sampling random labeled trees via random Prufer sequences",
            "Verifying enumeration bounds in combinatorics and graph theory",
        ],
        references: [
            "Cayley, A Theorem on Trees, 1889",
            "Prufer, Neuer Beweis eines Satzes uber Permutationen, 1918",
        ],
        workedExample:
            "For n = 4 the formula gives 4 squared, or 16. The 16 Prufer sequences of length two over labels 0 through 3 decode to 16 different edge sets, one for each labeled tree on four vertices.",
    },
    id: "tree-count-by-cayley",
    name: "Cayley Tree Count",
    category: "tree",
    complexity: { time: "O(n^(n-2) * n)", space: "O(n^(n-2))" },
    defaultInput: { n: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "read the number of labeled vertices n",
        "compute the closed form n raised to n minus two",
        "list every Prufer sequence of length n minus two",
        "decode each sequence into a set of tree edges",
        "insert the edge set into a collection of distinct trees",
        "confirm the collection size equals the closed form",
        "done: report the count and the number of distinct trees",
    ],
};

export default module;
