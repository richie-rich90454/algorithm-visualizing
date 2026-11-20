/**
 * dodgson-method.ts - Dodgson's Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dodgson's method elects the candidate who can be made a Condorcet winner
 * with the fewest adjacent swaps of names on the ballots. For each candidate
 * it tries moving that candidate upward by k places on each ballot (which
 * costs k swaps) and keeps the cheapest combination that gives the candidate
 * a majority over every opponent. The candidate with the smallest total cost
 * wins.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Ballots are complete rankings of candidate indices. The search is an exact
 * brute force over the k choices per ballot; inputs are kept small (at most
 * five candidates and ten ballots) because the problem is computationally
 * hard in general.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(v * m * prod(pos_i + 1)) for the brute-force search
 *   Space: O(m + v) besides the recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the minimum swap cost for each candidate.
 *   - The candidate under evaluation is highlighted.
 *   - All candidates tied for the smallest cost turn green at the end.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DodgsonResult {
    scores: number[];
    winners: number[];
    best: number;
}

/** Cheapest number of adjacent swaps to make candidate c a Condorcet winner. */
function scoreFor(ballots: number[][], m: number, c: number): number {
    const v = ballots.length;
    if (v === 0) {
        return 0;
    }
    const majority = Math.floor(v / 2) + 1;
    const options = ballots.map((ballot) => {
        const pos = ballot.indexOf(c);
        if (pos < 0) {
            return [{ cost: 0, beaten: 0 }];
        }
        const choices: Array<{ cost: number; beaten: number }> = [];
        for (let k = 0; k <= pos; k += 1) {
            let beaten = 0;
            for (let opponent = 0; opponent < m; opponent += 1) {
                if (opponent === c) {
                    continue;
                }
                const op = ballot.indexOf(opponent);
                // Moving c up k places puts it ahead of the k candidates just
                // above it, plus everyone that was already below it.
                if (op > pos || (op >= pos - k && op < pos)) {
                    beaten |= 1 << opponent;
                }
            }
            choices.push({ cost: k, beaten });
        }
        return choices;
    });

    let best = Infinity;
    const counts = new Array<number>(m).fill(0);
    const search = (index: number, total: number): void => {
        if (total >= best) {
            return;
        }
        if (index === ballots.length) {
            for (let opponent = 0; opponent < m; opponent += 1) {
                if (opponent !== c && (counts[opponent] ?? 0) < majority) {
                    return;
                }
            }
            best = total;
            return;
        }
        for (const choice of options[index] ?? []) {
            const changed: number[] = [];
            for (let opponent = 0; opponent < m; opponent += 1) {
                if (choice.beaten & (1 << opponent)) {
                    counts[opponent] = (counts[opponent] ?? 0) + 1;
                    changed.push(opponent);
                }
            }
            search(index + 1, total + choice.cost);
            for (const opponent of changed) {
                counts[opponent] = (counts[opponent] ?? 0) - 1;
            }
        }
    };
    search(0, 0);
    return best === Infinity ? v * m : best;
}

function solve(ballots: number[][], m: number): DodgsonResult {
    const scores = Array.from({ length: m }, (_, c) => scoreFor(ballots, m, c));
    const best = Math.min(...scores);
    const winners = scores.map((score, index) => (score === best ? index : -1)).filter((i) => i >= 0);
    return { scores, winners, best };
}

function bars(scores: number[], focus: number, winners: number[], done: boolean): VisualEntity[] {
    return scores.map((score, index) => {
        const state: EntityState = done && winners.includes(index)
            ? "sorted"
            : index === focus
              ? "active"
              : done
                ? "idle"
                : "visited";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `C${index}: ${score}`,
            value: score,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, score },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number } | null) ?? {};
    const ballots: number[][] = Array.isArray(task.ballots)
        ? task.ballots
              .filter((b) => Array.isArray(b))
              .map((b) => b.filter((x) => Number.isInteger(x) && x >= 0))
        : [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    let maxSeen = -1;
    for (const ballot of ballots) {
        for (const c of ballot) {
            maxSeen = Math.max(maxSeen, c);
        }
    }
    const m = Math.max(2, Math.min(5, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1));
    const result = solve(ballots, m);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: bars(new Array<number>(m).fill(0), -1, [], false),
        edges: [],
        description: `Dodgson's method on ${ballots.length} ballots over ${m} candidates; each score is the fewest swaps needed to become a Condorcet winner.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { candidates: m, ballots: ballots.length, scores: new Array<number>(m).fill(0) },
    };

    for (let c = 0; c < m; c += 1) {
        yield {
            stepNumber: step++,
            entities: bars(result.scores, c, [], false),
            edges: [],
            description: `Candidate ${c} needs ${result.scores[c]} adjacent swap(s) to beat every opponent in a majority.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { candidates: m, focus: c, score: result.scores[c], scores: [...result.scores] },
        };
    }

    yield {
        stepNumber: step,
        entities: bars(result.scores, -1, result.winners, true),
        edges: [],
        description: `The smallest swap cost is ${result.best}; winner${result.winners.length > 1 ? "s" : ""}: ${result.winners.join(", ")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { candidates: m, scores: [...result.scores], winners: [...result.winners], best: result.best },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Dodgson asked how much you would have to edit the ballots to make a candidate beat everyone head to head. The edit cost is one point for each adjacent swap of two names on a single ballot, and the candidate who needs the fewest edits wins. A candidate who is already a Condorcet winner needs no edits at all.",
        invariants: [
            "Moving a candidate up k places on a ballot costs exactly k adjacent swaps.",
            "After moving candidate c up, c beats precisely the opponents now below it on that ballot.",
            "A candidate wins a head to head contest when it is preferred on a strict majority of ballots.",
        ],
        correctness:
            "For a fixed candidate and ballot, the only useful edits move that candidate upward: swapping any other pair cannot help it beat more opponents, and moving it up by k makes it beat exactly the k passed opponents plus those already below it. Enumerating every k choice per ballot therefore covers all minimal edit sets; checking the resulting pairwise counts against the majority threshold keeps exactly the feasible sets, and the smallest total k is the Dodgson score. Electing the candidate with the smallest score implements Dodgson's rule, and a Condorcet winner scores zero while every other candidate scores at least one.",
        complexityRationale:
            "With v ballots, m candidates, and position pos_i of the chosen candidate on ballot i, the search visits the product of pos_i + 1 combinations and updates m majority counters at each leaf, giving roughly O(v * m * product(pos_i + 1)) time. Only the counter array and recursion path are stored, so auxiliary space is O(m + v); the exponential factor is why the teaching input is small.",
        uses: [
            "A case study in computationally hard voting rules",
            "Comparing Condorcet consistent methods in social choice courses",
            "Measuring how fragile an election result is to small ballot changes",
        ],
        references: [
            "Dodgson, A Method of Taking Votes on More than Two Questions (1876)",
            "Bartholdi, Tovey, and Trick, Voting Schemes and Computational Complexity (1989)",
        ],
        workedExample:
            "With the cyclic ballots 0>1>2, 1>2>0, and 2>0>1, no candidate is a Condorcet winner. Candidate 0 is already ahead of both opponents on the first ballot, needs one swap to pass candidate 2 on the third ballot, and needs none on the second, so its score is one; by symmetry the others also score one and all three are tied.",
    },
    id: "dodgson-method",
    name: "Dodgson's Method",
    category: "game",
    complexity: { time: "O(v * m * prod(pos_i + 1))", space: "O(m + v)" },
    defaultInput: { ballots: [[0, 1, 2], [1, 2, 0], [2, 0, 1]], candidates: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the ballots and the number of candidates",
        "for each candidate compute its Dodgson score",
        "find the candidate's position on each ballot",
        "try moving it up by k adjacent swaps, for each k",
        "count ballots where each opponent is now beaten",
        "keep the smallest total cost giving a majority over every opponent",
        "elect every candidate with the smallest score",
    ],
};

export default module;
