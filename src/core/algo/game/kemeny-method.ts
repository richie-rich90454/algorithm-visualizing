/**
 * kemeny-method.ts - Kemeny-Young Ranking (exhaustive small-instance solver)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kemeny-Young method finds the ranking that best summarizes a set of
 * ranked ballots. For a proposed ranking it counts how many voter pairs
 * disagree with the order, and it chooses the ranking with the fewest such
 * disagreements. That ranking is the maximum-likelihood consensus under the
 * Mallows model and is the unique ranking rule satisfying several fairness
 * axioms.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact exhaustive search over all candidate orders, limited to at
 * most six candidates so the factorial number of frames stays bounded. Ranked
 * ballots are complete and have no ties. Finding an optimal ranking is
 * NP-hard in general, so larger elections need branch-and-bound or heuristics.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(m! * m^2 * ballots) for m candidates
 *   Space: O(m^2) for the pairwise tally
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the candidate occupying each position of the current ranking.
 *   - Each evaluated order is highlighted with its disagreement score.
 *   - The final frame marks the optimal ranking in green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface KemenyInput {
    candidates?: string[];
    ballots?: number[][];
}

/** Tally count[a][b] = number of ballots ranking candidate a above candidate b. */
function tally(m: number, ballots: number[][]): number[][] {
    const count: number[][] = Array.from({ length: m }, () => Array.from({ length: m }, () => 0));
    for (const ballot of ballots) {
        for (let i = 0; i < ballot.length; i += 1) {
            for (let j = i + 1; j < ballot.length; j += 1) {
                const a = ballot[i];
                const b = ballot[j];
                if (a !== undefined && b !== undefined && a !== b && count[a]?.[b] !== undefined) {
                    count[a][b] = (count[a][b] ?? 0) + 1;
                }
            }
        }
    }
    return count;
}

/** Disagreement score of a permutation: voter pairs that contradict it. */
function scoreOf(perm: number[], count: number[][]): number {
    const pos: number[] = [];
    perm.forEach((candidate, index) => {
        pos[candidate] = index;
    });
    let score = 0;
    for (let a = 0; a < perm.length; a += 1) {
        for (let b = a + 1; b < perm.length; b += 1) {
            const ca = perm[a] ?? 0;
            const cb = perm[b] ?? 0;
            score += count[cb]?.[ca] ?? 0;
        }
    }
    return score;
}

/** Generate all permutations by recursive adjacent swapping. */
function permutations(m: number): number[][] {
    const out: number[][] = [];
    const cur = Array.from({ length: m }, (_, index) => index);
    const visit = (k: number): void => {
        if (k === m) {
            out.push([...cur]);
            return;
        }
        for (let i = k; i < m; i += 1) {
            const tmp = cur[k];
            cur[k] = cur[i] as number;
            cur[i] = tmp as number;
            visit(k + 1);
            cur[i] = cur[k] as number;
            cur[k] = tmp as number;
        }
    };
    visit(0);
    return out;
}

function rankingCells(
    perm: number[],
    candidates: string[],
    state: VisualEntity["state"],
): VisualEntity[] {
    return perm.map((candidate, index) => ({
        id: `rank-${index}`,
        type: "cell" as const,
        label: candidates[candidate] ?? String(candidate),
        value: candidate,
        state,
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, candidate },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KemenyInput | null) ?? {};
    const candidates = (task.candidates ?? ["A", "B", "C", "D"]).slice(0, 6);
    const m = Math.max(1, candidates.length);
    const ballots = (task.ballots ?? [
        [0, 1, 2, 3],
        [1, 2, 3, 0],
        [2, 0, 1, 3],
        [0, 2, 1, 3],
    ]).map((b) => b.slice(0, m));

    const count = tally(m, ballots);
    const all = permutations(m);
    let bestScore = Infinity;
    let bestPerm = all[0] ?? Array.from({ length: m }, (_, index) => index);
    let evaluated = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: rankingCells(bestPerm, candidates, "idle"),
        edges: [],
        description: `Kemeny-Young over ${m} candidates and ${ballots.length} ballots; examining ${all.length} possible rankings.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: m, m, ballots: ballots.length, permutations: all.length },
    };
    step += 1;

    for (const perm of all) {
        const value = scoreOf(perm, count);
        evaluated += 1;
        if (value < bestScore) {
            bestScore = value;
            bestPerm = perm;
        }
        yield {
            stepNumber: step,
            entities: rankingCells(perm, candidates, "comparing"),
            edges: [],
            description: `Order ${perm.map((c) => candidates[c] ?? c).join(" > ")} disagrees with ${value} voter pairs; best so far is ${bestScore}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: m,
                evaluated,
                permutations: all.length,
                score: value,
                bestScore,
                current: perm.join(","),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: rankingCells(bestPerm, candidates, "sorted"),
        edges: [],
        description: `Optimal ranking ${bestPerm.map((c) => candidates[c] ?? c).join(" > ")} with ${bestScore} pairwise disagreements.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 1,
            cols: m,
            evaluated,
            bestScore,
            bestRanking: bestPerm.map((c) => candidates[c] ?? c).join(" > "),
            optimal: 1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of declaring a single winner, Kemeny-Young asks for the whole order that agrees with the voters as much as possible. Imagine comparing every pair of candidates in the proposed order and penalizing one point for each voter who put that pair the other way around. The ranking with the smallest penalty is the best summary of the electorate.",
        invariants: [
            "The pairwise tally counts, for every ordered pair, how many ballots prefer one candidate to the other.",
            "A proposed ranking's score is the number of voter-pair preferences it contradicts.",
            "Every complete ranking of the candidates is eventually evaluated.",
        ],
        correctness:
            "For a proposed order, the only disagreements come from pairs that the order places one way and a voter places the other way. Summing the tally of the reversed pair over all ordered pairs in the proposal therefore gives the total number of contradictory voter pairs, which is exactly the Kemeny score. Enumerating every permutation and keeping the minimum score selects a ranking that no other order beats, so it is a Kemeny-Young optimum; ties are all optimal.",
        complexityRationale:
            "There are m factorial candidate orders, each scored over m squared pairs using the precomputed tally, giving O(m! * m^2 * ballots) if the tally is rebuilt per ballot and O(m! * m^2) with the tally built once. The tally and one permutation use O(m^2) space.",
        uses: [
            "Consensus ranking in elections and committee preferences",
            "Rank aggregation for search results and recommender systems",
            "Building a single order from multiple expert judgments",
        ],
        references: [
            "Kemeny, Mathematics without Numbers (1959)",
            "Young and Levenglick, A Consistent Extension of Condorcet's Election Principle (1978)",
        ],
        workedExample:
            "With candidates A, B, C and ballots A>B>C, B>C>A, and C>A>B, the tally has each candidate beating one other and losing to one other. The order A>B>C disagrees with the B>C>A and C>A>B ballots on two pairs each, for a score of four, and every other order scores the same, so all six orders tie as Kemeny optima.",
    },
    id: "kemeny-method",
    name: "Kemeny-Young Method",
    category: "game",
    complexity: { time: "O(m! * m^2)", space: "O(m^2)" },
    defaultInput: {
        candidates: ["A", "B", "C", "D"],
        ballots: [
            [0, 1, 2, 3],
            [1, 2, 3, 0],
            [2, 0, 1, 3],
            [0, 2, 1, 3],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the candidates and the complete ranked ballots",
        "tally how many ballots prefer each candidate over each other candidate",
        "for every permutation of the candidates",
        "sum the reversed tally over every ordered pair in the permutation",
        "track the permutation with the smallest disagreement score",
        "after all permutations report the optimal ranking and its score",
    ],
};

export default module;
