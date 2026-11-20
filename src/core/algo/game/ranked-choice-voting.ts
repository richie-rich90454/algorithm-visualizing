/**
 * ranked-choice-voting.ts - Ranked Choice Voting (Instant Runoff)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ranked choice voting tallies only the highest-ranked continuing candidate
 * on each ballot. If nobody has a majority, the candidate with the fewest
 * first-place votes is eliminated and those ballots transfer to their next
 * continuing preference. The rounds repeat until one candidate holds a
 * majority or only one candidate remains.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Ballots are complete rankings of candidate indices. Elimination removes one
 * candidate per round, breaking a lowest-count tie by the smaller index, so
 * the replay is deterministic. Exhausted ballots with no continuing
 * preference stop contributing to later rounds.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * v * m) with m elimination rounds over v ballots
 *   Space: O(m + v)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the first-place count of every candidate in each round.
 *   - The current leader is highlighted; an eliminated candidate is red.
 *   - The final winner turns green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RcvResult {
    history: number[][];
    eliminated: number[];
    winner: number;
    majorities: number[];
}

function solve(ballots: number[][], m: number): RcvResult {
    const remaining = new Set<number>(Array.from({ length: m }, (_, i) => i));
    const eliminated: number[] = [];
    const history: number[][] = [];
    const majorities: number[] = [];
    let winner = -1;
    let guard = 0;

    while (guard <= m + 1) {
        guard += 1;
        const active = ballots.filter((ballot) => ballot.some((c) => remaining.has(c)));
        const counts = new Array<number>(m).fill(0);
        for (const ballot of active) {
            for (const c of ballot) {
                if (remaining.has(c)) {
                    counts[c] = (counts[c] ?? 0) + 1;
                    break;
                }
            }
        }
        history.push([...counts]);
        const majority = Math.floor(active.length / 2) + 1;
        majorities.push(majority);

        let leader = -1;
        let top = -1;
        for (const c of remaining) {
            if ((counts[c] ?? 0) > top) {
                top = counts[c] ?? 0;
                leader = c;
            }
        }
        if (active.length > 0 && top >= majority) {
            winner = leader;
            break;
        }
        if (remaining.size === 1) {
            winner = [...remaining][0] ?? -1;
            break;
        }

        let lowest = -1;
        let low = Infinity;
        for (const c of remaining) {
            if ((counts[c] ?? 0) < low) {
                low = counts[c] ?? 0;
                lowest = c;
            }
        }
        remaining.delete(lowest);
        eliminated.push(lowest);
    }

    if (winner < 0) {
        winner = eliminated[eliminated.length - 1] ?? 0;
    }
    return { history, eliminated, winner, majorities };
}

function bars(
    counts: number[],
    m: number,
    eliminated: number[],
    leader: number,
    winner: number,
    done: boolean,
): VisualEntity[] {
    return counts.map((count, index) => {
        let state: EntityState = "idle";
        if (index === winner && done) {
            state = "sorted";
        } else if (eliminated.includes(index)) {
            state = "error";
        } else if (index === leader && !done) {
            state = "active";
        } else {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `C${index}: ${count}`,
            value: count,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, count, m },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number } | null) ?? {};
    const ballots: number[][] = Array.isArray(task.ballots)
        ? task.ballots
              .filter((b) => Array.isArray(b))
              .map((b) => b.filter((x) => Number.isInteger(x) && x >= 0))
        : [[0, 1, 2], [1, 2, 0], [2, 1, 0], [0, 2, 1], [2, 0, 1]];
    let maxSeen = -1;
    for (const ballot of ballots) {
        for (const c of ballot) {
            maxSeen = Math.max(maxSeen, c);
        }
    }
    const m = Math.max(2, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1);
    const result = solve(ballots, m);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: bars(new Array<number>(m).fill(0), m, [], -1, -1, false),
        edges: [],
        description: `Ranked choice voting on ${ballots.length} ballots over ${m} candidates; each round transfers ballots from the eliminated candidate.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { candidates: m, ballots: ballots.length, counts: new Array<number>(m).fill(0) },
    };

    for (let round = 0; round < result.history.length; round += 1) {
        const counts = result.history[round] ?? [];
        const eliminatedSoFar = result.eliminated.slice(0, round);
        const leader = counts.indexOf(Math.max(...counts));
        const isLast = round === result.history.length - 1;
        yield {
            stepNumber: step++,
            entities: bars(counts, m, eliminatedSoFar, leader, result.winner, isLast),
            edges: [],
            description: isLast
                ? `Final round ${round + 1}: candidate ${result.winner} holds a majority of ${result.majorities[round]} or more active votes and wins.`
                : `Round ${round + 1}: leader is candidate ${leader} with ${counts[leader]} first-place votes; threshold is ${result.majorities[round]}.`,
            codeLineNumber: isLast ? 6 : 4,
            layout: "array",
            meta: {
                candidates: m,
                round: round + 1,
                counts: [...counts],
                threshold: result.majorities[round] ?? 0,
                eliminated: [...eliminatedSoFar],
                winner: isLast ? result.winner : -1,
            },
        };
    }

    yield {
        stepNumber: step,
        entities: bars(result.history[result.history.length - 1] ?? [], m, result.eliminated, -1, result.winner, true),
        edges: [],
        description: `After ${result.history.length} round(s) and ${result.eliminated.length} elimination(s), candidate ${result.winner} is elected.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            candidates: m,
            rounds: result.history.length,
            counts: [...(result.history[result.history.length - 1] ?? [])],
            eliminated: [...result.eliminated],
            winner: result.winner,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of picking only a first choice, voters rank the field. Count first choices, and if no one has a majority, remove the weakest candidate and pretend those ballots had ranked their next surviving choice first. Repeating this narrows the field until someone commands a majority, which keeps the winner broadly acceptable rather than merely the largest plurality.",
        invariants: [
            "Each active ballot contributes its count to exactly one continuing candidate per round.",
            "The elimination threshold is one more than half of the active ballots.",
            "Once a candidate is eliminated it never receives votes in a later round.",
        ],
        correctness:
            "Each round scans every ballot and awards its vote to the first candidate still in the running, so the tally counts exactly the active ballots. A candidate with at least half of the active votes plus one is preferred by a majority and wins immediately. When nobody has a majority, eliminating the lowest candidate and transferring its ballots preserves every ballot's ranking among the remaining candidates, so the process is a faithful instant runoff. With finitely many candidates the field shrinks each nonterminal round and terminates with a majority winner or the final remaining candidate.",
        complexityRationale:
            "There are at most m elimination rounds; each round scans v ballots and for each ballot walks a ranking of length at most m, giving O(m^2 * v) time. Storing the tallies, the eliminated list, and the ballot rankings uses O(m + v) auxiliary space.",
        uses: [
            "Single-seat public elections in jurisdictions using instant runoff",
            "Party primaries and internal organizational elections",
            "A fallback rule that guarantees a majority winner among continuing candidates",
        ],
        references: [
            "Arrow, Social Choice and Individual Values (1951)",
            "Manin, The Principles of Representative Government (1997)",
        ],
        workedExample:
            "With five ballots ranking 0>1>2, 1>2>0, 2>1>0, 0>2>1, and 2>0>1, first choices are 0:2, 1:1, 2:2 in a three-way split with threshold three. Candidate 1 is eliminated and its ballot moves to candidate 2, giving 2:2 and 0:2 again; eliminating candidate 0 by the index tiebreak transfers its two ballots to candidate 2, who wins three to two.",
    },
    id: "ranked-choice-voting",
    name: "Ranked Choice Voting",
    category: "game",
    complexity: { time: "O(m^2 * v)", space: "O(m + v)" },
    defaultInput: { ballots: [[0, 1, 2], [1, 2, 0], [2, 1, 0], [0, 2, 1], [2, 0, 1]], candidates: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the ballots and the candidate count",
        "count each active ballot for its top continuing candidate",
        "set the majority threshold to half the active ballots plus one",
        "if a candidate reaches the threshold, declare it the winner",
        "otherwise eliminate the continuing candidate with the fewest votes",
        "transfer those ballots to their next continuing preference",
        "repeat until a majority winner or one candidate remains",
    ],
};

export default module;
