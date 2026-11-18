/**
 * zab-consensus.ts - Zab Atomic Broadcast (Teaching Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Zab is the atomic broadcast protocol behind ZooKeeper. It elects a leader
 * for an epoch, gives every proposal a monotonically increasing transaction
 * id (zxid = epoch plus counter), and guarantees that all servers deliver
 * committed proposals in exactly the same order.
 *
 * This teaching simulation implements only the deterministic core: leader
 * selection by (epoch, server id) and total-order zxid assignment with a
 * quorum acknowledgment. It does NOT model crashes, recovery, leader sync,
 * disk flushes, or real networking, so it is not a correct or safe
 * implementation of Zab for production use.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) for n servers and m proposals
 *   Space: O(n + m) for the server states and the replicated log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row of cells shows servers; the leader is green.
 *   - meta carries the zxid sequence and the committed prefix length.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Server {
    id: number;
    epoch: number;
}

/** Build the server cells for a frame. */
function makeCells(servers: Server[], leader: number, acknowledged: Set<number>): VisualEntity[] {
    return servers.map((server, index) => {
        let state: EntityState = "unvisited";
        if (server.id === leader) {
            state = "sorted";
        } else if (acknowledged.has(server.id)) {
            state = "visited";
        }
        return {
            id: `server-${server.id}`,
            type: "cell" as const,
            label: `s${server.id}`,
            value: server.id,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, serverId: server.id, epoch: server.epoch },
        };
    });
}

/** The Zab teaching simulation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { servers?: Array<{ id: number; epoch: number }>; proposals?: string[] } | null
    ) ?? {};
    const rawServers = Array.isArray(task.servers) ? task.servers : [];
    const servers: Server[] =
        rawServers.length > 0
            ? rawServers.map((s) => ({ id: Number(s.id), epoch: Number(s.epoch) || 0 }))
            : [
                  { id: 0, epoch: 1 },
                  { id: 1, epoch: 1 },
                  { id: 2, epoch: 1 },
                  { id: 3, epoch: 1 },
              ];
    const proposals = Array.isArray(task.proposals)
        ? task.proposals.map(String)
        : ["a", "b", "c"];
    const quorum = Math.floor(servers.length / 2) + 1;

    // Zab picks the server with the greatest (epoch, id) pair as leader.
    let leader = servers[0]?.id ?? -1;
    let leaderEpoch = servers[0]?.epoch ?? 0;
    for (const server of servers) {
        if (server.epoch > leaderEpoch || (server.epoch === leaderEpoch && server.id > leader)) {
            leader = server.id;
            leaderEpoch = server.epoch;
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(servers, -1, new Set()),
        edges: [],
        description: `Starting Zab with ${servers.length} servers and ${proposals.length} proposal(s); quorum is ${quorum}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: servers.length, leader: -1, epoch: leaderEpoch, quorum, zxids: [], committed: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(servers, leader, new Set()),
        edges: [],
        description: `Epoch ${leaderEpoch}: server ${leader} has the greatest (epoch, id) pair and becomes leader.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 1, cols: servers.length, leader, epoch: leaderEpoch, quorum, zxids: [], committed: 0 },
    };
    step += 1;

    const zxids: number[] = [];
    let committed = 0;
    for (let i = 0; i < proposals.length; i += 1) {
        const counter = i + 1;
        const zxid = leaderEpoch * 1000 + counter;
        zxids.push(zxid);

        // The leader plus quorum-1 followers acknowledge before commit.
        const acks = new Set<number>([leader]);
        for (const server of servers) {
            if (acks.size >= quorum) {
                break;
            }
            if (server.id !== leader) {
                acks.add(server.id);
            }
        }
        committed = i + 1;
        yield {
            stepNumber: step,
            entities: makeCells(servers, leader, acks),
            edges: [],
            description: `Proposal "${proposals[i]}" gets zxid ${zxid}; ${acks.size} acknowledgment(s) reach quorum ${quorum}, so it is delivered in order.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: servers.length,
                leader,
                epoch: leaderEpoch,
                quorum,
                zxids: [...zxids],
                committed,
                proposal: proposals[i],
                zxid,
                acknowledgments: acks.size,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(servers, leader, new Set(servers.map((s) => s.id))),
        edges: [],
        description: `All ${zxids.length} proposals are committed in zxid order. Every server delivers the same log. This simulation omits failures and is not production safe.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: servers.length,
            leader,
            epoch: leaderEpoch,
            quorum,
            zxids: [...zxids],
            committed: zxids.length,
            note: "teaching simulation, not production safe",
        },
    };
}

/** The Zab atomic broadcast teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "ZooKeeper keeps its replicas consistent by funneling all writes through one leader for an epoch. The leader stamps each proposal with a counter, and only after a quorum acknowledges does the proposal become committed. Because every server applies committed proposals in zxid order, all replicas end up with the same state.",
        invariants: [
            "The leader is the server with the greatest (epoch, server id) pair.",
            "zxids increase strictly with each proposal inside an epoch.",
            "A proposal is delivered only after at least a quorum of servers acknowledges it.",
        ],
        correctness:
            "A single leader serializes proposals, so no two proposals share a zxid and there is one unambiguous order. A quorum of any majority size intersects every other quorum, so a committed proposal is observed by any future leader's quorum. Delivering by ascending zxid makes the sequence identical on every server that applies the committed prefix.",
        complexityRationale:
            "Leader selection scans the n servers once and each of the m proposals is stamped and acknowledged in one pass, giving O(n + m) time. The server states and the replicated log take O(n + m) space.",
        uses: [
            "A teaching model for the ZooKeeper Atomic Broadcast protocol",
            "Explaining leader-based total-order broadcast",
            "Understanding zxid ordering in replicated coordination services",
        ],
        references: [
            "Junqueira, Reed, and Serafini, Zab: High-Performance Broadcast for Primary-Backup Systems, 2011",
            "Lamport, The Part-Time Parliament, 1998",
        ],
        workedExample:
            "With four servers all in epoch 1, server 3 becomes leader. Proposals a, b, c receive zxids 1001, 1002, 1003. A quorum of three servers acknowledges each, and every server delivers a, then b, then c in that order.",
    },
    id: "zab-consensus",
    name: "Zab Atomic Broadcast (Teaching Simulation)",
    category: "parallel-distributed",
    complexity: { time: "O(n + m)", space: "O(n + m)" },
    defaultInput: {
        servers: [
            { id: 0, epoch: 1 },
            { id: 1, epoch: 1 },
            { id: 2, epoch: 1 },
            { id: 3, epoch: 1 },
        ],
        proposals: ["a", "b", "c"],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the quorum as a strict majority of servers",
        "select the server with the greatest epoch then id as leader",
        "for each proposal in arrival order",
        "assign the next zxid from the leader epoch and a counter",
        "collect acknowledgments until the quorum is reached",
        "deliver the proposal to every server in zxid order",
        "done: report the committed log shared by all servers",
    ],
};

export default module;
