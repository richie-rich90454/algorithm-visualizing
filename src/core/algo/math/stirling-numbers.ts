/**
 * stirling-numbers.ts - Stirling Numbers of the Second Kind.
 *
 * S(n,k) counts the ways to partition n labeled objects into k nonempty
 * unlabeled groups. The recurrence S(n,k) = S(n-1,k-1) + k*S(n-1,k) is filled
 * as a DP table: either the new object forms its own group, or it joins one of
 * the k existing groups.
 *
 * Time O(n*k), space O(n*k).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function table(n: number, k: number, row: number, col: number, phase: string): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i <= n; i += 1) {
        for (let j = 0; j <= k; j += 1) {
            let state: EntityState = "idle";
            if (i === row && j === col) state = "comparing";
            else if (phase === "done" && j <= i) state = "sorted";
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: `S(${i},${j})`,
                value: `${i},${j}`,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; k?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(0, Math.min(30, Math.trunc(task.n))) : 8;
    const k = typeof task.k === "number" ? Math.max(0, Math.min(30, Math.trunc(task.k))) : 4;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
    dp[0]![0] = 1;
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(n, k, -1, -1, "start"),
        edges: [],
        description: `Fill Stirling table up to S(${n},${k}); base S(0,0)=1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, k, result: n === 0 && k === 0 ? 1 : 0 },
    };
    step += 1;

    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= Math.min(i, k); j += 1) {
            dp[i]![j] = dp[i - 1]![j - 1]! + j * dp[i - 1]![j]!;
            yield {
                stepNumber: step,
                entities: table(n, k, i, j, "working"),
                edges: [],
                description: `S(${i},${j}) = S(${i - 1},${j - 1}) + ${j}*S(${i - 1},${j}) = ${dp[i - 1]![j - 1]} + ${j}*${dp[i - 1]![j]} = ${dp[i]![j]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { n, k, i, j, value: dp[i]![j] },
            };
            step += 1;
        }
    }

    const result = k <= n ? dp[n]![k]! : 0;
    yield {
        stepNumber: step,
        entities: table(n, k, -1, -1, "done"),
        edges: [],
        description: `Done: S(${n},${k}) = ${result} partitions of ${n} objects into ${k} groups.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n, k, result, table: dp.map((r) => r.join(",")) },
    };
}

const module: AlgorithmModule = {
    id: "stirling-numbers",
    name: "Stirling Numbers of the Second Kind",
    category: "math",
    complexity: { time: "O(n*k)", space: "O(n*k)" },
    defaultInput: { n: 8, k: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "create table S[0..n][0..k] filled with zero",
        "set S[0][0] = 1 and all other S[0][j] = 0",
        "for i = 1 to n, for j = 1 to min(i,k)",
        "S[i][j] <- S[i-1][j-1] + j*S[i-1][j]",
        "done: S[n][k] is the number of partitions into k groups",
    ],
    education: {
        intuition:
            "When adding the i-th labeled object to a partition of the first i-1 objects, either it stands alone as a new group, giving S(i-1,j-1) ways, or it joins one of j existing groups, giving j*S(i-1,j) ways. Adding those cases gives the recurrence.",
        invariants: [
            "S(i,0) is 0 for i>0 and S(0,0) is 1.",
            "S(i,j) is 0 whenever j > i, since groups cannot be empty.",
            "S(i,1) = S(i,i) = 1 for every positive i.",
        ],
        correctness:
            "Every partition of i objects into j groups either isolates object i (bijection with partitions of i-1 objects into j-1 groups) or places it in one of the j groups of a partition of i-1 objects into j groups. The two cases are disjoint and exhaustive, so the recurrence counts exactly once.",
        complexityRationale:
            "The nested loops fill at most n*k table entries, each in constant time, for O(n*k) time. Storing the full table costs O(n*k) space, which could be reduced to O(k) if only the final row were needed.",
        uses: [
            "Counting set partitions in combinatorics",
            "Converting powers to falling factorials and back",
            "Computing Bell numbers as sums of Stirling numbers",
        ],
        references: [
            "Graham, Knuth, and Patashnik, Concrete Mathematics, Chapter 6",
            "Stanley, Enumerative Combinatorics, Volume 1",
        ],
        workedExample:
            "S(4,2) = S(3,1) + 2*S(3,2) = 1 + 2*3 = 7. The seven ways split four labeled objects into two nonempty unlabeled groups such as {a}|{b,c,d} and {a,b}|{c,d}.",
    },
};

export default module;
