/**
 * tree-enumeration.ts - Enumerating Labeled Trees by Prufer Sequences
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cayley's formula says there are n to the power n minus two labeled trees on
 * n vertices. A Prufer sequence of length n minus two is a compact name for
 * each one: decoding repeatedly joins the smallest available leaf to the next
 * sequence entry, then connects the final two leaves. Enumerating every
 * sequence therefore enumerates every labeled tree exactly once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(n-2) * n log n) to decode every sequence
 *   Space: O(n) for one decoded tree plus the displayed entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sampled tree is drawn with the standard tree layout.
 *   - The caption names the Prufer sequence and the decoded edge set.
 *   - Metadata reports the total count, the sample shown, and Cayley's value.
 */

import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

interface EnumerationInput {
    n?: number;
}

/** Decode one Prufer sequence into a canonical edge list. */
function decode(sequence: number[], n: number): Array<[number, number]> {
    const degree = new Array<number>(n).fill(1);
    for (const value of sequence) {
        degree[value] = (degree[value] ?? 0) + 1;
    }
    const available: number[] = [];
    for (let vertex = 0; vertex < n; vertex += 1) {
        if (degree[vertex] === 1) {
            available.push(vertex);
        }
    }
    available.sort((a, b) => a - b);
    const edges: Array<[number, number]> = [];
    for (const value of sequence) {
        const leaf = available.shift() as number;
        const first = Math.min(leaf, value);
        const second = Math.max(leaf, value);
        edges.push([first, second]);
        degree[leaf] = (degree[leaf] as number) - 1;
        degree[value] = (degree[value] as number) - 1;
        if ((degree[value] as number) === 1) {
            available.push(value);
            available.sort((a, b) => a - b);
        }
    }
    const remaining = available.sort((a, b) => a - b);
    if (remaining.length >= 2) {
        edges.push([remaining[0] as number, remaining[1] as number]);
    }
    edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return edges;
}

/** Encode an integer as a fixed-length base-n Prufer sequence. */
function toSequence(code: number, length: number, n: number): number[] {
    const digits = new Array<number>(length).fill(0);
    let value = code;
    for (let i = length - 1; i >= 0; i -= 1) {
        digits[i] = value % n;
        value = Math.floor(value / n);
    }
    return digits;
}

/** Build entities for one decoded tree rooted at vertex zero. */
function treeEntities(n: number, edges: Array<[number, number]>): {
    entities: ReturnType<typeof makeTreeNodes>;
    edgeList: ReturnType<typeof makeTreeEdges>;
} {
    const ids = Array.from({ length: n }, (_, i) => String(i));
    const adjacency = new Map<string, string[]>();
    for (const id of ids) {
        adjacency.set(id, []);
    }
    for (const [a, b] of edges) {
        adjacency.get(String(a))?.push(String(b));
        adjacency.get(String(b))?.push(String(a));
    }
    const parentMap = new Map<string, string | null>();
    const root = ids[0] ?? "0";
    const visited = new Set<string>([root]);
    const queue = [root];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const neighbor of adjacency.get(current) ?? []) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                parentMap.set(neighbor, current);
                queue.push(neighbor);
            }
        }
    }
    for (const id of ids) {
        if (!parentMap.has(id)) {
            parentMap.set(id, null);
        }
    }
    return { entities: makeTreeNodes(parentMap, ids), edgeList: makeTreeEdges(parentMap, ids) };
}

/** The tree enumeration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EnumerationInput | null) ?? {};
    const n = Math.min(6, Math.max(1, typeof task.n === "number" ? Math.floor(task.n) : 4));
    const length = n - 2;
    const total = n === 1 ? 1 : Math.pow(n, length);
    const maxFrames = 30;
    const seen = new Set<string>();

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Enumerating labeled trees on ${n} vertices via Prufer sequences.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { n, total, shown: 0, cayley: total, complete: false },
    };

    let step = 1;
    let shown = 0;
    for (let code = 0; code < total; code += 1) {
        const sequence = length <= 0 ? [] : toSequence(code, length, n);
        const edges = decode(sequence, n);
        const signature = edges.map(([a, b]) => `${a}-${b}`).join("|");
        seen.add(signature);
        if (shown >= maxFrames) {
            continue;
        }
        const tree = treeEntities(n, edges);
        const edgeText = edges.map(([a, b]) => `${a}-${b}`).join(", ");
        yield {
            stepNumber: step,
            entities: tree.entities.map((entity) => ({ ...entity, state: "sorted" as const })),
            edges: tree.edgeList.map((edge) => ({ ...edge, state: "path" as const })),
            description:
                `Tree ${code + 1} of ${total}: Prufer [${sequence.join(", ")}] gives edges ${edgeText}.`,
            codeLineNumber: code + 1 === total ? 5 : 3,
            layout: "tree",
            meta: {
                n,
                total,
                shown: shown + 1,
                cayley: total,
                sequence,
                edgeCount: edges.length,
                complete: false,
            },
        };
        shown += 1;
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description:
            `Enumerated ${total} distinct labeled tree(s) on ${n} vertices; showed ${shown}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { n, total, shown, cayley: total, distinct: seen.size, complete: seen.size === total },
    };
}

/** The tree enumeration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Cayley's formula gives the number of labeled trees but not their shapes. Prufer sequences make the count constructive: every sequence of length n minus two names exactly one tree. Decoding joins the smallest available leaf to each sequence value in turn and finally connects the last two leaves, so walking through all sequences walks through all trees.",
        invariants: [
            "A Prufer sequence has length n minus two over labels zero through n minus one.",
            "A vertex appears in the sequence exactly as many times as its degree minus one.",
            "Each decoded edge list has n minus one edges and connects all n vertices.",
        ],
        correctness:
            "The decoding step always joins the smallest leaf to the next sequence value, which is the unique inverse of the Prufer encoding procedure. Because encoding and decoding are inverses, different sequences produce different trees and every labeled tree has exactly one sequence. The number of sequences of length n minus two over n symbols is n to the power n minus two, matching Cayley's formula, so the enumeration is both complete and duplicate free.",
        complexityRationale:
            "There are n to the power n minus two sequences. Decoding one keeps a sorted leaf list and performs n steps, costing O(n log n), so total time is O(n to the power n minus two times n log n). Only one decoded tree and its leaf list are held at a time, giving O(n) working space apart from the displayed frames.",
        uses: [
            "Generating all topologies for small phylogenetic analyses",
            "Exhaustive testing of tree algorithms on every labeled shape",
            "A constructive proof of Cayley's formula",
        ],
        references: [
            "Cayley, A Theorem on Trees, 1889",
            "Prufer, Neuer Beweis eines Satzes uber Permutationen, 1918",
        ],
        workedExample:
            "On four vertices a Prufer sequence has length two. The sequence zero, zero decodes by joining leaf one to vertex zero, then leaf two to vertex zero, and finally connecting the remaining leaves zero and three, giving the star centered at zero. Walking all sixteen sequences yields all sixteen labeled trees, matching Cayley's formula four to the power two.",
    },
    id: "tree-enumeration",
    name: "Tree Enumeration",
    category: "tree",
    complexity: { time: "O(n^(n-2) * n log n)", space: "O(n)" },
    defaultInput: { n: 4 },
    visualType: "tree",
    run,
    pseudocode: [
        "let the Prufer length be n minus two",
        "for every base-n code of that length",
        "convert the code to a Prufer sequence",
        "compute each vertex degree from its appearances",
        "repeatedly join the smallest leaf to the next value",
        "connect the two leaves left at the end",
        "done: report all distinct labeled trees and their count",
    ],
};

export default module;
