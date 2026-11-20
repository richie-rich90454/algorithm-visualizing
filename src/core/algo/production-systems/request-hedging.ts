/**
 * request-hedging.ts - Request Hedging for Tail Latency
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a large service a few slow replicas dominate the tail latency. Request
 * hedging sends a duplicate of a request after a short delay if the original
 * has not responded, then uses whichever reply arrives first and discards the
 * other. The delay is chosen below the tail so the hedge usually helps and
 * rarely adds load. This module computes the winner from deterministic primary
 * and hedge latencies and quantifies the saved time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a fixed number of requests
 *   Space: O(1) for the timeline bars and reported statistics
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the hedge delay, primary completion, hedge completion, and winner.
 *   - The winning bar is highlighted.
 *   - The final frame reports the observed latency and time saved.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HedgeInput {
    primaryLatency?: number;
    hedgeDelay?: number;
    hedgeLatency?: number;
}

/** Build the four timeline bars with the winner highlighted. */
function makeBars(delay: number, primary: number, hedge: number, hedgeSent: boolean, winner: string): VisualEntity[] {
    const rows: Array<[string, number, string]> = [
        ["hedge delay", delay, "delay"],
        ["primary", primary, "primary"],
        ["hedge", hedgeSent ? hedge : 0, "hedge"],
        ["winner", Math.min(primary, hedgeSent ? hedge : primary), winner],
    ];
    return rows.map(([label, value, key], index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${label}: ${value.toFixed(1)} ms`,
        value,
        state: (key === winner ? "sorted" : key === "hedge" && !hedgeSent ? "unvisited" : "comparing") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, key, value },
    }));
}

/** Decide whether hedging is sent and which response wins. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HedgeInput | null) ?? {};
    const primary = Math.max(0, typeof task.primaryLatency === "number" ? task.primaryLatency : 100);
    const delay = Math.max(0, typeof task.hedgeDelay === "number" ? task.hedgeDelay : 50);
    const hedgeLatency = Math.max(0, typeof task.hedgeLatency === "number" ? task.hedgeLatency : 40);
    const hedgeSent = primary > delay;
    const hedgeCompletion = delay + hedgeLatency;
    const winner = !hedgeSent || primary <= hedgeCompletion ? "primary" : "hedge";
    const latency = !hedgeSent ? primary : Math.min(primary, hedgeCompletion);
    const saved = primary - latency;

    yield {
        stepNumber: 0,
        entities: makeBars(delay, primary, hedgeCompletion, hedgeSent, "delay"),
        edges: [],
        description: `Primary latency ${primary} ms, hedge delay ${delay} ms, hedge latency ${hedgeLatency} ms.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { primary, delay, hedgeLatency, hedgeSent, hedgeCompletion, winner, latency, saved },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(delay, primary, hedgeCompletion, hedgeSent, "primary"),
        edges: [],
        description: !hedgeSent
            ? `Primary answered at ${primary} ms before the ${delay} ms hedge delay; no hedge was sent.`
            : `Primary has not answered by ${delay} ms, so a hedge request is sent.`,
        codeLineNumber: hedgeSent ? 3 : 2,
        layout: "array",
        meta: { primary, delay, hedgeLatency, hedgeSent, hedgeCompletion, winner, latency, saved },
    };

    if (!hedgeSent) {
        yield {
            stepNumber: 2,
            entities: makeBars(delay, primary, hedgeCompletion, false, "primary"),
            edges: [],
            description: `No hedge was needed; the client observed ${latency} ms.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { primary, delay, hedgeLatency, hedgeSent, hedgeCompletion, winner, latency, saved },
        };
        return;
    }

    yield {
        stepNumber: 2,
        entities: makeBars(delay, primary, hedgeCompletion, true, "hedge"),
        edges: [],
        description: `Primary would finish at ${primary} ms; the hedge finishes at ${hedgeCompletion} ms.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { primary, delay, hedgeLatency, hedgeSent, hedgeCompletion, winner, latency, saved },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(delay, primary, hedgeCompletion, true, winner),
        edges: [],
        description: winner === "hedge"
            ? `Hedge answered first at ${hedgeCompletion} ms; saved ${saved} ms of tail latency.`
            : `Primary answered first at ${primary} ms; the hedge was canceled.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { primary, delay, hedgeLatency, hedgeSent, hedgeCompletion, winner, latency, saved },
    };
}

/** The request hedging module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Most requests are fast, but a few hit a slow or overloaded replica and dominate the 99th-percentile latency. Hedging sends a second copy after a short delay if the first is still outstanding. Whoever answers first wins and the other is canceled, so a slow replica no longer decides the client's latency as long as the hedge lands on a healthy one.",
        invariants: [
            "A hedge is sent only when the primary has not answered by the delay.",
            "The observed latency is the minimum of the primary and hedge completion times.",
            "Hedging never increases the client-observed latency.",
        ],
        correctness:
            "If the primary finishes before the delay, no hedge is issued and the latency is the primary's. Otherwise the hedge is issued at the delay and completes at delay plus hedge latency; the client takes the earlier of that and the primary's completion, which is exactly the minimum of the two arrival times. Because the minimum is at most the primary's latency, hedging cannot make the response slower, and the saved time equals primary latency minus that minimum.",
        complexityRationale:
            "Only a constant number of comparisons and arithmetic operations are performed, so time is O(1). The four timeline bars and reported fields also take O(1) space.",
        uses: [
            "Reducing tail latency in large fan-out storage systems",
            "Hedged requests in distributed RPC clients",
            "Mitigating stragglers in web search and recommendation serving",
        ],
        references: [
            "Dean and Barroso, The Tail at Scale, Communications of the ACM, 2013",
            "Google SRE Book, Chapter 22 on addressing latency",
        ],
        workedExample:
            "A primary would answer in 100 ms with a hedge delay of 50 ms and a hedge latency of 20 ms. The hedge is sent at 50 ms and completes at 70 ms, beating the primary, so the client observes 70 ms and saves 30 ms. Had the primary answered at 60 ms, no hedge would have been sent at all.",
    },
    id: "request-hedging",
    name: "Request Hedging",
    category: "production-systems",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { primaryLatency: 100, hedgeDelay: 50, hedgeLatency: 20 },
    visualType: "array",
    run,
    pseudocode: [
        "read the primary latency, hedge delay, and hedge latency",
        "wait up to the hedge delay for the primary",
        "if the primary answered then use it and stop",
        "otherwise send a hedge request at the delay",
        "compare the two expected completion times",
        "use the earlier reply and cancel the other",
        "done: report the observed latency and time saved",
    ],
};

export default module;
