/**
 * least-response-time-balancer.ts - Weighted Least-Response-Time Balancing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The weighted response-time policy sends each new request to the server with
 * the smallest predicted response time per unit of weight. A server's current
 * load is its accumulated service time; dividing by its weight lets a faster
 * machine legitimately hold more work. After assigning a request the chosen
 * server's load grows by that request's service time, and the next request is
 * placed afresh. This is the WRT policy used by production load balancers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R * S) for R requests and S servers
 *   Space: O(R + S) for the assignments and the server loads
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are requests and columns are servers.
 *   - The chosen server for the current request is GREEN; candidates are CYAN.
 *   - Final cells show the complete assignment matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Server {
    id: string;
    weight: number;
    latency: number;
}

/** Pick the server with the smallest current load divided by weight. */
function pick(loads: number[], servers: Server[]): number {
    let best = 0;
    let bestRatio = Number.POSITIVE_INFINITY;
    for (let i = 0; i < servers.length; i += 1) {
        const weight = Math.max(1, servers[i]?.weight ?? 1);
        const ratio = (loads[i] ?? 0) / weight;
        if (ratio < bestRatio) {
            bestRatio = ratio;
            best = i;
        }
    }
    return best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { servers?: Server[]; requests?: number[] } | null) ?? {};
    const servers: Server[] = Array.isArray(task.servers) && task.servers.length > 0
        ? task.servers.map((s) => ({
              id: String(s.id ?? "server"),
              weight: Math.max(1, Math.floor(s.weight ?? 1)),
              latency: Math.max(0, Number(s.latency ?? 0)),
          }))
        : [
              { id: "A", weight: 2, latency: 0 },
              { id: "B", weight: 1, latency: 0 },
              { id: "C", weight: 3, latency: 0 },
          ];
    const requests: number[] = Array.isArray(task.requests)
        ? task.requests.map((r) => Math.max(0, Number(r) || 0))
        : [10, 5, 8, 12, 4];

    const loads = servers.map((s) => s.latency);
    const assignments: number[] = [];

    const cells = (currentRequest: number, chosen: number): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let r = 0; r < requests.length; r += 1) {
            for (let s = 0; s < servers.length; s += 1) {
                const assigned = assignments[r] === s;
                let state: EntityState = assigned ? "sorted" : "idle";
                if (r === currentRequest) state = s === chosen ? "path" : "comparing";
                entities.push({
                    id: `cell-${r}-${s}`,
                    type: "cell" as const,
                    label: assigned ? "1" : "0",
                    value: assigned ? 1 : 0,
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: s, request: r, server: s, assigned },
                });
            }
        }
        return entities;
    };

    const commonMeta = {
        rows: requests.length,
        cols: servers.length,
        serverIds: servers.map((s) => s.id),
        weights: servers.map((s) => s.weight),
        requests,
    };

    yield {
        stepNumber: 0,
        entities: cells(-1, -1),
        edges: [],
        description: `Balancing ${requests.length} request(s) across ${servers.length} weighted server(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...commonMeta, phase: "init", loads: [...loads] },
    };
    let step = 1;
    for (let r = 0; r < requests.length; r += 1) {
        const chosen = pick(loads, servers);
        assignments.push(chosen);
        loads[chosen] = (loads[chosen] ?? 0) + (requests[r] ?? 0);
        const chosenServer = servers[chosen];
        const ratio = ((loads[chosen] ?? 0) - (requests[r] ?? 0)) / Math.max(1, chosenServer?.weight ?? 1);
        yield {
            stepNumber: step,
            entities: cells(r, chosen),
            edges: [],
            description: `Request ${r} (${requests[r]} units) goes to ${chosenServer?.id ?? chosen} with ratio ${ratio.toFixed(2)}; its load is now ${loads[chosen]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                ...commonMeta,
                phase: "assign",
                request: r,
                chosen,
                ratio,
                loads: [...loads],
            },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: cells(-1, -1),
        edges: [],
        description: `Assigned all ${requests.length} request(s); final loads [${loads.join(",")}].`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...commonMeta,
            phase: "final",
            assignments,
            assignedIds: assignments.map((i) => servers[i]?.id ?? ""),
            loads: [...loads],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A naive router counts connections, but a slow server and a fast server should not carry the same amount of work. Weighted response-time balancing estimates how long each server would take for a new request by dividing its current load by its weight, then picks the smallest. Because the chosen server's load rises immediately, the policy continuously re-levels the fleet.",
        invariants: [
            "Each server's load is the sum of the service times assigned to it.",
            "At every assignment the chosen server minimizes current load divided by weight.",
            "Ties are resolved by the lowest server index, so the run is deterministic.",
        ],
        correctness:
            "The pick routine examines every server and keeps the strict minimum of load over weight, so by induction the chosen server is optimal for that request under the policy. Adding the request's service time to that server's load is the only state change, which keeps the load invariant. Repeating the argument for each request proves the whole assignment sequence is the WRT schedule.",
        complexityRationale:
            "Each of the R requests scans all S servers once, so total time is O(R * S). Storing the assignment row and the server load vector uses O(R + S) space.",
        uses: [
            "Reverse proxies and application load balancers",
            "HTTP server farms with heterogeneous machine sizes",
            "Distributed task queues with unequal worker capacities",
        ],
        references: [
            "Aweya, Ouellette and Montuno, A View of Web Caching and Load Balancing, 2001",
            "Wikipedia, Load balancing (computing), weighted response time",
        ],
        workedExample:
            "With servers A weight 2, B weight 1, C weight 3 and requests 10, 5, 8, all ratios start at zero, so A is chosen first and its load becomes 10. The next ratios are 5, 0 and 0, so B is chosen (tie broken by index) and reaches load 5. The third request then sees ratios 5, 5 and 0, so it goes to C.",
    },
    id: "least-response-time-balancer",
    name: "Weighted Least-Response-Time Load Balancer",
    category: "production-systems",
    complexity: { time: "O(R * S)", space: "O(R + S)" },
    defaultInput: {
        servers: [
            { id: "A", weight: 2, latency: 0 },
            { id: "B", weight: 1, latency: 0 },
            { id: "C", weight: 3, latency: 0 },
        ],
        requests: [10, 5, 8, 12, 4],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every server's load to its starting latency",
        "for each incoming request with service time t",
        "choose the server minimizing current load divided by weight",
        "break ties by choosing the lowest server index",
        "assign the request to that server",
        "increase the chosen server's load by t",
        "record the assignment in the decision matrix",
        "done: report assignments and final server loads",
    ],
};

export default module;
