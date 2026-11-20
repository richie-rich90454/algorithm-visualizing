/**
 * nested-loop-join.ts - Nested Loop Join
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The nested loop join is the simplest relational join. For every row of the
 * outer relation it scans every row of the inner relation and emits the pairs
 * whose join keys are equal. It needs no index or sort and always finds every
 * matching pair, at the cost of comparing every cross-product pair.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(|outer| * |inner|) comparisons
 *   Space: O(|outer| * |inner|) in the worst case for the emitted matches
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid cell is drawn for each (outer, inner) comparison.
 *   - A green cell is an equal-key match; the active cell is being compared.
 *   - meta carries the flat match list and the comparison count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Row {
    key: number;
    value: number;
}

/** Build the comparison-matrix cells for the join. */
function makeCells(
    outer: Row[],
    inner: Row[],
    currentI: number,
    currentJ: number,
    matches: Set<string>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < outer.length; i += 1) {
        for (let j = 0; j < inner.length; j += 1) {
            const o = outer[i];
            const p = inner[j];
            if (!o || !p) {
                continue;
            }
            const isMatch = o.key === p.key;
            let state: EntityState = "idle";
            if (matches.has(`${i},${j}`)) {
                state = "sorted";
            } else if (i === currentI && j === currentJ) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: `${o.key}=${p.key}?`,
                value: o.key - p.key,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, outerKey: o.key, innerKey: p.key },
            });
        }
    }
    return cells;
}

/** Nested loop join generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { outer?: Row[]; inner?: Row[] } | null) ?? {};
    const outer: Row[] = (task.outer ?? [
        { key: 1, value: 10 },
        { key: 3, value: 30 },
        { key: 2, value: 20 },
    ]).map((r) => ({ key: Math.floor(Number(r.key)), value: Math.floor(Number(r.value)) }));
    const inner: Row[] = (task.inner ?? [
        { key: 2, value: 200 },
        { key: 3, value: 300 },
        { key: 3, value: 301 },
        { key: 4, value: 400 },
    ]).map((r) => ({ key: Math.floor(Number(r.key)), value: Math.floor(Number(r.value)) }));

    const flatMatches: number[] = [];
    const matchCells = new Set<string>();
    let comparisons = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(outer, inner, -1, -1, matchCells),
        edges: [],
        description: `Nested loop join of ${outer.length} outer and ${inner.length} inner rows: ${outer.length * inner.length} pair(s) to compare.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: outer.length, cols: inner.length, matches: [], comparisons: 0 },
    };
    step += 1;

    for (let i = 0; i < outer.length; i += 1) {
        const o = outer[i];
        if (!o) {
            continue;
        }
        for (let j = 0; j < inner.length; j += 1) {
            const p = inner[j];
            if (!p) {
                continue;
            }
            comparisons += 1;
            const isMatch = o.key === p.key;
            if (isMatch) {
                flatMatches.push(o.key, o.value, p.key, p.value);
                matchCells.add(`${i},${j}`);
            }
            yield {
                stepNumber: step,
                entities: makeCells(outer, inner, i, j, matchCells),
                edges: [],
                description: `Compare outer[${i}] key ${o.key} with inner[${j}] key ${p.key}: ${isMatch ? "match emitted" : "no match"}.`,
                codeLineNumber: isMatch ? 5 : 4,
                layout: "grid",
                meta: {
                    rows: outer.length,
                    cols: inner.length,
                    matches: [...flatMatches],
                    comparisons,
                    currentOuter: i,
                    currentInner: j,
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(outer, inner, -1, -1, matchCells),
        edges: [],
        description: `Join complete: ${flatMatches.length / 4} matching pair(s) from ${comparisons} comparison(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: outer.length, cols: inner.length, matches: [...flatMatches], comparisons },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Compare every row of one table with every row of the other and keep the pairs whose keys match. It is the join you would write with two nested loops, and it is correct regardless of data size, indexing, or ordering because no pair is ever skipped.",
        invariants: [
            "Each comparison visits exactly one (outer row, inner row) pair.",
            "A pair is emitted only when the two join keys are equal.",
            "After all pairs are scanned, the emitted set equals the cross product filtered by key equality.",
        ],
        correctness:
            "The loops enumerate the full Cartesian product of the two relations, and the equality test selects exactly those pairs that satisfy the join predicate. Since every pair is visited once and only equal-key pairs are emitted, the output is precisely the relational equi-join and no duplicate or missing pair is possible.",
        complexityRationale:
            "There are |outer| times |inner| pairs and each needs one comparison, giving quadratic time in the product of the input sizes. Each match contributes four numbers to the output list, so space is linear in the number of matches, which is at most the number of pairs.",
        uses: [
            "A fallback join in database engines when no usable index or sort exists",
            "Small dimension-table lookups in query plans",
            "A reference implementation for checking optimized joins",
        ],
        references: [
            "Elmasri and Navathe, Fundamentals of Database Systems, Chapter 14",
            "Garcia-Molina, Ullman and Widom, Database Systems: The Complete Book, Chapter 15",
        ],
        workedExample:
            "With outer keys 1, 3, 2 and inner keys 2, 3, 3, 4, the scan finds outer 3 matching both inner 3 rows and outer 2 matching inner 2. It emits three pairs in total after checking all twelve comparisons.",
    },
    id: "nested-loop-join",
    name: "Nested Loop Join",
    category: "production-systems",
    complexity: { time: "O(|outer| * |inner|)", space: "O(matches)" },
    defaultInput: {
        outer: [
            { key: 1, value: 10 },
            { key: 3, value: 30 },
            { key: 2, value: 20 },
        ],
        inner: [
            { key: 2, value: 200 },
            { key: 3, value: 300 },
            { key: 3, value: 301 },
            { key: 4, value: 400 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty match list",
        "for each outer row o in the outer relation",
        "for each inner row p in the inner relation",
        "compare the join key of o with the key of p",
        "if the keys are not equal, continue to the next pair",
        "if equal, emit the combined row into the match list",
        "after all pairs, report the match list and comparison count",
    ],
};

export default module;
