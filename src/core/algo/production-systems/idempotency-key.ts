/**
 * idempotency-key.ts - Idempotency Key Deduplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A retryable API uses an idempotency key so that repeating a request does not
 * repeat its side effect. The first request with a key is executed and its
 * result cached. Later requests carrying the same key return the cached result
 * without executing again, which makes the operation safe to retry.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) expected for n requests with hash-map lookups
 *   Space: O(k) for k distinct keys in the result cache
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per request shows its key, result, and action.
 *   - Executed requests are green; deduplicated repeats are blue.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Request {
    key: string;
    value: number;
}

interface Task {
    requests?: Request[];
}

/** Build one cell per request using the decisions made so far. */
function makeCells(
    requests: Request[],
    actions: Array<string | null>,
    results: Array<number | null>,
    current: number,
): VisualEntity[] {
    return requests.map((request, index) => {
        const action = actions[index];
        const result = results[index];
        let state: EntityState = "unvisited";
        if (action === "execute") state = "sorted";
        if (action === "dedup") state = "active";
        if (index === current) state = "comparing";
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${request.key}: ${result === null || result === undefined ? "-" : result}${action ? ` (${action})` : ""}`,
            value: result ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, key: request.key },
        };
    });
}

/** The idempotency-key generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const requests: Request[] = Array.isArray(task.requests) && task.requests.length > 0
        ? task.requests.map((r) => ({ key: String(r?.key ?? ""), value: Number(r?.value ?? 0) }))
        : [
            { key: "order-1", value: 100 },
            { key: "order-2", value: 250 },
            { key: "order-1", value: 100 },
            { key: "order-3", value: 75 },
            { key: "order-2", value: 250 },
        ];
    const cache = new Map<string, number>();
    const actions: Array<string | null> = requests.map(() => null);
    const results: Array<number | null> = requests.map(() => null);

    const summary = () => ({
        rows: 1,
        cols: requests.length,
        executed: actions.filter((a) => a === "execute").length,
        deduped: actions.filter((a) => a === "dedup").length,
        distinctKeys: cache.size,
        actions: actions.map((a) => a ?? ""),
        results: results.map((r) => r ?? 0),
        keys: [...cache.keys()],
    });

    yield {
        stepNumber: 0,
        entities: makeCells(requests, actions, results, -1),
        edges: [],
        description: `Processing ${requests.length} requests with idempotency-key deduplication.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(),
    };
    let step = 1;

    for (let i = 0; i < requests.length; i += 1) {
        const request = requests[i];
        if (request === undefined) continue;
        if (cache.has(request.key)) {
            actions[i] = "dedup";
            results[i] = cache.get(request.key) ?? 0;
        } else {
            actions[i] = "execute";
            results[i] = request.value;
            cache.set(request.key, request.value);
        }
        yield {
            stepNumber: step,
            entities: makeCells(requests, actions, results, i),
            edges: [],
            description: `Request ${i} key ${request.key}: ${actions[i]} with result ${results[i]}.`,
            codeLineNumber: actions[i] === "dedup" ? 4 : 2,
            layout: "grid",
            meta: summary(),
        };
        step += 1;
    }

    const final = summary();
    yield {
        stepNumber: step,
        entities: makeCells(requests, actions, results, requests.length),
        edges: [],
        description: `Done: executed ${final.executed} request(s), deduplicated ${final.deduped} repeat(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: final,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Network retries can deliver the same request more than once. Attaching a unique key lets the server remember the result of the first delivery. When the same key arrives again, the server skips the side effect and hands back the remembered result, so the caller sees exactly one logical operation.",
        invariants: [
            "A key is executed at most once over the whole request stream.",
            "Every repeated key returns exactly the result stored by its first request.",
            "The cache grows only when a previously unseen key appears.",
        ],
        correctness:
            "The generator checks the cache before executing. On a miss it stores the produced result under the key; on a hit it returns the stored value without recomputing. Therefore each distinct key is executed exactly once and all its repeats return the identical cached value, which is precisely the idempotency guarantee.",
        complexityRationale:
            "Each request performs one expected constant-time hash-map lookup and possible insert, so total time is O(n). The cache holds one entry per distinct key, giving O(k) space.",
        uses: [
            "Payment APIs that must not charge twice on retry",
            "Order submission endpoints behind unreliable networks",
            "Any side-effecting HTTP POST that clients may resend",
        ],
        references: [
            "IETF RFC 9110, HTTP Semantics, Section 9.2.2 on idempotency",
            "Stripe API documentation, Idempotent Requests",
        ],
        workedExample:
            "Requests with keys order-1, order-2, order-1, order-3, order-2 execute the first order-1 and order-2, deduplicate their repeats, and execute order-3 once, for three executions and two deduplications.",
    },
    id: "idempotency-key",
    name: "Idempotency Key Deduplication",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(k)" },
    defaultInput: {
        requests: [
            { key: "order-1", value: 100 },
            { key: "order-2", value: 250 },
            { key: "order-1", value: 100 },
            { key: "order-3", value: 75 },
            { key: "order-2", value: 250 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty key to result cache",
        "for each incoming request with a key",
        "if the key is already in the cache",
        "return the cached result without executing",
        "otherwise execute the request and store its result",
        "record whether this request executed or was deduplicated",
        "done: report the executed and deduplicated counts",
    ],
};

export default module;
