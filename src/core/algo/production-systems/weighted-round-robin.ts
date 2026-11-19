/**
 * weighted-round-robin.ts - Smooth Weighted Round Robin Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Smooth weighted round robin spreads requests across servers in proportion
 * to their weights without emitting long runs of the same server. Each round
 * every server's current score grows by its weight; the server with the
 * largest score is chosen and then has the total weight subtracted from it.
 * Over a complete cycle of sum(weights) picks, each server is chosen exactly
 * its weight times, yet the choices stay evenly interleaved.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * r) for n servers and r requests
 *   Space: O(n + r) for the scores and the selection log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per server shows how many requests it has received.
 *   - The chosen server is highlighted after each pick.
 *   - The final frame reports the exact per-server counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    weights?: number[];
    requests?: number;
}

function makeBars(counts: number[], weights: number[], current: number, done: boolean): VisualEntity[] {
    return counts.map((count, index) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (index === current) state = "active";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `server ${index}: weight ${weights[index] ?? 0}, picks ${count}`,
            value: count,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, weight: weights[index] ?? 0, picks: count },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawWeights = Array.isArray(task.weights) ? task.weights.map((v) => Math.max(1, Math.floor(Number(v) || 1))) : [];
    const weights = rawWeights.length > 0 ? rawWeights : [3, 1, 2];
    const requested = typeof task.requests === "number" ? Math.max(1, Math.floor(task.requests)) : 12;
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const scores = weights.map(() => 0);
    const counts = weights.map(() => 0);
    const selected: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(counts, weights, -1, false),
        edges: [],
        description: `Smooth weighted round robin over ${weights.length} servers with total weight ${totalWeight}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { family: "weighted-round-robin", servers: weights.length, weights, totalWeight, requests: requested, counts: [...counts], selected: [], done: false },
    };

    let step = 1;
    for (let request = 0; request < requested; request += 1) {
        let best = 0;
        for (let i = 0; i < weights.length; i += 1) {
            scores[i] = (scores[i] ?? 0) + (weights[i] ?? 0);
            if ((scores[i] ?? 0) > (scores[best] ?? 0)) best = i;
        }
        scores[best] = (scores[best] ?? 0) - totalWeight;
        counts[best] = (counts[best] ?? 0) + 1;
        selected.push(best);
        yield {
            stepNumber: step,
            entities: makeBars(counts, weights, best, false),
            edges: [],
            description: `Request ${request + 1} goes to server ${best}; running picks [${counts.join(", ")}].`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                family: "weighted-round-robin",
                servers: weights.length,
                weights,
                totalWeight,
                requests: requested,
                counts: [...counts],
                selected: [...selected],
                current: best,
                score: Math.max(...scores),
                done: false,
            },
        };
        step += 1;
    }

    const exact = counts.every((count, i) => count * totalWeight === requested * (weights[i] ?? 0));
    yield {
        stepNumber: step,
        entities: makeBars(counts, weights, -1, true),
        edges: [],
        description: exact
            ? `After ${requested} requests the counts [${counts.join(", ")}] match the weights exactly.`
            : `After ${requested} requests the counts [${counts.join(", ")}] are proportional to the weights.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            family: "weighted-round-robin",
            servers: weights.length,
            weights,
            totalWeight,
            requests: requested,
            counts: [...counts],
            selected,
            exact,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain round robin gives every server one turn, which is unfair when servers have different capacities. Smooth weighted round robin lets each server accumulate credit equal to its weight every round and sends the next request to the server with the most credit. Subtracting the total weight after a pick keeps the scores bounded and prevents any server from hogging a long streak.",
        invariants: [
            "Every server's score increases by its weight at the start of each round.",
            "The chosen server's score decreases by the total weight.",
            "Over a whole cycle of sum(weights) picks each server is chosen exactly its weight times.",
        ],
        correctness:
            "Treat the scores modulo the total weight as positions on a circle. Each round advances every server by its weight and picks the largest, which is equivalent to visiting the points at offsets proportional to cumulative weights in sorted order. Over one cycle of total picks, each point is visited exactly its weight times, so the long-run frequency equals the normalized weight. Subtracting the total preserves all scores modulo that total, so the same cyclic order repeats every cycle.",
        complexityRationale:
            "Each of the r requests scans the n servers once to update scores and find the maximum, giving O(n*r) time. Storing the n scores, n counts, and r-element selection log uses O(n + r) space.",
        uses: [
            "Traffic distribution across application servers with mixed capacities",
            "Sharding requests among database replicas of different sizes",
            "Fair task allocation in batch schedulers",
        ],
        references: [
            "Nginx documentation, ngx_http_upstream_module weighted round robin",
            "LVS documentation, Weighted Round-Robin scheduling",
        ],
        workedExample:
            "For servers with weights 3, 1, and 2 the total is 6. Over six requests the smooth schedule picks server 0 three times, server 1 once, and server 2 twice, interleaved as 0, 2, 0, 1, 2, 0 rather than grouping the three picks for server 0 together.",
    },
    id: "weighted-round-robin",
    name: "Weighted Round Robin",
    category: "production-systems",
    complexity: { time: "O(n * r)", space: "O(n + r)" },
    defaultInput: { weights: [3, 1, 2], requests: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read server weights and the number of requests",
        "initialize every server score and pick count to zero",
        "for each request add each weight to its server score",
        "choose the server with the largest score",
        "subtract the total weight from the chosen score",
        "increment that server's pick count and log the choice",
        "done: report the exact per-server pick counts",
    ],
};

export default module;
