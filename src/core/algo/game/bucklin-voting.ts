/**
 * bucklin-voting.ts - Bucklin Voting (Grand Junction Rule)
 *
 * Voters rank candidates. Starting with first places only, the tally adds one
 * ranking level at a time until a candidate reaches a majority. If several
 * candidates cross the threshold at the same level, the one with the largest
 * cumulative count wins; a remaining tie is reported as a shared victory.
 *
 * Time: O(v * m^2) in the worst case for v ballots and m candidates.
 * Space: O(v * m) for the displayed ballot table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function rankOf(ballot: number[], candidate: number): number {
    const index = ballot.indexOf(candidate);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
}

/** Return the winning level, the leaders at that level, and every cumulative tally. */
function tallyBucklin(ballots: number[][], m: number) {
    const majority = Math.floor(ballots.length / 2) + 1;
    const history: number[][] = [];
    for (let level = 0; level < m; level += 1) {
        const cumulative = new Array<number>(m).fill(0);
        for (const ballot of ballots) {
            for (let c = 0; c < m; c += 1) {
                if (rankOf(ballot, c) <= level) cumulative[c] = (cumulative[c] ?? 0) + 1;
            }
        }
        history.push([...cumulative]);
        const qualified = cumulative
            .map((count, c) => ({ count, c }))
            .filter((entry) => entry.count >= majority);
        if (qualified.length > 0) {
            const top = Math.max(...qualified.map((e) => e.count));
            return {
                majority,
                level,
                winners: qualified.filter((e) => e.count === top).map((e) => e.c),
                cumulative,
                history,
            };
        }
    }
    const plurality = history[0] ?? new Array<number>(m).fill(0);
    const top = Math.max(...plurality);
    return {
        majority,
        level: -1,
        winners: plurality.map((count, c) => (count === top ? c : -1)).filter((c) => c >= 0),
        cumulative: plurality,
        history,
    };
}

function makeCells(
    ballots: number[][],
    m: number,
    cumulative: number[],
    highlighted: Set<number>,
    winners: Set<number>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let v = 0; v < ballots.length; v += 1) {
        const ballot = ballots[v] ?? [];
        for (let c = 0; c < m; c += 1) {
            const rank = rankOf(ballot, c);
            const display = rank === Number.POSITIVE_INFINITY ? "-" : String(rank + 1);
            cells.push({
                id: `cell-${v}-${c}`,
                type: "cell",
                label: display,
                value: rank === Number.POSITIVE_INFINITY ? -1 : rank,
                state: highlighted.has(c) ? "comparing" : "visited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: v, col: c, voter: v, candidate: c, rank: Number.isFinite(rank) ? rank : -1 },
            });
        }
    }
    for (let c = 0; c < m; c += 1) {
        cells.push({
            id: `total-${c}`,
            type: "cell",
            label: String(cumulative[c] ?? 0),
            value: cumulative[c] ?? 0,
            state: winners.has(c) ? "sorted" : highlighted.has(c) ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: ballots.length, col: c, candidate: c, total: cumulative[c] ?? 0 },
        });
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
    const result = tallyBucklin(ballots, m);
    const rows = ballots.length + 1;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(ballots, m, new Array<number>(m).fill(0), new Set(), new Set()),
        edges: [],
        description: `Bucklin tally over ${ballots.length} ballots and ${m} candidates; majority threshold is ${result.majority}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols: m, majority: result.majority, winners: [], level: -1 },
    };
    step += 1;

    for (let level = 0; level < result.history.length; level += 1) {
        const cumulative = result.history[level] ?? [];
        const qualified = new Set<number>();
        for (let c = 0; c < m; c += 1) if ((cumulative[c] ?? 0) >= result.majority) qualified.add(c);
        yield {
            stepNumber: step,
            entities: makeCells(ballots, m, cumulative, qualified, new Set()),
            edges: [],
            description: `Level ${level}: cumulative counts [${cumulative.join(", ")}]${qualified.size > 0 ? " reach a majority" : " fall short of a majority"}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows, cols: m, majority: result.majority, winners: [], level, cumulative: [...cumulative] },
        };
        step += 1;
        if (qualified.size > 0 && result.level === level) break;
    }

    yield {
        stepNumber: step,
        entities: makeCells(ballots, m, result.cumulative, new Set(), new Set(result.winners)),
        edges: [],
        description: `Bucklin winner${result.winners.length === 1 ? "" : "s"}: ${result.winners.join(", ")} at level ${result.level} with count ${Math.max(...result.cumulative)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows,
            cols: m,
            majority: result.majority,
            winners: [...result.winners],
            level: result.level,
            cumulative: [...result.cumulative],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Bucklin voting looks for broad support rather than a simple plurality. Count first-place votes; if nobody has a majority, add second-place votes, then third places, and so on. The first candidate to pass half the ballots wins, which lets a broadly acceptable compromise beat a narrow favorite.",
        invariants: [
            "The cumulative count for a candidate never decreases as the ranking level grows.",
            "A candidate enters the tally exactly when a ballot ranks them at or above the current level.",
            "The winning level is the first one at which any candidate meets the majority threshold.",
        ],
        correctness:
            "By construction the cumulative count after level L is the number of voters who place a candidate among their top L+1 choices. The algorithm checks levels in increasing order and stops at the first with a qualified candidate, so the reported level is minimal. Among qualified candidates the highest cumulative count is the Bucklin tie-breaker, and remaining exact ties are reported together rather than broken arbitrarily.",
        complexityRationale:
            "There are at most m levels and each scans v ballots over m candidates to compute ranks, giving O(v * m^2) time with naive rank lookups. The ballot table and cumulative row occupy O(v * m) space.",
        uses: [
            "Historical and some current municipal elections",
            "Committee selection where broad acceptability matters",
            "Comparing majority-based rules with plurality voting",
        ],
        references: [
            "Bucklin, The Grand Junction Plan, 1912",
            "Arrow, Social Choice and Individual Values, Chapter 7",
        ],
        workedExample:
            "With five ballots and three candidates, first places give counts 2, 2, 1 with no majority of three. Adding second places raises the totals to 3, 4, 2, so candidate 1 wins with four votes at level one.",
    },
    id: "bucklin-voting",
    name: "Bucklin Voting",
    category: "game",
    complexity: { time: "O(v * m^2)", space: "O(v * m)" },
    defaultInput: {
        ballots: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 1, 0], [1, 2, 0]],
        candidates: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the ballots and the number of candidates",
        "set the majority threshold to half the ballots rounded up plus one",
        "for each ranking level from first place onward",
        "count ballots ranking each candidate at or above that level",
        "if any candidate reaches the majority threshold stop",
        "among qualified candidates choose the largest cumulative count",
        "report the winners, or the plurality leaders if no majority exists",
    ],
};

export default module;
