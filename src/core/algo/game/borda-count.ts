/**
 * borda-count.ts - Borda Count
 *
 * Each voter submits a ranking of the candidates, and a candidate receives
 * one point for every candidate ranked below her on a ballot. The Borda score
 * is the sum of those points over all voters, and the candidate with the
 * largest total wins. The rule aggregates rich preference information instead
 * of using only first-place votes, but it can fail the majority criterion.
 *
 * Time O(v * m) for v ballots over m candidates; space O(v * m) for the table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Election {
    ballots: number[][];
    m: number;
    scores: number[];
    winners: number[];
}

function tally(ballots: number[][], m: number): Election {
    const scores = new Array<number>(m).fill(0);
    for (const ballot of ballots) {
        for (let p = 0; p < ballot.length; p += 1) {
            const c = ballot[p] ?? 0;
            if (c >= 0 && c < m) scores[c] = (scores[c] ?? 0) + (ballot.length - 1 - p);
        }
    }
    const best = Math.max(...scores);
    const winners = scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
    return { ballots, m, scores, winners };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number } | null) ?? {};
    const supplied = Array.isArray(task.ballots) && task.ballots.length >= 1
        ? task.ballots.map((b) => (Array.isArray(b) ? b.filter((x) => Number.isInteger(x)) : []))
        : [[0, 1, 2], [0, 2, 1], [1, 0, 2]];
    let maxSeen = -1;
    for (const ballot of supplied) for (const c of ballot) maxSeen = Math.max(maxSeen, c);
    const m = Math.max(2, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1);
    const election = tally(supplied, m);
    const rows = election.ballots.length + 1;
    const cols = m;

    const grid = (uptoVoter: number): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let v = 0; v < election.ballots.length; v += 1) {
            const ballot = election.ballots[v] ?? [];
            for (let c = 0; c < m; c += 1) {
                const pos = ballot.indexOf(c);
                const points = pos < 0 ? 0 : ballot.length - 1 - pos;
                out.push({
                    id: `cell-${v}-${c}`,
                    type: "cell",
                    label: String(points),
                    value: points,
                    state: (v === uptoVoter ? "comparing" : points > 0 ? "visited" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: v, col: c, voter: v, candidate: c, points },
                });
            }
        }
        for (let c = 0; c < m; c += 1) {
            out.push({
                id: `total-${c}`,
                type: "cell",
                label: String(election.scores[c] ?? 0),
                value: election.scores[c] ?? 0,
                state: (election.winners.includes(c) ? "sorted" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { row: election.ballots.length, col: c, candidate: c, total: election.scores[c] ?? 0 },
            });
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: grid(-1),
        edges: [],
        description: `Borda count over ${m} candidates and ${election.ballots.length} ballots; each lower-ranked opponent earns one point.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, candidates: m, ballots: election.ballots.map((b) => b.join(",")), scores: [...election.scores], winners: [...election.winners] },
    };
    step += 1;

    for (let v = 0; v < election.ballots.length; v += 1) {
        const ballot = election.ballots[v] ?? [];
        yield {
            stepNumber: step,
            entities: grid(v),
            edges: [],
            description: `Ballot ${v} ranks [${ballot.join(",")}], awarding ${ballot.length - 1} points to first place down to zero for last.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows, cols, voter: v, ballot: [...ballot], scores: [...election.scores], candidates: m },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: grid(-1),
        edges: [],
        description: `Final Borda scores ${election.scores.join("/")}; the winner ${election.winners.join(",")} has the largest total.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows, cols, scores: [...election.scores], winners: [...election.winners],
            candidates: m, ballots: election.ballots.map((b) => b.join(",")),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than looking only at first-place votes, a Borda ballot tells us the full order of preference. We give a candidate one point for every rival placed below her, so a first-place rank on a long ballot is worth more than the same rank on a short one, and then add the points across all voters.",
        invariants: [
            "On a ballot with k ranked candidates, the points awarded sum to k times k minus one over two.",
            "An unranked candidate earns zero points from that ballot.",
            "The winner is a candidate with the maximum total Borda score.",
        ],
        correctness:
            "For a ballot of length k the candidate at position p has exactly k minus one minus p ranked candidates below her, which is the number of points assigned. Summing over ballots produces the Borda score by definition, and selecting every candidate attaining the maximum correctly handles ties. The per-ballot point total is a constant, so the rule aggregates positional information consistently across voters.",
        complexityRationale:
            "Each ballot of length at most m is scanned once to award points, so v ballots take O(v * m) time; storing the per-voter contribution table uses O(v * m) space for the visualization.",
        uses: [
            "Ranking candidates in elections and committee selections",
            "Aggregating ranked preferences in recommender systems",
            "Computing positions in speed skating and other ranked competitions",
        ],
        references: [
            "Borda, Memoire sur les elections au scrutin (1781)",
            "Arrow, Social Choice and Individual Values (1951)",
        ],
        workedExample:
            "With three candidates and ballots 0 above 1 above 2, 0 above 2 above 1, and 1 above 0 above 2, candidate 0 earns 2 plus 2 plus 1 equals 5, candidate 1 earns 1 plus 0 plus 2 equals 3, and candidate 2 earns 0 plus 1 plus 0 equals 1, so candidate 0 wins.",
    },
    id: "borda-count",
    name: "Borda Count",
    category: "game",
    complexity: { time: "O(v * m)", space: "O(v * m)" },
    defaultInput: { ballots: [[0, 1, 2], [0, 2, 1], [1, 0, 2]], candidates: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the candidate count and every ranked ballot",
        "initialize every candidate's Borda score to zero",
        "for each ballot find the position of each candidate",
        "award the number of ranked rivals below that candidate",
        "add the ballot points to the running scores",
        "find the largest total score after all ballots",
        "report all candidates attaining that maximum",
    ],
};

export default module;
