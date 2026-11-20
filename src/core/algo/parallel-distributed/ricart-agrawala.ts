/**
 * ricart-agrawala.ts - Ricart-Agrawala Distributed Mutual Exclusion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ricart and Agrawala improved Lamport's distributed mutex by removing the
 * full request queue at every process. A process stamps its request with a
 * Lamport time and multicasts it. Other processes reply immediately unless
 * they are themselves requesting with an earlier stamp; those requests are
 * deferred and answered when the holder releases the lock. Two messages per
 * peer per request are enough, and the total stamp order guarantees mutual
 * exclusion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages per critical-section entry
 *   Space: O(n) for the deferred request list per process
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Processes sit on a circle; REQUEST multicasts are directed edges.
 *   - The process in the critical section is GREEN, waiters are YELLOW.
 *   - meta reports clocks, grant order, and the message count.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface ReqSpec {
    proc?: number;
    time?: number;
}

interface Req {
    proc: number;
    time: number;
}

const defaultRequests: ReqSpec[] = [
    { proc: 0, time: 1 },
    { proc: 2, time: 1 },
    { proc: 1, time: 2 },
    { proc: 3, time: 5 },
];

function position(i: number, n: number): [number, number] {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [Math.round(200 * Math.cos(angle)), Math.round(200 * Math.sin(angle))];
}

function makeNodes(n: number, clocks: number[], states: Map<number, EntityState>): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => {
        const [x, y] = position(i, n);
        return {
            id: `proc-${i}`,
            type: "node" as const,
            label: `P${i}`,
            value: clocks[i] ?? 0,
            state: states.get(i) ?? "unvisited",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { proc: i, clock: clocks[i] ?? 0 },
        };
    });
}

function makeEdges(requester: number, n: number, label: string): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let j = 0; j < n; j += 1) {
        if (j === requester) {
            continue;
        }
        edges.push({
            id: `msg-${requester}-${j}`,
            sourceId: `proc-${requester}`,
            targetId: `proc-${j}`,
            label,
            state: "active",
            directed: true,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: number; requests?: ReqSpec[] } | null) ?? {};
    const n = Math.max(2, Math.min(8, Math.floor(task.processes ?? 4)));
    const specs = Array.isArray(task.requests) && task.requests.length > 0 ? task.requests : defaultRequests;

    const clocks: number[] = Array.from({ length: n }, () => 0);
    const requests: Req[] = specs.map((spec) => {
        const p = Math.max(0, Math.min(n - 1, Math.floor(spec.proc ?? 0)));
        const local = Math.max(0, Math.floor(spec.time ?? 0));
        clocks[p] = Math.max(clocks[p] ?? 0, local) + 1;
        return { proc: p, time: clocks[p] ?? 1 };
    });

    let step = 0;
    let messages = 0;
    let inCS = -1;
    const grantOrder: number[] = [];
    const pending = new Set<number>(requests.map((r) => r.proc));

    const meta = (last: string) => ({
        processes: n,
        clocks: [...clocks],
        grantOrder: [...grantOrder],
        inCS,
        messages,
        pending: [...pending],
        last,
    });
    const frame = (
        states: Map<number, EntityState>,
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeNodes(n, clocks, states),
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta: meta(description),
    });

    yield frame(new Map(), [], `Ricart-Agrawala mutex on ${n} processes with ${requests.length} request(s).`, 0);

    for (const req of requests) {
        const states = new Map<number, EntityState>([[req.proc, "comparing" as EntityState]]);
        messages += 2 * (n - 1);
        yield frame(
            states,
            makeEdges(req.proc, n, "REQUEST"),
            `P${req.proc} stamps its request (${req.time}, ${req.proc}) and multicasts to ${n - 1} peers; peers with earlier requests defer their replies.`,
            2,
        );
    }

    const earlier = (a: Req, b: Req): boolean => (a.time !== b.time ? a.time < b.time : a.proc < b.proc);
    const sorted = [...requests].sort((a, b) => (earlier(a, b) ? -1 : earlier(b, a) ? 1 : 0));

    for (const req of sorted) {
        inCS = req.proc;
        grantOrder.push(req.proc);
        const granting = new Map<number, EntityState>([[req.proc, "active" as EntityState]]);
        yield frame(
            granting,
            [],
            `P${req.proc} has replies from all ${n - 1} peers and its stamp is the earliest pending: entering the critical section.`,
            4,
        );
        inCS = -1;
        pending.delete(req.proc);
        clocks[req.proc] = (clocks[req.proc] ?? 0) + 1;
        yield frame(
            new Map(),
            [],
            `P${req.proc} releases the lock and replies to every deferred request it was holding.`,
            5,
        );
    }

    const done = `All ${grantOrder.length} requests granted by total stamp order: ${grantOrder.map((p) => `P${p}`).join(" -> ")}. No two overlapped.`;
    yield frame(new Map(), [], done, 7);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A process asks everyone for permission to enter the critical section and waits until all replies arrive. A peer replies at once unless it is asking too with an earlier timestamp, in which case it delays its reply until it has finished. Because timestamps give one global order, only the earliest pending request can collect every reply, so exactly one process enters at a time.",
        invariants: [
            "Requests are totally ordered by (Lamport time, process id).",
            "A process enters only after replies from all n-1 peers arrive.",
            "At most one process is in the critical section in any frame.",
        ],
        correctness:
            "If request a is earlier than request b in the total order, any process holding an earlier request defers its reply to b but never defers a reply to a. Thus a collects replies from all peers while at least one earlier holder still blocks b, so a enters first. Only the minimum pending request can be replied to by every process, so two requests can never both hold all replies: mutual exclusion. When the holder releases, it answers deferred requests, so the next minimum eventually collects all replies, giving progress under fair delivery.",
        complexityRationale:
            "Each entry multicasts one REQUEST to n-1 peers and receives one REPLY from each, plus one RELEASE multicast, so O(n) messages per request. Each process stores only its Lamport clock and its deferred request list, O(n) space.",
        uses: [
            "Coordinating access to a shared replicated resource without a central lock server",
            "Distributed database concurrency control",
            "A canonical teaching counterpart to Lamport's original mutex algorithm",
        ],
        references: [
            "Ricart and Agrawala, An Optimal Algorithm for Mutual Exclusion in Computer Networks, 1981",
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
        ],
        workedExample:
            "Four processes request with stamps (2,P0), (2,P2), (3,P1), (6,P3). P0 is earliest, collects all replies, and enters. P2's reply is deferred while P0 holds the lock, so P2 enters next. The grant order is P0, P2, P1, P3 and no two processes overlap.",
    },
    id: "ricart-agrawala",
    name: "Ricart-Agrawala Mutual Exclusion",
    category: "parallel-distributed",
    complexity: { time: "O(n) messages per entry", space: "O(n)" },
    defaultInput: { processes: 4, requests: defaultRequests },
    visualType: "point",
    run,
    pseudocode: [
        "each process keeps a Lamport clock",
        "to request, increment the clock and stamp the request with (time, id)",
        "multicast the stamped REQUEST to every other process",
        "on receipt, reply at once unless you hold an earlier request",
        "enter the critical section once all n-1 replies have arrived",
        "on exit, multicast RELEASE and reply to all deferred requests",
        "repeat until every pending request has been granted",
        "done: report the grant order in total stamp order",
    ],
};

export default module;
