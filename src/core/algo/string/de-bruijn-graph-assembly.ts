/**
 * de-bruijn-graph-assembly.ts - Assembly by de Bruijn Graph Eulerian Path
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Short DNA reads of fixed length k can be assembled by building a de Bruijn
 * graph: each read becomes an edge from its first k-1 symbols to its last k-1
 * symbols. Overlapping reads chain end to end, so reconstructing the original
 * string is the same as finding an Eulerian path that uses every edge exactly
 * once. The path starts at the node whose out-degree exceeds its in-degree,
 * or anywhere when the graph is balanced.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R) for R reads, each edge visited once
 *   Space: O(R) for the nodes, edges, and traversal stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are (k-1)-symbol overlaps; edges are the reads.
 *   - The edge being traversed is highlighted; finished edges turn green.
 *   - Metadata tracks the assembled string and how many reads were used.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface AssemblyInput {
    reads?: string[];
    text?: string;
    k?: number;
}

interface GraphEdge {
    id: string;
    from: number;
    to: number;
    label: string;
    read: string;
    used: boolean;
}

/** Build graph node and edge entities for one frame. */
function makeGraph(
    merLabels: string[],
    edges: GraphEdge[],
    activeEdge: number,
    done: boolean,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = merLabels.map((label, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label,
        value: label,
        state: "unvisited" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: "root", mer: label, index },
    }));
    const result: VisualEdge[] = edges.map((edge, index) => {
        let state: EntityState = "idle";
        if (done || edge.used) {
            state = "sorted";
        } else if (index === activeEdge) {
            state = "active";
        }
        return {
            id: `read-${index}`,
            sourceId: `node-${edge.from}`,
            targetId: `node-${edge.to}`,
            label: edge.read,
            state,
            directed: true,
        };
    });
    return { entities, edges: result };
}

/** The de Bruijn graph assembly generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AssemblyInput | null) ?? {};
    let k = typeof task.k === "number" ? Math.max(2, Math.floor(task.k)) : 3;
    let reads: string[] = [];
    if (Array.isArray(task.reads)) {
        reads = task.reads.filter((read) => typeof read === "string");
        if (reads.length > 0) {
            k = reads[0]?.length ?? k;
        }
        reads = reads.filter((read) => read.length === k);
    } else if (typeof task.text === "string") {
        const text = task.text;
        reads = [];
        for (let i = 0; i + k <= text.length; i += 1) {
            reads.push(text.slice(i, i + k));
        }
    } else {
        const text = "abababa";
        k = 3;
        for (let i = 0; i + k <= text.length; i += 1) {
            reads.push(text.slice(i, i + k));
        }
    }

    const merLabels: string[] = [];
    const merIndex = new Map<string, number>();
    const addMer = (mer: string): number => {
        let index = merIndex.get(mer);
        if (index === undefined) {
            index = merLabels.length;
            merLabels.push(mer);
            merIndex.set(mer, index);
        }
        return index;
    };
    const edges: GraphEdge[] = reads.map((read, index) => ({
        id: `read-${index}`,
        from: addMer(read.slice(0, k - 1)),
        to: addMer(read.slice(1)),
        label: read[k - 1] as string,
        read,
        used: false,
    }));
    const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
    const outDegree = new Map<number, number>();
    const inDegree = new Map<number, number>();
    for (const edge of edges) {
        outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
        inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const graph0 = makeGraph(merLabels, edges, -1, false);
    yield {
        stepNumber: 0,
        entities: graph0.entities,
        edges: graph0.edges,
        description: `De Bruijn graph from ${reads.length} read(s) of length ${k}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {
            reads: reads.length,
            nodes: merLabels.length,
            k,
            assembled: "",
            edgesUsed: 0,
            startMer: "",
        },
    };

    let step = 1;
    if (edges.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No reads to assemble; the assembled string is empty.",
            codeLineNumber: 5,
            layout: "graph",
            meta: { reads: 0, nodes: 0, k, assembled: "", edgesUsed: 0, startMer: "", done: true },
        };
        return;
    }

    let start = 0;
    for (let node = 0; node < merLabels.length; node += 1) {
        if ((outDegree.get(node) ?? 0) === (inDegree.get(node) ?? 0) + 1) {
            start = node;
            break;
        }
    }
    if (!edges.some((edge) => edge.from === start)) {
        start = (edges[0] as GraphEdge).from;
    }
    const startMer = merLabels[start] ?? "";

    interface StackFrame {
        node: number;
        via: string | null;
    }
    const stack: StackFrame[] = [{ node: start, via: null }];
    const circuit: string[] = [];
    let edgesUsed = 0;

    while (stack.length > 0) {
        const top = stack[stack.length - 1] as StackFrame;
        const edge = edges.find((candidate) => candidate.from === top.node && !candidate.used);
        if (edge) {
            edge.used = true;
            edgesUsed += 1;
            stack.push({ node: edge.to, via: edge.id });
            const pathLabels = stack
                .map((frame) => (frame.via === null ? null : edgeById.get(frame.via)?.label ?? ""))
                .filter((label) => label !== "")
                .join("");
            const graph = makeGraph(merLabels, edges, edges.indexOf(edge), false);
            yield {
                stepNumber: step,
                entities: graph.entities,
                edges: graph.edges,
                description: `Traversed read "${edge.read}" (${edgesUsed} of ${reads.length}); walk ends in "${merLabels[edge.to] ?? ""}".`,
                codeLineNumber: 2,
                layout: "graph",
                meta: {
                    reads: reads.length,
                    nodes: merLabels.length,
                    k,
                    assembled: startMer + pathLabels,
                    edgesUsed,
                    startMer,
                },
            };
            step += 1;
        } else {
            const popped = stack.pop() as StackFrame;
            if (popped.via !== null) {
                circuit.push(popped.via);
            }
        }
    }

    const labels = circuit
        .reverse()
        .map((id) => edgeById.get(id)?.label ?? "")
        .join("");
    const assembled = startMer + labels;
    const graphFinal = makeGraph(merLabels, edges, -1, true);
    yield {
        stepNumber: step,
        entities: graphFinal.entities,
        edges: graphFinal.edges,
        description:
            edgesUsed === reads.length
                ? `Assembly complete using all ${reads.length} reads: "${assembled}".`
                : `Assembly used ${edgesUsed} of ${reads.length} reads: "${assembled}".`,
        codeLineNumber: 5,
        layout: "graph",
        meta: {
            reads: reads.length,
            nodes: merLabels.length,
            k,
            assembled,
            edgesUsed,
            startMer,
            done: true,
        },
    };
}

/** The de Bruijn graph assembly module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of aligning reads pairwise, a de Bruijn graph records overlaps directly. Each read of length k is an edge joining its prefix of length k minus one to its suffix of length k minus one. Reads that overlap share a node, so an ordering that uses every edge once reconstructs a string consistent with all reads.",
        invariants: [
            "Every read contributes exactly one directed edge between its two overlapping ends.",
            "An edge's label is the final symbol of its read, appended when the edge is traversed.",
            "A node with out-degree one greater than in-degree, if one exists, must start the path.",
        ],
        correctness:
            "Traversing an edge appends exactly one new symbol to the current string, and the node reached is the suffix of the read just used, which equals the prefix of the next read. Thus consecutive edges overlap correctly and the assembled string has every read as a substring at its edge position. Hierholzer's algorithm uses each edge exactly once in a connected balanced graph (or a graph with the required start and end imbalance), so every read is consumed once and the reconstruction is consistent with the whole read set.",
        complexityRationale:
            "Building the graph hashes each read's two ends once, O(R) time. Hierholzer scans each outgoing edge list once overall, so traversal is also O(R); nodes and edges both number O(R), giving linear space.",
        uses: [
            "Assembling genomes from short sequencing reads",
            "Reconstructing strings from overlapping fragments",
            "A first model of Eulerian methods in bioinformatics",
        ],
        references: [
            "Pevzner, Tang, and Waterman, An Eulerian Path Approach to DNA Fragment Assembly, 2001",
            "Compeau, Pevzner, and Tesler, How to Apply de Bruijn Graphs to Genome Assembly, 2011",
        ],
        workedExample:
            'Reads "aba", "bab", "aba", "bab" with k equal to three give nodes "ab" and "ba". An Eulerian circuit traverses aba, bab, aba, bab from "ab" back to "ab", appending a, b, a, b to obtain "ababab", whose four length-three windows are exactly the input reads.',
    },
    id: "de-bruijn-graph-assembly",
    name: "de Bruijn Graph Assembly",
    category: "string",
    complexity: { time: "O(R)", space: "O(R)" },
    defaultInput: { text: "abababa", k: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "build a node for each distinct read prefix and suffix",
        "add one directed edge per read from prefix to suffix",
        "choose the start node whose out-degree exceeds its in-degree",
        "walk unused edges with a Hierholzer stack",
        "append the final symbol of each traversed read",
        "splice side paths into the circuit when stuck",
        "done: report the assembled string and reads used",
    ],
};

export default module;
