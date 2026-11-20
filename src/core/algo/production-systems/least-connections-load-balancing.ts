/**
 * least-connections-load-balancing.ts - Least-Connections Load Balancing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A least-connections balancer assigns each incoming request to the backend
 * with the fewest active connections. With weights, it compares active
 * connections divided by weight so a stronger backend absorbs more traffic.
 * Ties are broken by least recent selection, which gives round-robin behavior
 * when every backend starts empty and equally weighted. Completion events free
 * connections. This is the policy used by many reverse proxies.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E * B) for E events and B backends
 *   Space: O(B + R) for backend state and the assignment list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per backend shows its active connection count.
 *   - The backend chosen for a request is green; a completion is yellow.
 *   - The final frame reports assignments and total completions.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Backend {
    id: string;
    weight?: number;
}

interface BalancerEvent {
    type: "request" | "complete";
    backend?: string;
    count?: number;
}

interface LCBInput {
    backends?: Backend[];
    events?: BalancerEvent[];
    initialActive?: Record<string, number>;
}

function makeBars(
    ids: string[],
    active: number[],
    scores: number[],
    highlight: { index: number; state: EntityState } | null,
): VisualEntity[] {
    return ids.map((id, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${id}: ${active[index] ?? 0} active, score ${(scores[index] ?? 0).toFixed(3)}`,
        value: active[index] ?? 0,
        state: highlight?.index === index ? highlight.state : "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, id, active: active[index] ?? 0, score: scores[index] ?? 0 },
    }));
}

/** The least-connections load balancer generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LCBInput | null) ?? {};
    const backends: Backend[] = Array.isArray(task.backends) && task.backends.length > 0
        ? task.backends.filter((b) => b && typeof b.id === "string")
        : [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ids = backends.map((backend) => backend.id);
    const weights = backends.map((backend) => typeof backend.weight === "number" && backend.weight > 0 ? backend.weight : 1);
    const events: BalancerEvent[] = Array.isArray(task.events) && task.events.length > 0
        ? task.events.filter((event) => event && (event.type === "request" || event.type === "complete"))
        : Array.from({ length: 9 }, () => ({ type: "request" as const }));

    const initial = task.initialActive && typeof task.initialActive === "object" ? task.initialActive : {};
    const active = ids.map((id) => {
        const value = Number(initial[id]) || 0;
        return Math.max(0, Math.floor(value));
    });
    const lastChosen = ids.map(() => 0);
    const chosen: string[] = [];
    let sequence = 0;
    let assigned = 0;
    let completed = 0;

    const scoresOf = (): number[] => active.map((count, index) => count / (weights[index] as number));
    let scores = scoresOf();

    yield {
        stepNumber: 0,
        entities: makeBars(ids, active, scores, null),
        edges: [],
        description: `Least-connections balancer with ${ids.length} backend(s); ${events.length} events queued.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ids, weights, active: [...active], scores: [...scores], chosen: [], assigned: 0, completed: 0, lastEvent: "init", complete: false },
    };
    let step = 1;

    for (const event of events) {
        if (event.type === "request") {
            scores = scoresOf();
            let best = 0;
            for (let index = 1; index < ids.length; index += 1) {
                const score = scores[index] as number;
                const bestScore = scores[best] as number;
                if (score < bestScore - 1e-12) best = index;
                else if (Math.abs(score - bestScore) <= 1e-12 && (lastChosen[index] as number) < (lastChosen[best] as number)) best = index;
            }
            const id = ids[best] as string;
            active[best] = (active[best] as number) + 1;
            lastChosen[best] = sequence + 1;
            sequence += 1;
            chosen.push(id);
            assigned += 1;
            scores = scoresOf();
            yield {
                stepNumber: step,
                entities: makeBars(ids, active, scores, { index: best, state: "sorted" }),
                edges: [],
                description: `Request ${assigned} assigned to ${id}: lowest score ${(scores[best] as number).toFixed(3)} among ${ids.length} backend(s).`,
                codeLineNumber: 2,
                layout: "array",
                meta: { ids, weights, active: [...active], scores: [...scores], chosen: [...chosen], assigned, completed, lastEvent: "request", complete: false },
            };
            step += 1;
        } else {
            const index = event.backend ? ids.indexOf(event.backend) : -1;
            const amount = typeof event.count === "number" ? Math.max(0, Math.floor(event.count)) : 1;
            if (index >= 0) {
                active[index] = Math.max(0, (active[index] as number) - amount);
                completed += amount;
            }
            scores = scoresOf();
            yield {
                stepNumber: step,
                entities: makeBars(ids, active, scores, index >= 0 ? { index, state: "comparing" } : null),
                edges: [],
                description: index >= 0
                    ? `Completion on ${ids[index]} freed ${amount} connection(s); ${active[index]} still active.`
                    : `Completion ignored: backend ${String(event.backend)} is unknown.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { ids, weights, active: [...active], scores: [...scores], chosen: [...chosen], assigned, completed, lastEvent: "complete", complete: false },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(ids, active, scores, null),
        edges: [],
        description: `Balancing finished: ${assigned} request(s) assigned, ${completed} connection(s) completed, final loads [${active.join(", ")}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ids, weights, active: [...active], scores: [...scores], chosen, assigned, completed, lastEvent: "done", complete: true },
    };
}

/** The least-connections load balancer module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A load balancer that sends requests round-robin ignores how busy each backend really is. Least connections watches the live connection count and sends the next request to the emptiest server. Dividing by a weight lets a more powerful server carry a larger share while still keeping all servers busy in proportion.",
        invariants: [
            "Every request increments exactly one backend's active count.",
            "A completion never drives a backend's active count below zero.",
            "The selected backend minimizes active connections divided by weight.",
            "Ties are broken by least recent selection, giving round-robin rotation from a level start.",
        ],
        correctness:
            "Selecting the minimum score is a greedy choice that always assigns work to the least loaded backend under the weighted metric. Because ties use the oldest last-selection time, a group of equally scored backends rotates rather than starving later members. Completion events only decrease counts and clamp at zero, so counts always equal assignments minus completions at that backend. The reported final counts therefore reflect every event exactly once.",
        complexityRationale:
            "Each event scans all backends once to find the minimum score and once to recompute scores, so E events cost O(E times B) time. Storing the weights, counts, and assignment list uses O(B plus R) space.",
        uses: [
            "Backend selection in HTTP reverse proxies",
            "Connection routing in database connection pools",
            "Request dispatch in application load balancers",
        ],
        references: [
            "HAProxy documentation, balance leastconn algorithm, 2024",
            "Nginx HTTP Load Balancing guide, 2024",
        ],
        workedExample:
            "Three backends start at zero connections. The first three requests go to a, b, and c in turn because scores tie and least-recent selection rotates. A completion on b drops its count to zero, so the fourth request goes to b, again the least loaded.",
    },
    id: "least-connections-load-balancing",
    name: "Least-Connections Load Balancing",
    category: "production-systems",
    complexity: { time: "O(E * B)", space: "O(B + R)" },
    defaultInput: {
        backends: [{ id: "a" }, { id: "b" }, { id: "c" }],
        events: [
            { type: "request" }, { type: "request" }, { type: "request" },
            { type: "complete", backend: "b", count: 1 },
            { type: "request" }, { type: "request" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the backends, weights, initial loads, and event list",
        "for each event in order",
        "on a request compute each score as active connections over weight",
        "choose the minimum score, breaking ties by least recent selection",
        "increment that backend and record the assignment",
        "on a completion decrease the named backend and clamp at zero",
        "done: report the assignment list and final loads",
    ],
};

export default module;
