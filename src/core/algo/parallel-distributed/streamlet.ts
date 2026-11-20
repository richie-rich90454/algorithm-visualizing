/**
 * streamlet.ts - Streamlet BFT Consensus (Notarize and Finalize)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Streamlet groups time into epochs, each with a designated leader who
 * proposes a block extending the longest notarized chain. Replicas vote once
 * per epoch. A block becomes notarized when it gathers more than two thirds of
 * the votes, and it becomes finalized when a notarized block extends it in the
 * next epoch. Finalization is irreversible because a later notarized block
 * always builds on the longest notarized chain.
 *
 * This deterministic teaching simulation computes notarized and finalized
 * blocks from an epoch schedule of leaders and parent links.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E) votes for E epochs, one message round per phase
 *   Space: O(E) for the block tree and vote tallies
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per epoch shows the leader and parent link.
 *   - Notarized blocks are amber; finalized blocks are green.
 *   - The final frame lists the finalized chain.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface StreamletEpoch {
    leader: number;
    parent: number;
}

export interface StreamletData {
    epochs: number;
    notarized: boolean[];
    finalized: boolean[];
    finalizedChain: number[];
}

/** Deterministic Streamlet notarization and finalization over an epoch schedule. */
export function simulateStreamlet(schedule: StreamletEpoch[]): StreamletData {
    const epochs = schedule.length;
    const notarized: boolean[] = Array<boolean>(epochs).fill(false);
    for (let k = 0; k < epochs; k += 1) {
        const parent = schedule[k]?.parent ?? -1;
        notarized[k] = parent === 0 || (parent >= 1 && parent <= k && (notarized[parent - 1] ?? false));
    }
    const finalized: boolean[] = Array<boolean>(epochs).fill(false);
    for (let k = 0; k < epochs; k += 1) {
        if (!notarized[k]) continue;
        for (let j = k + 1; j < epochs; j += 1) {
            if (notarized[j] && schedule[j]?.parent === k + 1) {
                finalized[k] = true;
                break;
            }
        }
    }
    const finalizedChain = finalized.map((value, i) => (value ? i + 1 : -1)).filter((h) => h >= 0);
    return { epochs, notarized, finalized, finalizedChain };
}

/** Grid cells, one per epoch. */
function makeCells(schedule: StreamletEpoch[], states: EntityState[]): VisualEntity[] {
    return schedule.map((epoch, index) => ({
        id: `epoch-${index}`,
        type: "cell" as const,
        label: `e${index + 1}:L${epoch.leader}`,
        value: index + 1,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, leader: epoch.leader, parent: epoch.parent, row: Math.floor(index / 5), col: index % 5 },
    }));
}

/** The Streamlet generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { schedule?: StreamletEpoch[] } | null) ?? {};
    const schedule: StreamletEpoch[] = Array.isArray(task.schedule) && task.schedule.length > 0
        ? task.schedule.map((e, i) => ({
            leader: typeof e?.leader === "number" ? e.leader : i % 4,
            parent: typeof e?.parent === "number" ? e.parent : i,
        }))
        : [
            { leader: 0, parent: 0 },
            { leader: 1, parent: 1 },
            { leader: 2, parent: 2 },
            { leader: 3, parent: 3 },
            { leader: 0, parent: 4 },
        ];
    const data = simulateStreamlet(schedule);

    yield {
        stepNumber: 0,
        entities: makeCells(schedule, Array<EntityState>(data.epochs).fill("idle")),
        edges: [],
        description: `Streamlet with ${data.epochs} epochs: each leader proposes one block extending the longest notarized chain.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { epochs: data.epochs, notarized: 0, finalized: 0, phase: "setup" },
    };

    const notarizedStates: EntityState[] = data.notarized.map((n) => (n ? "active" : "error"));
    yield {
        stepNumber: 1,
        entities: makeCells(schedule, notarizedStates),
        edges: [],
        description: `Prepare vote: ${data.notarized.filter(Boolean).length} of ${data.epochs} block(s) gathered votes from more than two thirds of replicas.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {
            epochs: data.epochs,
            notarized: data.notarized.filter(Boolean).length,
            finalized: 0,
            phase: "notarize",
            notarizedFlags: data.notarized.map((n) => (n ? 1 : 0)),
        },
    };

    const finalStates: EntityState[] = data.finalized.map((f, i) => (f ? "sorted" : data.notarized[i] ? "active" : "idle"));
    yield {
        stepNumber: 2,
        entities: makeCells(schedule, finalStates),
        edges: [],
        description: `Commit: ${data.finalizedChain.length} block(s) are finalized because a notarized child extends them; the finalized chain is [${data.finalizedChain.join(", ")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {
            epochs: data.epochs,
            notarized: data.notarized.filter(Boolean).length,
            finalized: data.finalizedChain.length,
            phase: "done",
            finalizedChain: data.finalizedChain,
        },
    };
}

/** The Streamlet module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Run a leader-based protocol in short epochs. Each block points to a parent, and a block only counts once more than two thirds of replicas vote for it. A block becomes permanent when the next epoch's leader builds a notarized block on top of it. Because notarized blocks always extend the longest notarized chain, two conflicting blocks can never both be finalized.",
        invariants: [
            "A block is notarized only when it extends a notarized parent or genesis.",
            "Finalization requires a notarized block whose parent is the candidate.",
            "A finalized block can never be replaced by a conflicting later block.",
        ],
        correctness:
            "Consider a notarized block B at epoch e and any later notarized block C. Because more than two thirds of replicas vote in each phase and the two quorums intersect in at least one honest replica, C must extend the longest notarized chain as seen by that replica, which includes B or a descendant of B. Hence no notarized block after e can conflict with B. Once B has a notarized child, B is finalized and every future notarized block extends it, giving safety and a grow-only finalized chain.",
        complexityRationale:
            "Each epoch runs one prepare and one commit vote among N replicas, so O(N) messages per epoch and O(E * N) overall for E epochs. Storing the block tree and vote counts uses O(E) space.",
        uses: [
            "Proof-of-stake finality gadgets that need simple, auditable safety",
            "Permissioned ledgers such as the Streamlet-based prototypes",
            "Teaching BFT consensus with short, pipelined epochs",
        ],
        references: [
            "Yandamuri, Abraham, and Nayak, Streamlet: Textbook Streamlined Blockchains, 2020",
            "Castro and Liskov, Practical Byzantine Fault Tolerance, 1999",
        ],
        workedExample:
            "Five epochs propose blocks with parents 0, 1, 2, 3, and 4, forming a straight chain. All five become notarized, and epochs 1 through 4 are finalized because each has a notarized child. The last block waits for the next epoch before it can finalize.",
    },
    id: "streamlet",
    name: "Streamlet",
    category: "parallel-distributed",
    complexity: { time: "O(E*N) messages", space: "O(E)" },
    defaultInput: {
        schedule: [
            { leader: 0, parent: 0 },
            { leader: 1, parent: 1 },
            { leader: 2, parent: 2 },
            { leader: 3, parent: 3 },
            { leader: 0, parent: 4 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "assign one leader to each epoch",
        "leader proposes a block extending the longest notarized chain",
        "replicas vote once for the proposed block",
        "notarize a block with more than two thirds of the votes",
        "finalize a notarized block that has a notarized child",
        "ignore votes for blocks that do not extend the notarized chain",
        "append finalized blocks to the permanent ledger",
        "done: report the finalized chain",
    ],
};

export default module;
