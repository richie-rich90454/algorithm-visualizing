/**
 * graph-attention-network.ts - Graph Attention Network (GAT) Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A GAT layer learns how much each neighbor should contribute to a node's new
 * feature. It scores every edge with a small leaky linear function, normalizes
 * the scores across each neighborhood with softmax, and forms a weighted sum of
 * transformed neighbor features. Attention lets a node ignore unhelpful
 * neighbors instead of averaging all of them equally.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for a dense graph with n nodes
 *   Space: O(n^2) for the attention weight matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their updated feature; edges are labeled with attention
 *     weights, brighter for larger weights.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

type Matrix = number[][];

interface Input {
    adjacency?: Matrix;
    features?: number[];
    weight?: number;
    aSelf?: number;
    aNeighbor?: number;
    leaky?: number;
}

function nodes(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((v, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: v.toFixed(3),
        value: v,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, feature: v },
    }));
}

function softmax(values: number[]): number[] {
    const max = values.length > 0 ? Math.max(...values) : 0;
    const exps = values.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, v) => a + v, 0);
    return exps.map((v) => (sum === 0 ? 0 : v / sum));
}

function rows(m: Matrix): string[] {
    return m.map((row) => row.join(","));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const adjacency: Matrix = task.adjacency ?? [
        [0, 1, 0, 0],
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [0, 0, 1, 0],
    ];
    const features = (task.features ?? [1, 2, 1, 0]).slice();
    const weight = typeof task.weight === "number" ? task.weight : 1;
    const aSelf = typeof task.aSelf === "number" ? task.aSelf : 0.5;
    const aNeighbor = typeof task.aNeighbor === "number" ? task.aNeighbor : 0.5;
    const leaky = typeof task.leaky === "number" ? task.leaky : 0.2;
    const n = adjacency.length;
    const at = (a: number[], i: number): number => a[i] ?? 0;

    const alphas: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const scores: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        const neighbors: number[] = [i];
        for (let j = 0; j < n; j += 1) {
            if (j !== i && (adjacency[i]?.[j] ?? 0) > 0) neighbors.push(j);
        }
        const raw = neighbors.map((j) => {
            const s = aSelf * weight * at(features, i) + aNeighbor * weight * at(features, j);
            return s >= 0 ? s : leaky * s;
        });
        const norm = softmax(raw);
        neighbors.forEach((j, k) => {
            scores[i] = scores[i] ?? [];
            alphas[i] = alphas[i] ?? [];
            (scores[i] as number[])[j] = raw[k] ?? 0;
            (alphas[i] as number[])[j] = norm[k] ?? 0;
        });
    }
    const outputs = features.map((_, i) => {
        let sum = 0;
        for (let j = 0; j < n; j += 1) sum += (alphas[i]?.[j] ?? 0) * weight * at(features, j);
        return Math.max(0, sum);
    });
    const edges = (): VisualEdge[] => {
        const list: VisualEdge[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                if (i !== j && (adjacency[i]?.[j] ?? 0) > 0) {
                    const a = alphas[i]?.[j] ?? 0;
                    list.push({
                        id: `edge-${i}-${j}`,
                        sourceId: `node-${i}`,
                        targetId: `node-${j}`,
                        label: a.toFixed(2),
                        state: a >= 0.5 ? "active" : "idle",
                        directed: true,
                    });
                }
            }
        }
        return list;
    };
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(n).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: nodes(features, state("idle")),
        edges: edges(),
        description: `One GAT layer over ${n} nodes with leaky slope ${leaky}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { n, features },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(features, state("comparing")),
        edges: edges(),
        description: "Gather each node's neighborhood including its own feature.",
        codeLineNumber: 1,
        layout: "graph",
        meta: { n, features },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(features, state("active")),
        edges: edges(),
        description: "Score every neighbor pair with a leaky linear attention function.",
        codeLineNumber: 2,
        layout: "graph",
        meta: { n, scores: rows(scores) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(outputs, state("sorted")),
        edges: edges(),
        description: "Normalize scores with softmax and form the attention-weighted neighbor sum.",
        codeLineNumber: 4,
        layout: "graph",
        meta: { n, alphas: rows(alphas), outputs, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Not every neighbor is equally useful. Graph attention assigns each edge a learnable score, turns those scores into weights that sum to one across a neighborhood, and computes each node's new feature as a weighted average of its neighbors. A node can therefore amplify informative neighbors and suppress misleading ones, which a plain graph convolution cannot do.",
        invariants: [
            "For every node, attention weights over its neighborhood sum to one.",
            "Self-attention is always present because a node includes itself as a neighbor.",
            "ReLU keeps final embeddings nonnegative.",
        ],
        correctness:
            "The leaky linear scorer is a deterministic function of the two endpoint features, and softmax over the neighborhood produces a valid probability distribution over neighbors. The output is the expectation of the transformed neighbor features under that distribution, which is a permutation-equivariant aggregation: relabeling nodes merely relabels outputs. Multi-head attention simply runs this computation independently and concatenates results.",
        complexityRationale:
            "Scoring and normalizing every ordered node pair costs O(n squared) time on a dense graph, and storing the score and attention matrices uses O(n squared) space. On sparse graphs the cost is proportional to the number of edges instead.",
        uses: [
            "Semi-supervised node classification with varying neighbor relevance",
            "Graph representation learning in social and citation networks",
            "Attention-based molecular and protein structure models",
        ],
        references: [
            "Velickovic et al., Graph Attention Networks, ICLR 2018",
            "Bahdanau, Cho, and Bengio, Neural Machine Translation by Jointly Learning to Align and Translate, ICLR 2015",
        ],
        workedExample:
            "A node with feature 2 has neighbors with features 1 and 3. The attention scorer gives the closer neighbor a higher raw score; softmax turns the scores into weights such as 0.4 and 0.6. The new feature is 0.4 times 1 plus 0.6 times 3, which equals 2.2 before ReLU.",
    },
    id: "graph-attention-network",
    name: "Graph Attention Network",
    category: "ml-ai",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: {
        adjacency: [
            [0, 1, 0, 0],
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
        ],
        features: [1, 2, 1, 0],
        weight: 1,
        aSelf: 0.5,
        aNeighbor: 0.5,
        leaky: 0.2,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the adjacency, node features, weight, and attention vector",
        "for each node gather its neighbors together with itself",
        "score every neighbor pair with a leaky linear function",
        "normalize the scores into weights with softmax",
        "sum transformed neighbor features weighted by attention",
        "apply ReLU to produce the final embedding",
        "done: emit attention weights and node embeddings",
    ],
};

export default module;
