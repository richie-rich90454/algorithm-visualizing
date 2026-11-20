/**
 * telephone-dp.ts - Telephone Numbers (Dynamic Programming).
 *
 * Counts the number of ways to connect n people into disjoint pairs so that
 * everybody who calls does so once. The recurrence is
 * T(n) = T(n-1) + (n-1) * T(n-2), because person n either makes no call or
 * pairs with any of the n-1 others.
 *
 * Time O(n), space O(n) for the displayed table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Input = { people?: number };

function frame(
    step: number,
    dp: number[],
    computed: number,
    current: number,
    description: string,
    line: number,
): VisualFrame {
    const entities: VisualEntity[] = dp.map((value, index) => ({
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
    return {
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 1, cols: dp.length, people: dp.length - 1, ways: dp[dp.length - 1] ?? 0 },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = Number.isFinite(task.people)
        ? Math.max(0, Math.min(18, Math.floor(Number(task.people))))
        : 8;
    const dp = new Array<number>(n + 1).fill(0);
    let step = 0;

    dp[0] = 1;
    yield frame(step++, dp, 0, -1, "With nobody to call there is one empty arrangement.", 1);
    if (n >= 1) {
        dp[1] = 1;
        yield frame(step++, dp, 1, 1, "One person cannot place a call, so T(1) = 1.", 2);
    }

    for (let k = 2; k <= n; k += 1) {
        dp[k] = (dp[k - 1] ?? 0) + (k - 1) * (dp[k - 2] ?? 0);
        yield frame(
            step++,
            dp,
            k,
            k,
            `T(${k}) = T(${k - 1}) + ${k - 1} * T(${k - 2}) = ${dp[k - 1]} + ${k - 1} * ${dp[k - 2]} = ${dp[k]}.`,
            3,
        );
    }

    yield frame(
        step,
        dp,
        n,
        -1,
        `There are ${dp[n]} ways to pair up ${n} people into phone calls.`,
        5,
    );
}

const module: AlgorithmModule = {
    id: "telephone-dp",
    name: "Telephone Numbers (Dynamic Programming)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { people: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "allocate T[0..n] and set T[0] to 1",
        "set T[1] to 1 when n is at least one",
        "for k from 2 to n",
        "set T[k] to T[k-1] + (k-1) * T[k-2]",
        "explain the two cases: last person silent or calling",
        "report T[n] as the number of pairings",
    ],
    education: {
        intuition:
            "Focus on the last person. That person either makes no call, which leaves any valid arrangement of the other k-1 people, or calls one of the other k-1 people, which leaves an arrangement of k-2 people for the rest. Adding the two cases gives the recurrence.",
        invariants: [
            "T(0) = T(1) = 1.",
            "After filling entry k, T(k) = T(k-1) + (k-1) T(k-2).",
            "Every table entry is a nonnegative integer count of perfect matchings.",
        ],
        correctness:
            "Consider a fixed person among k. If that person calls one of the other k-1 people, removing the pair leaves a valid set of calls among k-2 people; there are (k-1) choices for the partner and T(k-2) arrangements for the rest. Otherwise the person makes no call, giving T(k-1) arrangements of the others. The cases are disjoint and cover every set of calls, so the recurrence counts them all exactly once.",
        complexityRationale:
            "Filling each of the n entries does one multiplication and one addition, so time is O(n). The table of n+1 counts uses O(n) space, reducible to O(1) with rolling variables.",
        uses: [
            "Counting perfect matchings in a complete graph",
            "Counting involutions without fixed points in combinatorics",
            "Modeling round-robin pairing schedules",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, telephone numbers",
            "Stanley, Enumerative Combinatorics, Volume 1, matchings",
        ],
        workedExample:
            "For four people: T(2)=T(1)+1*T(0)=2, T(3)=T(2)+2*T(1)=4, T(4)=T(3)+3*T(2)=4+6=10. Ten distinct ways exist to split four people into two calls.",
    },
};

export default module;
