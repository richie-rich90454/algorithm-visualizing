/**
 * copelands-method.ts - Copeland's Method
 *
 * Copeland's rule scores every candidate by counting one point for each
 * opponent she beats head to head and subtracting one point for each opponent
 * she loses to; a tie contributes zero. The candidate with the highest
 * Copeland score wins. With an odd number of voters the scores always sum to
 * zero, and a Condorcet winner receives the maximum possible score of m minus
 * one, which makes the method Condorcet consistent.
 *
 * Time O(v * m^2) for v ballots over m candidates; space O(m^2).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function solve(ballots: number[][], m: number): {
    pairwise: number[][];
    wins: number[];
    losses: number[];
    scores: number[];
    ranking: number[];
    winners: number[];
} {
    const pairwise = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (const ballot of ballots) {
        for (let i = 0; i < m; i += 1) {
            for (let j = 0; j < m; j += 1) {
                if (i === j) continue;
                const pi = ballot.indexOf(i);
                const pj = ballot.indexOf(j);
                if (pi >= 0 && pj >= 0 && pi < pj) pairwise[i]![j] = (pairwise[i]![j] ?? 0) + 1;
            }
        }
    }
    const wins = new Array<number>(m).fill(0);
    const losses = new Array<number>(m).fill(0);
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < m; j += 1) {
            if (i === j) continue;
            if ((pairwise[i]![j] ?? 0) > (pairwise[j]![i] ?? 0)) wins[i] = (wins[i] ?? 0) + 1;
            else if ((pairwise[i]![j] ?? 0) < (pairwise[j]![i] ?? 0)) losses[i] = (losses[i] ?? 0) + 1;
        }
    }
    const scores = wins.map((w, i) => w - (losses[i] ?? 0));
    const ranking = scores.map((_, i) => i).sort((x, y) => (scores[y] ?? 0) - (scores[x] ?? 0) || x - y);
    const best = Math.max(...scores);
    const winners = scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
    return { pairwise, wins, losses, scores, ranking, winners };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number } | null) ?? {};
    const supplied = Array.isArray(task.ballots) && task.ballots.length >= 1
        ? task.ballots.map((b) => (Array.isArray(b) ? b.filter((x) => Number.isInteger(x)) : []))
        : [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 1, 0]];
    let maxSeen = -1;
    for (const ballot of supplied) for (const c of ballot) maxSeen = Math.max(maxSeen, c);
    const m = Math.max(2, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1);
    const result = solve(supplied, m);

    const grid = (focus: number): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < m; i += 1) {
            for (let j = 0; j < m; j += 1) {
                if (i === j) continue;
                const a = result.pairwise[i]?.[j] ?? 0;
                const b = result.pairwise[j]?.[i] ?? 0;
                const outcome = a > b ? "win" : a < b ? "loss" : "tie";
                out.push({
                    id: `cell-${i}-${j}`,
                    type: "cell",
                    label: `${a}-${b}`,
                    value: a,
                    state: (i === focus ? "comparing" : outcome === "win" ? "sorted" : outcome === "loss" ? "error" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: i, col: j, a, b, outcome },
                });
            }
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: grid(-1),
        edges: [],
        description: `Copeland's method on ${supplied.length} ballots over ${m} candidates; each head to head contest contributes one win or one loss.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: m, candidates: m, ballots: supplied.length, scores: [...result.scores], winners: [...result.winners], ranking: [...result.ranking] },
    };
    step += 1;

    for (let i = 0; i < m; i += 1) {
        yield {
            stepNumber: step,
            entities: grid(i),
            edges: [],
            description: `Candidate ${i} has ${result.wins[i]} pairwise wins and ${result.losses[i]} losses, for a Copeland score of ${result.scores[i]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: m, cols: m, candidate: i, wins: result.wins[i] ?? 0, losses: result.losses[i] ?? 0,
                score: result.scores[i] ?? 0, scores: [...result.scores], winners: [...result.winners],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: grid(-1),
        edges: [],
        description: `Copeland scores ${result.scores.join("/")} give the ranking ${result.ranking.join(" > ")} with winner ${result.winners.join(",")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: m, cols: m, scores: [...result.scores], winners: [...result.winners], ranking: [...result.ranking],
            wins: [...result.wins], losses: [...result.losses], pairwise: result.pairwise.flat(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Copeland's method turns every head to head contest into a simple score: beat an opponent and gain one point, lose and give up one, tie and get nothing. Adding these up ranks candidates by how often they prevail against the field. A candidate who beats everybody collects the largest possible score, so the rule always agrees with the Condorcet winner whenever one exists.",
        invariants: [
            "Each unordered pair contributes plus one to the winner and minus one to the loser, or zero to both on a tie.",
            "The Copeland score of a candidate equals wins minus losses.",
            "With no ties the scores over all candidates sum to zero.",
        ],
        correctness:
            "The pairwise matrix is built directly from ballot positions, so wins and losses are counted exactly. Each pair is examined once from each side, giving one win and one loss or two ties, which proves the score sum is zero and each score equals wins minus losses. If a Condorcet winner exists she beats all m minus one opponents and has score m minus one while every other candidate loses to her and has a strictly smaller score, so the method is Condorcet consistent.",
        complexityRationale:
            "Constructing the pairwise matrix scans v ballots over m by m ordered pairs, costing O(v * m^2) time; scoring and sorting add O(m^2) and O(m log m), and the matrix uses O(m^2) space.",
        uses: [
            "Ranking teams in round robin tournaments with ties",
            "A Condorcet consistent fallback voting rule",
            "Comparing versus Borda and plurality in social choice courses",
        ],
        references: [
            "Copeland, A 'reasonable' social welfare function (1951)",
            "Arrow, Social Choice and Individual Values (1951)",
        ],
        workedExample:
            "With three candidates, three ballots rank 0 above 1 above 2 and one ranks 1 above 2 above 0. Candidate 0 beats both rivals for score two, candidate 1 beats candidate 2 but loses to candidate 0 for score zero, and candidate 2 loses both for score minus two, so candidate 0 wins.",
    },
    id: "copelands-method",
    name: "Copeland's Method",
    category: "game",
    complexity: { time: "O(v * m^2)", space: "O(m^2)" },
    defaultInput: { ballots: [[0, 1, 2], [0, 1, 2], [0, 1, 2], [1, 2, 0]], candidates: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the ballots and the candidate count",
        "build the pairwise head to head win matrix",
        "for each candidate count wins against opponents",
        "for each candidate count losses against opponents",
        "set the Copeland score to wins minus losses",
        "sort candidates by descending score to form a ranking",
        "report the top ranked winner or winners",
    ],
};

export default module;
