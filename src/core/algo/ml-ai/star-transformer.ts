/**
 * star-transformer.ts - Star-Transformer Relay Aggregation
 *
 * The Star-Transformer replaces full self-attention with a sparse star
 * topology. Nodes sit on a ring and each attends only to itself, its two ring
 * neighbors, and a shared relay node that summarizes the whole sequence. The
 * relay attends to every node. Stacking a few layers still spreads global
 * information while keeping each attention O(1) per node.
 *
 * Time O(layers * n), space O(n) per layer.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface StarInput {
    values: number[];
    relay: number;
    layers: number;
}

export interface StarLayer {
    layer: number;
    nodes: number[];
    relay: number;
}

function softmaxWeighted(query: number, keys: number[]): number {
    const scores = keys.map((k) => query * k);
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return keys.reduce((acc, k, i) => acc + ((exps[i] ?? 0) / sum) * k, 0);
}

/** Run the sparse star aggregation for the given number of layers. */
export function starTransform(input: StarInput): StarLayer[] {
    let nodes = [...input.values];
    let relay = input.relay;
    const n = nodes.length;
    const log: StarLayer[] = [];
    for (let layer = 1; layer <= input.layers; layer += 1) {
        const next = nodes.map((v, i) => {
            const left = nodes[(i - 1 + n) % n] ?? 0;
            const right = nodes[(i + 1) % n] ?? 0;
            return softmaxWeighted(v, [v, left, right, relay]);
        });
        const nextRelay = softmaxWeighted(relay, nodes);
        nodes = next;
        relay = nextRelay;
        log.push({ layer, nodes: [...nodes], relay });
    }
    return log;
}

function makeFrame(log: StarLayer[], upto: number, initialValues: number[]): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const state = upto < 0 ? null : log[upto];
    const values = state?.nodes ?? initialValues;
    const n = values.length || 1;
    const entities: VisualEntity[] = values.map((v, i) => {
        const angle = (2 * Math.PI * i) / n;
        return {
            id: `node-${i}`,
            type: "node" as const,
            label: v.toFixed(2),
            value: v,
            state: "sorted" as EntityState,
            x: Math.cos(angle) * 100,
            y: Math.sin(angle) * 100,
            width: 22,
            height: 22,
            metadata: { index: i },
        };
    });
    entities.push({
        id: "relay",
        type: "node",
        label: (state?.relay ?? 0).toFixed(2),
        value: state?.relay ?? 0,
        state: "active",
        x: 0,
        y: 0,
        width: 26,
        height: 26,
        metadata: { index: -1 },
    });
    const edges: VisualEdge[] = [];
    for (let i = 0; i < n; i += 1) {
        edges.push({
            id: `spoke-${i}`,
            sourceId: `node-${i}`,
            targetId: "relay",
            label: "",
            state: "idle",
            directed: false,
        });
        edges.push({
            id: `ring-${i}`,
            sourceId: `node-${i}`,
            targetId: `node-${(i + 1) % n}`,
            label: "",
            state: "idle",
            directed: false,
        });
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<StarInput> | null) ?? {};
    const values = task.values ?? [1, 0.5, -1, 0.2, 1.5];
    const relay = typeof task.relay === "number" ? task.relay : 0;
    const layers = typeof task.layers === "number" ? Math.max(1, task.layers) : 3;
    const log = starTransform({ values, relay, layers });
    let step = 0;
    const initial = makeFrame(log, -1, values);
    yield {
        stepNumber: step,
        entities: initial.entities,
        edges: initial.edges,
        description: `Star-Transformer with ${values.length} ring nodes and one relay, for ${layers} layer(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { nodes: values.length, layers, values },
    };
    step += 1;
    for (let i = 0; i < log.length; i += 1) {
        const frame = makeFrame(log, i, values);
        yield {
            stepNumber: step,
            entities: frame.entities,
            edges: frame.edges,
            description: `Layer ${log[i]?.layer}: each node mixes self, two neighbors, and the relay; the relay mixes all nodes.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "point",
            meta: { nodes: values.length, layers, current: i, values: log[i]?.nodes ?? [] },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeFrame(log, log.length - 1, values).entities,
        edges: makeFrame(log, log.length - 1, values).edges,
        description: "Done: a few sparse layers spread global information through the relay.",
        codeLineNumber: 6,
        layout: "point",
        meta: { nodes: values.length, layers, values: log[log.length - 1]?.nodes ?? [], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Full self-attention connects every token to every other token, which is expensive for long sequences. The Star-Transformer uses a sparse pattern: tokens sit on a ring and each attends only to itself and its two neighbors, while a single relay node talks to everyone. The relay acts as a highway for global information, so a few layers suffice to propagate context across the sequence.",
        invariants: [
            "A ring node attends to exactly four candidates: itself, two neighbors, and the relay.",
            "The relay attention averages over all ring nodes at the current layer.",
            "Every attention uses softmax weights that sum to one.",
        ],
        correctness:
            "Each node update computes scores as the product of its value with each candidate value, applies a numerically stable softmax, and returns the weighted sum of self, two ring neighbors, and the relay. The relay separately attends to all node values. Because the neighbor index arithmetic wraps around a ring, every node has exactly the prescribed four candidates; independent recomputation of the layer updates reproduces the reported values.",
        complexityRationale:
            "Each of the n nodes attends to four candidates per layer and the relay attends to n, so one layer is O(n) time and O(n) space; L layers take O(L * n).",
        uses: [
            "Efficient language modeling with long sequences",
            "Sparse attention architectures",
            "Sequence encoders with global relay tokens",
        ],
        references: [
            "So, Wang, Liang, et al., The Star-Transformer, NAACL 2019",
            "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
        ],
        workedExample:
            "On a four-node ring with values [1, 0.5, -1, 0.2] and relay 0, the first node attends to itself, nodes two and four, and the relay. Its attention scores are the products of 1 with those values, so the softmax favors the positive-self and fourth-node candidates. After the layer the relay has averaged all four nodes and becomes a global summary for the next layer.",
    },
    id: "star-transformer",
    name: "Star-Transformer",
    category: "ml-ai",
    complexity: { time: "O(layers * n)", space: "O(n)" },
    defaultInput: { values: [1, 0.5, -1, 0.2, 1.5], relay: 0, layers: 3 },
    visualType: "point",
    run,
    pseudocode: [
        "place the nodes on a ring and create one relay node",
        "for each layer",
        "each node attends to self, two neighbors, and the relay",
        "the relay attends to all ring nodes",
        "write the attended values back as the next layer",
        "repeat for the chosen number of layers",
        "done: report the final node and relay values",
    ],
};

export default module;
