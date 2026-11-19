/**
 * deepwalk.ts - DeepWalk Random-Walk Graph Embeddings
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DeepWalk learns a low-dimensional vector for every vertex by treating short
 * random walks as sentences and vertices as words. It samples truncated random
 * walks from each start vertex, counts how often vertices co-occur inside a
 * window, and factorizes that co-occurrence matrix to obtain two-dimensional
 * coordinates. Vertices that often share walks end up close together.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(|V| * walks * length * window + |V|^3) for the eigen factorization
 *   Space: O(|V|^2) for the co-occurrence matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their visit count; frequently visited nodes are GREEN.
 *   - Edges on the current random walk are GOLD.
 *   - The final frame reports the two-dimensional embedding coordinates.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit pseudo-random generator so replays are reproducible. */
function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeNodes(labels: string[], visits: Map<string, number>): VisualEntity[] {
    const max = Math.max(1, ...visits.values());
    return labels.map((label) => {
        const v = visits.get(label) ?? 0;
        return {
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: (v > 0 ? (v >= max ? "sorted" : "visited") : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, visits: v },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        graph?: Record<string, string[]>;
        walkLength?: number;
        walksPerNode?: number;
        window?: number;
        seed?: number;
    } | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C", "E"],
        E: ["D"],
    };
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const index = new Map(labels.map((v, i) => [v, i]));
    const walkLength = Math.max(2, Math.min(20, Math.floor(task.walkLength ?? 5)));
    const walksPerNode = Math.max(1, Math.min(10, Math.floor(task.walksPerNode ?? 2)));
    const window = Math.max(1, Math.min(6, Math.floor(task.window ?? 2)));
    const rand = mulberry32(Math.floor(task.seed ?? 7));
    const visits = new Map<string, number>(labels.map((v) => [v, 0]));
    const cooc = labels.map(() => labels.map(() => 0));
    const paths: string[][] = [];
    let step = 0;

    const adjacency = (label: string): string[] => (graph[label] ?? []).filter((n) => index.has(n));

    const emit = (description: string, codeLineNumber: number, path: string[] = [], meta: Record<string, number | string | boolean | Array<number | string>> = {}): VisualFrame => {
        const edges: VisualEdge[] = [];
        for (const [u, vs] of Object.entries(graph)) {
            for (const v of vs) {
                if (!index.has(u) || !index.has(v)) continue;
                const onWalk = path.some((p, i) => i + 1 < path.length && p === u && path[i + 1] === v);
                edges.push({
                    id: `edge-${u}-${v}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: "",
                    state: onWalk ? "active" : "idle",
                    directed: false,
                });
            }
        }
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities: makeNodes(labels, visits),
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { vertices: labels.length, walkLength, walksPerNode, window, ...meta },
        };
    };

    yield emit("DeepWalk samples short random walks and factorizes their co-occurrences.", 0);
    for (const start of labels) {
        for (let w = 0; w < walksPerNode; w += 1) {
            const path: string[] = [start];
            visits.set(start, (visits.get(start) ?? 0) + 1);
            for (let t = 1; t < walkLength; t += 1) {
                const neighbors = adjacency(path[path.length - 1] as string);
                if (neighbors.length === 0) break;
                const next = neighbors[Math.floor(rand() * neighbors.length)] as string;
                path.push(next);
                visits.set(next, (visits.get(next) ?? 0) + 1);
            }
            paths.push(path);
            for (let i = 0; i < path.length; i += 1) {
                for (let j = i + 1; j < Math.min(path.length, i + 1 + window); j += 1) {
                    const a = index.get(path[i] as string) as number;
                    const b = index.get(path[j] as string) as number;
                    if (a === b) continue;
                    cooc[a][b] += 1;
                    cooc[b][a] += 1;
                }
            }
            yield emit(`Walk ${w + 1} from ${start}: ${path.join(" -> ")}.`, 2, path, { path });
        }
    }

    const n = labels.length;
    const power = (matrix: number[][]): number[] => {
        let v = labels.map((_, i) => 1 / Math.sqrt(n) + i * 1e-4);
        for (let it = 0; it < 100; it += 1) {
            const out = matrix.map((row) => row.reduce((acc, val, j) => acc + val * (v[j] as number), 0));
            const norm = Math.sqrt(out.reduce((acc, x) => acc + x * x, 0)) || 1;
            v = out.map((x) => x / norm);
        }
        return v;
    };
    const first = power(cooc);
    const deflated = cooc.map((row, i) => row.map((val, j) => val - (first[i] as number) * (first[j] as number) * n));
    const second = power(deflated);
    const coocPairs = labels
        .flatMap((a, i) => labels.slice(i + 1).map((b, k) => `${a},${b},${cooc[i][i + 1 + k]}`))
        .filter((s) => Number((s as string).split(",")[2]) > 0);
    const embedding = labels.map((label, i) => `${label},${(first[i] as number).toFixed(4)},${(second[i] as number).toFixed(4)}`);

    yield emit(`Co-occurrence edges: ${coocPairs.join(" | ") || "none"}.`, 4, [], { cooc: coocPairs, walks: paths.length });
    yield emit(`Embedding ready for ${labels.length} vertices from ${paths.length} walk(s).`, 5, [], { embedding, walks: paths.length, final: true });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "DeepWalk borrows the word2vec idea for graphs: if two vertices often appear near each other on random walks, they should have similar vectors. It generates many short walks, treats each walk like a sentence, counts window co-occurrences, and factorizes that matrix. The result is a compact embedding that preserves neighborhood structure.",
        invariants: [
            "Every walk moves only along edges of the input graph.",
            "The co-occurrence matrix is symmetric because each window pair is counted in both directions.",
            "With a fixed seed the walk sequence and embedding are fully reproducible.",
        ],
        correctness:
            "Random walks sample the graph's local connectivity: vertices in the same dense region are likely to co-occur often. The co-occurrence matrix records exactly those co-occurrences, and its leading eigenvectors give coordinates that preserve the dominant similarity structure. Because walks follow real edges, an embedding distance reflects genuine graph proximity rather than arbitrary labels.",
        complexityRationale:
            "Sampling costs one step per walk position and O(window) updates per position, so O(|V| * walks * length * window) time. The symmetric eigen factorization via repeated multiplication is O(|V|^3) in the worst case, and the co-occurrence matrix uses O(|V|^2) space.",
        uses: [
            "Node features for link prediction and node classification",
            "Visualization and clustering of large social or citation networks",
            "Initialization for downstream graph neural networks",
        ],
        references: [
            "Perozzi, Al-Rfou, and Skiena, DeepWalk: Online Learning of Social Representations, KDD 2014",
            "Mikolov et al., Efficient Estimation of Word Representations in Vector Space, 2013",
        ],
        workedExample:
            "On a small graph where B and C share neighbors A and D, walks such as A -> B -> C -> D repeatedly place B and C in the same window, giving them a large co-occurrence count and nearby embedding coordinates.",
    },
    id: "deepwalk",
    name: "DeepWalk",
    category: "graph",
    complexity: { time: "O(|V| w l d + |V|^3)", space: "O(|V|^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C", "E"],
            E: ["D"],
        },
        walkLength: 5,
        walksPerNode: 2,
        window: 2,
        seed: 7,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the adjacency list and an empty co-occurrence matrix",
        "for each vertex and for a fixed number of walks",
        "sample a truncated random walk along graph edges",
        "for every pair inside the window, increment their co-occurrence",
        "after all walks, factorize the co-occurrence matrix",
        "use the top two eigenvectors as vertex coordinates",
        "report walks, co-occurrence counts, and coordinates",
        "done: structurally similar vertices lie close together",
    ],
};

export default module;
