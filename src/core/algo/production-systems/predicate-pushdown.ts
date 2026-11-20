/**
 * predicate-pushdown.ts - Predicate Pushdown in Query Plans
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A naive join plan crosses two relations first and applies a filter only
 * afterward, paying to combine rows that the filter will discard. Predicate
 * pushdown moves a filter as close to its source relation as possible: rows
 * that cannot pass the predicate are removed before the join. Because the
 * predicate here references only one input relation, pushing it below the join
 * is always safe and yields exactly the same result rows while joining fewer
 * candidates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L * R) for the naive plan; O(L * R') after pushdown, R' <= R
 *   Space: O(L * R') for the surviving joined rows
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per row of the filtered relation, marked keep or discard.
 *   - Result cells show surviving joined rows.
 *   - meta compares naive candidate pairs with pushdown candidate pairs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type LeftRow = [id: number, category: number];
type RightRow = [id: number, value: number];

interface Input {
    left?: LeftRow[];
    right?: RightRow[];
    threshold?: number;
}

const DEFAULT_LEFT: LeftRow[] = [
    [1, 10],
    [2, 20],
    [3, 30],
    [4, 40],
];
const DEFAULT_RIGHT: RightRow[] = [
    [1, 5],
    [1, 80],
    [2, 50],
    [3, 20],
    [4, 90],
];
const DEFAULT_THRESHOLD = 50;

function resultCells(rows: string[], state: EntityState): VisualEntity[] {
    return rows.map((row, index) => ({
        id: `row-${index}`,
        type: "cell" as const,
        label: row,
        value: row,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, value: row },
    }));
}

function filterCells(rows: RightRow[], keep: boolean[], current: number | null): VisualEntity[] {
    return rows.map((row, index) => {
        let state: EntityState = "idle";
        if (index === current) {
            state = "active";
        } else if (keep[index] === true) {
            state = "sorted";
        } else if (keep[index] === false) {
            state = "error";
        }
        return {
            id: `cand-${index}`,
            type: "cell" as const,
            label: `id${row[0]}:v${row[1]}`,
            value: row[1],
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, id: row[0], value: row[1] },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const left: LeftRow[] = task.left ?? DEFAULT_LEFT;
    const right: RightRow[] = task.right ?? DEFAULT_RIGHT;
    const threshold = task.threshold ?? DEFAULT_THRESHOLD;
    let step = 0;
    const matchCount = (rows: RightRow[]): number =>
        left.reduce((sum, l) => sum + rows.filter((r) => r[0] === l[0]).length, 0);

    yield {
        stepNumber: step,
        entities: filterCells(right, [], null),
        edges: [],
        description: `Optimizing a join of ${left.length} left and ${right.length} right rows with predicate value >= ${threshold}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { threshold, naivePairs: matchCount(right), pushdownPairs: 0, matches: [] },
    };
    step += 1;

    const keep: boolean[] = [];
    for (let i = 0; i < right.length; i += 1) {
        const row = right[i]!;
        keep[i] = row[1] >= threshold;
        yield {
            stepNumber: step,
            entities: filterCells(right, keep, i),
            edges: [],
            description: `Pushdown test: right row id${row[0]} value ${row[1]} ${keep[i] ? "passes" : "is discarded before the join"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                threshold,
                naivePairs: matchCount(right),
                pushdownPairs: matchCount(right.filter((_, i) => keep[i])),
                matches: [],
            },
        };
        step += 1;
    }

    const filtered = right.filter((_, i) => keep[i]);
    const pairs: string[] = [];
    for (const l of left) {
        for (const r of filtered) {
            if (l[0] === r[0]) {
                pairs.push(`id${l[0]}:cat${l[1]}:v${r[1]}`);
            }
        }
    }
    yield {
        stepNumber: step,
        entities: resultCells(pairs, "sorted"),
        edges: [],
        description: `Pushdown joined ${filtered.length} of ${right.length} right rows and returned ${pairs.length} row(s) identical to the naive plan.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            threshold,
            naivePairs: matchCount(right),
            pushdownPairs: matchCount(filtered),
            matches: pairs,
            duplicateResult: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If a filter only looks at columns from one table, there is no reason to carry the other table's rows through the join first. Pushing the predicate down means discarding failing rows at the source, so the join sees a smaller input. The result is unchanged because discarded rows could never have satisfied the filter anyway.",
        invariants: [
            "A row is pushed down only when its predicate references columns from its own relation.",
            "The set of result rows after pushdown equals the set from filtering after the join.",
            "Pushdown never increases the number of candidate rows entering the join.",
            "Row order in the result matches the left-then-right join order.",
        ],
        correctness:
            "The naive plan forms every matching left-right pair and keeps those whose right value passes the predicate. The pushed-down plan first removes right rows that fail the predicate, then forms matching pairs. For any pair produced by the naive plan, its right row passed the predicate, so that row survived pushdown and the pair is produced again. Conversely every pushed-down pair passes the predicate by construction. The two result sets are therefore identical, while the join input is no larger.",
        complexityRationale:
            "Forming all left-right candidates costs O(L * R) in the naive plan. After pushdown only R' right rows remain, so the join costs O(L * R') with R' <= R, plus O(R) for the filter. The result set uses O(L * R') space.",
        uses: [
            "SQL optimizer rewrites in PostgreSQL, MySQL, and Apache Spark Catalyst",
            "Reducing network shuffle by filtering before distributed joins",
            "Columnar query engines that evaluate predicates during scans",
        ],
        references: [
            "Garcia-Molina, Ullman, and Widom, Database Systems: The Complete Book, query optimization chapter",
            "Selinger et al., Access Path Selection in a Relational Database Management System, SIGMOD 1979",
        ],
        workedExample:
            "Joining left rows id1..4 with right rows id1:v5, id1:v80, id2:v50, id3:v20, id4:v90 and filter value >= 50, the naive plan considers five right rows. Pushdown drops v5 and v20 before joining, leaving three rows. Both plans return id1:v80, id2:v50, and id4:v90, but pushdown performs fewer join comparisons.",
    },
    id: "predicate-pushdown",
    name: "Predicate Pushdown",
    category: "production-systems",
    complexity: { time: "O(L * R')", space: "O(L * R')" },
    defaultInput: { left: DEFAULT_LEFT, right: DEFAULT_RIGHT, threshold: DEFAULT_THRESHOLD },
    visualType: "grid",
    run,
    pseudocode: [
        "identify predicates that reference one join input",
        "for each row of the filtered relation",
        "keep the row when it satisfies the predicate",
        "otherwise discard it before the join is built",
        "join the left rows with the surviving right rows",
        "emit each matching left-right pair",
        "compare candidate counts with the naive plan",
        "done: report the identical result rows",
    ],
};

export default module;
