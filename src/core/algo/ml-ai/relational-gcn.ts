/**
 * relational-gcn.ts - Relational Graph Convolutional Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A relational graph convolutional network learns a separate weight for each
 * edge type. For every node it transforms features coming along each relation
 * with that relation's weight, sums the messages, adds a self-loop term, and
 * applies a nonlinearity. This lets a knowledge graph model distinguish, for
 * example, a family edge from a business edge at the same node.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E + N * R) for E edges, N nodes and R relation weights
 *   Space: O(N + E) for the hidden features and edge list
 *
 *  ---------------------------------------------------------------------------
 * Visualization mapping
 *  ---------------------------------------------------------------------------
 *   - Nodes are drawn as circles carrying their input and hidden feature.
 *   - Edges carry the relation index and are highlighted while aggregated.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface RelationalInput {
    features?: number[];
    edges?: Array<[number, number, number]>;
    relationWeights?: number[];
    relu?: boolean;
}

type Edge = [number, number, number];

function nodes(features: number[], hidden: number[], active: number): VisualEntity[] {
    return features.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: hidden.length > 0 ? `${value}->${hidden[index]?.toFixed(2) ?? "0"}` : String(value),
        value: value,
        state: (index === active ? "active" : hidden.length > 0 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, feature: value },
    }));
}

function graphEdges(edges: Edge[], active: number): VisualEdge[] {
    return edges.map(([source, target, relation], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${source}`,
        targetId: `node-${target}`,
        label: `r${relation}`,
        state: (index === active ? "active" : "idle") as EntityState,
        directed: true,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RelationalInput | null) ?? {};
    const features: number[] = Array.isArray(task.features) && task.features.length > 0
        ? task.features.slice()
        : [1, 2, 3, 4];
    const edges: Edge[] = Array.isArray(task.edges)
        ? task.edges.filter((edge) => Array.isArray(edge) && edge.length >= 3).map((edge) => [edge[0] ?? 0, edge[1] ?? 0, edge[2] ?? 0] as Edge)
        : [[0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 0, 2]];
    const relationWeights: number[] = Array.isArray(task.relationWeights) && task.relationWeights.length > 0
        ? task.relationWeights.slice()
        : [1, 0.5, -0.5];
    const relu = typeof task.relu === "boolean" ? task.relu : true;
    const n = features.length;

    const messages = new Array<number>(n).fill(0);
    const contributions: Array<{ edge: number; source: number; target: number; relation: number; value: number }> = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes(features, [], -1),
        edges: graphEdges(edges, -1),
        description: `Relational GCN over ${n} nodes, ${edges.length} edges and ${relationWeights.length} relations.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "setup", features, edges, relationWeights, relu, hidden: [], contributions: [], selfTerm: features.slice() },
    };
    step += 1;

    for (let i = 0; i < edges.length; i += 1) {
        const [source, target, relation] = edges[i] ?? [0, 0, 0];
        const weight = relationWeights[relation] ?? 0;
        const value = weight * (features[source] ?? 0);
        if (target >= 0 && target < n) messages[target] = (messages[target] ?? 0) + value;
        contributions.push({ edge: i, source, target, relation, value: Number(value.toFixed(8)) });
        yield {
            stepNumber: step,
            entities: nodes(features, [], target),
            edges: graphEdges(edges, i),
            description: `Edge ${i} sends ${value.toFixed(2)} from node ${source} to node ${target} under relation ${relation}.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { phase: "message", features, edges, relationWeights, relu, hidden: [], contributions: contributions.slice(), selfTerm: features.slice(), activeEdge: i },
        };
        step += 1;
    }

    const withSelf = messages.map((message, i) => message + (relationWeights[0] ?? 0) * (features[i] ?? 0));
    yield {
        stepNumber: step,
        entities: nodes(features, [], -1),
        edges: graphEdges(edges, -1),
        description: "Add the self-loop contribution to each node's aggregated messages.",
        codeLineNumber: 3,
        layout: "graph",
        meta: { phase: "self", features, edges, relationWeights, relu, hidden: [], contributions, selfTerm: withSelf.slice() },
    };
    step += 1;

    const hidden = withSelf.map((value) => (relu ? Math.max(0, value) : value));
    yield {
        stepNumber: step,
        entities: nodes(features, hidden, -1),
        edges: graphEdges(edges, -1),
        description: `Done: hidden features are ${hidden.map((value) => value.toFixed(2)).join(", ")}.`,
        codeLineNumber: relu ? 4 : 5,
        layout: "graph",
        meta: { phase: "done", features, edges, relationWeights, relu, hidden: hidden.map((value) => Number(value.toFixed(8))), contributions, selfTerm: withSelf.map((value) => Number(value.toFixed(8))) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In a knowledge graph an edge can mean many different things, and each meaning should influence a node differently. Relational GCN assigns a learnable weight to every relation type, sends a scaled feature along each edge, sums all messages arriving at a node, and adds a self-loop so the node keeps its own information. The result is a feature that respects both structure and edge semantics.",
        invariants: [
            "Every edge uses the weight of its own relation type.",
            "Messages are summed, not overwritten, at each destination node.",
            "The self-loop term uses relation zero and keeps a node's own feature.",
        ],
        correctness:
            "For a node v the aggregation is the sum over incoming edges of weight of the edge relation times the source feature, plus the self weight times the feature of v. Processing one edge at a time and accumulating into the destination reproduces exactly that sum regardless of edge order, since addition is associative and commutative. Applying a rectified linear unit replaces negative results with zero; the final frame reports the same hidden feature that an independent pass over the edge list computes.",
        complexityRationale:
            "Each of the E edges contributes one multiply and add, and the self term touches N nodes once, giving O(E + N) time. The hidden feature array and the edge list occupy O(N + E) space.",
        uses: [
            "Link prediction and entity classification in knowledge graphs",
            "Representation learning over typed relational data",
            "Graph neural networks with heterogeneous edge types",
        ],
        references: [
            "Schlichtkrull et al., Modeling Relational Data with Graph Convolutional Networks, ESWC 2018",
            "Kipf and Welling, Semi-Supervised Classification with Graph Convolutional Networks, ICLR 2017",
        ],
        workedExample:
            "With features one, two, three, four, self weight one, relation one weight 0.5 and relation two weight negative 0.5, node one receives 0.5 from node zero along relation one; adding its self term of two gives 2.5. Node zero receives negative two from node three along relation two; adding its self term of one gives negative one, which ReLU turns to zero.",
    },
    id: "relational-gcn",
    name: "Relational Graph Convolutional Network",
    category: "ml-ai",
    complexity: { time: "O(E + N * R)", space: "O(N + E)" },
    defaultInput: {
        features: [1, 2, 3, 4],
        edges: [[0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 0, 2]],
        relationWeights: [1, 0.5, -0.5],
        relu: true,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read node features, typed edges and one weight per relation",
        "initialize every node's message accumulator to zero",
        "for each edge multiply the source feature by its relation weight",
        "add the scaled message to the destination accumulator",
        "add the self-loop weight times each node's own feature",
        "apply a rectified linear unit when requested",
        "done: report the hidden feature of every node",
    ],
};

export default module;
