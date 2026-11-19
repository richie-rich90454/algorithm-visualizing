/**
 * rate-limit-sliding-window.ts - Sliding Window Log Rate Limiter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sliding window log rate limiter stores the timestamps of admitted
 * requests. A new request is admitted only if fewer than the allowed number
 * of timestamps fall in the interval (t - window, t]. Accepted timestamps are
 * appended, denied ones are not, so the decision at every instant depends on
 * exactly the recent traffic and never on fixed clock buckets.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r * a) for r requests and a admitted timestamps
 *   Space: O(a) for the stored timestamps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per request with its timestamp, in-window count, decision.
 *   - Admitted requests are green; denied ones are red in the final frame.
 *   - The final frame reports accepted and denied totals.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    timestamps?: number[];
    window?: number;
    limit?: number;
}

function makeCells(
    timestamps: number[],
    counts: number[],
    decisions: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < timestamps.length; row += 1) {
        const columns = [timestamps[row] ?? 0, counts[row] ?? 0, decisions[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = decisions[row] === 1 ? "sorted" : "error";
            else if (row === current) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(columns[col] ?? 0),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const timestamps = Array.isArray(task.timestamps) && task.timestamps.length > 0
        ? task.timestamps.map(Number)
        : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const window = typeof task.window === "number" && task.window > 0 ? task.window : 4;
    const limit = typeof task.limit === "number" ? Math.max(1, Math.floor(task.limit)) : 3;

    const admitted: number[] = [];
    const counts: number[] = [];
    const decisions: number[] = [];

    const metaBase = { family: "rate-limit-sliding-window", rows: timestamps.length, cols: 3, window, limit };

    yield {
        stepNumber: 0,
        entities: makeCells(timestamps, counts, decisions, -1, false),
        edges: [],
        description: `Sliding window of ${window} time units allowing ${limit} admitted requests.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, timestamps: [...timestamps], counts: [], decisions: [], accepted: 0, denied: 0 },
    };

    let step = 1;
    for (let i = 0; i < timestamps.length; i += 1) {
        const t = timestamps[i] ?? 0;
        const inWindow = admitted.filter((s) => s > t - window && s <= t).length;
        const accept = inWindow < limit;
        counts.push(inWindow);
        decisions.push(accept ? 1 : 0);
        if (accept) admitted.push(t);
        yield {
            stepNumber: step,
            entities: makeCells(timestamps, counts, decisions, i, false),
            edges: [],
            description: `t=${t}: ${inWindow} recent admitted request(s); ${accept ? "admitted" : "denied"}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                ...metaBase,
                timestamps: [...timestamps],
                counts: [...counts],
                decisions: [...decisions],
                current: i,
                accepted: admitted.length,
                denied: decisions.filter((d) => d === 0).length,
            },
        };
        step += 1;
    }

    const accepted = decisions.filter((d) => d === 1).length;
    yield {
        stepNumber: step,
        entities: makeCells(timestamps, counts, decisions, -1, true),
        edges: [],
        description: `Sliding window complete: ${accepted} admitted and ${decisions.length - accepted} denied request(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...metaBase,
            timestamps: [...timestamps],
            counts,
            decisions,
            admitted: [...admitted],
            accepted,
            denied: decisions.length - accepted,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A fixed window counter can let twice the allowed traffic through around a boundary. The sliding window log avoids that by remembering the exact timestamps of admitted requests. A new request looks back one full window and is admitted only if fewer than the limit of those remembered timestamps are still relevant.",
        invariants: [
            "Only admitted timestamps are stored; denied requests never consume quota.",
            "A timestamp is in the window when it is greater than t minus the window and at most t.",
            "The in-window count at an admitted request is strictly below the limit.",
        ],
        correctness:
            "At each request the limiter counts admitted timestamps in the half-open interval (t-window, t], which is exactly the set of requests that should still consume quota. If that count is below the limit the request is admitted and appended; otherwise it is denied. By induction the stored log always equals the set of admitted requests whose timestamps lie in the current window prefix, so no instant ever has more than the limit of admitted requests and the decision sequence is deterministic for a fixed input.",
        complexityRationale:
            "Each request scans the a admitted timestamps to count those in the window, giving O(r*a) time for r requests. Storing the admitted timestamps plus the decision arrays uses O(r) space.",
        uses: [
            "Per-user API quota enforcement without boundary bursts",
            "Protecting login endpoints from credential stuffing",
            "Throttling webhook deliveries to a downstream service",
        ],
        references: [
            "Cloudflare documentation, How rate limiting works",
            "Google Cloud API Gateway documentation, Quota and rate limiting overview",
        ],
        workedExample:
            "With a window of 4 seconds and a limit of 3, requests at times 0, 1, and 2 are admitted. A request at time 3 sees three recent admits and is denied. At time 5 only timestamps 1 and 2 remain in the window, so the request is admitted again.",
    },
    id: "rate-limit-sliding-window",
    name: "Sliding Window Rate Limit",
    category: "production-systems",
    complexity: { time: "O(r * a)", space: "O(r)" },
    defaultInput: { timestamps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], window: 4, limit: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the request timestamps, window, and limit",
        "keep an empty log of admitted timestamps",
        "for each request count admits newer than t minus the window",
        "admit the request when that count is below the limit",
        "append admitted timestamps to the log",
        "record the count and decision for every request",
        "done: report accepted and denied totals",
    ],
};

export default module;
