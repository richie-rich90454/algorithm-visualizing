/**
 * trustrank.ts - TrustRank Trust Propagation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TrustRank is a personalized ranking used to spot web spam. A small set of
 * hand-picked trustworthy pages seeds a score vector, and scores flow along
 * outgoing links with damping. At every step a fraction beta of the rank is
 * redistributed from the trusted seeds, so pages that are far (in link terms)
 * from any trusted page receive little trust. The iteration converges to the
 * unique stationary distribution of that random walk with teleportation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * E) for k iterations over E directed edges
 *   Space: O(V) for the score vector plus O(V + E) for the graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node's label shows its current trust score.
 *   - The highest-scoring node is GREEN (sorted); seeds are BLUE (path).
 *   - meta carries the score vector, residual, and convergence status.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

interface Task {
    edges?: Array<[string, string]>;
    goodSeeds?: string[];
    beta?: number;
    iterations?: number;
    tolerance?: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawPairs = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : ([
            ["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"],
            ["D", "E"], ["E", "A"], ["F", "A"], ["G", "F"],
        ] as Array<[string, string]>);
    const pairs: Array<[string, string]> = rawPairs
        .filter((p) => Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string")
        .map(([a, b]) => [a, b]);
    const vertices = [...new Set(pairs.flatMap(([a, b]) => [a, b]))].sort();

    const beta = typeof task.beta === "number" && task.beta > 0 && task.beta < 1
        ? task.beta
        : 0.85;
    const maxIterations = Math.min(1000, Math.max(1, Math.floor(Number(task.iterations ?? 200)) || 200));
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-10;

    const requestedSeeds = Array.isArray(task.goodSeeds)
        ? task.goodSeeds.filter((s): s is string => typeof s === "string" && vertices.includes(s))
        : [];
    const seedLabels = requestedSeeds.length > 0 ? [...new Set(requestedSeeds)] : [vertices[0] ?? "A"];
    const seedMass: number[] = vertices.map((v) => (seedLabels.includes(v) ? 1 / seedLabels.length : 0));

    const outbound: Record<string, string[]> = {};
    const inbound: Record<string, string[]> = {};
    for (const v of vertices) {
        outbound[v] = [];
        inbound[v] = [];
    }
    for (const [a, b] of pairs) {
        if (!outbound[a] || !inbound[b]) continue;
        outbound[a]!.push(b);
        inbound[b]!.push(a);
    }

    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(outbound);
    const byId = new Map(nodes.map((node) => [node.id, node]));

    const applyScores = (scores: number[], converged: boolean): void => {
        const leader = scores.indexOf(Math.max(...scores));
        vertices.forEach((label, index) => {
            const node = byId.get(`node-${label}`);
            if (!node) return;
            const value = scores[index] ?? 0;
            node.label = `${label}:${value.toFixed(3)}`;
            node.value = value;
            let state: EntityState = "visited";
            if (index === leader) state = "sorted";
            else if (seedLabels.includes(label)) state = "path";
            node.state = state;
        });
        for (const edge of edges) edge.state = "idle";
    };

    let scores: number[] = seedMass.slice();
    let residual = 0;
    let iterations = 0;
    let converged = false;
    applyScores(scores, false);

    const meta = (phase: string) => ({
        phase,
        labels: vertices,
        scores: [...scores],
        goodSeeds: seedLabels,
        beta,
        iterations,
        residual,
        converged,
        edgeCount: edges.length,
    });

    yield {
        stepNumber: 0,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `TrustRank seeded on ${seedLabels.join(", ")} with damping ${beta.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta("setup"),
    };

    let step = 1;
    while (iterations < maxIterations && !converged) {
        const next: number[] = vertices.map((vertex, index) => {
            let incoming = 0;
            for (const source of inbound[vertex] ?? []) {
                const sources = outbound[source] ?? [];
                if (sources.length === 0) continue;
                incoming += scores[vertices.indexOf(source)]! / sources.length;
            }
            return (1 - beta) * (seedMass[index] ?? 0) + beta * incoming;
        });
        residual = next.reduce((sum, value, index) => sum + Math.abs(value - (scores[index] ?? 0)), 0);
        scores = next;
        iterations += 1;
        converged = residual < tolerance;
        applyScores(scores, converged);

        if (iterations <= 8 || iterations === maxIterations || converged) {
            yield {
                stepNumber: step,
                entities: nodes.map((n) => ({ ...n })),
                edges: edges.map((e) => ({ ...e })),
                description: `Iteration ${iterations}: total change ${residual.toExponential(2)}${converged ? ", converged" : ""}.`,
                codeLineNumber: converged ? 5 : 2,
                layout: "graph",
                meta: meta(converged ? "done" : "iteration"),
            };
            step += 1;
        }
    }

    const leader = scores.indexOf(Math.max(...scores));
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `TrustRank converged after ${iterations} iterations; ${vertices[leader] ?? "?"} has the highest trust.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { ...meta("done"), topVertex: vertices[leader], converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Trust begins only with a few pages known to be trustworthy, then spreads across links like a rumor that loses strength each time it is passed on. A damping term continually re-injects trust at the seed set, so the eventual score of a page reflects how easily a random surfer reaches it from a trusted page. Spam pages that link only to each other stay far from the seeds and receive low scores.",
        invariants: [
            "The score vector stays nonnegative and sums to one at every iteration.",
            "A fraction beta of rank is propagated along links and the remaining fraction is teleported to the trusted seeds.",
            "A page with no outgoing links contributes nothing to its neighbors.",
        ],
        correctness:
            "The update is multiplication by a row-stochastic transition matrix combined with a rank-one teleportation term toward the seed distribution. Because beta is strictly less than one, that affine map is a contraction in the L1 norm, so it has a unique fixed point and power iteration converges to it. The fixed point is exactly the stationary distribution of the random surfer that jumps to a trusted seed with probability one minus beta.",
        complexityRationale:
            "Each iteration scans every directed edge once to accumulate incoming mass and every vertex once to apply damping, costing O(E + V). At most k iterations are performed, so time is O(k * E) and the two score vectors use O(V) space.",
        uses: [
            "Detecting link spam and low-quality web pages in search engines",
            "Personalized page ranking with a trusted starting set",
            "Reputation propagation in social and citation networks",
        ],
        references: [
            "Gyongyi, Garcia-Molina, and Pedersen, Combating Web Spam with TrustRank, VLDB 2004",
            "Page et al., The PageRank Citation Ranking: Bringing Order to the Web, 1999",
        ],
        workedExample:
            "On the link graph A->B, A->C, C->D, D->E, E->A, with A as the only trusted seed and beta 0.85, the first iteration gives A about 0.15 from teleportation plus the incoming mass from E. Pages directly linked from A receive most of the propagated trust, while a page reachable only through a long chain receives progressively less.",
    },
    id: "trustrank",
    name: "TrustRank",
    category: "graph",
    complexity: { time: "O(k * E)", space: "O(V)" },
    defaultInput: {
        edges: [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"], ["E", "A"], ["F", "A"], ["G", "F"]],
        goodSeeds: ["A"],
        beta: 0.85,
        iterations: 200,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build incoming-link lists and outgoing degrees",
        "initialize the seed distribution over trusted vertices",
        "set the score vector to the seed distribution",
        "repeat until the total change is tiny",
        "for each vertex sum trusted mass from its in-neighbors",
        "set the new score to beta times that sum plus teleport mass",
        "measure the total change and replace the score vector",
        "done: report the converged trust scores",
    ],
};

export default module;
