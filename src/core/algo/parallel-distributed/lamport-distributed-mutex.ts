/**
 * lamport-distributed-mutex.ts - Lamport's Distributed Mutual Exclusion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each process keeps a Lamport logical clock and a local queue of request
 * stamps ordered by (time, process id). To enter the critical section a process
 * timestamps its request, multicasts it to every other process, and waits until
 * its own request is first in its queue and every other process has replied.
 * Because all processes order requests by the same total order, the first
 * request in every queue is the same one, so only one process can be admitted
 * at a time. A release multicasts to remove the head request everywhere.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages per request (one request plus n-1 replies)
 *   Space: O(n) per process for the request queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are processes arranged on a circle; edges show the request multicast.
 *   - GREEN marks the process in the critical section, amber marks queued requests.
 *   - meta carries the logical clocks, request queue, and grant order.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface ReqSpec {
    proc?: number;
    time?: number;
}

interface Input {
    processes?: number;
    requests?: ReqSpec[];
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

/** Total order by Lamport timestamp, then process id for ties. */
function earlier(a: Req, b: Req): boolean {
    return a.time !== b.time ? a.time < b.time : a.proc < b.proc;
}

function nodePosition(i: number, n: number): [number, number] {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [Math.round(200 * Math.cos(angle)), Math.round(200 * Math.sin(angle))];
}

function makeNodes(
    n: number,
    clocks: number[],
    queue: Req[],
    inCS: number,
): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => {
        const [x, y] = nodePosition(i, n);
        const queued = queue.some((r) => r.proc === i);
        const state: EntityState = i === inCS ? "active" : queued ? "comparing" : "idle";
        return {
            id: `proc-${i}`,
            type: "node" as const,
            label: `P${i}`,
            value: clocks[i] ?? 0,
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { proc: i, clock: clocks[i] ?? 0, queued, inCS: i === inCS },
        };
    });
}

/** Multicast edges from a requester to all other processes. */
function makeEdges(n: number, requester: number): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let j = 0; j < n; j += 1) {
        if (j === requester) continue;
        edges.push({
            id: `req-${requester}-${j}`,
            sourceId: `proc-${requester}`,
            targetId: `proc-${j}`,
            label: "REQUEST",
            state: "active",
            directed: true,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = Math.max(2, Math.min(8, Math.floor(task.processes ?? 4)));
    const specs: ReqSpec[] = Array.isArray(task.requests) && task.requests.length > 0 ? task.requests : defaultRequests;
    const clocks = Array.from({ length: n }, () => 0);
    const pending: Req[] = [];
    const grantOrder: number[] = [];
    let step = 0;
    let inCS = -1;

    const meta = (last: string) => ({
        processes: n,
        clocks: [...clocks],
        queue: pending.map((r) => `P${r.proc}@${r.time}`),
        inCS,
        grants: grantOrder.length,
        grantOrder: [...grantOrder],
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeNodes(n, clocks, pending, inCS),
        edges: [],
        description: `Lamport mutex on ${n} processes with ${specs.length} request(s); clocks start at zero.`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta("initialized"),
    };

    for (const spec of specs) {
        const p = Math.max(0, Math.min(n - 1, Math.floor(spec.proc ?? 0)));
        const localTime = Math.max(0, Math.floor(spec.time ?? 0));
        clocks[p] = Math.max(clocks[p] ?? 0, localTime) + 1;
        const req: Req = { proc: p, time: clocks[p]! };
        pending.push(req);
        const description = `P${p} issues REQUEST stamped (${req.time}, ${p}) and multicasts to all other processes.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(n, clocks, pending, inCS),
            edges: makeEdges(n, p),
            description,
            codeLineNumber: 2,
            layout: "point",
            meta: meta(description),
        };
    }

    pending.sort((a, b) => (earlier(a, b) ? -1 : earlier(b, a) ? 1 : 0));
    while (pending.length > 0) {
        const next = pending[0]!;
        const p = next.proc;
        inCS = p;
        grantOrder.push(p);
        const grant = `P${p} is first in every queue and holds replies from all: entering the critical section.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(n, clocks, pending, inCS),
            edges: [],
            description: grant,
            codeLineNumber: 5,
            layout: "point",
            meta: meta(grant),
        };
        inCS = -1;
        pending.shift();
        clocks[p] = (clocks[p] ?? 0) + 1;
        const release = `P${p} releases the lock and multicasts RELEASE; request removed from every queue.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(n, clocks, pending, inCS),
            edges: [],
            description: release,
            codeLineNumber: 6,
            layout: "point",
            meta: meta(release),
        };
    }

    const done = `All ${grantOrder.length} requests granted in Lamport order: ${grantOrder.map((p) => `P${p}`).join(" -> ")}.`;
    yield {
        stepNumber: step,
        entities: makeNodes(n, clocks, pending, inCS),
        edges: [],
        description: done,
        codeLineNumber: 8,
        layout: "point",
        meta: meta(done),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine every process keeps the same sorted waiting list of requests, each stamped with a logical time and a process id. When you want the lock, you put your stamp on everyone's list and wait until yours is at the front and everybody has acknowledged it. Since all lists share one order, exactly one request can be at the front at a time, so no two processes enter together.",
        invariants: [
            "Every process orders requests by the same (time, process id) key.",
            "A process enters only when its own request is first and all replies are collected.",
            "At most one process is in the critical section at any frame.",
        ],
        correctness:
            "Logical clocks are advanced on send and receive, so if request a happens before request b then a's stamp is smaller in the total order. Every process inserts requests into the same total order and replies to every request it receives, so the head of every queue is the same request. A process can enter only when its request is that common head and it has replies from all n-1 others; because there is a single head, two processes cannot both satisfy the condition, giving mutual exclusion. The head request is eventually at the front everywhere and all replies arrive, so a waiting process eventually enters, giving liveness under fair delivery.",
        complexityRationale:
            "Each critical-section request sends one multicast to n-1 processes and receives n-1 replies, so O(n) messages per entry. Every process stores its request queue, O(n) space, and the local Lamport clock is a single integer.",
        uses: [
            "Coordinating writes to a shared replicated file in a distributed file system",
            "Serializing access to a distributed resource without a central lock manager",
            "A canonical teaching example for logical clocks and mutual exclusion",
        ],
        references: [
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
            "Lamport, A New Solution of Dijkstra's Concurrent Programming Problem, 1974",
        ],
        workedExample:
            "Four processes issue requests stamped (2,P0), (2,P2), (3,P1), and (6,P3). Sorting by (time, id) gives P0, P2, P1, P3. Each enters the critical section in that order: P0 first, then after its release P2, and so on, so the grant order is P0, P2, P1, P3 and no two overlap.",
    },
    id: "lamport-distributed-mutex",
    name: "Lamport Distributed Mutual Exclusion",
    category: "parallel-distributed",
    complexity: { time: "O(n) messages per request", space: "O(n)" },
    defaultInput: { processes: 4, requests: defaultRequests },
    visualType: "point",
    run,
    pseudocode: [
        "each process keeps a Lamport clock and a request queue",
        "to request, increment clock and stamp the request with (time, id)",
        "multicast the stamped request to all other processes",
        "on receipt, merge clocks, enqueue the request, and reply",
        "enter when your request is first and all replies arrived",
        "on exit, multicast RELEASE and drop the head request",
        "on RELEASE, remove that request from your queue",
        "repeat until every request has been granted",
        "done: report the grant order",
    ],
};

export default module;
