/**
 * fixed-window-rate-limiter.ts - Fixed Window Rate Limiter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A fixed window limiter divides time into equal-size buckets and keeps one
 * counter per bucket. A request is looked up by the bucket that contains its
 * timestamp: when the counter is below the limit the request is allowed and
 * the counter is incremented, otherwise it is rejected. The counter resets at
 * the next bucket boundary. The scheme is constant time and constant memory
 * per active bucket, at the cost of allowing up to twice the limit across a
 * bucket boundary.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r requests (one modulo and counter update each)
 *   Space: O(w) for the w buckets that have seen traffic
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per request; an allowed request is green, a rejected one red.
 *   - The active request is highlighted and its bucket is shown in meta.
 *   - meta carries the per-bucket counts and the allow/reject totals.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LimiterInput {
    limit?: number;
    windowMs?: number;
    requests?: number[];
}

/** Build one bar per request, coloured by its verdict. */
function makeBars(decisions: boolean[], focus: number): VisualEntity[] {
    return decisions.map((allowed, i) => ({
        id: `req-${i}`,
        type: "bar" as const,
        label: `${i}${allowed ? "+" : "-"}`,
        value: allowed ? 1 : 0,
        state: (i === focus ? "active" : allowed ? "sorted" : "error") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, allowed: allowed ? 1 : 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LimiterInput | null) ?? {};
    const limit = Math.max(1, Math.floor(Number(task.limit ?? 3)) || 3);
    const windowMs = Math.max(1, Math.floor(Number(task.windowMs ?? 1000)) || 1000);
    const requests = Array.isArray(task.requests)
        ? task.requests.map((t) => Math.floor(Number(t) || 0))
        : [50, 120, 400, 800, 1000, 1050, 1900, 2050, 2100, 2150];
    const decisions: boolean[] = [];
    const buckets = new Map<number, number>();
    let allowed = 0;
    let rejected = 0;
    let step = 0;
    const emit = (description: string, codeLine: number, focus: number) => ({
        stepNumber: step++,
        entities: makeBars(decisions, focus),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "array" as const,
        meta: {
            limit,
            windowMs,
            decisions: decisions.map((d) => (d ? 1 : 0)),
            buckets: [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, count]) => [bucket, count]),
            allowed,
            rejected,
        },
    });

    yield emit(`Fixed window limiter: at most ${limit} request(s) per ${windowMs} millisecond bucket.`, 0, -1);

    for (let i = 0; i < requests.length; i += 1) {
        const time = requests[i]!;
        const bucket = Math.floor(time / windowMs);
        const used = buckets.get(bucket) ?? 0;
        const verdict = used < limit;
        if (verdict) {
            buckets.set(bucket, used + 1);
            allowed += 1;
        } else {
            rejected += 1;
        }
        decisions.push(verdict);
        yield emit(
            `Request ${i} at t=${time} falls in bucket ${bucket} (${used}/${limit} used): ${verdict ? "allowed" : "rejected"}.`,
            verdict ? 4 : 6,
            i,
        );
    }

    yield emit(
        `Finished with ${allowed} allowed and ${rejected} rejected request(s) across ${buckets.size} bucket(s).`,
        7,
        -1,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Cut time into fixed-length windows, such as one-second tiles, and give each tile its own counter. A request looks at the tile it lands in and is accepted while that tile still has spare capacity. When the clock crosses into the next tile the counter starts over. It is the simplest possible limiter and needs only a hash map from tile number to count.",
        invariants: [
            "A bucket counter never exceeds the configured limit.",
            "The bucket of a timestamp is floor(timestamp divided by window size).",
            "Each request consults exactly one bucket and changes it only when allowed.",
        ],
        correctness:
            "By construction a request is allowed only when its bucket has recorded fewer than the limit of prior allowed requests, so no bucket ever admits more than the limit. Incrementing occurs only on an allowed request, so the stored count always equals the number of allowed requests in that bucket. Rejected requests leave the bucket untouched, which is why they cannot consume quota. The counter is keyed by bucket number, so traffic from a previous window can never influence a later one.",
        complexityRationale:
            "Each request performs one integer division, one map lookup and at most one increment, so the whole trace is O(r). Only buckets that saw traffic are stored, giving O(w) space for w distinct buckets.",
        uses: [
            "Public REST API request quotas per client",
            "Simple per-tenant throttling in API gateways",
            "Teaching the boundary burst that motivates the sliding window limiter",
        ],
        references: [
            "Cloudflare, How we built rate limiting capable of scaling to millions of domains",
            "Fitzpatrick, Rate limiting algorithms and their trade-offs",
        ],
        workedExample:
            "With a limit of three per 1000 milliseconds, requests at 50, 120 and 400 all land in bucket 0 and are allowed. A request at 800 is rejected because bucket 0 is full. The request at 1000 lands in bucket 1 with a fresh counter and is allowed, showing the classic boundary burst where six requests can pass within a single second.",
    },
    id: "fixed-window-rate-limiter",
    name: "Fixed Window Rate Limiter",
    category: "production-systems",
    complexity: { time: "O(r)", space: "O(w)" },
    defaultInput: {
        limit: 3,
        windowMs: 1000,
        requests: [50, 120, 400, 800, 1000, 1050, 1900, 2050, 2100, 2150],
    },
    visualType: "array",
    run,
    pseudocode: [
        "choose the request limit and the window length in milliseconds",
        "keep a counter for each window the requests touch",
        "for each request compute its window as floor of time over length",
        "read the counter for that window",
        "if the counter is below the limit, allow and increment it",
        "otherwise reject the request without changing the counter",
        "record the verdict for this request",
        "done: report allowed, rejected and the final counters",
    ],
};

export default module;
