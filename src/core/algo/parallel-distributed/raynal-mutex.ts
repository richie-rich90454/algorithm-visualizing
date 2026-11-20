/**
 * raynal-mutex.ts - Raynal's Distributed Mutual Exclusion Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Raynal's algorithm keeps a timestamp-ordered request queue at every site, as
 * Lamport's does, but it cuts the number of reply messages. A site entering the
 * critical section only needs acknowledgments from the sites whose requests
 * appear before its own, not from every other site. Later requesters cannot
 * overtake an earlier one because they must wait for it, so the earlier sites
 * are exactly the ones whose permission matters. This trades a little extra
 * bookkeeping for fewer messages when the queue is short.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(k) reply messages for a request with k predecessors, at most O(n)
 *   Space: O(n) per site for the replicated ordered request queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Nodes are sites on a circle; the site in the section is green.
 *   - Request multicasts and the smaller predecessor acknowledgment set are
 *     drawn as directed edges.
 *   - meta compares the acknowledgments needed here with Lamport's n-1 replies.
 *
 * This is a deterministic teaching simulation with distinct request stamps;
 * ties break by site number. It does not model message delay, failures, or a
 * real distributed runtime.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

interface ReqSpec {
    proc?: number;
    time?: number;
}

interface Input {
    processes?: number;
    requests?: ReqSpec[];
}

interface Request {
    proc: number;
    time: number;
}

const DEFAULT_REQUESTS: ReqSpec[] = [
    { proc: 0, time: 1 },
    { proc: 2, time: 2 },
    { proc: 1, time: 3 },
    { proc: 3, time: 4 },
];

/** Total order by stamp, then site number. */
function earlier(a: Request, b: Request): boolean {
    return a.time !== b.time ? a.time < b.time : a.proc < b.proc;
}

function position(i: number, n: number): [number, number] {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [Math.round(200 * Math.cos(angle)), Math.round(200 * Math.sin(angle))];
}

/** Build the site nodes for a frame. */
function makeNodes(n: number, queue: Request[], inCS: number, waiting: number): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => {
        const [x, y] = position(i, n);
        const queued = queue.some((r) => r.proc === i);
        const state: EntityState = i === inCS ? "active" : i === waiting ? "comparing" : queued ? "visited" : "idle";
        return {
            id: `site-${i}`,
            type: "node" as const,
            label: `S${i}`,
            value: queue.find((r) => r.proc === i)?.time ?? 0,
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { site: i, queued, inCS: i === inCS, waiting: i === waiting },
        };
    });
}

/** Multicast edges from a requester to all other sites. */
function requestEdges(n: number, requester: number): VisualEdge[] {
    return Array.from({ length: n }, (_, j) => ({
        id: `req-${requester}-${j}`,
        sourceId: `site-${requester}`,
        targetId: `site-${j}`,
        label: "REQUEST",
        state: "active" as EntityState,
        directed: true,
    })).filter((edge) => edge.targetId !== `site-${requester}`);
}

/** Acknowledgment edges sent only by predecessor sites. */
function ackEdges(requester: number, ackFrom: number[]): VisualEdge[] {
    return ackFrom.map((site) => ({
        id: `ack-${site}-${requester}`,
        sourceId: `site-${site}`,
        targetId: `site-${requester}`,
        label: "ACK",
        state: "path" as EntityState,
        directed: true,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = Math.max(2, Math.min(6, Math.floor(task.processes ?? 4)));
    const specs: ReqSpec[] = Array.isArray(task.requests) && task.requests.length > 0 ? task.requests : DEFAULT_REQUESTS;
    const requests: Request[] = specs.map((spec, i) => ({
        proc: Math.max(0, Math.min(n - 1, Math.floor(spec.proc ?? i % n))),
        time: typeof spec.time === "number" && Number.isFinite(spec.time) ? Math.floor(spec.time) : i + 1,
    }));
    const order = [...requests].sort((a, b) => (earlier(a, b) ? -1 : earlier(b, a) ? 1 : 0));
    const queue: Request[] = [];
    const grantOrder: number[] = [];
    let inCS = -1;
    let waiting = -1;
    let acksNeeded = 0;
    let ackFrom: number[] = [];
    let messageCount = 0;

    const meta = (last: string) => ({
        processes: n,
        requestCount: requests.length,
        order: order.map((r) => `S${r.proc}@${r.time}`),
        queue: queue.map((r) => `S${r.proc}@${r.time}`),
        waiting,
        inCS,
        acksNeeded,
        ackFrom: [...ackFrom],
        lamportAcks: n - 1,
        messagesSaved: Math.max(0, n - 1 - acksNeeded),
        messageCount,
        grantOrder: [...grantOrder],
        last,
    });

    yield {
        stepNumber: 0,
        entities: makeNodes(n, queue, inCS, waiting),
        edges: [],
        description: `Raynal mutex on ${n} sites; each request needs replies only from earlier requests.`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta("initialized"),
    };

    let step = 1;
    for (const request of order) {
        queue.push(request);
        waiting = request.proc;
        ackFrom = [...new Set(queue.filter((r) => earlier(r, request)).map((r) => r.proc))].filter((p) => p !== request.proc);
        acksNeeded = ackFrom.length;
        messageCount += n - 1 + acksNeeded;
        yield {
            stepNumber: step++,
            entities: makeNodes(n, queue, inCS, waiting),
            edges: requestEdges(n, request.proc),
            description: `S${request.proc} stamps its request ${request.time} and multicasts it; the local queue now has ${queue.length} entry(ies).`,
            codeLineNumber: 2,
            layout: "point",
            meta: meta("requested"),
        };

        yield {
            stepNumber: step++,
            entities: makeNodes(n, queue, inCS, waiting),
            edges: ackEdges(request.proc, ackFrom),
            description: `Only predecessor sites {${ackFrom.join(", ")}} send ACK to S${request.proc}; Lamport would need ${n - 1} replies.`,
            codeLineNumber: 3,
            layout: "point",
            meta: meta("acknowledged"),
        };

        inCS = request.proc;
        grantOrder.push(request.proc);
        yield {
            stepNumber: step++,
            entities: makeNodes(n, queue, inCS, waiting),
            edges: [],
            description: `Its request is first in the queue and ${acksNeeded} predecessor ACK(s) arrived, so S${request.proc} enters the critical section.`,
            codeLineNumber: 4,
            layout: "point",
            meta: meta("entered"),
        };

        inCS = -1;
        waiting = -1;
        yield {
            stepNumber: step++,
            entities: makeNodes(n, queue, inCS, waiting),
            edges: [],
            description: `S${request.proc} releases the section while its stamped request stays in the queue as a predecessor for later requests.`,
            codeLineNumber: 5,
            layout: "point",
            meta: meta("released"),
        };
    }

    yield {
        stepNumber: step,
        entities: makeNodes(n, queue, inCS, waiting),
        edges: [],
        description: `All ${grantOrder.length} requests were granted in stamp order: ${grantOrder.map((p) => `S${p}`).join(" -> ")}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: meta("done"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Every site keeps the same list of pending requests ordered by logical time. When you ask for the lock, you only need a yes from the requests ahead of you; ones behind you must wait for you anyway, so their permission is guaranteed later. This is the same ordering idea as Lamport's algorithm with a smaller mailbox: early requests need no replies at all, and the last one needs fewer than all the other sites.",
        invariants: [
            "Every site's local queue orders requests by the same (time, site) total order.",
            "A site enters only when its own request is first and every predecessor has acknowledged.",
            "The acknowledgment set is a subset of the other sites, so it never exceeds n-1 members.",
        ],
        correctness:
            "Because all queues use the same total order, the first entry is identical everywhere. A site enters only when its request is first and predecessors have replied. If two sites were simultaneously in the section, the one with the later stamp would be a successor of the other and would be waiting for that predecessor's acknowledgment, which is withheld while the predecessor is in the section. That contradiction proves mutual exclusion. Each predecessor eventually leaves the critical section, so the earliest waiting request collects its acknowledgment and advances; by induction every site enters, proving progress.",
        complexityRationale:
            "A request is multicast to n-1 sites and answered by only k predecessor sites, where k is at most n-1, so a request costs O(k) reply messages instead of Lamport's fixed n-1. Each site stores the ordered queue, O(n) space.",
        uses: [
            "Distributed locking when request queues are usually short",
            "Teaching message-count optimizations of timestamp-based mutual exclusion",
            "Coordinating access to a shared resource in a small fixed cluster",
        ],
        references: [
            "Raynal, Distributed Algorithms and Protocols, chapters on mutual exclusion",
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
        ],
        workedExample:
            "With sites S0 through S3 and requests stamped 1, 2, 3, 4 from S0, S2, S1, S3, the order is S0, S2, S1, S3. S0 needs no acknowledgment, S2 waits only for S0, S1 waits for S0 and S2, and S3 waits for the first three. Where Lamport sends three replies per request, Raynal sends zero, one, two, and three.",
    },
    id: "raynal-mutex",
    name: "Raynal Distributed Mutual Exclusion",
    category: "parallel-distributed",
    complexity: { time: "O(k) reply messages, k <= n", space: "O(n)" },
    defaultInput: { processes: 4, requests: DEFAULT_REQUESTS },
    visualType: "point",
    run,
    pseudocode: [
        "keep an ordered request queue at every site",
        "on request, stamp it and multicast to all sites",
        "insert each incoming request in (time, site) order",
        "wait until your request is first in the queue",
        "wait for ACKs only from sites listed before you",
        "enter the critical section when both conditions hold",
        "on exit, multicast RELEASE and keep the stamp as a predecessor",
        "done: report the grant order and messages saved",
    ],
};

export default module;
