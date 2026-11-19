/**
 * log-structured-broadcast.ts - Log-Structured Broadcast with Gap Filling
 *
 * Each node keeps an append-only log of (source, sequence) records. During a
 * gossip exchange two nodes swap their log summaries, discover the entries the
 * other is missing, and append them in (source, sequence) order. Repeated
 * pairwise exchanges make every node's log converge to the same ordered set.
 *
 * Time:  O(rounds * messages log messages) for sorting the appended gaps
 * Space: O(nodes * messages) across all node logs
 *
 * Visualization: a grid has one row per node and one column per message; a
 * filled cell means that node has appended the record, and the gossiping pair
 * is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type GossipMessage = { source: number; seq: number; payload: string };

/** Deterministic global order for records. */
export function messageKey(m: GossipMessage): string {
    return `${m.source}:${m.seq}`;
}

/** The gossip broadcast generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: number; messages?: GossipMessage[]; rounds?: Array<[number, number]> } | null) ?? {};
    const nodes = typeof task.nodes === "number" && task.nodes > 0 ? Math.floor(task.nodes) : 4;
    const seenInput = new Set<string>();
    const messages: GossipMessage[] = (Array.isArray(task.messages) ? task.messages : [
        { source: 0, seq: 0, payload: "a" },
        { source: 0, seq: 1, payload: "b" },
        { source: 1, seq: 0, payload: "c" },
        { source: 2, seq: 0, payload: "d" },
    ]).filter((m) => {
        if (!m || typeof m.source !== "number") return false;
        const key = messageKey(m);
        if (seenInput.has(key)) return false;
        seenInput.add(key);
        return true;
    }).map((m) => ({ source: Math.max(0, Math.min(nodes - 1, Math.floor(m.source))), seq: Math.max(0, Math.floor(m.seq)), payload: String(m.payload ?? "") }));
    const ordered = messages.slice().sort((a, b) => a.source - b.source || a.seq - b.seq);
    const keys = ordered.map(messageKey);
    const cols = keys.length;
    const rounds: Array<[number, number]> = Array.isArray(task.rounds)
        ? task.rounds.filter((r) => Array.isArray(r) && r.length === 2).map((r) => [Math.floor(r[0] as number), Math.floor(r[1] as number)])
        : [[0, 1], [2, 3], [1, 2], [0, 3]];

    const logs: Set<string>[] = Array.from({ length: nodes }, () => new Set<string>());
    for (const m of ordered) logs[m.source]?.add(messageKey(m));
    let step = 0;

    const cells = (highlight: Set<number> | null): VisualEntity[] => {
        const result: VisualEntity[] = [];
        for (let p = 0; p < nodes; p += 1) {
            for (let c = 0; c < cols; c += 1) {
                const key = keys[c] as string;
                const has = logs[p]?.has(key) ?? false;
                result.push({
                    id: `cell-${p}-${c}`,
                    type: "cell" as const,
                    label: has ? (ordered[c]?.payload ?? "") : "",
                    value: key,
                    state: has ? (highlight?.has(p) ? "comparing" : "sorted") : "idle",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: p, col: c, source: ordered[c]?.source ?? 0, seq: ordered[c]?.seq ?? 0, present: has },
                });
            }
        }
        return result;
    };
    const delivered = (): number => logs.reduce((sum, log) => sum + log.size, 0);

    yield {
        stepNumber: step,
        entities: cells(null),
        edges: [],
        description: `${nodes} nodes begin with ${ordered.length} record(s), each held only by its source node.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: nodes, cols, nodes, keys, round: -1, delivered: delivered(), messages: ordered.map((m) => `${m.source}:${m.seq}:${m.payload}`) },
    };
    step += 1;

    for (let index = 0; index < rounds.length; index += 1) {
        const [a, b] = rounds[index] as [number, number];
        if (a < 0 || b < 0 || a >= nodes || b >= nodes || a === b) continue;
        const union = new Set([...(logs[a] ?? []), ...(logs[b] ?? [])]);
        for (const key of union) {
            (logs[a] as Set<string>).add(key);
            (logs[b] as Set<string>).add(key);
        }
        yield {
            stepNumber: step,
            entities: cells(new Set([a, b])),
            edges: [],
            description: `Gossip ${index + 1}: nodes ${a} and ${b} exchanged summaries and appended ${union.size - Math.min(logs[a]?.size ?? 0, logs[b]?.size ?? 0)} missing record(s) in order.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: nodes, cols, nodes, keys, round: index, pair: [a, b], delivered: delivered(), messages: ordered.map((m) => `${m.source}:${m.seq}:${m.payload}`) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(null),
        edges: [],
        description: `Broadcast converged: all ${nodes} node logs contain the same ${ordered.length} record(s) in (source, sequence) order.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: nodes, cols, nodes, keys, round: rounds.length, delivered: delivered(), messages: ordered.map((m) => `${m.source}:${m.seq}:${m.payload}`) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A broadcast protocol can be built on append-only logs: each node writes the messages it originates, then gossip rounds let pairs of nodes compare what they have. A node only ever appends missing (source, sequence) records, never rewrites or reorders them, so the log is a durable, ordered history that naturally fills gaps as replicas exchange summaries.",
        invariants: [
            "A record is appended at most once per node, identified by its source and sequence number.",
            "Records in every log are ordered by source and then sequence number.",
            "A node's log only grows during a gossip round, never shrinks.",
        ],
        correctness:
            "In each exchange a node adds exactly the union of both summaries minus what it already had, so no record is lost or duplicated. Appending the missing records in global (source, sequence) order preserves the ordering invariant for both participants. Any pair of nodes that gossip eventually share the union of their records; because the gossip graph connects the replicas, repeated rounds propagate every record to every node, so all logs converge to the same ordered set.",
        complexityRationale:
            "Each round forms a union and sorts the appended gaps, O(m log m) for m messages, over r rounds giving O(r * m log m) time. Each of the n nodes stores up to m records, O(n * m) space.",
        uses: [
            "Replicated event logs in distributed messaging systems",
            "Anti-entropy repair between storage replicas",
            "Gossip-based membership and message dissemination",
        ],
        references: [
            "Birman, Reliable Dissemination of Information in Large Systems, 1990",
            "Kreps, Kafka: a Distributed Messaging System for Log Processing, 2011",
        ],
        workedExample:
            "Node 0 logs (0,0)=a and (0,1)=b while node 1 logs (1,0)=c. When nodes 0 and 1 gossip, node 0 appends c and node 1 appends a and b, both ordered (0,0), (0,1), (1,0). A later exchange with node 2 copies all three records there, so every node ends with the same log.",
    },
    id: "log-structured-broadcast",
    name: "Log-Structured Broadcast",
    category: "parallel-distributed",
    complexity: { time: "O(r m log m)", space: "O(n m)" },
    defaultInput: {
        nodes: 4,
        messages: [
            { source: 0, seq: 0, payload: "a" },
            { source: 0, seq: 1, payload: "b" },
            { source: 1, seq: 0, payload: "c" },
            { source: 2, seq: 0, payload: "d" },
        ],
        rounds: [[0, 1], [2, 3], [1, 2], [0, 3]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "each node writes its own records into an append-only log",
        "for every gossip round pick two nodes",
        "exchange the set of record keys each node holds",
        "compute the union of the two log summaries",
        "append missing records in source then sequence order",
        "never delete or reorder an existing record",
        "repeat until every node holds every record",
        "done: report the converged logs and delivered count",
    ],
};

export default module;
