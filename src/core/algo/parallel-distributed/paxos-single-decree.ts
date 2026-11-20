/**
 * paxos-single-decree.ts - Single-Decree Paxos (toy simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Single-decree Paxos lets a set of acceptors agree on one value even when
 * messages are delayed or processes fail. A proposer runs two phases: prepare
 * (collect promises and learn any already accepted value) and accept (ask a
 * majority to accept the value with the highest accepted ballot). Once a
 * majority accepts, the value is chosen and can never change.
 *
 * This is a deterministic, failure-free simulation of the protocol logic, not
 * a production distributed system.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * acceptors) messages in this simulation
 *   Space: O(acceptors) for acceptor state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Acceptors are grid cells showing the value they last accepted.
 *   - A cell is yellow while it receives a message and green once it accepts.
 *   - The metadata reports the current ballot, phase, and chosen value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Acceptor {
    promised: number;
    acceptedBallot: number;
    acceptedValue: number;
}

interface Ballot {
    number: number;
    value: number;
}

/** Build acceptor cells. */
function makeCells(
    acceptors: Acceptor[],
    active: number,
    activeState: EntityState,
): VisualEntity[] {
    return acceptors.map((acceptor, index) => ({
        id: `acceptor-${index}`,
        type: "cell" as const,
        label: acceptor.acceptedValue >= 0 ? String(acceptor.acceptedValue) : "-",
        value: acceptor.acceptedValue,
        state:
            index === active
                ? activeState
                : acceptor.acceptedBallot > 0
                  ? ("visited" as EntityState)
                  : ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, promised: acceptor.promised },
    }));
}

/** The single-decree Paxos generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { acceptorCount?: number; ballots?: Ballot[] } | null) ?? {};
    const count =
        typeof task.acceptorCount === "number" && task.acceptorCount >= 3
            ? Math.floor(task.acceptorCount)
            : 5;
    const ballots: Ballot[] =
        Array.isArray(task.ballots) && task.ballots.length > 0
            ? task.ballots
                  .filter(
                      (item): item is Ballot =>
                          !!item &&
                          typeof item.number === "number" &&
                          typeof item.value === "number",
                  )
                  .map((item) => ({ number: item.number, value: item.value }))
            : [
                  { number: 1, value: 42 },
                  { number: 2, value: 99 },
                  { number: 3, value: 7 },
              ];
    const majority = Math.floor(count / 2) + 1;
    let acceptors: Acceptor[] = Array.from({ length: count }, () => ({
        promised: 0,
        acceptedBallot: 0,
        acceptedValue: -1,
    }));
    let chosen: number | null = null;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(acceptors, -1, "idle"),
        edges: [],
        description: `Starting single-decree Paxos with ${count} acceptors; a majority is ${majority}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: count,
            ballot: 0,
            phase: "init",
            promises: 0,
            accepts: 0,
            majority,
            chosenValue: -1,
            chosen: false,
        },
    };
    step += 1;

    for (const ballot of ballots) {
        type Promise = { index: number; acceptedBallot: number; acceptedValue: number };
        const promises: Promise[] = [];

        for (let index = 0; index < count; index += 1) {
            const acceptor = acceptors[index]!;
            if (ballot.number > acceptor.promised) {
                acceptor.promised = ballot.number;
                promises.push({
                    index,
                    acceptedBallot: acceptor.acceptedBallot,
                    acceptedValue: acceptor.acceptedValue,
                });
                yield {
                    stepNumber: step,
                    entities: makeCells(acceptors, index, "comparing"),
                    edges: [],
                    description: `Prepare ballot ${ballot.number}: acceptor ${index} promises and reports its last accepted ballot ${acceptor.acceptedBallot}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: {
                        rows: 1,
                        cols: count,
                        ballot: ballot.number,
                        phase: "prepare",
                        promises: promises.length,
                        accepts: 0,
                        majority,
                        chosenValue: -1,
                        chosen: false,
                    },
                };
                step += 1;
            } else {
                yield {
                    stepNumber: step,
                    entities: makeCells(acceptors, index, "error"),
                    edges: [],
                    description: `Prepare ballot ${ballot.number}: acceptor ${index} refuses because it already promised ${acceptor.promised}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: {
                        rows: 1,
                        cols: count,
                        ballot: ballot.number,
                        phase: "prepare",
                        promises: promises.length,
                        accepts: 0,
                        majority,
                        chosenValue: -1,
                        chosen: false,
                    },
                };
                step += 1;
            }
        }

        if (promises.length < majority) {
            yield {
                stepNumber: step,
                entities: makeCells(acceptors, -1, "idle"),
                edges: [],
                description: `Ballot ${ballot.number} only got ${promises.length} promise(s), short of a majority; no value is sent.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: {
                    rows: 1,
                    cols: count,
                    ballot: ballot.number,
                    phase: "promises-failed",
                    promises: promises.length,
                    accepts: 0,
                    majority,
                    chosenValue: -1,
                    chosen: false,
                },
            };
            step += 1;
            continue;
        }

        let value = ballot.value;
        let highest = -1;
        for (const promise of promises) {
            if (promise.acceptedValue >= 0 && promise.acceptedBallot > highest) {
                highest = promise.acceptedBallot;
                value = promise.acceptedValue;
            }
        }

        let accepts = 0;
        for (const promise of promises) {
            const acceptor = acceptors[promise.index]!;
            if (ballot.number >= acceptor.promised) {
                acceptor.acceptedBallot = ballot.number;
                acceptor.acceptedValue = value;
                accepts += 1;
                yield {
                    stepNumber: step,
                    entities: makeCells(acceptors, promise.index, "active"),
                    edges: [],
                    description: `Accept ballot ${ballot.number}: acceptor ${promise.index} accepts value ${value}.`,
                    codeLineNumber: 6,
                    layout: "grid",
                    meta: {
                        rows: 1,
                        cols: count,
                        ballot: ballot.number,
                        phase: "accept",
                        promises: promises.length,
                        accepts,
                        majority,
                        chosenValue: value,
                        chosen: accepts >= majority,
                    },
                };
                step += 1;
            }
        }

        const won = accepts >= majority;
        if (won && chosen === null) {
            chosen = value;
        }
        yield {
            stepNumber: step,
            entities: makeCells(acceptors, -1, won ? "sorted" : "idle"),
            edges: [],
            description: won
                ? `Ballot ${ballot.number} reached a majority; value ${value} is chosen${chosen === value ? " and fixed forever" : ""}.`
                : `Ballot ${ballot.number} did not reach an accepting majority.`,
            codeLineNumber: 8,
            layout: "grid",
            meta: {
                rows: 1,
                cols: count,
                ballot: ballot.number,
                phase: "done",
                promises: promises.length,
                accepts,
                majority,
                chosenValue: value,
                chosen: won,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(acceptors, -1, "sorted"),
        edges: [],
        description:
            chosen === null
                ? "No ballot obtained a majority, so no value was chosen."
                : `Consensus reached: the chosen value is ${chosen}.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            rows: 1,
            cols: count,
            ballot: ballots.length,
            phase: "finished",
            promises: 0,
            accepts: 0,
            majority,
            chosenValue: chosen === null ? -1 : chosen,
            chosen: chosen !== null,
        },
    };
}

/** The single-decree Paxos module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A proposer first asks whether anyone has already picked a value, promising to use the newest such value if so. Only after a majority answers does it ask that majority to accept. Because any two majorities overlap, a later proposer always hears about an already chosen value and must reuse it.",
        invariants: [
            "An acceptor never promises a ballot numbered lower or equal to one it already promised.",
            "The proposer adopts the value with the highest accepted ballot among its promises.",
            "A value is chosen only after a strict majority accepts it.",
        ],
        correctness:
            "Suppose value v is chosen at ballot n by majority Q. Any later ballot m with majority Q' intersects Q, so some acceptor in Q' reports an accepted value of ballot at least n. By induction that value is v, and because the proposer takes the highest reported ballot, it proposes v. Thus no two different values can ever be chosen.",
        complexityRationale:
            "Each ballot sends a prepare and an accept to every acceptor, so the simulation uses O(rounds * acceptors) messages and stores O(acceptors) acceptor state.",
        uses: [
            "Agreeing on a configuration value in replicated services",
            "The consensus core of production systems such as Raft and Multi-Paxos",
            "A teaching model for safety under message loss and process failure",
        ],
        references: [
            "Lamport, The Part-Time Parliament, 1998",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "With five acceptors, ballot 1 proposes 42 and a majority accepts, so 42 is chosen. Ballot 2 proposes 99, but the prepare phase learns that a majority already accepted 42 at ballot 1, so it must also propose 42. The chosen value never changes.",
    },
    id: "paxos-single-decree",
    name: "Single-Decree Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * acceptors)", space: "O(acceptors)" },
    defaultInput: {
        acceptorCount: 5,
        ballots: [
            { number: 1, value: 42 },
            { number: 2, value: 99 },
            { number: 3, value: 7 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "each acceptor starts with no promise and no accepted value",
        "for each ballot in increasing number",
        "send prepare and collect promises from acceptors",
        "if fewer than a majority promise, skip this ballot",
        "adopt the value with the highest accepted ballot seen",
        "send accept to every promising acceptor",
        "if a majority accepts, the value is chosen",
        "a later ballot must reuse any chosen value",
        "done: report the single chosen value",
    ],
};

export default module;
