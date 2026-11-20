/**
 * snowman-consensus.ts - Snowman Consensus (Repeated Subsampling, Exact Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Snowman is a leaderless consensus protocol in the Avalanche family. Each
 * node keeps a preferred color and a confidence counter. In every round it
 * polls a small random-looking sample of peers; if at least alpha of them
 * prefer the same color it shifts its preference and raises its confidence.
 * Once the confidence reaches beta the color is accepted as final. Because a
 * majority color is more likely to appear in every sample, the network
 * converges on that color without a leader.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an EXACT SIMULATION of the confidence update rule with deterministic
 * round-robin sampling instead of cryptography-seeded random sampling. It does
 * not model network messages, adversary behavior, or the directed acyclic
 * ledger built on top of the consensus layer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * n * k) for n nodes polling k peers per round
 *   Space: O(n) for preferences and confidence counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Graph nodes are participants, colored by their current preference.
 *   - A node that just changed preference is active; a decided node is green.
 *   - Edges show the sample polled in the current round.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type SnowmanInput = {
    colors?: number[];
    rounds?: number;
    k?: number;
    alpha?: number;
    beta?: number;
};

function makeNodes(
    preferences: number[],
    confidence: number[],
    beta: number,
    changed: Set<number>,
    decided: Set<number>,
): VisualEntity[] {
    return preferences.map((color, index) => {
        const state: EntityState = decided.has(index)
            ? "sorted"
            : changed.has(index)
              ? "active"
              : confidence[index] !== undefined && (confidence[index] as number) > 0
                ? "visited"
                : "unvisited";
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: `C${color}:${confidence[index] ?? 0}`,
            value: color,
            state,
            x: Math.cos((index * 2 * Math.PI) / preferences.length) * 10,
            y: Math.sin((index * 2 * Math.PI) / preferences.length) * 10,
            width: 0,
            height: 0,
            metadata: { index, color, confidence: confidence[index] ?? 0, decided: decided.has(index), beta },
        };
    });
}

function samplePeers(n: number, node: number, round: number, k: number): number[] {
    const sample: number[] = [];
    let cursor = node + round + 1;
    while (sample.length < Math.min(k, n - 1)) {
        const peer = ((cursor % n) + n) % n;
        if (peer !== node) {
            sample.push(peer);
        }
        cursor += 1;
    }
    return sample;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SnowmanInput | null) ?? {};
    const colors: number[] = Array.isArray(task.colors) ? [...task.colors] : [0, 0, 0, 1, 1];
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.min(12, task.rounds)) : 6;
    const k = typeof task.k === "number" ? Math.max(1, Math.min(colors.length - 1, task.k)) : 3;
    const alpha = typeof task.alpha === "number" ? Math.max(1, Math.min(k, task.alpha)) : 2;
    const beta = typeof task.beta === "number" ? Math.max(1, Math.min(12, task.beta)) : 2;

    const preferences = [...colors];
    const confidence = new Array<number>(colors.length).fill(0);
    const decided = new Set<number>();
    let step = 0;

    const edges: VisualEdge[] = samplePeers(colors.length, 0, 0, k).map((peer, index) => ({
        id: `sample-0-${index}`,
        sourceId: "node-0",
        targetId: `node-${peer}`,
        label: "poll",
        state: "active" as EntityState,
        directed: true,
    }));

    yield {
        stepNumber: step,
        entities: makeNodes(preferences, confidence, beta, new Set(), decided),
        edges,
        description: `Snowman consensus on ${colors.length} nodes with sample size ${k}, alpha ${alpha}, and beta ${beta}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { rounds, k, alpha, beta, decided: 0, preferences: [...preferences], round: 0 },
    };
    step += 1;

    for (let round = 0; round < rounds; round += 1) {
        const changed = new Set<number>();
        const pollEdges: VisualEdge[] = [];
        for (let node = 0; node < colors.length; node += 1) {
            if (decided.has(node)) {
                continue;
            }
            const peers = samplePeers(colors.length, node, round, k);
            peers.forEach((peer, index) => {
                pollEdges.push({
                    id: `poll-${round}-${node}-${index}`,
                    sourceId: `node-${node}`,
                    targetId: `node-${peer}`,
                    label: "poll",
                    state: "comparing" as EntityState,
                    directed: true,
                });
            });
            const counts = new Map<number, number>();
            for (const peer of peers) {
                const color = preferences[peer] as number;
                counts.set(color, (counts.get(color) ?? 0) + 1);
            }
            let winner = preferences[node] as number;
            let winnerCount = 0;
            for (const [color, count] of counts) {
                if (count >= alpha && count > winnerCount) {
                    winner = color;
                    winnerCount = count;
                }
            }
            if (winner !== preferences[node]) {
                preferences[node] = winner;
                confidence[node] = 1;
                changed.add(node);
            } else if (winnerCount > 0) {
                confidence[node] = (confidence[node] ?? 0) + 1;
            }
            if ((confidence[node] ?? 0) >= beta) {
                decided.add(node);
            }
        }

        yield {
            stepNumber: step,
            entities: makeNodes(preferences, confidence, beta, changed, decided),
            edges: pollEdges,
            description: `Round ${round + 1}: sampled ${k} peers per node; ${changed.size} preference change(s), ${decided.size} node(s) decided.`,
            codeLineNumber: decided.size === colors.length ? 5 : 3,
            layout: "graph",
            meta: {
                rounds,
                k,
                alpha,
                beta,
                decided: decided.size,
                preferences: [...preferences],
                confidence: [...confidence],
                round: round + 1,
            },
        };
        step += 1;
        if (decided.size === colors.length) {
            break;
        }
    }

    const distinct = new Set([...decided].map((index) => preferences[index]));
    yield {
        stepNumber: step,
        entities: makeNodes(preferences, confidence, beta, new Set(), decided),
        edges: [],
        description:
            decided.size === colors.length && distinct.size === 1
                ? `Consensus reached: all ${colors.length} nodes decided on color ${[...distinct][0]}.`
                : `Consensus incomplete: ${decided.size} of ${colors.length} nodes decided.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            rounds,
            k,
            alpha,
            beta,
            decided: decided.size,
            preferences: [...preferences],
            confidence: [...confidence],
            agreed: distinct.size === 1,
            finalColor: distinct.size === 1 ? [...distinct][0] : -1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask a few random neighbors what they think instead of asking everybody. If a clear majority of the sample favors one color, adopt it and become a little more confident. Repeating this makes a widely held color spread quickly while tiny minorities die out, and no node needs to be in charge.",
        invariants: [
            "A node raises confidence only when the sampled majority matches its current preference.",
            "A preference change resets confidence to one.",
            "A node is decided only after confidence reaches beta.",
        ],
        correctness:
            "When a color has a strict majority, a sample of size k is more likely to contain that color above alpha than any rival. Nodes holding the majority color keep increasing confidence, while nodes holding a minority color eventually sample a majority and switch. With enough rounds all nodes converge, and quorum-style safety prevents two colors from both becoming final.",
        complexityRationale:
            "Each node polls k peers per round for n nodes, so a round costs O(n*k) and the cap of R rounds costs O(R*n*k). Only the preference and confidence of each node are stored, O(n) space.",
        uses: [
            "Leaderless decision making in avalanche consensus protocols",
            "Fast confirmation of transactions in high-throughput ledgers",
            "Gossip-based agreement in large peer-to-peer networks",
        ],
        references: [
            "Rockett, Abraham, and Gueta, Avalanche Consensus, 2019",
            "Badertscher et al., Snowman Consensus Protocol, 2020",
        ],
        workedExample:
            "Five nodes start as 0,0,0,1,1 with sample size four and alpha three. A node preferring 1 samples 0,0,0,1, sees three votes for 0, switches, and after two confirming rounds decides 0; all nodes end on 0.",
    },
    id: "snowman-consensus",
    name: "Snowman Consensus (Repeated Subsampling)",
    category: "parallel-distributed",
    complexity: { time: "O(rounds*n*k)", space: "O(n)" },
    defaultInput: { colors: [0, 0, 0, 1, 1], rounds: 6, k: 4, alpha: 3, beta: 2 },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize each node's preference and confidence",
        "for each round until all nodes decide",
        "each undecided node polls k random peers",
        "find a color with at least alpha votes in the sample",
        "if that color differs adopt it and reset confidence to one",
        "otherwise increase confidence by one",
        "declare a color final once confidence reaches beta",
        "done: report the agreed color",
    ],
};

export default module;
