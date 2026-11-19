/**
 * single-transferable-vote.ts - Single Transferable Vote (Fractional Surplus)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Single transferable vote elects several winners from ranked ballots. A
 * candidate is elected on reaching the Droop quota, and the surplus ballots
 * transfer to later preferences at a reduced fractional weight so that no
 * excess votes are wasted. If nobody reaches the quota, the weakest candidate
 * is eliminated and its ballots transfer at full weight. The process stops
 * when all seats are filled or the remaining candidates fill them outright.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Ballots are complete rankings of candidate indices with unit initial
 * weight. Surplus transfers use exact fractional weights (no random sampling
 * or compression). Elimination breaks a lowest-tally tie by the smaller index,
 * making the replay deterministic. Inputs are small: at most six candidates
 * and ten ballots.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((m + s) * v * m) for m candidates, s seats, and v ballots
 *   Space: O(v + m)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current weighted tally of every candidate per round.
 *   - An elected candidate is green, an eliminated one red, the acted-on one yellow.
 *   - The final frame lists the elected candidates and the Droop quota.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface StvRound {
    tally: number[];
    action: "elect" | "eliminate" | "fill";
    candidate: number;
}

interface StvResult {
    quota: number;
    seats: number;
    elected: number[];
    eliminated: number[];
    rounds: StvRound[];
}

const EPS = 1e-12;

function solve(ballots: number[][], m: number, requestedSeats: number): StvResult {
    const seats = Math.max(1, Math.min(m, Math.floor(requestedSeats)));
    const quota = Math.floor(ballots.length / (seats + 1)) + 1;
    const status = new Array<string>(m).fill("running");
    const pointer = new Array<number>(ballots.length).fill(0);
    const weight = new Array<number>(ballots.length).fill(1);
    const elected: number[] = [];
    const eliminated: number[] = [];
    const rounds: StvRound[] = [];

    const advance = (index: number): void => {
        const ballot = ballots[index] ?? [];
        while (pointer[index]! < ballot.length && status[ballot[pointer[index]!] ?? 0] !== "running") {
            pointer[index] = (pointer[index] ?? 0) + 1;
        }
    };

    let guard = 0;
    while (elected.length < seats && guard <= 2 * m + 2) {
        guard += 1;
        const tally = new Array<number>(m).fill(0);
        for (let i = 0; i < ballots.length; i += 1) {
            advance(i);
            const position = pointer[i] ?? 0;
            const ballot = ballots[i] ?? [];
            if (position < ballot.length) {
                const candidate = ballot[position] ?? 0;
                tally[candidate] = (tally[candidate] ?? 0) + (weight[i] ?? 0);
            }
        }

        let pick = -1;
        for (let c = 0; c < m; c += 1) {
            if (status[c] !== "running" || (tally[c] ?? 0) < quota - EPS) {
                continue;
            }
            if (pick < 0 || (tally[c] ?? 0) > (tally[pick] ?? 0)) {
                pick = c;
            }
        }

        if (pick >= 0) {
            const total = tally[pick] ?? 0;
            const surplus = Math.max(0, total - quota);
            const factor = total > EPS ? surplus / total : 0;
            status[pick] = "elected";
            elected.push(pick);
            rounds.push({ tally: [...tally], action: "elect", candidate: pick });
            for (let i = 0; i < ballots.length; i += 1) {
                const ballot = ballots[i] ?? [];
                const position = pointer[i] ?? 0;
                if (position < ballot.length && ballot[position] === pick) {
                    weight[i] = (weight[i] ?? 0) * factor;
                    pointer[i] = position + 1;
                }
            }
            continue;
        }

        const running = Array.from({ length: m }, (_, c) => c).filter((c) => status[c] === "running");
        if (running.length <= seats - elected.length) {
            for (const c of running) {
                status[c] = "elected";
                elected.push(c);
            }
            rounds.push({ tally: [...tally], action: "fill", candidate: running[0] ?? -1 });
            break;
        }

        let lowest = -1;
        for (const c of running) {
            if (lowest < 0 || (tally[c] ?? 0) < (tally[lowest] ?? 0)) {
                lowest = c;
            }
        }
        status[lowest] = "eliminated";
        eliminated.push(lowest);
        rounds.push({ tally: [...tally], action: "eliminate", candidate: lowest });
        for (let i = 0; i < ballots.length; i += 1) {
            const ballot = ballots[i] ?? [];
            const position = pointer[i] ?? 0;
            if (position < ballot.length && ballot[position] === lowest) {
                pointer[i] = position + 1;
            }
        }
    }

    return { quota, seats, elected, eliminated, rounds };
}

function bars(
    tally: number[],
    elected: number[],
    eliminated: number[],
    acted: number,
    done: boolean,
): VisualEntity[] {
    return tally.map((value, index) => {
        let state: EntityState = "visited";
        if (done && elected.includes(index)) {
            state = "sorted";
        } else if (eliminated.includes(index)) {
            state = "error";
        } else if (index === acted) {
            state = "active";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `C${index}: ${value.toFixed(2)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, tally: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number; seats?: number } | null) ?? {};
    const ballots: number[][] = Array.isArray(task.ballots)
        ? task.ballots
              .filter((b) => Array.isArray(b))
              .map((b) => b.filter((x) => Number.isInteger(x) && x >= 0))
        : [[0, 1, 2], [0, 2, 1], [1, 2, 0], [1, 0, 2], [2, 0, 1], [2, 1, 0]];
    let maxSeen = -1;
    for (const ballot of ballots) {
        for (const c of ballot) {
            maxSeen = Math.max(maxSeen, c);
        }
    }
    const m = Math.max(2, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1);
    const seats = typeof task.seats === "number" ? Math.floor(task.seats) : 2;
    const result = solve(ballots, m, seats);
    const zero = new Array<number>(m).fill(0);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: bars(zero, [], [], -1, false),
        edges: [],
        description: `Single transferable vote with ${ballots.length} ballots, ${m} candidates, ${result.seats} seat(s), and a Droop quota of ${result.quota}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            candidates: m,
            ballots: ballots.length,
            seats: result.seats,
            quota: result.quota,
            tally: zero,
            elected: [],
            eliminated: [],
        },
    };

    for (let round = 0; round < result.rounds.length; round += 1) {
        const info = result.rounds[round];
        if (!info) {
            continue;
        }
        const electedSoFar = result.elected.slice(0, round + (info.action === "elect" || info.action === "fill" ? 1 : 0));
        const eliminatedSoFar = result.eliminated.slice(0, round + (info.action === "eliminate" ? 1 : 0));
        const verb = info.action === "elect" ? "reaches the quota and is elected" : info.action === "eliminate" ? "is eliminated and transfers at full weight" : "fills the remaining seat";
        yield {
            stepNumber: step++,
            entities: bars(info.tally, electedSoFar, eliminatedSoFar, info.candidate, false),
            edges: [],
            description: `Round ${round + 1}: candidate ${info.candidate} ${verb}; the quota is ${result.quota}.`,
            codeLineNumber: info.action === "elect" ? 3 : info.action === "eliminate" ? 5 : 6,
            layout: "array",
            meta: {
                candidates: m,
                round: round + 1,
                quota: result.quota,
                tally: [...info.tally],
                action: info.action,
                candidate: info.candidate,
                elected: [...electedSoFar],
                eliminated: [...eliminatedSoFar],
            },
        };
    }

    const lastTally = result.rounds[result.rounds.length - 1]?.tally ?? zero;
    yield {
        stepNumber: step,
        entities: bars(lastTally, result.elected, result.eliminated, -1, true),
        edges: [],
        description: `Elected candidates: ${result.elected.join(", ")} with ${result.eliminated.length} elimination(s) under a quota of ${result.quota}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            candidates: m,
            seats: result.seats,
            quota: result.quota,
            tally: [...lastTally],
            elected: [...result.elected],
            eliminated: [...result.eliminated],
            rounds: result.rounds.length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Single transferable vote is a multiwinner ranked election. A candidate who collects more votes than a fair share, the Droop quota, is elected and the excess ballots pass to later choices at a reduced weight. If nobody has a quota, the weakest candidate is dropped and its ballots pass on unchanged. This preserves the idea that a vote should count toward one winner at a time while wasting as little as possible.",
        invariants: [
            "The Droop quota is the floor of the ballot count over seats plus one, plus one.",
            "Only continuing candidates receive tally weight in a round.",
            "A candidate is elected at most once and eliminated at most once.",
        ],
        correctness:
            "Each round assigns every ballot's current weight to its first still-running preference, so the tally is the true weighted support. Reaching the quota means the candidate has more than a fair share, and scaling the surplus ballots by surplus divided by total transfers exactly the excess while discarding the quota that justified election. Eliminating the lowest candidate and advancing its ballots preserves each voter's relative ordering among the survivors. The loop either elects a candidate or reduces the surviving field each round, so with finitely many candidates it terminates once all seats are filled or the survivors fill them directly.",
        complexityRationale:
            "At most m plus s rounds occur, and each scans v ballots while advancing a pointer through a ranking of length at most m, costing O((m + s) * v * m) time. The weight and pointer arrays plus the tally occupy O(v + m) space.",
        uses: [
            "Multimember legislative elections using the Irish and Australian systems",
            "Electing several board seats while preserving proportional representation",
            "Internal organization elections that need more than one winner",
        ],
        references: [
            "Droop, Methods of Counting Votes (1881)",
            "Tideman, Collective Decisions and Voting (2006)",
        ],
        workedExample:
            "With six ballots, two seats, and three candidates, the Droop quota is floor of six over three plus one, namely three. First choices are two each, so no one reaches the quota and candidate 0 is eliminated; its ballots transfer to candidates 1 and 2, lifting both to three. Both are elected, and no surplus is left to transfer.",
    },
    id: "single-transferable-vote",
    name: "Single Transferable Vote",
    category: "game",
    complexity: { time: "O((m + s) * v * m)", space: "O(v + m)" },
    defaultInput: {
        ballots: [[0, 1, 2], [0, 2, 1], [1, 2, 0], [1, 0, 2], [2, 0, 1], [2, 1, 0]],
        candidates: 3,
        seats: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set the Droop quota to floor of ballots over seats plus one, plus one",
        "give each ballot unit weight and a pointer to its first choice",
        "tally the current weighted first choice of every ballot",
        "if a candidate reaches the quota, elect it",
        "transfer its surplus ballots at a reduced fractional weight",
        "otherwise eliminate the candidate with the lowest tally",
        "transfer those ballots at full weight and repeat until seats fill",
    ],
};

export default module;
