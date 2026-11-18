/**
 * mysticeti-consensus.ts - Mysticeti DAG Consensus (Teaching Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Mysticeti is a Byzantine-fault-tolerant consensus protocol that orders
 * transactions from a causal DAG of blocks rather than running a leader-driven
 * ballot for each decision. Validators advance in rounds; every block in a
 * round references at least two f plus one blocks from the previous round,
 * which is a quorum certificate. One block in each round is the leader. A
 * leader is committed when a quorum of blocks in the following round references
 * it, and committed leaders are ordered by round to give every replica the same
 * transaction sequence. This module simulates that DAG, the quorum
 * certificates, the leader commit rule, and the resulting total order on a
 * fixed set of validators. It is a deterministic teaching model, not a network
 * implementation, and it does not model timeouts, forks, or equivocation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * rounds) blocks, each referencing O(n) predecessors
 *   Space: O(n * rounds) for the block DAG and its edges
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are blocks; directed edges are causal references to round predecessors.
 *   - A committed leader is green, a block is blue when its quorum is formed.
 *   - The metadata lists leaders, commit status, and the final ordered values.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface MysticetiInput {
    nodes?: number;
    rounds?: number;
    crash?: number[];
}

interface Block {
    id: string;
    validator: number;
    round: number;
    value: string;
    references: string[];
    isLeader: boolean;
}

/** Build block nodes for a frame. */
function makeNodes(blocks: Block[], committedLeaders: Set<string>, certified: Set<string>): VisualEntity[] {
    return blocks.map((block) => {
        let state: EntityState = "idle";
        if (committedLeaders.has(block.id)) {
            state = "sorted";
        } else if (certified.has(block.id)) {
            state = "visited";
        } else if (block.isLeader) {
            state = "pivot";
        }
        return {
            id: `node-${block.id}`,
            type: "node" as const,
            label: `V${block.validator}R${block.round}${block.isLeader ? "*" : ""}`,
            value: block.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { validator: block.validator, round: block.round, leader: block.isLeader, value: block.value },
        };
    });
}

/** Build the reference edges of the DAG. */
function makeEdges(blocks: Block[], highlight: Set<string>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const block of blocks) {
        for (const ref of block.references) {
            const key = `${block.id}->${ref}`;
            edges.push({
                id: `edge-${key}`,
                sourceId: `node-${block.id}`,
                targetId: `node-${ref}`,
                label: "",
                state: highlight.has(key) ? "active" as const : "idle" as const,
                directed: true,
            });
        }
    }
    return edges;
}

/** The Mysticeti DAG simulation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MysticetiInput | null) ?? {};
    const requested = typeof task.nodes === "number" && task.nodes >= 4 && task.nodes <= 7
        ? Math.floor(task.nodes)
        : 4;
    const n = requested <= 4 ? 4 : 7;
    const f = Math.floor((n - 1) / 3);
    const quorum = 2 * f + 1;
    const rounds = typeof task.rounds === "number" ? Math.max(2, Math.min(5, Math.floor(task.rounds))) : 3;
    const crash = new Set<number>(
        Array.isArray(task.crash) ? task.crash.filter((i) => Number.isInteger(i) && i >= 0 && i < n) : [],
    );
    const alive = Array.from({ length: n }, (_, i) => i).filter((i) => !crash.has(i));

    const blocks: Block[] = [];
    const certified = new Set<string>();
    const committedLeaders = new Set<string>();
    const leaders: string[] = [];
    const commitOrder: string[] = [];
    let step = 0;

    const frame = (description: string, line: number, highlight: Set<string> = new Set()): VisualFrame => ({
        stepNumber: step++,
        entities: makeNodes(blocks, committedLeaders, certified),
        edges: makeEdges(blocks, highlight),
        description,
        codeLineNumber: line,
        layout: "graph",
        meta: {
            n,
            f,
            quorum,
            rounds,
            crashed: [...crash],
            alive: alive.length,
            blocks: JSON.stringify(blocks.map((b) => ({ id: b.id, round: b.round, leader: b.isLeader, value: b.value, references: [...b.references] }))),
            leaders: [...leaders],
            committedLeaders: [...committedLeaders],
            commitOrder: [...commitOrder],
        },
    });

    yield frame(`A DAG of ${n} validators tolerates f = ${f} Byzantine faults; a quorum is ${quorum} references.`, 0);

    if (alive.length < quorum) {
        yield frame(`Only ${alive.length} validators are live, below the quorum of ${quorum}; no leader can be certified.`, 1);
        yield frame("Consensus stalls; a new epoch with more live validators is required.", 8);
        return;
    }

    // Build the DAG round by round. Each block references a quorum of the previous round.
    for (let r = 1; r <= rounds; r += 1) {
        const leaderV = alive[(r - 1) % alive.length]!;
        const leaderId = `V${leaderV}R${r}`;
        leaders.push(leaderId);

        for (const v of alive) {
            const references: string[] = [];
            if (r > 1) {
                // Honest blocks reference the previous leader first, then fill a quorum cyclically.
                const prevLeaderV = alive[(r - 2) % alive.length]!;
                const ordered = [prevLeaderV, ...alive.filter((x) => x !== prevLeaderV)];
                for (let k = 0; k < quorum && k < ordered.length; k += 1) {
                    references.push(`V${ordered[k]}R${r - 1}`);
                }
            }
            blocks.push({
                id: `V${v}R${r}`,
                validator: v,
                round: r,
                value: `tx-${v}-${r}`,
                references,
                isLeader: v === leaderV,
            });
        }

        const highlight = new Set<string>();
        for (const block of blocks) {
            if (block.round === r) {
                for (const ref of block.references) {
                    highlight.add(`${block.id}->${ref}`);
                }
            }
        }
        yield frame(
            `Round ${r}: ${alive.length} blocks proposed; each references a quorum of ${quorum} round ${r - 1} blocks. Leader is ${leaderId}.`,
            r === 1 ? 2 : 3,
            highlight,
        );

        if (r > 1) {
            const prevLeaderId = leaders[leaders.length - 2]!;
            const voters = blocks.filter((b) => b.round === r && b.references.includes(prevLeaderId));
            if (voters.length >= quorum) {
                certified.add(prevLeaderId);
                committedLeaders.add(prevLeaderId);
                const leaderBlock = blocks.find((b) => b.id === prevLeaderId);
                if (leaderBlock) {
                    commitOrder.push(leaderBlock.value);
                }
                yield frame(
                    `Leader ${prevLeaderId} is referenced by ${voters.length} blocks, a quorum, so it commits.`,
                    5,
                    new Set(voters.map((b) => `${b.id}->${prevLeaderId}`)),
                );
            } else {
                yield frame(
                    `Leader ${prevLeaderId} has only ${voters.length} votes, below ${quorum}; it is skipped.`,
                    6,
                );
            }
        }
    }

    yield frame(
        `DAG complete: ${committedLeaders.size} leader(s) committed in order [${commitOrder.join(", ")}].`,
        8,
    );
}

/** The Mysticeti consensus module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of electing one leader and voting repeatedly, Mysticeti lets every validator keep adding blocks to a shared DAG. Each block points back to a quorum of earlier blocks, so the DAG itself carries the votes. When enough later blocks point to a leader, that leader is safely committed, and reading the committed leaders by round gives all replicas the same global order.",
        invariants: [
            "Every non-genesis block references at least two f plus one prior-round blocks.",
            "Two quorums of size two f plus one intersect in at least one honest validator's block.",
            "Committed leaders enter the total order in increasing round number.",
        ],
        correctness:
            "A leader is committed only when a quorum of next-round blocks references it. Because at most f validators are faulty and a quorum has two f plus one members, any two such quorums share at least one honest validator whose single block cannot support two conflicting leaders in the same round. Therefore two replicas cannot commit different leaders for the same round. Ordering committed leaders by round then yields an identical total order everywhere, and the causal references pull each leader's predecessor transactions into that order as well.",
        complexityRationale:
            "There are n blocks per round and each references up to a quorum of predecessors, so building and scanning the DAG costs O(n * rounds * n) = O(n^2 * rounds) time. Storing the blocks and their edges uses O(n * rounds * n) = O(n^2 * rounds) space in the worst case.",
        uses: [
            "Ordering transactions in high-throughput proof-of-stake blockchains",
            "Reaching Byzantine agreement with a DAG mempool and low latency",
            "A teaching model for leader commit rules and quorum certificates",
        ],
        references: [
            "Spiegelman et al., Mysticeti: Low-Latency DAG Consensus with Fast Commit Path, 2023",
            "Danezis et al., Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus, 2022",
        ],
        workedExample:
            "With four validators and one crashed, f is one and a quorum is three. The three live validators keep proposing blocks that each reference three predecessors. The leader of round two receives references from all three live blocks in round three, forming a quorum, so it commits and its transaction enters the order after the round-one leader.",
    },
    id: "mysticeti-consensus",
    name: "Mysticeti DAG Consensus (Simulation)",
    category: "parallel-distributed",
    complexity: { time: "O(n^2 * rounds)", space: "O(n^2 * rounds)" },
    defaultInput: { nodes: 4, rounds: 3, crash: [] },
    visualType: "graph",
    run,
    pseudocode: [
        "set fault tolerance f and quorum two f plus one",
        "identify the live validators for this epoch",
        "for each round from one to the round limit",
        "choose one live validator as the round leader",
        "each validator proposes a block referencing a quorum of prior blocks",
        "count next-round blocks that reference the previous leader",
        "commit the leader when that count reaches the quorum",
        "append committed leader values in round order",
        "done: report the committed total order",
    ],
};

export default module;
