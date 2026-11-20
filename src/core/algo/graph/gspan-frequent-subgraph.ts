/**
 * gspan-frequent-subgraph.ts - Frequent Connected Subgraph Mining
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Frequent subgraph mining finds connected patterns that occur in at least a
 * given number of graphs in a database. GSpan enumerates connected subgraphs
 * by extending a pattern one edge at a time under a canonical DFS ordering so
 * that each distinct pattern is generated once; support is then the number of
 * database graphs that contain an isomorphic copy. This teaching core uses
 * exhaustive connected edge expansion with a canonical labeling step, which
 * finds the same frequent patterns on small inputs while keeping the code
 * short enough to inspect.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(G * C * k!) for G graphs, C connected subgraphs, pattern size k
 *   Space: O(P) for the distinct pattern keys and their support counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frequent pattern is drawn as a small graph with numbered vertices.
 *   - Its support count is reported in the caption and in `meta.patterns`.
 */
import type { AlgorithmModule, MetaValue, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Edge = [string, string];

interface In {
    graphs?: Edge[][];
    minSupport?: number;
    maxNodes?: number;
}

/** Unique vertex labels of an edge list, in first-seen order. */
function verticesOf(edges: Edge[]): string[] {
    const seen = new Set<string>();
    for (const [a, b] of edges) {
        seen.add(a);
        seen.add(b);
    }
    return [...seen];
}

/** Lexicographically smallest sorted edge list over all vertex relabelings. */
function canonical(vertices: string[], edges: Edge[]): { key: string; labels: string[] } {
    let best = "";
    let bestLabels = [...vertices];
    const permute = (current: string[], remaining: string[]): void => {
        if (remaining.length === 0) {
            const index = new Map(current.map((label, i) => [label, i]));
            const pairs: Array<[number, number]> = [];
            for (const [a, b] of edges) {
                const x = index.get(a);
                const y = index.get(b);
                if (x === undefined || y === undefined || x === y) continue;
                pairs.push(x < y ? [x, y] : [y, x]);
            }
            pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
            const key = pairs.map((p) => `${p[0]}-${p[1]}`).join(";");
            if (best === "" || key < best) {
                best = key;
                bestLabels = [...current];
            }
            return;
        }
        for (let i = 0; i < remaining.length; i += 1) {
            const label = remaining[i] as string;
            permute(
                [...current, label],
                remaining.filter((_, j) => j !== i),
            );
        }
    };
    permute([], vertices);
    return { key: best, labels: bestLabels };
}

/** All distinct connected subgraph keys of one graph, up to maxNodes vertices. */
function patternsOfGraph(edges: Edge[], maxNodes: number): Map<string, string> {
    const found = new Map<string, string>();
    const visited = new Set<string>();
    for (let seed = 0; seed < edges.length; seed += 1) {
        const stack: number[][] = [[seed]];
        while (stack.length > 0) {
            const ids = stack.pop() as number[];
            const marker = ids.join(",");
            if (visited.has(marker)) continue;
            visited.add(marker);
            const sub = ids.map((i) => edges[i]).filter((e): e is Edge => Boolean(e));
            const verts = verticesOf(sub);
            if (verts.length === 0 || verts.length > maxNodes) continue;
            const { key, labels } = canonical(verts, sub);
            if (!found.has(key)) found.set(key, labels.join(","));
            for (let j = 0; j < edges.length; j += 1) {
                if (ids.includes(j)) continue;
                const edge = edges[j];
                if (!edge) continue;
                if (verts.includes(edge[0]) || verts.includes(edge[1])) {
                    stack.push([...ids, j].sort((a, b) => a - b));
                }
            }
        }
    }
    return found;
}

function makePatternEntities(key: string): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodeCount = key === "" ? 0 : new Set(key.split(";").flatMap((p) => p.split("-"))).size;
    const labels = Array.from({ length: nodeCount }, (_, i) => String(i));
    const nodes: VisualEntity[] = labels.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: "sorted" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
    const edges: VisualEdge[] = key === "" ? [] : key.split(";").map((pair, index) => {
        const [a, b] = pair.split("-");
        return {
            id: `edge-${index}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "path" as const,
            directed: false,
        };
    });
    return { nodes, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as In | null) ?? {};
    const graphs = (task.graphs ?? []).map((g) => g.map((e): Edge => [String(e[0]), String(e[1])]));
    const minSupport = typeof task.minSupport === "number" ? Math.max(1, task.minSupport) : 2;
    const maxNodes = typeof task.maxNodes === "number" ? Math.max(1, Math.min(5, task.maxNodes)) : 4;

    const support = new Map<string, number>();
    for (const graph of graphs) {
        const perGraph = patternsOfGraph(graph, maxNodes);
        for (const key of perGraph.keys()) support.set(key, (support.get(key) ?? 0) + 1);
    }
    const frequent = [...support.entries()]
        .filter(([, count]) => count >= minSupport)
        .sort((a, b) => a[0].split(";").length - b[0].split(";").length || a[0].localeCompare(b[0]));

    const frame = (
        stepNumber: number,
        nodes: VisualEntity[],
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
        meta: Record<string, MetaValue>,
    ): VisualFrame => ({
        stepNumber,
        entities: nodes,
        edges,
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    let step = 0;
    if (graphs.length === 0) {
        yield frame(step, [], [], "Empty database - there are no graphs to mine.", 0, { patterns: [], count: 0 });
        return;
    }
    yield frame(
        step,
        [],
        [],
        `Mining ${graphs.length} graph(s) for connected patterns with support at least ${minSupport}.`,
        0,
        { graphs: graphs.length, minSupport, maxNodes },
    );
    step += 1;

    if (frequent.length === 0) {
        yield frame(step, [], [], "No connected pattern reaches the minimum support.", 7, { patterns: [], count: 0 });
        return;
    }

    for (const [key, count] of frequent) {
        const { nodes, edges } = makePatternEntities(key);
        const size = key === "" ? 0 : new Set(key.split(";").flatMap((p) => p.split("-"))).size;
        yield frame(
            step,
            nodes,
            edges,
            `Frequent pattern (${size} vertex/vertices, ${key.split(";").length} edge(s)) appears in ${count} graph(s).`,
            5,
            { key, support: count, vertices: size, edges: key.split(";").length },
        );
        step += 1;
    }

    const patterns: MetaValue[] = frequent.map(([key, count]) => ({
        key,
        support: count,
        size: key === "" ? 0 : new Set(key.split(";").flatMap((p) => p.split("-"))).size,
    }));
    yield frame(
        step,
        [],
        [],
        `Done: found ${frequent.length} frequent connected subgraph pattern(s).`,
        7,
        { patterns, count: frequent.length, minSupport, graphs: graphs.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A frequent subgraph is a small connected shape that recurs across many graphs in a collection. To find them, grow each pattern by adding one adjacent edge at a time, give every shape a canonical name so the same shape is not counted twice, and tally in how many database graphs each shape appears. Shapes meeting the support threshold are the repeated structural motifs.",
        invariants: [
            "Every enumerated pattern is connected and has at most maxNodes vertices.",
            "Canonical labeling gives isomorphic subgraphs the same key, so each shape is counted once per graph.",
            "Support counts graphs containing a shape, not the number of its embeddings.",
        ],
        correctness:
            "Growing from every seed edge by repeatedly adding an incident edge reaches every connected subgraph of the graph: any connected subgraph can be built by adding its edges in an order where each new edge touches the growing component. Canonical labeling maps isomorphic copies to one key, so a graph contributes at most one to each key; summing those contributions counts exactly the graphs that contain the shape, which is the definition of support.",
        complexityRationale:
            "A graph with C connected subgraphs up to size k generates O(C) extensions, and canonicalizing each costs O(k!) over vertex permutations, giving O(G C k!) time across G graphs. The support table stores one entry per distinct pattern key, O(P) space.",
        uses: [
            "Discovering recurring molecular fragments in cheminformatics",
            "Finding common interaction motifs in biological networks",
            "Characterizing frequent call patterns in program analysis",
        ],
        references: [
            "Yan and Han, gSpan: Graph-Based Substructure Pattern Mining, 2002",
            "Kuramochi and Karypis, Frequent Subgraph Discovery, 2001",
        ],
        workedExample:
            "With a minimum support of two over two triangle graphs, the single-edge pattern has support two, the two-edge path has support two, and the triangle has support two. A graph containing only a path would not raise the triangle support, so the triangle would be dropped when support is three.",
    },
    id: "gspan-frequent-subgraph",
    name: "Frequent Subgraph Mining (GSpan-style)",
    category: "graph",
    complexity: { time: "O(G * C * k!)", space: "O(P)" },
    defaultInput: {
        graphs: [
            [["A", "B"], ["B", "C"], ["A", "C"]],
            [["X", "Y"], ["Y", "Z"], ["X", "Z"]],
        ],
        minSupport: 2,
        maxNodes: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "for every graph in the database",
        "grow connected subgraphs by adding one incident edge at a time",
        "stop growing when the vertex limit is reached",
        "canonicalize each subgraph over all vertex relabelings",
        "record one canonical key per distinct shape per graph",
        "tally support as the number of graphs containing each key",
        "keep the keys whose support meets the minimum threshold",
        "done: report every frequent connected subgraph pattern",
    ],
};

export default module;
