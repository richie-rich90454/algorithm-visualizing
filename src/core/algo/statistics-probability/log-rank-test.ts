/**
 * log-rank-test.ts - Log-Rank Test for Survival Curves
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The log-rank test compares two survival curves by looking at each distinct
 * event time. At every time it forms the risk sets in both groups and compares
 * the observed number of events in group one with the number expected when the
 * two groups share one hazard. Summing those differences and standardizing by
 * their variance gives a chi-square statistic with one degree of freedom.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) with a sort of the event times
 *   Space: O(n) for the risk sets and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per distinct event time shows the observed minus expected count.
 *   - The current event time is highlighted; the final frame is green.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `t=${index}: ${value.toFixed(3)}`,
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { group1?: number[][]; group2?: number[][] } | null) ?? {};
    const g1: number[][] = Array.isArray(task.group1) ? task.group1 : [[1, 1], [2, 1], [3, 0], [4, 1], [5, 1]];
    const g2: number[][] = Array.isArray(task.group2) ? task.group2 : [[1, 0], [2, 0], [3, 1], [4, 1], [5, 1]];
    const times = Array.from(new Set([...g1, ...g2].map((p) => Number(p[0]) || 0))).sort((a, b) => a - b);
    let observed = 0;
    let expected = 0;
    let variance = 0;
    const differences: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(times.map(() => 0), -1, false),
        edges: [],
        description: `Comparing two survival curves over ${times.length} distinct event times.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { times, observed: 0, expected: 0, variance: 0, chiSquare: 0, differences: [] },
    };
    for (let i = 0; i < times.length; i += 1) {
        const t = times[i]!;
        const risk1 = g1.filter((p) => (Number(p[0]) || 0) >= t).length;
        const risk2 = g2.filter((p) => (Number(p[0]) || 0) >= t).length;
        const total = risk1 + risk2;
        const d1 = g1.filter((p) => (Number(p[0]) || 0) === t && (Number(p[1]) || 0) === 1).length;
        const d2 = g2.filter((p) => (Number(p[0]) || 0) === t && (Number(p[1]) || 0) === 1).length;
        const d = d1 + d2;
        if (d > 0 && total > 1) {
            const e1 = (d * risk1) / total;
            const v = (d * risk1 * risk2 * (total - d)) / (total * total * (total - 1));
            observed += d1;
            expected += e1;
            variance += v;
            differences.push(d1 - e1);
        } else {
            differences.push(0);
        }
        const chi = variance > 0 ? (observed - expected) ** 2 / variance : 0;
        yield {
            stepNumber: i + 1,
            entities: makeBars([...differences, ...new Array<number>(times.length - differences.length).fill(0)], i, false),
            edges: [],
            description: `At time ${t}: risk ${risk1}/${risk2}, observed ${d1}, expected ${((d1 + d2 ? (d1 + d2) * risk1 / (risk1 + risk2) : 0)).toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { times, observed, expected, variance, chiSquare: chi, differences: [...differences], current: i },
        };
    }
    const chiSquare = variance > 0 ? (observed - expected) ** 2 / variance : 0;
    yield {
        stepNumber: times.length + 1,
        entities: makeBars(differences, -1, true),
        edges: [],
        description: `Log-rank chi-square = ${chiSquare.toFixed(4)} from observed ${observed} versus expected ${expected.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { times, observed, expected, variance, chiSquare, differences },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To compare two survival curves, look at every moment when someone has an event and ask whether the events split between the groups in proportion to the groups at risk. If one group has many more events than expected at several times, its survival is worse. The log-rank statistic adds those discrepancies and measures them against their sampling variance.",
        invariants: [
            "A subject contributes to a risk set only at times at or after its observed time.",
            "Censored subjects add to the risk set but never count as events.",
            "At each event time the expected events in group one are the event count times the group one risk share.",
        ],
        correctness:
            "Under the null hypothesis that both groups share one hazard, the events at a given time follow a hypergeometric split across the risk sets, so the expected count is d times n1 over n and its variance is the hypergeometric variance. These contributions are independent across distinct event times, so their sums give a statistic that is asymptotically chi-square with one degree of freedom. A large observed minus expected difference therefore signals a real survival difference.",
        complexityRationale:
            "There are n distinct times and each scan filters the two groups, costing O(n) time overall with a sort of O(n log n). Storing the times and per-time differences uses O(n) space.",
        uses: [
            "Comparing treatments in clinical survival trials",
            "Testing differences in time-to-failure between machines",
            "Analyzing customer churn or time-to-event data",
        ],
        references: [
            "Mantel, Evaluation of survival data and two new rank order statistics, 1966",
            "Kleinbaum and Klein, Survival Analysis, log-rank section",
        ],
        workedExample:
            "If at one event time group one has 4 of 10 at risk and 2 of 5 events occur, the expected number in group one is 5 times 4/10 = 2, so the difference is zero. Repeating this across times and accumulating a positive difference points to worse survival in group one.",
    },
    id: "log-rank-test",
    name: "Log-Rank Test",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { group1: [[1, 1], [2, 1], [3, 0], [4, 1], [5, 1]], group2: [[1, 0], [2, 0], [3, 1], [4, 1], [5, 1]] },
    visualType: "array",
    run,
    pseudocode: [
        "read each group's observed times and event indicators",
        "collect all distinct event times in order",
        "at each time count the subjects still at risk in both groups",
        "count observed events and compute the expected share",
        "accumulate observed minus expected and its variance",
        "divide the squared total difference by the variance",
        "done: report the log-rank chi-square statistic",
    ],
};

export default module;
