/**
 * egg-dropping-dp.ts - Egg Dropping (Dynamic Programming)
 *
 * Given E eggs and F consecutive floors, find the fewest drops needed in the
 * worst case to identify the highest safe floor. Dropping from floor x either
 * breaks an egg (search the x-1 floors below with one fewer egg) or survives
 * (search the F-x floors above with the same eggs). The recurrence takes the
 * better choice of pivot floor for every subproblem.
 *
 * Time: O(E * F^2). Space: O(E * F).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    eggs?: number;
    floors?: number;
}

function makeCells(dp: number[][], active?: [number, number]): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let e = 0; e < dp.length; e += 1) {
        const row = dp[e] ?? [];
        for (let f = 0; f < row.length; f += 1) {
            const value = row[f] ?? 0;
            const state: EntityState =
                active && active[0] === e && active[1] === f
                    ? "comparing"
                    : f === 0 || f === 1 || e === 1 || (active && e === active[0] && f < active[1])
                      ? "visited"
                      : "idle";
            cells.push({
                id: `cell-${e}-${f}`,
                type: "cell",
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: e, col: f, eggs: e, floors: f, trials: value },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const eggs = Math.min(6, Math.max(1, Math.floor(typeof task.eggs === "number" ? task.eggs : 3)));
    const floors = Math.min(30, Math.max(0, Math.floor(typeof task.floors === "number" ? task.floors : 14)));
    const dp: number[][] = Array.from({ length: eggs + 1 }, () =>
        new Array<number>(floors + 1).fill(0),
    );

    for (let e = 1; e <= eggs; e += 1) {
        dp[e]![0] = 0;
        if (floors >= 1) dp[e]![1] = 1;
    }
    for (let f = 0; f <= floors; f += 1) dp[1]![f] = f;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Base cases ready for ${eggs} eggs and ${floors} floors: one egg needs one trial per floor, zero floors need none.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { eggs, floors, rows: eggs + 1, cols: floors + 1, answer: floors > 0 ? floors : 0, dp: dp.map((r) => [...r]) },
    };
    step += 1;

    for (let e = 2; e <= eggs; e += 1) {
        for (let f = 2; f <= floors; f += 1) {
            let best = Number.POSITIVE_INFINITY;
            for (let x = 1; x <= f; x += 1) {
                const breaks = dp[e - 1]![x - 1] ?? 0;
                const survives = dp[e]![f - x] ?? 0;
                const worst = Math.max(breaks, survives) + 1;
                if (worst < best) best = worst;
            }
            dp[e]![f] = Number.isFinite(best) ? best : 0;
            yield {
                stepNumber: step,
                entities: makeCells(dp, [e, f]),
                edges: [],
                description: `With ${e} eggs and ${f} floors, the best first drop needs ${dp[e]![f]} trials in the worst case.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: {
                    eggs,
                    floors,
                    rows: eggs + 1,
                    cols: floors + 1,
                    answer: dp[e]![f],
                    dp: dp.map((r) => [...r]),
                },
            };
            step += 1;
        }
    }

    const answer = dp[eggs]![floors] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Done: ${answer} trials are sufficient in the worst case with ${eggs} eggs and ${floors} floors.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { eggs, floors, rows: eggs + 1, cols: floors + 1, answer, dp: dp.map((r) => [...r]) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Choose a floor to drop the first egg from. If it breaks, the answer is lower and one egg is gone; if it survives, the answer is higher and all eggs remain. Try every possible first floor and keep the choice with the smallest worst-case number of drops, then reuse that same idea on the smaller subproblems.",
        invariants: [
            "dp[e][f] is the minimum worst-case number of trials for e eggs and f consecutive floors.",
            "Base cases hold: dp[e][0] = 0, dp[e][1] = 1, and dp[1][f] = f.",
            "Every transition reads dp values for strictly fewer floors or fewer eggs, which are already final.",
        ],
        correctness:
            "Any optimal strategy picks some first floor x. If the egg breaks, the remaining problem has e-1 eggs and x-1 floors; otherwise it has e eggs and f-x floors. The worst case for that first drop is one plus the larger of the two optimal subproblem costs, so minimizing over all x gives the optimal cost for the current subproblem. Base cases are exact, and filling the table by increasing eggs and floors gives correct values by induction.",
        complexityRationale:
            "The table has (E+1)(F+1) cells and each cell scans up to F pivot floors, giving O(E * F^2) time. Storing the table uses O(E * F) space.",
        uses: [
            "Reliability testing where tests are destructive",
            "Binary search when the number of allowed failed probes is limited",
            "A teaching example for optimal substructure and minimax DP",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 15",
            "Bellas, Egg-Dropping Puzzles and Dynamic Programming, 2010",
        ],
        workedExample:
            "With 2 eggs and 10 floors, dropping at floor 4 first balances the outcomes: a break leaves 1 egg and 3 floors needing 3 trials, while a survival leaves 2 eggs and 6 floors needing 3 trials, so the worst case is 4 drops total.",
    },
    id: "egg-dropping-dp",
    name: "Egg Dropping (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(E * F^2)", space: "O(E * F)" },
    defaultInput: { eggs: 3, floors: 14 },
    visualType: "grid",
    run,
    pseudocode: [
        "read eggs E and floors F and allocate a table dp of size (E+1) by (F+1)",
        "set dp[e][0] = 0, dp[e][1] = 1 for every e, and dp[1][f] = f for every f",
        "for e from 2 to E and f from 2 to F",
        "for each trial floor x from 1 to f",
        "let worst be 1 plus the larger of dp[e-1][x-1] and dp[e][f-x]",
        "set dp[e][f] to the smallest worst value over all x",
        "follow the filled table and report dp[E][F] as the answer",
    ],
};

export default module;
