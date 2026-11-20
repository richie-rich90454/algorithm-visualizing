/**
 * round-robin-dns.ts - Round-Robin DNS Load Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Round-robin DNS rotates the order of address records returned for a name so
 * successive lookups select different servers. For a static list of k servers,
 * lookup i is answered by server i modulo k. The result is an even spread of
 * requests with no state in the name server beyond a rotating pointer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n lookups, with O(1) work per lookup
 *   Space: O(n) for the assignment log and per-server counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per lookup shows the server chosen for that request.
 *   - The current lookup is CYAN, earlier assignments GREEN.
 *   - meta carries the assignment log and per-server request counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DnsInput {
    servers?: string[];
    requests?: number;
}

function makeCells(servers: string[], assignments: number[], current: number): VisualEntity[] {
    return assignments.map((serverIndex, request) => {
        let state: EntityState = "idle";
        if (request === current) {
            state = "active";
        } else if (assignments[request] !== undefined) {
            state = "sorted";
        }
        return {
            id: `cell-${request}`,
            type: "cell" as const,
            label: `req ${request}: ${servers[serverIndex] ?? ""}`,
            value: serverIndex,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: request, request, server: servers[serverIndex] ?? "" },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DnsInput | null) ?? {};
    const servers = Array.isArray(task.servers) && task.servers.length > 0
        ? task.servers.map((name, index) => String(name || `server-${index + 1}`))
        : ["10.0.0.1", "10.0.0.2", "10.0.0.3"];
    const requests = Math.max(0, Math.min(200, Math.floor(Number(task.requests) || 9)));
    const assignments: number[] = [];
    const counts = servers.map(() => 0);

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Round-robin DNS over ${servers.length} server(s) for ${requests} lookup(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: requests > 0 ? 1 : 0,
            cols: requests,
            servers,
            assignments,
            counts,
        },
    };
    let step = 1;

    for (let request = 0; request < requests; request += 1) {
        const serverIndex = request % servers.length;
        assignments.push(serverIndex);
        counts[serverIndex] = (counts[serverIndex] ?? 0) + 1;
        yield {
            stepNumber: step,
            entities: makeCells(servers, assignments, request),
            edges: [],
            description: `Lookup ${request} is answered by ${servers[serverIndex]} because ${request} mod ${servers.length} = ${serverIndex}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: requests,
                servers,
                assignments: [...assignments],
                counts: [...counts],
                request,
                serverIndex,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(servers, assignments, -1),
        edges: [],
        description: `Assigned ${requests} lookup(s); per-server counts are ${counts.join(", ")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: requests > 0 ? 1 : 0,
            cols: requests,
            servers,
            assignments,
            counts,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A DNS name can have several address records. If the name server rotates which record it lists first, and clients take the first one, then consecutive lookups naturally spread across the servers. It is a stateless form of load balancing: the only thing that changes is a pointer that advances by one after each answer.",
        invariants: [
            "Lookup i is assigned to server i modulo the number of servers.",
            "The rotation pointer advances by exactly one for every lookup.",
            "Any two servers receive counts that differ by at most one after a full rotation.",
        ],
        correctness:
            "Modulo arithmetic maps request i to a unique server in the list, so every lookup has exactly one answer and the sequence repeats every k requests. Over n lookups each server is chosen either floor(n/k) or ceil(n/k) times, which is why counts differ by at most one. The companion test compares the entire assignment log with an independent modulo loop and checks both the fairness bound and that every server is used when there are enough requests.",
        complexityRationale:
            "One modulo operation per lookup gives O(n) time for n requests. Storing the assignments and per-server counts uses O(n + k) space.",
        uses: [
            "Simple stateless load distribution across replicated web servers",
            "Geographic failover when multiple address records are published",
            "A teaching model for rotation-based request distribution",
        ],
        references: [
            "RFC 1035, Domain Names - Implementation and Specification",
            "RFC 1794, DNS Support for Load Balancing",
        ],
        workedExample:
            "With servers 10.0.0.1, 10.0.0.2, and 10.0.0.3, lookups 0 through 8 go to servers 1, 2, 3, 1, 2, 3, 1, 2, 3. After nine lookups each server has handled exactly three requests.",
    },
    id: "round-robin-dns",
    name: "Round-Robin DNS",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n + k)" },
    defaultInput: {
        servers: ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
        requests: 9,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the ordered list of server addresses",
        "set the request counter to zero",
        "assign the current request to server index modulo the number of servers",
        "append the chosen address to the assignment log",
        "increment the server count for that address",
        "advance the request counter by one",
        "repeat until all requests are assigned",
        "done: report the assignments and per-server counts",
    ],
};

export default module;
