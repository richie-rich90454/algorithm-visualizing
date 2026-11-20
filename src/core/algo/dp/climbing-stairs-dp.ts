/**
 * climbing-stairs-dp.ts - Climbing Stairs (Dynamic Programming).
 *
 * Counts the number of distinct ways to reach the top of a flight of n stairs
 * when each move climbs either one or two steps. The recurrence is Fibonacci:
 * ways(k) = ways(k-1) + ways(k-2), with ways(0) = ways(1) = 1.
 *
 * Time O(n), space O(n) for the table that is shown in the visualization.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Input = { stairs?: number };

function cells(
    dp: number[],
    computed: number,
    current: number,
): VisualEntity[] {
    return dp.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `${index}: ${value}`,
        value,
        state: (index === current
            ? "active"
            : index <= computed
                ? "sorted"
                : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, index, value },
    }));
}

function frame(
    step: number,
    dp: number[],
    computed: number,
    current: number,
    description: string,
    line: number,
): VisualFrame {
    return {
        stepNumber: step,
        entities: cells(dp, computed, current),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 1, cols: dp.length, stairs: dp.length - 1, ways: dp[dp.length - 1] ?? 0 },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = Number.isFinite(task.stairs)
        ? Math.max(0, Math.min(60, Math.floor(Number(task.stairs))))
        : 10;
    const dp = new Array<number>(n + 1).fill(0);
    let step = 0;

    if (n === 0) {
        dp[0] = 1;
        yield frame(step++, dp, 0, 0, "Zero stairs: one way, do nothing.", 0);
        yield frame(step, dp, 0, 0, "Climbing 0 stairs has exactly 1 way (the empty climb).", 5);
        return;
    }

    dp[0] = 1;
    yield frame(step++, dp, 0, -1, `Base case: ways(0) = 1 for ${n} stairs.`, 1);
    dp[1] = 1;
    yield frame(step++, dp, 1, 1, "Base case: ways(1) = 1 (a single one-step move).", 2);

    for (let k = 2; k <= n; k += 1) {
        dp[k] = (dp[k - 1] ?? 0) + (dp[k - 2] ?? 0);
        yield frame(
            step++,
            dp,
            k,
            k,
            `ways(${k}) = ways(${k - 1}) + ways(${k - 2}) = ${dp[k - 1]} + ${dp[k - 2]} = ${dp[k]}.`,
            3,
        );
    }

    yield frame(
        step,
        dp,
        n,
        -1,
        `There are ${dp[n]} distinct ways to climb ${n} stairs.`,
        5,
    );
}

const module: AlgorithmModule = {
    id: "climbing-stairs-dp",
    name: "Climbing Stairs (Dynamic Programming)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { stairs: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "allocate ways[0..n] and set ways[0] to 1",
        "set ways[1] to 1 when n is at least one",
        "for k from 2 to n",
        "set ways[k] to ways[k-1] + ways[k-2]",
        "keep the table for reconstruction and display",
        "report ways[n] as the number of climbs",
    ],
    education: {
        intuition:
            "The last move that lands you on step k came from step k-1 or step k-2. Every route to either of those steps extends uniquely to a route to k, so the counts add. Building the answers from step 0 upward avoids recomputing the same subproblems.",
        invariants: [
            "ways[0] and ways[1] both equal 1.",
            "After computing entry k, ways[k] equals ways[k-1] + ways[k-2].",
            "Entries beyond the current step remain zero until they are filled.",
        ],
        correctness:
            "Partition all walks that reach step k by their final move. A walk ending in a one-step move corresponds one-to-one with a walk reaching k-1, and a walk ending in a two-step move corresponds one-to-one with a walk reaching k-2. These two classes are disjoint and exhaustive, so ways(k) = ways(k-1) + ways(k-2); induction on k proves every table entry is correct.",
        complexityRationale:
            "Each step from 2 to n performs one constant-time addition, giving O(n) time. The table stores n+1 integers, so space is O(n), or O(1) if only the previous two entries are retained.",
        uses: [
            "Counting binary strings without consecutive ones",
            "Counting tilings of a 1-by-n board with dominoes and squares",
            "A first example of memoization and bottom-up dynamic programming",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 15",
            "Knuth, The Art of Computer Programming, Volume 1, Fibonacci numbers",
        ],
        workedExample:
            "For four stairs: ways(0)=1, ways(1)=1, ways(2)=1+1=2, ways(3)=2+1=3, and ways(4)=3+2=5. The five climbs are 1111, 112, 121, 211, and 22.",
    },
};

export default module;
