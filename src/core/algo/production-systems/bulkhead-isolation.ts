/**
 * bulkhead-isolation.ts - Bulkhead Resource Pool Isolation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bulkheading partitions a shared resource such as connection pools or thread
 * counts into independent compartments, one per workload. A request is admitted
 * only to its own pool; when that pool is full the request is rejected, but all
 * other pools keep their capacity. This prevents one noisy tenant from
 * exhausting the whole service and causing a cascading failure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r incoming requests
 *   Space: O(p) for p pools and their counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per pool shows used capacity, turning red when saturated.
 *   - Each request updates exactly one pool's bar.
 *   - The final frame reports admitted and rejected counts per pool.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BulkheadInput {
    capacities?: number[];
    requests?: number[];
}

/** Build one bar per pool showing usage and saturation. */
function makeBars(capacities: number[], used: number[]): VisualEntity[] {
    return capacities.map((capacity, index) => {
        const inUse = used[index] ?? 0;
        const saturated = inUse >= capacity;
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `pool ${index}: ${inUse}/${capacity}${saturated ? " saturated" : ""}`,
            value: inUse,
            state: saturated ? ("error" as EntityState) : ("sorted" as EntityState),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, used: inUse, capacity, saturated },
        };
    });
}

/** Route requests through isolated resource pools. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BulkheadInput | null) ?? {};
    const capacities: number[] = (task.capacities ?? [2, 2, 2]).filter((c) => typeof c === "number" && c > 0);
    const requests: number[] = task.requests ?? [0, 0, 0, 1, 2, 0, 1, 2, 1];
    const p = capacities.length;
    const used = new Array<number>(p).fill(0);
    const admitted = new Array<number>(p).fill(0);
    const rejected = new Array<number>(p).fill(0);

    if (p === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No resource pools were defined; requests cannot be routed.",
            codeLineNumber: 0,
            layout: "array",
            meta: { admitted: [], rejected: [], used: [], count: 0 },
        };
        return;
    }

    yield {
        stepNumber: 0,
        entities: makeBars(capacities, used),
        edges: [],
        description: `Routing ${requests.length} requests across ${p} isolated resource pools.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { capacities, admitted: [...admitted], rejected: [...rejected], used: [...used], count: p },
    };
    let step = 1;

    for (let r = 0; r < requests.length; r += 1) {
        const pool = requests[r]!;
        let outcome = "ignored";
        if (pool >= 0 && pool < p) {
            if ((used[pool] ?? 0) < capacities[pool]!) {
                used[pool] = (used[pool] ?? 0) + 1;
                admitted[pool] = (admitted[pool] ?? 0) + 1;
                outcome = "admitted";
            } else {
                rejected[pool] = (rejected[pool] ?? 0) + 1;
                outcome = "rejected";
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(capacities, used),
            edges: [],
            description: `Request ${r} to pool ${pool}: ${outcome}.`,
            codeLineNumber: outcome === "admitted" ? 3 : 4,
            layout: "array",
            meta: { capacities, admitted: [...admitted], rejected: [...rejected], used: [...used], count: p, pool, outcome },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(capacities, used),
        edges: [],
        description: `Across ${p} pools, ${admitted.reduce((a, b) => a + b, 0)} requests were admitted and ${rejected.reduce((a, b) => a + b, 0)} rejected.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { capacities, admitted, rejected, used, count: p },
    };
}

/** The bulkhead isolation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A shared pool of threads or connections lets one slow tenant starve everyone else. Bulkheading splits that pool into fixed compartments, one per workload, so each group can only consume its own allotment. When one compartment is full its callers fail fast, while every other compartment keeps working normally.",
        invariants: [
            "A request changes only the usage counter of its own pool.",
            "A pool never holds more requests than its capacity.",
            "A saturated pool's rejections do not alter any other pool's usage.",
        ],
        correctness:
            "For each request the algorithm checks only the target pool's used count against its capacity and then updates at most that one counter, so by induction every pool's usage equals its admitted count and never exceeds capacity. Because no other counter is touched, saturation in one pool cannot propagate. Rejected requests increment only the rejection counter, giving fast failure without resource consumption.",
        complexityRationale:
            "Each request performs one comparison and one increment, so routing r requests is O(r). The pool counters and bars are linear in the number of pools p, giving O(p) space.",
        uses: [
            "Thread-pool and connection-pool partitioning in application servers",
            "Per-tenant rate and resource limits in shared services",
            "Failure isolation in microservice client libraries",
        ],
        references: [
            "Google SRE Book, Chapter 22 on handling overload",
            "Netflix Hystrix documentation, bulkhead isolation pattern",
        ],
        workedExample:
            "Three pools each hold two connections. Four requests to pool zero fill it, and a fifth is rejected instantly. Requests to pools one and two during that time are still admitted normally, showing that pool zero's saturation did not cascade to the others.",
    },
    id: "bulkhead-isolation",
    name: "Bulkhead Isolation",
    category: "production-systems",
    complexity: { time: "O(r)", space: "O(p)" },
    defaultInput: { capacities: [2, 2, 2], requests: [0, 0, 0, 1, 2, 0, 1, 2, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "read pool capacities and the request stream",
        "initialize each pool's usage and counters to zero",
        "for each request identify its target pool",
        "if that pool has free capacity then admit it",
        "otherwise reject the request immediately",
        "leave every other pool untouched",
        "done: report admitted and rejected per pool",
    ],
};

export default module;
