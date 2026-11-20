/**
 * single-flight-cache.ts - Single-Flight Cache (Request Coalescing)
 *
 * When many clients ask for the same uncached key at once, a naive cache
 * starts one backend load per request. Single-flight coalescing keeps a table
 * of in-flight loads: the first miss starts a load and every later miss for
 * the same key waits for that load instead of starting another. When the load
 * finishes, the value is stored and every waiter receives it. This is a
 * deterministic discrete-time simulation of the coalescing mechanism used to
 * protect backends from thundering herds.
 *
 * Complexity:
 *   Time:  O(requests + steps) for the event simulation
 *   Space: O(keys + steps) for the cache, in-flight table, and results
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Request {
    key: string;
    step: number;
}

type Outcome = "hit" | "load" | "wait";

function makeCells(cached: string[], inFlight: string[], width: number, current: string | null): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows: Array<[string[], number]> = [[cached, 0], [inFlight, 1]];
    for (const [values, row] of rows) {
        for (let col = 0; col < width; col += 1) {
            const key = values[col];
            const state: EntityState = key === current ? "active" : key === undefined ? "idle" : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: key ?? "·",
                value: key ?? "",
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, region: row === 0 ? "cache" : "inflight" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { requests?: Request[]; loadTime?: number } | null) ?? {};
    const requests: Request[] = Array.isArray(task.requests)
        ? task.requests
        : [
            { key: "a", step: 0 }, { key: "a", step: 0 }, { key: "b", step: 0 },
            { key: "a", step: 1 }, { key: "b", step: 1 }, { key: "a", step: 2 },
          ];
    const loadTime = Math.max(1, typeof task.loadTime === "number" ? task.loadTime : 2);
    const keys = [...new Set(requests.map((request) => request.key))];
    const width = Math.max(1, keys.length);
    const maxStep = Math.max(0, ...requests.map((request) => request.step));
    const cached = new Set<string>();
    const inFlight = new Map<string, number>();
    const outcomes: Outcome[] = [];
    const base = { requests: requests.length, loadTime, keys: keys.length };

    yield {
        stepNumber: 0,
        entities: makeCells([], [], width, null),
        edges: [],
        description: "A cache and an in-flight table decide whether each request loads, waits, or hits.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", loads: 0, waits: 0, hits: 0 },
    };

    let frameIndex = 1;
    for (let time = 0; time <= maxStep; time += 1) {
        for (const [key, finish] of [...inFlight]) {
            if (finish === time) {
                cached.add(key);
                inFlight.delete(key);
            }
        }
        const arrivals = requests.filter((request) => request.step === time);
        for (const request of arrivals) {
            let outcome: Outcome;
            if (cached.has(request.key)) {
                outcome = "hit";
            } else if (inFlight.has(request.key)) {
                outcome = "wait";
            } else {
                inFlight.set(request.key, time + loadTime);
                outcome = "load";
            }
            outcomes.push(outcome);
            yield {
                stepNumber: frameIndex,
                entities: makeCells([...cached], [...inFlight.keys()], width, request.key),
                edges: [],
                description: `Time ${time}: ${request.key} is a ${outcome}; ${inFlight.size} load(s) in flight.`,
                codeLineNumber: outcome === "hit" ? 2 : outcome === "wait" ? 4 : 6,
                layout: "grid",
                meta: {
                    ...base,
                    phase: outcome,
                    time,
                    key: request.key,
                    loads: outcomes.filter((item) => item === "load").length,
                    waits: outcomes.filter((item) => item === "wait").length,
                    hits: outcomes.filter((item) => item === "hit").length,
                    cached: [...cached],
                    inFlight: [...inFlight.keys()],
                },
            };
            frameIndex += 1;
        }
    }
    yield {
        stepNumber: frameIndex,
        entities: makeCells([...cached], [...inFlight.keys()], width, null),
        edges: [],
        description: `${outcomes.filter((item) => item === "load").length} backend load(s), ${outcomes.filter((item) => item === "wait").length} waiter(s), ${outcomes.filter((item) => item === "hit").length} cache hit(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...base,
            phase: "done",
            loads: outcomes.filter((item) => item === "load").length,
            waits: outcomes.filter((item) => item === "wait").length,
            hits: outcomes.filter((item) => item === "hit").length,
            cached: [...cached],
            inFlight: [...inFlight.keys()],
            outcomes,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A thundering herd happens when a popular cached value expires and every client misses at once. Single-flight caching lets the first miss start the backend load and parks the rest as waiters on the same key. When the value arrives it goes into the cache and all waiters are released. The backend sees one request instead of hundreds.",
        invariants: [
            "At most one backend load is in flight for any key.",
            "A request hitting a cached key never starts a load.",
            "A waiter for a key is released when that key's load completes.",
        ],
        correctness:
            "On each arrival the cache is checked first, then the in-flight table. If neither holds the key a single load is registered; if the key is loading the request is counted as a waiter without starting another load. Loads complete at their scheduled time and move the key into the cache. Because these three cases are exhaustive and mutually exclusive, the number of backend loads equals the number of distinct cold misses, and no duplicate load can be created for a key.",
        complexityRationale:
            "The simulation visits each time step and each request once, and the in-flight table gives constant-time membership tests, so it runs in O(requests plus steps) time. The cache, in-flight table, and result list use O(keys plus requests) space.",
        uses: [
            "Protecting databases from cache stampedes",
            "Deduplicating concurrent remote procedure calls",
            "Teaching concurrency control with in-flight registries",
        ],
        references: [
            "Fitzpatrick, Scalable Memcached, 2007",
            "Varnish documentation, grace mode and request coalescing",
        ],
        workedExample:
            "Two requests for key a arrive at time zero. The first starts a load finishing at time two; the second becomes a waiter. A request for a at time one also waits, while a request at time two finds a cached and is a hit. The backend loaded a exactly once.",
    },
    id: "single-flight-cache",
    name: "Single-Flight Cache",
    category: "production-systems",
    complexity: { time: "O(requests + steps)", space: "O(keys + steps)" },
    defaultInput: {
        requests: [
            { key: "a", step: 0 }, { key: "a", step: 0 }, { key: "b", step: 0 },
            { key: "a", step: 1 }, { key: "b", step: 1 }, { key: "a", step: 2 },
        ],
        loadTime: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty cache and in-flight table",
        "at each time step complete loads scheduled for now",
        "for each arriving request check the cache first",
        "if cached count a hit and return the value",
        "if key is loading count a waiter and join it",
        "otherwise start one load and count it",
        "when a load finishes store the value in the cache",
        "done: report load, waiter, and hit counts",
    ],
};

export default module;
