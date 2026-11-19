/**
 * de-bruijn-sequence.ts - de Bruijn Sequence Generation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A de Bruijn sequence B(k, n) is a cyclic string of length k^n over an
 * alphabet of k symbols in which every string of length n occurs exactly once
 * as a circular substring. It is built by treating every length-(n-1) string
 * as a vertex and every length-n string as an edge from its prefix to its
 * suffix, then walking an Eulerian cycle of that de Bruijn graph. Reading the
 * edge labels along the cycle produces the sequence.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^n) edges, each visited once
 *   Space: O(k^n) for the edges and the displayed sequence
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Character boxes show the current Eulerian traversal path.
 *   - The final frame shows the complete cyclic de Bruijn sequence.
 *   - Metadata reports the alphabet, order, and edge count.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface DeBruijnInput {
    alphabet?: string;
    order?: number;
}

/** Character boxes for a growing sequence. */
function makeSequenceCharacters(sequence: string): VisualEntity[] {
    return makeCharacters(sequence, "sequence");
}

/** The de Bruijn sequence generator via Hierholzer's Eulerian cycle. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeBruijnInput | null) ?? {};
    const alphabet = Array.from(new Set(
        typeof task.alphabet === "string" && task.alphabet.length > 0 ? task.alphabet : "01",
    ));
    const order = typeof task.order === "number" ? Math.max(1, Math.floor(task.order)) : 3;

    // Vertices are strings of length order - 1; edges extend them by one symbol.
    const vertices: string[] = [""];
    for (let length = 0; length < order - 1; length += 1) {
        const next: string[] = [];
        for (const vertex of vertices) {
            for (const symbol of alphabet) {
                next.push(vertex + symbol);
            }
        }
        vertices.splice(0, vertices.length, ...next);
    }

    interface Edge {
        to: string;
        label: string;
        used: boolean;
    }
    const outgoing = new Map<string, Edge[]>();
    for (const vertex of vertices) {
        outgoing.set(vertex, []);
    }
    for (const vertex of vertices) {
        for (const symbol of alphabet) {
            const to = (vertex + symbol).slice(1);
            if (!outgoing.has(to)) {
                outgoing.set(to, []);
            }
            (outgoing.get(vertex) as Edge[]).push({ to, label: symbol, used: false });
        }
    }

    const expectedCount = Math.pow(alphabet.length, order);
    const start = vertices[0] ?? "";

    yield {
        stepNumber: 0,
        entities: makeSequenceCharacters(""),
        edges: [],
        description:
            `Building B(${alphabet.length}, ${order}): ${vertices.length} vertices, ` +
            `${expectedCount} edges to traverse.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {
            alphabet: alphabet.join(""),
            order,
            sequence: "",
            edgeCount: 0,
            expectedCount,
            vertexCount: vertices.length,
        },
    };

    let step = 1;
    interface Frame {
        vertex: string;
        via: string | null;
    }
    const stack: Frame[] = [{ vertex: start, via: null }];
    const circuitLabels: string[] = [];
    let traversed = 0;

    while (stack.length > 0) {
        const top = stack[stack.length - 1] as Frame;
        const edges = outgoing.get(top.vertex) ?? [];
        const edge = edges.find((candidate) => !candidate.used);
        if (edge) {
            edge.used = true;
            stack.push({ vertex: edge.to, via: edge.label });
            traversed += 1;
            const path = stack.map((frame) => frame.via).filter((label) => label !== null).join("");
            yield {
                stepNumber: step,
                entities: makeSequenceCharacters(path),
                edges: [],
                description: `Traversed edge ${traversed} of ${expectedCount}; current path "${path}".`,
                codeLineNumber: 2,
                layout: "text",
                meta: {
                    alphabet: alphabet.join(""),
                    order,
                    sequence: "",
                    edgeCount: traversed,
                    expectedCount,
                    vertexCount: outgoing.size,
                    path,
                },
            };
            step += 1;
        } else {
            const popped = stack.pop() as Frame;
            if (popped.via !== null) {
                circuitLabels.push(popped.via);
            }
        }
    }

    const sequence = circuitLabels.reverse().join("");
    yield {
        stepNumber: step,
        entities: makeSequenceCharacters(sequence),
        edges: [],
        description:
            `de Bruijn sequence B(${alphabet.length}, ${order}) of length ${sequence.length}: "${sequence}".`,
        codeLineNumber: 5,
        layout: "text",
        meta: {
            alphabet: alphabet.join(""),
            order,
            sequence,
            edgeCount: traversed,
            expectedCount,
            vertexCount: outgoing.size,
            done: true,
        },
    };
}

/** The de Bruijn sequence module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A de Bruijn sequence is the shortest circular string that contains every possible substring of a fixed length. Imagine writing each overlapping window as an edge between its prefix and suffix; following an Eulerian cycle visits each window exactly once. The letters appended along that walk spell the universal sequence.",
        invariants: [
            "Every length-(n-1) string is a vertex and every length-n string is one edge.",
            "Each edge is traversed exactly once by the Eulerian cycle.",
            "The number of edge labels equals k to the power n.",
        ],
        correctness:
            "In the de Bruijn graph each vertex has in-degree and out-degree k, so the graph is balanced and strongly connected and therefore has an Eulerian cycle. Hierholzer's algorithm finds such a cycle by extending a walk until stuck and splicing in side cycles. Consecutive edge labels along the cycle encode each length-n window exactly once because each edge is traversed once, so the emitted cyclic sequence contains every n-length string once, which is the defining property of a de Bruijn sequence.",
        complexityRationale:
            "The graph has k^n edges and k^(n-1) vertices. Hierholzer visits each edge once and does constant work per edge, so both time and space are O(k^n), which is optimal because the output itself has that length.",
        uses: [
            "Generating maximal-length pseudorandom sequences",
            "Constructing universal test sets for DNA sequencing",
            "Designing round-robin tournaments and covering codes",
        ],
        references: [
            "de Bruijn, Combinatorial Problems (Koninklijke Nederlandse Akademie), 1946",
            "Knuth, The Art of Computer Programming, Vol. 4, Fascicle 3",
        ],
        workedExample:
            'For alphabet "01" and order three, the graph has four vertices (00, 01, 10, 11) and eight edges. An Eulerian cycle yields "00010111", whose circular windows are 000, 001, 010, 101, 011, 111, 110, and 100, each appearing exactly once.',
    },
    id: "de-bruijn-sequence",
    name: "de Bruijn Sequence",
    category: "string",
    complexity: { time: "O(k^n)", space: "O(k^n)" },
    defaultInput: { alphabet: "01", order: 3 },
    visualType: "text",
    run,
    pseudocode: [
        "create one vertex for every string of length order minus one",
        "create one edge per length-order string from prefix to suffix",
        "start a Hierholzer walk at any vertex",
        "follow unused edges and push the destination vertex",
        "when stuck, pop and prepend the edge label to the cycle",
        "reverse the collected labels to obtain the Eulerian cycle",
        "done: output the de Bruijn sequence of edge labels",
    ],
};

export default module;
