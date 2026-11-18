/**
 * raft-consensus.ts - Raft Leader Election and Log Replication (Toy Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Raft keeps a replicated log consistent by electing a single leader and
 * having that leader replicate entries to a majority of servers. A candidate
 * wins an election when it collects votes from a majority in a term, and the
 * leader commits an entry once a majority has stored it. This module is a
 * deterministic teaching simulation on a fixed cluster; it is not a networking
 * implementation and does not give production safety guarantees.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages for one election and one replicated entry
 *   Space: O(n) for the server states and log metadata
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are servers: gray follower, yellow candidate, blue leader, red
 *     crashed, green committed.
 *   - A single directed edge shows the request or acknowledgment in flight.
 *   - Term, vote count, quorum, and commit index are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type NodeState = "follower" | "candidate" | "leader" | "crashed" | "replicated" | "committed";

/** Build the server nodes for one frame. */
function makeNodes(
    n: number,
    crash: number,
    candidate: number,
    leader: number,
    states: Map<number, NodeState>,
): VisualEntity[] {
    const color: Record<NodeState, EntityState> = {
        follower: "idle",
        candidate: "comparing",
        leader: "active",
        crashed: "error",
        replicated: "visited",
        committed: "sorted",
    };
    return Array.from({ length: n }, (_, i) => {
        const state = states.get(i) ?? (i === crash ? "crashed" : "follower");
        return {
            id: `node-${i}`,
            type: "node" as const,
            label: `S${i}${state === "leader" ? " (L)" : state === "candidate" ? " (C)" : ""}`,
            value: state,
            state: color[state],
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, role: state, candidate, leader },
        };
    });
}

/** A single message edge between two servers. */
function message(from: number, to: number, label: string): VisualEdge[] {
    return [{
        id: `msg-${from}-${to}`,
        sourceId: `node-${from}`,
        targetId: `node-${to}`,
        label,
        state: "active" as const,
        directed: true,
    }];
}

/** The Raft simulation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: number; crash?: number; entry?: string } | null) ?? {};
    const n = typeof task.nodes === "number" && task.nodes >= 3 && task.nodes <= 7
        ? Math.floor(task.nodes)
        : 5;
    const crash = typeof task.crash === "number" && task.crash >= 0 && task.crash < n
        ? Math.floor(task.crash)
        : -1;
    const entry = typeof task.entry === "string" && task.entry.length > 0 ? task.entry : "x=1";
    const quorum = Math.floor(n / 2) + 1;
    const alive = Array.from({ length: n }, (_, i) => i).filter((i) => i !== crash);
    const candidate = alive[0] ?? 0;
    const canElect = alive.length >= quorum;
    const term = 1;

    let step = 0;
    const baseStates = () => {
        const states = new Map<number, NodeState>();
        for (let i = 0; i < n; i += 1) {
            states.set(i, i === crash ? "crashed" : "follower");
        }
        return states;
    };
    const frame = (
        states: Map<number, NodeState>,
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
        votes: number,
        commitIndex: number,
        committed: boolean,
        leader: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeNodes(n, crash, candidate, leader, states),
        edges,
        description,
        codeLineNumber,
        layout: "graph",
        meta: { n, quorum, term, votes, commitIndex, committed, leader, entry, alive: alive.length },
    });

    yield frame(baseStates(), [], `Cluster of ${n} servers starts with all followers in term 0.`, 0, 0, 0, false, -1);
    step += 1;

    if (!canElect) {
        const states = baseStates();
        states.set(candidate, "candidate");
        yield frame(states, [], `Only ${alive.length} servers are alive, below the quorum of ${quorum}; no leader can be elected.`, 1, 1, 0, false, -1);
        step += 1;
        yield frame(states, [], `Election failed in term ${term}; the cluster cannot commit "${entry}".`, 7, 1, 0, false, -1);
        return;
    }

    const states = baseStates();
    states.set(candidate, "candidate");
    let votes = 1;
    yield frame(states, [], `Server ${candidate} times out, moves to term ${term}, and votes for itself.`, 1, votes, 0, false, -1);
    step += 1;

    for (const server of alive) {
        if (server === candidate || votes >= quorum) {
            continue;
        }
        states.set(server, "replicated");
        votes += 1;
        yield frame(states, message(candidate, server, "RequestVote reply"), `Server ${server} grants its vote to ${candidate}; votes ${votes} of ${quorum} needed.`, 2, votes, 0, false, -1);
        step += 1;
    }

    states.set(candidate, "leader");
    for (const [server, state] of states) {
        if (state === "replicated") {
            states.set(server, "follower");
        }
    }
    yield frame(states, [], `Server ${candidate} wins the election with ${votes} vote(s) and becomes leader for term ${term}.`, 3, votes, 0, false, candidate);
    step += 1;

    const heartbeat = alive.filter((i) => i !== candidate).flatMap((i) => message(candidate, i, "AppendEntries"));
    yield frame(states, heartbeat, `Leader ${candidate} sends "${entry}" to every other live server.`, 4, votes, 0, false, candidate);
    step += 1;

    let replicated = 1;
    let commitIndex = 0;
    let committed = false;
    for (const server of alive) {
        if (server === candidate || committed) {
            continue;
        }
        replicated += 1;
        states.set(server, "replicated");
        if (replicated >= quorum) {
            commitIndex = 1;
            committed = true;
        }
        yield frame(states, message(server, candidate, "AppendEntries ack"), `Server ${server} acknowledges the entry; ${replicated} of ${quorum} replicas hold it.`, 5, votes, commitIndex, committed, candidate);
        step += 1;
    }

    for (const [server, state] of states) {
        if (state === "replicated" || state === "leader") {
            states.set(server, "committed");
        }
    }
    yield frame(states, [], committed
        ? `Entry "${entry}" committed at index ${commitIndex} with ${replicated} replicas.`
        : `Entry "${entry}" was not committed; only ${replicated} replicas responded.`, 6, votes, commitIndex, committed, candidate);
}

/** The Raft consensus module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Raft makes consensus understandable by separating leader election from log replication. Servers start as followers; one that hears no leader becomes a candidate and asks for votes. A majority vote makes it leader, and the leader commits an entry only after a majority has copied it. The majority rule guarantees that two leaders cannot both win in the same term.",
        invariants: [
            "A candidate needs votes from a strict majority of all servers, not just live ones.",
            "The leader appends entries before replicating them and never overwrites committed entries.",
            "An entry is committed only when a majority of servers store it in the same term.",
        ],
        correctness:
            "Any two majorities of the same set of servers intersect, so at most one candidate can collect a majority in a given term. The leader-only rule means every committed entry passed through that leader. Because the leader advances the commit index only after a majority acknowledgment, every future leader must contain that entry, preserving the replicated log's agreement.",
        complexityRationale:
            "One election and one log entry require one RequestVote round and one AppendEntries round, each O(n) messages. The simulation stores a role and a log index per server, so space is O(n).",
        uses: [
            "Coordinating configuration and metadata in distributed key-value stores",
            "Electing a coordinator for a sharded database",
            "A reference consensus algorithm for teaching and student projects",
        ],
        references: [
            "Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, 2014",
            "Ongaro, Consensus: Bridging Theory and Practice, 2014",
        ],
        workedExample:
            "With five servers and one crashed, three votes form a majority. Server 0 votes for itself and servers 1 and 2 reply, so it becomes leader. When servers 1 and 2 also acknowledge the entry, three replicas hold it and the leader commits it at index one.",
    },
    id: "raft-consensus",
    name: "Raft Consensus (Toy Simulation)",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { nodes: 5, crash: -1, entry: "x=1" },
    visualType: "graph",
    run,
    pseudocode: [
        "start every server as a follower in term zero",
        "a timed-out server becomes a candidate and increments the term",
        "request votes from every other server",
        "become leader on receiving a majority of votes",
        "append the new entry to the leader log",
        "replicate the entry to all followers",
        "commit the entry once a majority acknowledges it",
        "done: report the leader, term, and commit index",
    ],
};

export default module;
