/**
 * bullshark-consensus.ts - Bullshark DAG Consensus (Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bullshark is a Byzantine-fault-tolerant consensus protocol that reads a
 * decision directly from a directed acyclic graph of blocks. Each wave has a
 * leader block; replicas in the following round vote for it by referencing it
 * in their own blocks. If the leader gathers a quorum of two f plus one votes
 * it forms a certificate and the value is decided. If the leader is not
 * supported, a shared coin selects a new leader for the next wave. This module
 * models that single decision rule on a fixed cluster. It is a deterministic
 * teaching simulation, not a networking implementation, and gives no
 * production safety or liveness guarantees.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(w * n) for w waves and n replicas
 *   Space: O(n) for replica states and vote counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are replicas: leader ACTIVE, crashed ERROR, voters VISITED.
 *   - Directed edges show the leader proposal and each vote in flight.
 *   - Fault count, quorum, wave, leader, vote count, and decision are in meta.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface BullsharkInput {
    nodes?: number;
    crash?: number | number[];
    value?: string;
    coin?: number;
    maxWaves?: number;
}

type Role = "leader" | "follower" | "crashed" | "voter" | "decided";

/** Build the replica nodes for one frame. */
function makeNodes(n: number, leader: number, crashed: Set<number>, voted: Set<number>, decided: boolean): VisualEntity[] {
    const color: Record<Role, EntityState> = {
        leader: "active",
        follower: "idle",
        crashed: "error",
        voter: "visited",
        decided: "sorted",
    };
    return Array.from({ length: n }, (_, i) => {
        const role: Role = crashed.has(i)
            ? "crashed"
            : decided
                ? "decided"
                : i === leader
                    ? "leader"
                    : voted.has(i)
                        ? "voter"
                        : "follower";
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

/** Run the Bullshark wave simulation. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BullsharkInput | null) ?? {};
    const requested = typeof task.nodes === "number" && task.nodes >= 4 ? Math.floor(task.nodes) : 4;
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
    const coin = typeof task.coin === "number" && Number.isFinite(task.coin) ? Math.floor(task.coin) : 0;
    const maxWaves = typeof task.maxWaves === "number" ? Math.max(1, Math.min(4, Math.floor(task.maxWaves))) : 2;
    const alive = Array.from({ length: n }, (_, i) => i).filter((i) => !crashed.has(i));
    let step = 0;

    const frame = (
        leader: number,
        voted: Set<number>,
        edges: VisualEdge[],
        description: string,
        line: number,
        wave: number,
        votes: number,
        certificates: number,
        decided: boolean,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeNodes(n, leader, crashed, voted, decided),
        edges,
        description,
        codeLineNumber: line,
        layout: "graph",
        meta: {
            n,
            f,
            quorum,
            value,
            coin,
            crashed: [...crashed],
            alive: alive.length,
            leader,
            wave,
            votes,
            certificates,
            decided,
        },
    });

    yield frame(alive[0] ?? 0, new Set(), [], `Bullshark on ${n} replicas tolerates f = ${f} faults; a certificate needs ${quorum} votes.`, 0, 0, 0, 0, false);

    if (alive.length < quorum) {
        yield frame(alive[0] ?? 0, new Set(), [], `Only ${alive.length} replicas are live, below the ${quorum} quorum; no certificate can form.`, 1, 0, 0, 0, false);
        yield frame(alive[0] ?? 0, new Set(), [], `No wave can decide "${value}"; the view must be reconfigured.`, 7, 0, 0, 0, false);
        return;
    }

    let certificates = 0;
    for (let wave = 1; wave <= maxWaves; wave += 1) {
        const leader = alive[(coin + wave - 1) % alive.length] ?? alive[0] ?? 0;
        const proposal = alive.filter((i) => i !== leader).map((i) => message(leader, i, `wave ${wave} proposal`));
        yield frame(leader, new Set(), proposal, `Wave ${wave}: leader ${leader} proposes "${value}" and references it in the DAG.`, 2, wave, 0, certificates, false);

        const voted = new Set<number>([leader]);
        let votes = 1;
        yield frame(leader, new Set(voted), [message(leader, leader, "self vote")], `Leader ${leader} votes for its own block.`, 3, wave, votes, certificates, false);

        for (const replica of alive) {
            if (replica === leader || votes >= quorum) {
                continue;
            }
            voted.add(replica);
            votes += 1;
            yield frame(leader, new Set(voted), [message(replica, leader, `wave ${wave} vote`)], `Replica ${replica} references the leader block; ${votes} of ${quorum} votes collected.`, 3, wave, votes, certificates, false);
        }

        if (votes >= quorum) {
            certificates += 1;
            yield frame(leader, new Set(voted), [], `Leader ${leader} has a certificate of ${votes} votes; decision is safe.`, 4, wave, votes, certificates, false);
            yield frame(leader, new Set(alive), [], `Bullshark decides "${value}" in wave ${wave} from one quorum certificate.`, 6, wave, votes, certificates, true);
            return;
        }

        yield frame(leader, new Set(voted), [], `Wave ${wave} gathered only ${votes} votes, below ${quorum}; the coin picks a new leader.`, 5, wave, votes, certificates, false);
    }

    yield frame(alive[0] ?? 0, new Set(), [], `After ${maxWaves} waves Bullshark has no certificate and has not decided "${value}".`, 7, maxWaves, 0, certificates, false);
}

/** The Bullshark teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Bullshark reads consensus straight out of a block DAG instead of running a long sequence of voting phases. A leader block is proposed and replicas vote by referencing it in later blocks. Enough references form a quorum certificate that safely fixes the value, and a shared coin picks a fresh leader when a proposal fails to attract support.",
        invariants: [
            "The cluster has n equals three f plus one replicas and tolerates f Byzantine faults.",
            "A certificate requires two f plus one matching votes.",
            "Any two quorums of size two f plus one overlap in at least one honest replica.",
        ],
        correctness:
            "With at most f faulty replicas, any set of two f plus one votes contains at least f plus one honest votes, and two such quorums intersect in at least one honest replica. That replica signs only one leader block per wave, so two conflicting values cannot both collect certificates. A leader with a certificate is therefore safe to decide; the coin eventually selects an honest leader under the standard randomness assumption, giving liveness.",
        complexityRationale:
            "Each wave sends one proposal to each replica and collects up to one vote from each, O(n) messages per wave and O(w n) for w waves. The simulation stores one role and one vote flag per replica, so space is O(n).",
        uses: [
            "Ordering transactions in DAG-based blockchains such as Narwhal and Mysticeti descendants",
            "Byzantine state-machine replication with optimistic single-certificate commits",
            "A teaching model for extracting consensus from a causal block graph",
        ],
        references: [
            "Spiegelman, Xiang, and van Renesse, Bullshark: DAG BFT Protocols Made Practical, 2022",
            "Danezis, Giridharan, Kokoris-Kogias, and Sonnino, Narwhal and Tusk, 2022",
        ],
        workedExample:
            "With four replicas and one crashed, f is one and a certificate needs three votes. Leader R0 proposes a block in wave one and collects votes from R0, R1, and R2. Those three votes form a certificate, so the value is decided in a single wave even though R3 never responds.",
    },
    id: "bullshark-consensus",
    name: "Bullshark Consensus (Teaching Core)",
    category: "parallel-distributed",
    complexity: { time: "O(w * n)", space: "O(n)" },
    defaultInput: { nodes: 4, crash: -1, value: "block-1", coin: 0, maxWaves: 2 },
    visualType: "graph",
    run,
    pseudocode: [
        "set fault tolerance f where n equals three f plus one",
        "set the certificate quorum to two f plus one votes",
        "for each wave choose a leader using the shared coin",
        "leader proposes a block and replicas reference it in the DAG",
        "count the votes gathered for the leader block",
        "if votes reach the quorum form a certificate and decide the value",
        "otherwise continue to the next wave with a new leader",
        "done: report the decision or the absence of one",
    ],
};

export default module;
