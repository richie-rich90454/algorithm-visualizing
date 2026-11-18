/**
 * swim-membership.ts - SWIM Gossip Membership and Failure Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SWIM keeps every member's view of the group eventually consistent without a
 * coordinator. Each member periodically probes one peer: it sends a direct
 * ping, and if no acknowledgement arrives it asks k other members to relay an
 * indirect ping. A peer that answers no probe is first marked suspect and only
 * confirmed dead after several independent suspicions. Membership changes are
 * piggybacked on pings and acknowledgements, so the news spreads gossip-style.
 *
 * This is a deterministic teaching simulation. Peer selection uses a fixed
 * round-robin schedule, failures and dropped acknowledgements are injected by
 * the input, and there is no real network, no message loss beyond the injected
 * case, and no suspicion-incarnation numbers. The protocol mechanics are exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * n * k) for n members and k indirect helpers
 *   Space: O(n^2) for every member's membership table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cell (observer, target) shows that observer's view of the target.
 *   - Alive is neutral, suspect is yellow, confirmed dead is red.
 *   - meta carries the full table, indirect probe count, and convergence flag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Status = "alive" | "suspect" | "dead";

/** Build the observer-by-target membership grid. */
function makeCells(
    table: Status[][],
    activeObserver: number,
    activeTarget: number,
    failed: number,
    flaky: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let observer = 0; observer < table.length; observer += 1) {
        for (let target = 0; target < table.length; target += 1) {
            const status = table[observer]?.[target] ?? "alive";
            let state: EntityState = "idle";
            if (status === "suspect") {
                state = "comparing";
            } else if (status === "dead") {
                state = "error";
            }
            if (observer === activeObserver && target === activeTarget) {
                state = status === "dead" ? "error" : "active";
            }
            const note = target === failed ? " failed" : target === flaky ? " flaky" : "";
            entities.push({
                id: `cell-${observer}-${target}`,
                type: "cell",
                label: `s${observer}>t${target}:${status}${note}`,
                value: status,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: observer, col: target, observer, target, status },
            });
        }
    }
    return entities;
}

/** The SWIM membership generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            nodes?: number;
            failed?: number;
            flaky?: number;
            rounds?: number;
            indirectK?: number;
            suspectThreshold?: number;
        } | null
    ) ?? {};
    const n = Math.min(12, Math.max(3, Math.floor(Number(task.nodes ?? 8)) || 8));
    const failedInput = Math.floor(Number(task.failed ?? 5));
    const failed = failedInput >= 0 && failedInput < n ? failedInput : -1;
    const flakyInput = Math.floor(Number(task.flaky ?? -1));
    const flaky = flakyInput >= 0 && flakyInput < n ? flakyInput : -1;
    const rounds = Math.min(120, Math.max(1, Math.floor(Number(task.rounds ?? 4 * n)) || 4 * n));
    const indirectK = Math.min(n - 2, Math.max(1, Math.floor(Number(task.indirectK ?? 2)) || 2));
    const suspectThreshold = Math.min(8, Math.max(1, Math.floor(Number(task.suspectThreshold ?? 2)) || 2));

    const table: Status[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => "alive" as Status));
    const suspicions: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    let indirectProbes = 0;

    const meta = (round: number, observer: number, target: number, done: boolean) => {
        let deadKnown = 0;
        for (let s = 0; s < n; s += 1) {
            if (s !== failed && table[s]?.[failed] === "dead") {
                deadKnown += 1;
            }
        }
        return {
            rows: n,
            cols: n,
            round,
            n,
            failed,
            flaky,
            indirectK,
            suspectThreshold,
            indirectProbes,
            deadKnown,
            aliveCount: n - 1,
            activeObserver: observer,
            activeTarget: target,
            statuses: table.flat(),
            done,
            note: "deterministic SWIM teaching model: round-robin probes, injected failures, no real network",
        };
    };

    yield {
        stepNumber: 0,
        entities: makeCells(table, -1, -1, failed, flaky),
        edges: [],
        description: `SWIM on ${n} members; node ${failed} is down${flaky >= 0 ? ` and node ${flaky} drops direct pings but answers indirect ones` : ""}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, -1, -1, false),
    };
    let step = 1;

    let converged = false;
    for (let round = 0; round < rounds && !converged; round += 1) {
        for (let observer = 0; observer < n; observer += 1) {
            if (observer === failed) {
                continue;
            }
            const target = (observer + round) % n;
            if (target === observer) {
                continue;
            }

            if (target === failed) {
                // Direct ping times out, then k indirect relays also fail.
                indirectProbes += indirectK;
                const count = (suspicions[observer]?.[target] ?? 0) + 1;
                if (suspicions[observer]) {
                    suspicions[observer]![target] = count;
                }
                if (table[observer]) {
                    table[observer]![target] = count >= suspectThreshold ? "dead" : "suspect";
                }
            } else if (target === flaky) {
                // Direct acknowledgement is dropped, but indirect relays get through.
                indirectProbes += indirectK;
                if (suspicions[observer]) {
                    suspicions[observer]![target] = 0;
                }
                if (table[observer]) {
                    table[observer]![target] = "alive";
                }
            } else {
                // Acknowledgement received; clear any stale suspicion.
                if (suspicions[observer]) {
                    suspicions[observer]![target] = 0;
                }
                if (table[observer]) {
                    table[observer]![target] = "alive";
                }
                // Piggyback membership updates in both directions.
                for (let subject = 0; subject < n; subject += 1) {
                    if (table[observer]?.[subject] === "dead" && table[target]?.[subject] !== "dead") {
                        if (table[target]) {
                            table[target]![subject] = "dead";
                        }
                    }
                    if (table[target]?.[subject] === "dead" && table[observer]?.[subject] !== "dead") {
                        if (table[observer]) {
                            table[observer]![subject] = "dead";
                        }
                    }
                }
            }

            let deadKnown = 0;
            for (let s = 0; s < n; s += 1) {
                if (s !== failed && table[s]?.[failed] === "dead") {
                    deadKnown += 1;
                }
            }
            converged = deadKnown === n - 1;
            yield {
                stepNumber: step,
                entities: makeCells(table, observer, target, failed, flaky),
                edges: [],
                description:
                    target === failed
                        ? `Round ${round + 1}: s${observer} pings failed node ${target}; ${indirectK} indirect probes fail, suspicion ${suspicions[observer]?.[target] ?? 0}/${suspectThreshold}.`
                        : target === flaky
                          ? `Round ${round + 1}: s${observer} loses the direct ack from flaky node ${target}; indirect probes confirm it is alive.`
                          : `Round ${round + 1}: s${observer} gets an ack from s${target} and piggybacks membership updates.`,
                codeLineNumber: target === failed ? 3 : target === flaky ? 5 : 6,
                layout: "grid",
                meta: meta(round + 1, observer, target, converged),
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(table, -1, -1, failed, flaky),
        edges: [],
        description: converged
            ? `All ${n - 1} live members agree that node ${failed} is dead after ${indirectProbes} indirect probe(s).`
            : `Stopped before full agreement: ${(meta(rounds, -1, -1, false) as { deadKnown: number }).deadKnown} of ${n - 1} live members marked node ${failed} dead.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: { ...meta(rounds, -1, -1, converged), converged },
    };
}

/** The SWIM membership module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "SWIM replaces a central health checker with gossip. Every member taps one random peer on the shoulder; if the peer does not answer, a few other members are asked to relay the question. A single missed ping only raises suspicion, so the group is not split by one lost packet, and membership changes ride along on ordinary messages until everyone has heard them.",
        invariants: [
            "A peer is marked dead only after at least the configured number of independent suspicions.",
            "A peer that answers a direct or indirect ping is immediately considered alive again.",
            "Membership knowledge only moves from alive member to alive member by piggybacking on pings and acknowledgements.",
        ],
        correctness:
            "A failed member can never answer a direct or indirect ping, so each live observer that probes it increments its suspicion until the threshold is reached and the status becomes dead. A live member that merely drops direct acknowledgements still answers through relays, so its suspicion is cleared and it is never confirmed dead. Because every ordered pair of live members probes each other within n rounds of the round-robin schedule, once one member knows a death it is forwarded to all others within another n rounds, so all live members eventually agree.",
        complexityRationale:
            "There are n members probing one peer per round, and a failed probe triggers at most k relays, so a round costs O(n*k) messages. Each member stores a status for every other member, which is O(n^2) space across the group.",
        uses: [
            "Failure detection in HashiCorp Consul and memberlist",
            "Membership gossip in Cassandra and other distributed stores",
            "Decentralized health checking in large peer-to-peer clusters",
        ],
        references: [
            "Das, Gupta and Motivala, SWIM: Scalable Weakly-consistent Infection-style Process Group Membership Protocol, 2002",
            "van Renesse, Minsky and Hayashibara, Scalable and Robust Failure Detection, 2004",
        ],
        workedExample:
            "With four members and member 3 down, member 0 probes 3 in round three and records one suspicion, then probes 3 again in round seven and confirms it dead. When member 0 next acknowledges a ping from member 1, the death is piggybacked, so member 1 learns it without probing member 3 itself. A flaky member that drops only the direct ping is rescued by the two indirect relays and stays alive.",
    },
    id: "swim-membership",
    name: "SWIM Membership Protocol",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * n * k)", space: "O(n^2)" },
    defaultInput: { nodes: 8, failed: 5, flaky: -1, rounds: 32, indirectK: 2, suspectThreshold: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "each member holds a status for every other member",
        "on each round pick one peer with the round-robin schedule",
        "send a direct ping and wait for an acknowledgement",
        "if no ack ask k other members to relay an indirect ping",
        "raise suspicion on total failure and confirm death at the threshold",
        "clear suspicion when any direct or indirect answer arrives",
        "piggyback known deaths on every ping and acknowledgement",
        "repeat until all live members agree or rounds run out",
        "done: report the converged membership table",
    ],
};

export default module;
