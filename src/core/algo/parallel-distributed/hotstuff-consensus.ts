/**
 * hotstuff-consensus.ts - HotStuff Three-Phase View (Toy Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * HotStuff is a Byzantine-fault-tolerant consensus protocol built around
 * chained three-phase commits and quorum certificates. This module models one
 * view: a leader proposes a block, replicas vote, and the leader forms a quorum
 * certificate from two f plus one matching votes in each of the prepare,
 * pre-commit, and commit phases. Only after a commit certificate does the view
 * decide. It is a deterministic teaching simulation on a fixed cluster; it is
 * not a networking implementation and gives no production safety guarantees.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages per phase, O(n) across the three phases
 *   Space: O(n) for replica states and vote counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are replicas: leader ACTIVE, crashed ERROR, voters VISITED.
 *   - Directed edges show a broadcast or a vote in flight.
 *   - Fault count, quorum, phase, certificates, and decision are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface HotStuffInput {
    nodes?: number;
    crash?: number | number[];
    value?: string;
}

type Role = "leader" | "follower" | "crashed" | "voter" | "decided";

/** Build replica nodes for one frame. */
function makeNodes(n: number, leader: number, crashed: Set<number>, voted: Set<number>): VisualEntity[] {
    const color: Record<Role, EntityState> = {
        leader: "active",
        follower: "idle",
        crashed: "error",
        voter: "visited",
        decided: "sorted",
    };
    return Array.from({ length: n }, (_, i) => {
        const role: Role = crashed.has(i) ? "crashed" : i === leader ? "leader" : voted.has(i) ? "voter" : "follower";
        return {
            id: `replica-${i}`,
            type: "node" as const,
            label: `R${i}${i === leader ? " (L)" : ""}`,
            value: role,
            state: color[role],
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, role, leader },
        };
    });
}

/** One directed message edge between replicas. */
function message(from: number, to: number, label: string): VisualEdge {
    return {
        id: `msg-${from}-${to}-${label}`,
        sourceId: `replica-${from}`,
        targetId: `replica-${to}`,
        label,
        state: "active" as const,
        directed: true,
    };
}

/** Run the single-view HotStuff simulation. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HotStuffInput | null) ?? {};
    const requested = typeof task.nodes === "number" && task.nodes >= 4 && task.nodes <= 7
        ? Math.floor(task.nodes)
        : 4;
    const n = requested <= 4 ? 4 : 7;
    const f = Math.floor((n - 1) / 3);
    const quorum = 2 * f + 1;
    const crashList = Array.isArray(task.crash)
        ? task.crash
        : typeof task.crash === "number" && task.crash >= 0
            ? [task.crash]
            : [];
    const crashed = new Set<number>(
        crashList.filter((i) => Number.isFinite(i) && i >= 0 && i < n).map((i) => Math.floor(i)),
    );
    const value = typeof task.value === "string" && task.value.length > 0 ? task.value : "block-1";
    const alive = Array.from({ length: n }, (_, i) => i).filter((i) => !crashed.has(i));
    const leader = alive[0] ?? 0;
    const phases = ["prepare", "pre-commit", "commit"];
    let step = 0;

    const frame = (
        voted: Set<number>,
        edges: VisualEdge[],
        description: string,
        line: number,
        votedCount: number,
        certificates: number,
        decided: boolean,
        phase: string,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeNodes(n, leader, crashed, voted),
        edges,
        description,
        codeLineNumber: line,
        layout: "graph",
        meta: {
            n,
            f,
            quorum,
            value,
            leader,
            crashed: [...crashed],
            alive: alive.length,
            phase,
            votedCount,
            certificates,
            decided,
            view: 1,
        },
    });

    yield frame(new Set(), [], `View 1 with ${n} replicas tolerates f = ${f} faults; quorum is ${quorum}.`, 0, 0, 0, false, "start");

    if (alive.length < quorum) {
        yield frame(new Set(), [], `Only ${alive.length} replicas are live, below ${quorum}; no quorum certificate can form.`, 1, 0, 0, false, "stalled");
        yield frame(new Set(), [], `View 1 ends without deciding "${value}"; a new view must be started.`, 6, 0, 0, false, "stalled");
        return;
    }

    let certificates = 0;
    for (const phase of phases) {
        const broadcast = alive.filter((i) => i !== leader).map((i) => message(leader, i, `${phase} proposal`));
        yield frame(new Set(), broadcast, `Leader ${leader} broadcasts the ${phase} proposal for "${value}".`, 2, 0, certificates, false, phase);

        const voted = new Set<number>();
        voted.add(leader);
        let votes = 1;
        yield frame(new Set(voted), [message(leader, leader, "self vote")], `Leader ${leader} votes in the ${phase} phase.`, 3, votes, certificates, false, phase);

        for (const replica of alive) {
            if (replica === leader || votes >= quorum) {
                continue;
            }
            voted.add(replica);
            votes += 1;
            yield frame(new Set(voted), [message(replica, leader, `${phase} vote`)], `Replica ${replica} votes in ${phase}; ${votes} of ${quorum} votes collected.`, 3, votes, certificates, false, phase);
        }

        if (votes >= quorum) {
            certificates += 1;
            yield frame(new Set(voted), [], `${phase} quorum certificate formed from ${votes} votes.`, 4, votes, certificates, false, phase);
        }
    }

    const decided = certificates === phases.length;
    const allVoted = new Set(alive);
    yield frame(
        allVoted,
        [],
        decided
            ? `Commit certificate complete; view 1 decides "${value}" with ${certificates} quorum certificates.`
            : `View 1 gathered ${certificates} certificates and did not decide.`,
        6,
        alive.length,
        certificates,
        decided,
        "decided",
    );
}

/** The HotStuff teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "HotStuff makes Byzantine agreement simple by routing everything through a leader and requiring certificates instead of counting individual votes. A leader proposes, replicas answer with votes, and any two f plus one votes form a quorum certificate because at most f replicas are faulty. Chaining prepare, pre-commit, and commit certificates ensures a decision is safe even when the leader changes between views.",
        invariants: [
            "The cluster has n equals three f plus one replicas and tolerates f Byzantine faults.",
            "A quorum certificate needs two f plus one matching votes.",
            "Any two quorums of size two f plus one overlap in at least one honest replica.",
        ],
        correctness:
            "With at most f faulty replicas, any set of two f plus one votes contains at least f plus one honest votes, and two such sets intersect in at least one honest replica. That replica will not sign conflicting certificates in the same phase, so a value backed by a certificate cannot be replaced. The additional pre-commit and commit certificates lock the value before the view decides, which is the three-chain safety rule.",
        complexityRationale:
            "Each phase sends one proposal to each replica and collects one vote from each, O(n) messages per phase and O(n) across the three phases. The simulation stores one role and one vote flag per replica, so space is O(n).",
        uses: [
            "Consensus in permissioned blockchains and BFT state machines",
            "Replicating a log when up to a third of nodes may misbehave",
            "A teaching model for quorum certificates and view-based leaders",
        ],
        references: [
            "Yin et al., HotStuff: BFT Consensus with Linearity and Responsiveness, 2019",
            "Yin et al., HotStuff: BFT Consensus in the Lens of Blockchain, 2020",
        ],
        workedExample:
            "With four replicas and one crashed, f is one and the quorum is three. Leader R0 collects votes from itself, R1, and R2 in prepare, forming the first certificate. Repeating in pre-commit and commit yields three certificates, so the view decides the proposed block even though one replica never responds.",
    },
    id: "hotstuff-consensus",
    name: "HotStuff Consensus (Three-Phase View)",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { nodes: 4, crash: -1, value: "block-1" },
    visualType: "graph",
    run,
    pseudocode: [
        "set fault tolerance f where n equals three f plus one",
        "set the quorum to two f plus one matching votes",
        "for each phase prepare, pre-commit, and commit",
        "leader broadcasts the proposal to every replica",
        "collect votes until the quorum is reached",
        "form a quorum certificate from those votes",
        "decide only after certificates from all three phases",
    ],
};

export default module;
