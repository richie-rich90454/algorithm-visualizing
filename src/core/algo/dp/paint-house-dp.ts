/**
 * paint-house-dp.ts - Paint House (Dynamic Programming)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given n houses and three colors, each house has a cost for each color.
 * Choose a color for every house so that no two neighboring houses share a
 * color, minimizing the total cost. The DP state dp[i][c] is the cheapest cost
 * for the first i+1 houses when house i is painted color c.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) with three colors
 *   Space: O(n * 3) for the replayable table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One row of cells per house, one column per color.
 *   - The cell being computed is YELLOW; already finished cells are GREEN.
 *   - The final frame marks the chosen color of every house.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    dp: number[][],
    computed: number,
    chosen: number[],
    final: boolean,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < dp.length; i += 1) {
        const row = dp[i] ?? [];
        for (let c = 0; c < 3; c += 1) {
            const value = row[c] ?? 0;
            let state: EntityState = "unvisited";
            if (final) {
                state = chosen[i] === c ? "sorted" : "idle";
            } else if (i < computed) {
                state = "visited";
            } else if (i === computed) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${i}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: c, cost: value },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { costs?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.costs) ? task.costs : [[17, 2, 17], [16, 16, 5], [14, 3, 19]];
    const costs = raw.map((row) => [Number(row[0]) || 0, Number(row[1]) || 0, Number(row[2]) || 0]);
    const n = costs.length;
    const dp: number[][] = costs.map((row) => [...row]);
    const choice: number[][] = costs.map(() => [-1, -1, -1]);
    let step = 0;

    const frame = (
        computed: number,
        chosen: number[],
        final: boolean,
        description: string,
        line: number,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(dp, computed, chosen, final),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: n,
            cols: 3,
            answer: n === 0 ? 0 : null,
            dp: dp.map((row) => [...row]),
        },
    });

    yield frame(-1, [], false, `Painting ${n} house(s) with three colors and no equal neighbors.`, 0);
    if (n === 0) {
        yield frame(-1, [], true, "No houses to paint, so the minimum cost is zero.", 1);
        return;
    }

    for (let c = 0; c < 3; c += 1) {
        choice[0]![c] = c;
    }
    yield frame(0, [], false, "House 0 can take any color at its own cost.", 2);

    for (let i = 1; i < n; i += 1) {
        for (let c = 0; c < 3; c += 1) {
            let best = Infinity;
            let from = -1;
            for (let p = 0; p < 3; p += 1) {
                if (p === c) continue;
                const candidate = (dp[i - 1]?.[p] ?? 0) + (costs[i]?.[c] ?? 0);
                if (candidate < best) {
                    best = candidate;
                    from = p;
                }
            }
            dp[i]![c] = best;
            choice[i]![c] = from;
        }
        yield frame(
            i,
            [],
            false,
            `House ${i}: each color takes the cheapest different color of house ${i - 1} plus its own cost.`,
            3,
        );
    }

    let answer = Infinity;
    let last = -1;
    for (let c = 0; c < 3; c += 1) {
        if ((dp[n - 1]?.[c] ?? Infinity) < answer) {
            answer = dp[n - 1]?.[c] ?? Infinity;
            last = c;
        }
    }
    const chosen: number[] = new Array(n).fill(0);
    let cursor = last;
    for (let i = n - 1; i >= 0; i -= 1) {
        chosen[i] = cursor;
        cursor = choice[i]?.[cursor] ?? -1;
    }
    const finalFrame = frame(-1, chosen, true, `Minimum painting cost is ${answer}.`, 5);
    finalFrame.meta["answer"] = answer;
    finalFrame.meta["choice"] = chosen;
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Walk left to right and remember, for each possible color of the current house, the cheapest way to have painted everything up to it. Because only the previous house matters, each new cost is the current color cost plus the cheapest different color from the row before.",
        invariants: [
            "dp[i][c] is the minimum cost for houses 0 through i when house i uses color c.",
            "The predecessor color is always different from c.",
            "Every prefix solution is extended by exactly one new house.",
        ],
        correctness:
            "For house 0 the DP equals the raw costs. For i > 0, any valid coloring ending in color c has a predecessor color p different from c, and its prefix is optimally captured by dp[i-1][p]. Taking the minimum over all such p and adding the cost of color c therefore yields the optimal substructure, so induction proves dp[i][c] correct; the global optimum is the minimum of the last row.",
        complexityRationale:
            "There are n rows and three colors, and each cell scans three predecessor colors, so the work is O(9n) = O(n). The table used for replay holds three values per house, giving O(n) space.",
        uses: [
            "Assigning adjacent jobs to different machines at minimum cost",
            "Coloring map regions with neighbor constraints",
            "A compact introduction to optimal substructure in DP",
        ],
        references: [
            "GeeksforGeeks, Paint House",
            "Cormen et al., Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "With costs [17,2,17], [16,16,5], [14,3,19], house 0 picks color 1 at cost 2. House 1 avoids color 1 and picks color 2 at cost 5. House 2 avoids color 2 and picks color 1 at cost 3, giving a total of 10.",
    },
    id: "paint-house-dp",
    name: "Paint House (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { costs: [[17, 2, 17], [16, 16, 5], [14, 3, 19]] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the cost matrix costs of shape n by three",
        "if n is zero the answer is zero and stop",
        "copy the first row into dp[0]",
        "for each house i from one to n-1 and each color c",
        "set dp[i][c] to costs[i][c] plus the smallest dp[i-1][p] with p different from c",
        "record the predecessor color that achieved that minimum",
        "the answer is the smallest value in the last row",
        "backtrack the predecessor colors to recover the chosen colors",
        "report the total cost and the chosen color of every house",
    ],
};

export default module;
