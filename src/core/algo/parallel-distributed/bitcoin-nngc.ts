/**
 * bitcoin-nngc.ts - Bitcoin-NG Key Block and Microblock Chains (toy simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bitcoin-NG separates leader election from transaction throughput. Time is
 * divided into epochs; each epoch begins with a key block that elects a leader,
 * and that leader streams many microblocks until the next key block arrives.
 * Fork choice prefers the chain with more key blocks, breaking ties by total
 * microblock count, so short-lived microblock forks do not fork the ledger.
 *
 * This is a deterministic teaching simulation with a fixed leader schedule and
 * a single scripted fork. It does not model proof-of-work difficulty, block
 * propagation delays, transaction validity, or incentives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * microblocks) to build and score the chains
 *   Space: O(rounds * microblocks) for the block grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells (round, slot) show a key block in slot zero and microblocks
 *     after it.
 *   - Key blocks are yellow, microblocks are idle, chosen-chain cells green.
 *   - meta carries the leader schedule, chain work, and the fork decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    rounds: number,
    microblocks: number,
    revealed: number,
    chosen: boolean,
    leader: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let round = 0; round < rounds; round += 1) {
        for (let slot = 0; slot <= microblocks; slot += 1) {
            const visible = round < revealed;
            const isKey = slot === 0;
            let state: EntityState = "unvisited";
            if (visible) {
                state = isKey ? "comparing" : "idle";
                if (chosen) state = isKey ? "active" : "sorted";
            }
            const value = round * (microblocks + 1) + slot;
            entities.push({
                id: `cell-${round}-${slot}`,
                type: "cell" as const,
                label: !visible ? "-" : isKey ? `K${round}` : `M${round}.${slot}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: round, col: slot, round, slot, keyBlock: isKey, leader: isKey ? leader : -1 },
            });
        }
    }
    return entities;
}

/** Simulate key-block leader rotation, microblock streaming, and fork choice. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { miners?: number; rounds?: number; microblocks?: number; forkRound?: number } | null) ?? {};
    const miners = typeof task.miners === "number" ? Math.max(2, Math.floor(task.miners)) : 4;
    const rounds = typeof task.rounds === "number" ? Math.max(2, Math.floor(task.rounds)) : 4;
    const microblocks = typeof task.microblocks === "number" ? Math.max(1, Math.floor(task.microblocks)) : 3;
    const forkRound = typeof task.forkRound === "number"
        ? Math.max(1, Math.min(rounds - 1, Math.floor(task.forkRound)))
        : 2;

    const leaders = Array.from({ length: rounds }, (_, round) => (round * 7 + 3) % miners);
    const mainKeyBlocks = rounds;
    const mainMicroblocks = rounds * microblocks;
    // The competing fork branches at forkRound and stops one key block early.
    const forkKeyBlocks = forkRound === 0 ? 0 : forkRound - 1;
    const forkMicroblocks = forkKeyBlocks * microblocks;
    const mainWork = mainKeyBlocks * 100 + mainMicroblocks;
    const forkWork = forkKeyBlocks * 100 + forkMicroblocks;
    const chosen = mainKeyBlocks !== forkKeyBlocks
        ? (mainKeyBlocks > forkKeyBlocks ? "main" : "fork")
        : (mainMicroblocks >= forkMicroblocks ? "main" : "fork");

    const meta = (phase: string, revealed: number, currentLeader: number) => ({
        phase,
        rows: rounds,
        cols: microblocks + 1,
        revealed,
        miners,
        leaders,
        mainKeyBlocks,
        mainMicroblocks,
        forkKeyBlocks,
        forkMicroblocks,
        mainWork,
        forkWork,
        chosen,
        leader: currentLeader,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rounds, microblocks, 0, false, -1),
        edges: [],
        description: `Simulating ${rounds} Bitcoin-NG epochs across ${miners} miners.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("init", 0, -1),
    };
    step += 1;

    for (let round = 0; round < rounds; round += 1) {
        const leader = leaders[round]!;
        yield {
            stepNumber: step,
            entities: makeCells(rounds, microblocks, round + 1, false, leader),
            edges: [],
            description: `Round ${round}: key block elects leader ${leader}, who streams ${microblocks} microblock(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta("epoch", round + 1, leader),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rounds, microblocks, rounds, false, -1),
        edges: [],
        description: `Fork detected at round ${forkRound}: main chain has ${mainKeyBlocks} key blocks, fork has ${forkKeyBlocks}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: meta("fork", rounds, -1),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(rounds, microblocks, rounds, chosen === "main", -1),
        edges: [],
        description: `Fork choice selects the ${chosen} chain with work ${chosen === "main" ? mainWork : forkWork}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta("chosen", rounds, -1),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Running one leader-election puzzle per transaction is wasteful. Bitcoin-NG elects a leader once per epoch with a key block and lets that leader publish a rapid stream of microblocks. A double-spend attempt only forks the microblocks inside an epoch, while the key-block chain keeps growing, so nodes follow the longest key-block chain and discard short microblock forks.",
        invariants: [
            "Each key block has exactly one elected leader from the miner set.",
            "Microblocks are only valid under the key block of their own epoch.",
            "Fork choice prefers more key blocks and uses microblock count only as a tie break.",
        ],
        correctness:
            "The leader schedule assigns one leader to each round, so every key block is well formed. Counting key blocks defines the main chain length; a fork that stops an epoch early has fewer key blocks and is strictly shorter. The fork-choice rule compares key-block counts first, so the longer chain wins regardless of how many microblocks the shorter one contains. Only when key-block counts tie does the microblock count decide, matching the design goal that microblock forks do not split the ledger.",
        complexityRationale:
            "Building the grid visits every round and slot once, O(rounds times microblocks). Scoring each chain is a constant-time count of its key blocks and microblocks, and the stored grid uses O(rounds times microblocks) space.",
        uses: [
            "High-throughput blockchains that decouple consensus from transaction rate",
            "Teaching the difference between leader election and transaction ordering",
            "Analyzing fork-choice rules under short-lived network partitions",
        ],
        references: [
            "Eyal et al., Bitcoin-NG: A Scalable Blockchain Protocol, 2015",
            "Nakamoto, Bitcoin: A Peer-to-Peer Electronic Cash System, 2008",
        ],
        workedExample:
            "With four miners, four rounds and three microblocks each, the deterministic schedule elects leaders three, two, one and zero. The main chain has four key blocks and twelve microblocks. A fork that branches at round two and has only one key block loses immediately, so the main chain is chosen.",
    },
    id: "bitcoin-nngc",
    name: "Bitcoin-NG Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * microblocks)", space: "O(rounds * microblocks)" },
    defaultInput: { miners: 4, rounds: 4, microblocks: 3, forkRound: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a leader for every epoch from the fixed schedule",
        "emit one key block per epoch and elect its leader",
        "let the leader publish a fixed number of microblocks",
        "build a competing fork that stops one epoch early",
        "score each chain by key blocks then microblocks",
        "follow the chain with the greater work",
        "done: report the chosen chain and the leader schedule",
    ],
};

export default module;
