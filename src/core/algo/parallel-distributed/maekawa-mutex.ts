/**
 * maekawa-mutex.ts - Maekawa's Quorum-Based Mutual Exclusion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Maekawa's algorithm cuts the number of messages per lock request from O(n) to
 * O(sqrt(n)). Processes are arranged in a square grid. The quorum of a process
 * is the union of its row and its column, so any two quorums intersect. To enter
 * the critical section a process asks only the members of its own quorum for
 * permission and waits for all of them to grant it. A voter grants to one
 * requester at a time. Because two quorums always share at least one voter, two
 * processes can never both collect a full set of grants, which guarantees
 * mutual exclusion with far fewer messages than asking everybody.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sqrt(n)) messages per request (request plus reply per voter)
 *   Space: O(sqrt(n)) for a process's quorum and deferred queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are processes laid out on a square grid.
 *   - GREEN marks the process in the section; amber marks its quorum voters.
 *   - meta carries the grid size, current quorum, and grant order.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface Input {
    processes?: number;
    requests?: number[];
}

const defaultRequests: number[] = [0, 4, 2, 6, 1, 8];

/** Members of a process quorum: its whole row union its whole column. */
function quorumOf(proc: number, m: number): number[] {
    const r = Math.floor(proc / m);
    const c = proc % m;
    const q: number[] = [];
    for (let j = 0; j < m * m; j += 1) {
        if (Math.floor(j / m) === r || j % m === c) q.push(j);
    }
    return q;
}

function makeNodes(m: number, inCS: number, voters: Set<number>, held: Set<number>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const span = (m - 1) * 110;
    for (let i = 0; i < m * m; i += 1) {
        const r = Math.floor(i / m);
        const c = i % m;
        const state: EntityState = i === inCS ? "active" : held.has(i) ? "swapped" : voters.has(i) ? "comparing" : "idle";
        entities.push({
            id: `proc-${i}`,
            type: "node" as const,
            label: `P${i}`,
            value: held.has(i) ? 1 : 0,
            state,
            x: c * 110 - span / 2,
            y: r * 110 - span / 2,
            width: 0,
            height: 0,
            metadata: { proc: i, row: r, col: c, inCS: i === inCS, voter: voters.has(i), held: held.has(i) },
        });
    }
    return entities;
}

function makeEdges(m: number, requester: number, voters: Set<number>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const j of quorumOf(requester, m)) {
        if (j === requester || !voters.has(j)) continue;
        edges.push({
            id: `vote-${requester}-${j}`,
            sourceId: `proc-${requester}`,
            targetId: `proc-${j}`,
            label: "GRANT?",
            state: "active",
            directed: true,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const m = Math.max(2, Math.min(4, Math.round(Math.sqrt(Math.max(4, Math.floor(task.processes ?? 9))))));
    const n = m * m;
    const specs: number[] = Array.isArray(task.requests) && task.requests.length > 0 ? task.requests : defaultRequests;
    const requests = specs.map((p) => Math.max(0, Math.min(n - 1, Math.floor(p))));
    const heldBy = new Map<number, number>();
    const grantOrder: number[] = [];
    let step = 0;
    let inCS = -1;
    let activeVoters: Set<number> = new Set();
    let activeRequester = -1;

    const meta = (last: string) => ({
        processes: n,
        grid: m,
        quorumSize: 2 * m - 1,
        quorum: activeRequester < 0 ? [] : quorumOf(activeRequester, m),
        inCS,
        grants: grantOrder.length,
        grantOrder: [...grantOrder],
        held: [...heldBy.keys()].sort((a, b) => a - b),
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeNodes(m, inCS, activeVoters, new Set(heldBy.keys())),
        edges: [],
        description: `Maekawa mutex on a ${m} by ${m} grid; each quorum has ${2 * m - 1} voter(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta("initialized"),
    };

    for (const p of requests) {
        activeRequester = p;
        activeVoters = new Set(quorumOf(p, m));
        const q = [...activeVoters].sort((a, b) => a - b);
        const ask = `P${p} asks quorum {${q.join(", ")}} for permission to enter.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(m, inCS, activeVoters, new Set(heldBy.keys())),
            edges: makeEdges(m, p, activeVoters),
            description: ask,
            codeLineNumber: 2,
            layout: "point",
            meta: meta(ask),
        };

        const free = q.every((v) => !heldBy.has(v));
        if (!free) {
            const blocker = q.find((v) => heldBy.has(v))!;
            const blocked = `Voter P${blocker} is held by another process, so P${p} waits.`;
            yield {
                stepNumber: step++,
                entities: makeNodes(m, inCS, activeVoters, new Set(heldBy.keys())),
                edges: [],
                description: blocked,
                codeLineNumber: 3,
                layout: "point",
                meta: meta(blocked),
            };
            continue;
        }

        inCS = p;
        grantOrder.push(p);
        for (const v of q) heldBy.set(v, p);
        const grant = `All ${q.length} voters grant permission; P${p} enters the critical section.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(m, inCS, activeVoters, new Set(heldBy.keys())),
            edges: [],
            description: grant,
            codeLineNumber: 4,
            layout: "point",
            meta: meta(grant),
        };

        inCS = -1;
        for (const v of q) heldBy.delete(v);
        const release = `P${p} releases its voters, which can now grant another request.`;
        yield {
            stepNumber: step++,
            entities: makeNodes(m, inCS, activeVoters, new Set(heldBy.keys())),
            edges: [],
            description: release,
            codeLineNumber: 5,
            layout: "point",
            meta: meta(release),
        };
    }

    activeRequester = -1;
    activeVoters = new Set();
    const done = `All ${grantOrder.length} requests were serialized by intersecting quorums: ${grantOrder.map((p) => `P${p}`).join(" -> ")}.`;
    yield {
        stepNumber: step,
        entities: makeNodes(m, inCS, activeVoters, new Set(heldBy.keys())),
        edges: [],
        description: done,
        codeLineNumber: 7,
        layout: "point",
        meta: meta(done),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Asking every process for permission to use a lock is wasteful. Maekawa noticed you only need to ask a small overlapping group, called a quorum. Arrange processes in a grid and let each one ask its row and column. Any two such groups share a member, so two processes can never both get everybody's permission at once. This keeps mutual exclusion while using only about the square root of the number of processes in messages.",
        invariants: [
            "Every pair of quorums shares at least one voter.",
            "A voter grants permission to at most one requester at a time.",
            "A process enters only after every member of its quorum has granted permission.",
        ],
        correctness:
            "For a process at grid cell (r, c) the quorum is row r union column c. Two processes at (r1, c1) and (r2, c2) share the voter at (r1, c2), so quorum sets always intersect. If two processes were both in the critical section, each would hold grants from its whole quorum; the shared voter would have granted two overlapping requests, contradicting the rule that a voter grants to one requester at a time. Hence mutual exclusion holds. Because voters queue requests and eventually grant the earliest one while no holder exists, a waiting process eventually collects all grants and enters.",
        complexityRationale:
            "Each row or column holds m = sqrt(n) processes, so a quorum has 2m-1 members and a request uses O(m) = O(sqrt(n)) grant/reply messages. A process stores its quorum and a short deferred queue, O(sqrt(n)) space.",
        uses: [
            "Distributed lock services that need to scale beyond a single coordinator",
            "Replicated database systems reducing coordination message overhead",
            "Sensor networks and peer groups with a square-grid topology",
        ],
        references: [
            "Maekawa, A Sqrt(N) Algorithm for Mutual Exclusion in Decentralized Systems, 1985",
            "Raynal, Distributed Algorithms and Protocols, chapters on mutual exclusion",
        ],
        workedExample:
            "On a 3 by 3 grid, process P0's quorum is row 0 plus column 0: {0, 1, 2, 3, 6}. Process P4's quorum is row 1 plus column 1: {1, 3, 4, 5, 7}. They share voters 1 and 3. If P0 is in the section holding those voters, P4 cannot collect all its grants, so it waits until P0 releases them.",
    },
    id: "maekawa-mutex",
    name: "Maekawa Quorum Mutual Exclusion",
    category: "parallel-distributed",
    complexity: { time: "O(sqrt(n)) messages per request", space: "O(sqrt(n))" },
    defaultInput: { processes: 9, requests: defaultRequests },
    visualType: "point",
    run,
    pseudocode: [
        "arrange processes in a square grid of size m by m",
        "define each quorum as its row union its column",
        "to request, multicast GRANT? to every quorum voter",
        "a voter grants to one requester and defers the rest",
        "enter when all quorum voters have granted permission",
        "on exit, multicast RELEASE to the quorum voters",
        "a released voter grants the next deferred requester",
        "repeat until all requests are satisfied",
        "done: report the serialized grant order",
    ],
};

export default module;
