/**
 * influence-maximization-greedy.ts - Greedy Influence Maximization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Under the independent cascade model, a chosen seed activates its neighbors
 * independently with their edge probabilities, newly active nodes try their
 * own outgoing edges once, and the process stops. The expected number of
 * activated nodes is a monotone submodular function of the seed set, so a
 * greedy pass that repeatedly adds the node with the largest estimated
 * marginal gain achieves at least a 1 - 1/e fraction of the optimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * V^2 * R) for k seeds, V nodes, and R cascade samples
 *   Space: O(V + E) for one sampled cascade
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Chosen seeds are GREEN (sorted); the candidate under test is PINK.
 *   - Nodes activated in the most recent sampled cascade are BLUE.
 *   - Edges that successfully transmitted activation are GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface ImInput {
    graph?: Record<string, Array<[string, number]>>;
    k?: number;
    samples?: number;
    seed?: number;
}

type Rng = () => number;

function makeRng(seed: number): Rng {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function cascade(
    graph: Record<string, Array<[string, number]>>,
    seeds: string[],
    random: Rng,
): { active: Set<string>; usedEdges: Set<string> } {
    const active = new Set<string>(seeds);
    const usedEdges = new Set<string>();
    const queue = [...seeds];
    while (queue.length > 0) {
        const u = queue.shift() as string;
        for (const [v, probability] of graph[u] ?? []) {
            if (!active.has(v) && random() < probability) {
                active.add(v);
                usedEdges.add(`${u}-${v}`);
                queue.push(v);
            }
        }
    }
    return { active, usedEdges };
}

function estimate(
    graph: Record<string, Array<[string, number]>>,
    seeds: string[],
    samples: number,
    rngSeed: number,
): { average: number; last: { active: Set<string>; usedEdges: Set<string> } } {
    const random = makeRng(rngSeed);
    let total = 0;
    let last = { active: new Set<string>(), usedEdges: new Set<string>() };
    for (let i = 0; i < samples; i += 1) {
        last = cascade(graph, seeds, random);
        total += last.active.size;
    }
    return { average: total / samples, last };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ImInput | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [["B", 0.6], ["C", 0.6], ["D", 0.6]],
        B: [["E", 0.4]],
        C: [["F", 0.4]],
        D: [["G", 0.4]],
        E: [],
        F: [],
        G: [],
    };
    const labels = Object.keys(graph);
    const k = Math.max(0, Math.min(labels.length, typeof task.k === "number" ? task.k : 2));
    const samples = Math.max(1, typeof task.samples === "number" ? task.samples : 200);
    const seed = typeof task.seed === "number" ? task.seed : 42;

    const nodes = makeGraphNodes(labels);
    const edges: VisualEdge[] = [];
    for (const [source, neighbors] of Object.entries(graph)) {
        for (const [target, probability] of neighbors) {
            edges.push({
                id: `edge-${source}-${target}`,
                sourceId: `node-${source}`,
                targetId: `node-${target}`,
                label: probability.toFixed(2),
                state: "idle",
                directed: true,
            });
        }
    }

    let step = 0;
    const chosen: string[] = [];

    const frame = (
        description: string,
        codeLineNumber: number,
        candidate: string,
        active: Set<string>,
        usedEdges: Set<string>,
        extra: Record<string, number | string | boolean | string[]> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => {
            const label = node.label;
            let state: EntityState = "unvisited";
            if (chosen.includes(label)) {
                state = "sorted";
            } else if (label === candidate) {
                state = "highlight";
            } else if (active.has(label)) {
                state = "visited";
            }
            return { ...node, state };
        }),
        edges: edges.map((edge) => {
            const source = edge.sourceId.replace("node-", "");
            const target = edge.targetId.replace("node-", "");
            return { ...edge, state: usedEdges.has(`${source}-${target}`) ? "path" : "idle" };
        }),
        description,
        codeLineNumber,
        layout: "graph",
        meta: { k, samples, chosen: [...chosen], candidate, ...extra },
    });

    yield frame(`Greedy influence maximization: choose ${k} seed(s) under ${samples} cascade sample(s) each.`, 0, "", new Set(), new Set());
    step += 1;

    for (let s = 0; s < k; s += 1) {
        let bestNode = "";
        let bestGain = -1;
        let bestSample = { active: new Set<string>(), usedEdges: new Set<string>() };
        for (let index = 0; index < labels.length; index += 1) {
            const candidate = labels[index] as string;
            if (chosen.includes(candidate)) {
                continue;
            }
            const trial = estimate(graph, [...chosen, candidate], samples, seed + s * 1000 + index);
            if (trial.average > bestGain) {
                bestGain = trial.average;
                bestNode = candidate;
                bestSample = trial.last;
            }
            yield frame(
                `Selection ${s + 1}: seeding ${candidate} gives an estimated spread of ${trial.average.toFixed(2)}.`,
                2,
                candidate,
                trial.last.active,
                trial.last.usedEdges,
                { candidateSpread: trial.average, selection: s + 1 },
            );
            step += 1;
        }
        if (!bestNode) {
            break;
        }
        chosen.push(bestNode);
        yield frame(
            `Selected ${bestNode} as seed ${s + 1}; estimated spread ${bestGain.toFixed(2)}.`,
            4,
            bestNode,
            bestSample.active,
            bestSample.usedEdges,
            { selection: s + 1, bestGain },
        );
        step += 1;
    }

    const final = estimate(graph, chosen, samples, seed + 9999);
    yield frame(
        `Chosen seeds ${chosen.join(", ") || "none"} reach about ${final.average.toFixed(2)} node(s) on average.`,
        6,
        "",
        final.last.active,
        final.last.usedEdges,
        { chosen, spread: final.average, done: true },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick the most influential person, then the person who adds the most new reach on top of the first, and so on. Each activation is an independent coin flip on every outgoing edge, so expected spread is estimated by running many random cascades. Because reach is monotone and submodular, this myopic rule provably reaches at least about 63 percent of the best possible seed set.",
        invariants: [
            "Each edge from a newly active node is attempted at most once per cascade.",
            "The expected spread never decreases when a seed is added.",
            "All candidates at a given step are estimated with the same deterministic random stream seed per candidate.",
        ],
        correctness:
            "For monotone submodular functions, the marginal gain of adding an element to a smaller set is at least its gain when added to a larger set. Comparing the greedy choice at each step with the remaining optimal seeds therefore bounds the lost coverage by a factor of 1 - 1/e after k steps. Using common random numbers keeps the comparisons deterministic and lowers estimation noise.",
        complexityRationale:
            "There are k selections and V candidates per selection; each estimate runs R cascades costing O(V + E), giving O(k times V^2 times R) time. A single cascade needs O(V + E) space for the active set and queue.",
        uses: [
            "Choosing influential users for viral marketing campaigns",
            "Selecting initial nodes for information dissemination in networks",
            "Seeding epidemics or contagion models in social-network analysis",
        ],
        references: [
            "Kempe, Kleinberg, and Tardos, Maximizing the Spread of Influence through a Social Network, KDD 2003",
            "Wolsey, An Analysis of the Greedy Algorithm for the Submodular Set Covering Problem, 1982",
        ],
        workedExample:
            "In a star-like network, node A links to B, C and D each with probability 0.6, and each of those links to one leaf with probability 0.4. Seeding A is expected to reach A plus 1.8 immediate neighbors plus 0.72 grandchildren, about 3.5 nodes, far more than seeding B alone at about 1.4, so A is selected first.",
    },
    id: "influence-maximization-greedy",
    name: "Greedy Influence Maximization",
    category: "graph",
    complexity: { time: "O(k * V^2 * R)", space: "O(V + E)" },
    defaultInput: { k: 2, samples: 200, seed: 42 },
    visualType: "graph",
    run,
    pseudocode: [
        "start with an empty seed set",
        "for each of the k seed positions",
        "for each node not yet chosen estimate spread by sampling cascades",
        "choose the node with the largest estimated marginal gain",
        "add it to the seed set",
        "repeat until k seeds are selected",
        "done: report the seed set and its estimated spread",
    ],
};

export default module;
