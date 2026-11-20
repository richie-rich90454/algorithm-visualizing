/**
 * locality-aware-load-balancing.ts - Locality-Aware Request Distribution
 *
 * A load balancer that prefers a server which already holds the requested
 * object, provided that server is below its load limit. When no suitable
 * cached server exists it falls back to the least loaded server overall. Each
 * chosen server records the object in a small LRU cache. The policy improves
 * cache hit rates without sending too much traffic to one machine. This is a
 * deterministic teaching model of locality-aware request distribution.
 *
 * Complexity:
 *   Time:  O(servers * cacheSize) per request to find candidates
 *   Space: O(servers * cacheSize) for all server caches
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Request {
    id: string;
    doc: string;
}

interface BalancerState {
    loads: number[];
    caches: string[][];
}

function pickLeast(candidates: number[], loads: number[]): number {
    let best = candidates[0] ?? 0;
    for (const index of candidates) {
        if ((loads[index] ?? 0) < (loads[best] ?? 0)) {
            best = index;
        }
    }
    return best;
}

function assign(state: BalancerState, request: Request, servers: number, capacity: number, cacheSize: number): number {
    const local: number[] = [];
    for (let index = 0; index < servers; index += 1) {
        const cached = state.caches[index] ?? [];
        if (cached.includes(request.doc) && (state.loads[index] ?? 0) < capacity) {
            local.push(index);
        }
    }
    const chosen = local.length > 0
        ? pickLeast(local, state.loads)
        : pickLeast(Array.from({ length: servers }, (_, i) => i), state.loads);
    state.loads[chosen] = (state.loads[chosen] ?? 0) + 1;
    const cache = state.caches[chosen] ?? [];
    state.caches[chosen] = [request.doc, ...cache.filter((doc) => doc !== request.doc)].slice(0, cacheSize);
    return chosen;
}

function makeCells(state: BalancerState, servers: number, cacheSize: number, chosen: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < servers; row += 1) {
        const cache = state.caches[row] ?? [];
        for (let col = 0; col < cacheSize; col += 1) {
            const doc = cache[col];
            const stateName: EntityState = row === chosen ? "active" : doc === undefined ? "idle" : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: doc ?? "-",
                value: doc ?? "",
                state: stateName,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, server: row, load: state.loads[row] ?? 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { servers?: number; capacity?: number; cacheSize?: number; requests?: Request[] } | null) ?? {};
    const servers = Math.max(1, typeof task.servers === "number" ? task.servers : 3);
    const capacity = Math.max(1, typeof task.capacity === "number" ? task.capacity : 4);
    const cacheSize = Math.max(1, typeof task.cacheSize === "number" ? task.cacheSize : 2);
    const requests: Request[] = Array.isArray(task.requests)
        ? task.requests
        : [
            { id: "r1", doc: "A" }, { id: "r2", doc: "B" }, { id: "r3", doc: "A" },
            { id: "r4", doc: "C" }, { id: "r5", doc: "B" }, { id: "r6", doc: "A" },
          ];
    const state: BalancerState = {
        loads: Array.from({ length: servers }, () => 0),
        caches: Array.from({ length: servers }, () => []),
    };
    const base = { servers, capacity, cacheSize, requests: requests.length };

    yield {
        stepNumber: 0,
        entities: makeCells(state, servers, cacheSize, -1),
        edges: [],
        description: "Each server starts with an empty LRU cache and zero active requests.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", loads: state.loads, assignments: [] },
    };
    const assignments: number[] = [];
    for (let i = 0; i < requests.length; i += 1) {
        const request = requests[i];
        if (!request) {
            continue;
        }
        const chosen = assign(state, request, servers, capacity, cacheSize);
        assignments.push(chosen);
        yield {
            stepNumber: i + 1,
            entities: makeCells(state, servers, cacheSize, chosen),
            edges: [],
            description: `Request ${request.id} for ${request.doc} routed to server ${chosen}; loads [${state.loads}].`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                ...base,
                phase: "assign",
                request: request.id,
                doc: request.doc,
                chosen,
                loads: [...state.loads],
                caches: state.caches.map((cache) => [...cache]),
                assignments: [...assignments],
            },
        };
    }
    yield {
        stepNumber: requests.length + 1,
        entities: makeCells(state, servers, cacheSize, -1),
        edges: [],
        description: `Assigned ${requests.length} request(s); final loads [${state.loads}].`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...base, phase: "done", loads: state.loads, caches: state.caches, assignments },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If a server has already cached the file a user wants, sending that request anywhere else wastes the cached copy. A locality-aware balancer checks which servers hold the object and sends the request to the least loaded of them. If none qualify, it sends the request to the least loaded server overall. Over time this concentrates related requests and raises the cache hit rate.",
        invariants: [
            "A server holding the requested object is preferred whenever it is below capacity.",
            "Ties in load are broken by the lowest server index.",
            "Each server cache keeps at most the configured number of recent objects.",
        ],
        correctness:
            "The candidate set is exactly the servers whose cache holds the object and whose load is below the limit. If it is nonempty the least loaded candidate is chosen, otherwise the least loaded of all servers is chosen; scanning in index order with a strict less-than comparison makes ties resolve to the lowest index. Updating the cache by removing the object then inserting it at the front and trimming to the size limit maintains a valid LRU cache, so the policy is deterministic and reproducible.",
        complexityRationale:
            "Finding candidates inspects every server's cache, and each insertion trims a list of bounded size, so a request costs O(servers times cacheSize) time. Storing the loads and caches uses O(servers times cacheSize) space.",
        uses: [
            "Web server farms with local file caches",
            "Content delivery nodes choosing a nearby replica",
            "Teaching the trade-off between load balance and cache locality",
        ],
        references: [
            "Pai, Zdancewic, Narayanan, and Lee, Home-Based Routing, USENIX ATC 1998",
            "Karger and Ruhl, Simple Load Balancing for Distributed Hash Tables, 2003",
        ],
        workedExample:
            "With three servers and capacity four, the first request for A goes to server 0 by the tie rule and caches A there. A later request for A prefers server 0 while it has room. Once server 0 is at capacity, a request for A goes to the least loaded server that can accept it, which may be server 1.",
    },
    id: "locality-aware-load-balancing",
    name: "Locality-Aware Load Balancing",
    category: "production-systems",
    complexity: { time: "O(servers * cacheSize)", space: "O(servers * cacheSize)" },
    defaultInput: {
        servers: 3,
        capacity: 4,
        cacheSize: 2,
        requests: [
            { id: "r1", doc: "A" }, { id: "r2", doc: "B" }, { id: "r3", doc: "A" },
            { id: "r4", doc: "C" }, { id: "r5", doc: "B" }, { id: "r6", doc: "A" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize zero loads and empty caches on every server",
        "for each incoming document request",
        "collect servers that cache it and are below capacity",
        "choose the least loaded candidate, breaking ties by index",
        "if none qualify choose the least loaded server overall",
        "increment its load and move the document to its cache front",
        "evict the oldest cached document when the cache is full",
        "done: report all server assignments",
    ],
};

export default module;
