/**
 * ranked-pairs-voting.ts - Ranked Pairs (Tideman) Voting
 *
 * Record how many voters prefer each candidate over each other candidate,
 * then consider the pairwise victories from strongest to weakest. A victory is
 * locked in unless it would create a cycle among already locked victories.
 * The topological order of the locked graph is the final ranking.
 *
 * Time: O(m^3) for m candidates; space O(m^2) for the pairwise matrix.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Pair {
    winner: number;
    loser: number;
    strength: number;
}

function rankIn(ballot: number[], candidate: number): number {
    const index = ballot.indexOf(candidate);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
}

function pairwise(ballots: number[][], m: number): number[][] {
    const counts: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (const ballot of ballots) {
        for (let a = 0; a < m; a += 1) {
            for (let b = a + 1; b < m; b += 1) {
                if (rankIn(ballot, a) < rankIn(ballot, b)) {
                    counts[a] = counts[a] ?? [];
                    counts[b] = counts[b] ?? [];
                    counts[a][b] = (counts[a][b] ?? 0) + 1;
                } else if (rankIn(ballot, b) < rankIn(ballot, a)) {
                    counts[b] = counts[b] ?? [];
                    counts[a] = counts[a] ?? [];
                    counts[b][a] = (counts[b][a] ?? 0) + 1;
                }
            }
        }
    }
    return counts;
}

/** True when adding winner -> loser would close a directed cycle. */
function wouldCycle(locked: Pair[], winner: number, loser: number): boolean {
    const adjacency = new Map<number, number[]>();
    for (const p of locked) {
        if (!adjacency.has(p.winner)) adjacency.set(p.winner, []);
        adjacency.get(p.winner)?.push(p.loser);
    }
    const seen = new Set<number>();
    const stack = [loser];
    while (stack.length > 0) {
        const u = stack.pop();
        if (u === undefined) continue;
        if (u === winner) return true;
        if (seen.has(u)) continue;
        seen.add(u);
        for (const v of adjacency.get(u) ?? []) stack.push(v);
    }
    return false;
}

function topological(m: number, locked: Pair[]): number[] {
    const indegree = new Array<number>(m).fill(0);
    const adjacency = new Map<number, number[]>();
    for (const p of locked) {
        if (!adjacency.has(p.winner)) adjacency.set(p.winner, []);
        adjacency.get(p.winner)?.push(p.loser);
        indegree[p.loser] = (indegree[p.loser] ?? 0) + 1;
    }
    const queue: number[] = [];
    for (let c = 0; c < m; c += 1) if ((indegree[c] ?? 0) === 0) queue.push(c);
    const order: number[] = [];
    while (queue.length > 0) {
        const u = queue.shift();
        if (u === undefined) break;
        order.push(u);
        for (const v of adjacency.get(u) ?? []) {
            indegree[v] = (indegree[v] ?? 0) - 1;
            if (indegree[v] === 0) queue.push(v);
        }
    }
    for (let c = 0; c < m; c += 1) if (!order.includes(c)) order.push(c);
    return order;
}

function makeCells(counts: number[][], m: number, focus: Pair | null, locked: Pair[]): VisualEntity[] {
    const lockedSet = new Set(locked.map((p) => `${p.winner}-${p.loser}`));
    const cells: VisualEntity[] = [];
    for (let a = 0; a < m; a += 1) {
        for (let b = 0; b < m; b += 1) {
            const value = counts[a]?.[b] ?? 0;
            let state: EntityState = a === b ? "idle" : "visited";
            if (a !== b && lockedSet.has(`${a}-${b}`)) state = "sorted";
            if (focus && ((a === focus.winner && b === focus.loser) || (a === focus.loser && b === focus.winner))) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${a}-${b}`,
                type: "cell",
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: a, col: b, first: a, second: b, preferFirst: value },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number } | null) ?? {};
    const ballots: number[][] = Array.isArray(task.ballots) && task.ballots.length > 0
        ? task.ballots.map((b) => (Array.isArray(b) ? b.filter((x) => Number.isInteger(x)) : []))
        : [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 1, 0], [1, 2, 0]];
    let maxSeen = -1;
    for (const ballot of ballots) for (const c of ballot) maxSeen = Math.max(maxSeen, c);
    const m = Math.max(2, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1);
    const counts = pairwise(ballots, m);
    const pairs: Pair[] = [];
    for (let a = 0; a < m; a += 1) {
        for (let b = a + 1; b < m; b += 1) {
            const ab = counts[a]?.[b] ?? 0;
            const ba = counts[b]?.[a] ?? 0;
            if (ab > ba) pairs.push({ winner: a, loser: b, strength: ab });
            else if (ba > ab) pairs.push({ winner: b, loser: a, strength: ba });
        }
    }
    pairs.sort((x, y) => y.strength - x.strength || x.winner - y.winner || x.loser - y.loser);
    const locked: Pair[] = [];
    const skipped: Pair[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(counts, m, null, locked),
        edges: [],
        description: `Ranked pairs over ${m} candidates: cell (a,b) counts ballots placing a above b.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: m, candidates: m, locked: [], ranking: [], winner: -1 },
    };
    step += 1;

    for (const pair of pairs) {
        const cycle = wouldCycle(locked, pair.winner, pair.loser);
        if (!cycle) locked.push(pair);
        else skipped.push(pair);
        yield {
            stepNumber: step,
            entities: makeCells(counts, m, pair, locked),
            edges: [],
            description: `Victory ${pair.winner} over ${pair.loser} (strength ${pair.strength}): ${cycle ? "skipped to avoid a cycle" : "locked in"}.`,
            codeLineNumber: cycle ? 5 : 4,
            layout: "grid",
            meta: {
                rows: m,
                cols: m,
                candidates: m,
                locked: locked.map((p) => `${p.winner}>${p.loser}:${p.strength}`),
                skipped: skipped.map((p) => `${p.winner}>${p.loser}:${p.strength}`),
                ranking: [],
                winner: -1,
                focus: `${pair.winner}>${pair.loser}`,
            },
        };
        step += 1;
    }

    const ranking = topological(m, locked);
    const winner = ranking[0] ?? -1;
    yield {
        stepNumber: step,
        entities: makeCells(counts, m, null, locked),
        edges: [],
        description: `Final ranking ${ranking.join(" > ")}; ranked-pairs winner is candidate ${winner}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: m,
            cols: m,
            candidates: m,
            locked: locked.map((p) => `${p.winner}>${p.loser}:${p.strength}`),
            skipped: skipped.map((p) => `${p.winner}>${p.loser}:${p.strength}`),
            ranking,
            winner,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ranked pairs respects as many voter preferences as possible. Build a list of pairwise victories and sort them by how many voters agree. Lock in each victory unless it would contradict a stronger locked chain, then read off a ranking from the remaining acyclic graph. This makes the method independent of irrelevant alternatives in the classic sense.",
        invariants: [
            "A locked victory always has at least as much support as any later victory considered.",
            "The set of locked victories is always acyclic.",
            "Skipped victories are exactly those that would close a cycle.",
        ],
        correctness:
            "Processing strengths in nonincreasing order means the first conflict is resolved in favor of the stronger majority. A cycle check via reachability guarantees the locked graph stays acyclic, so a topological order exists. Because every skipped edge would close a cycle, the locked graph is the maximal consistent set under this ordering, and its topological order is the ranked-pairs social ranking with the unique source as winner.",
        complexityRationale:
            "There are m squared pair counts, each needing a scan of v ballots for at most O(m) rank lookups, plus O(m) cycle checks over O(m^2) edges, for O(v * m^2 + m^3) time. The pairwise matrix and edge lists use O(m^2) space.",
        uses: [
            "Preference aggregation in elections and committees",
            "Consensus ranking from pairwise comparison data",
            "A concrete example of Condorcet-consistent social choice",
        ],
        references: [
            "Tideman, Independence of Irrelevant Alternatives as a Criterion, 1987",
            "Arrow, Social Choice and Individual Values, Chapter 7",
        ],
        workedExample:
            "With three tied-strength victories 0 over 2, 1 over 0 and 2 over 1, the first two lock in. The third would close the cycle 0 > 2 > 1 > 0, so it is skipped and the ranking becomes 1 > 0 > 2 with winner 1.",
    },
    id: "ranked-pairs-voting",
    name: "Ranked Pairs (Tideman) Voting",
    category: "game",
    complexity: { time: "O(m^3)", space: "O(m^2)" },
    defaultInput: {
        ballots: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 1, 0], [1, 2, 0]],
        candidates: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build the pairwise support matrix from every ballot",
        "form a victory for each pair with a strict majority preference",
        "sort victories by strength descending, breaking ties by candidate index",
        "for each victory in that order",
        "if adding it would create a cycle skip it",
        "otherwise lock it into the relation",
        "topologically sort the locked graph and report the winner",
    ],
};

export default module;
