/**
 * sort-merge-join.ts - Sort-Merge Join
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sort-merge join sorts both relations on the join key, then walks two
 * cursors in lockstep. When the keys match it finds the whole group of equal
 * keys on both sides and emits the cross product of those groups. When one key
 * is smaller, only that cursor advances. Sorting dominates the cost, and the
 * merge itself is a single linear scan.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((|left| + |right|) log(|left| + |right|)) for sorting
 *   Space: O(|left| + |right|) for the sorted copies and output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid row zero holds the sorted left keys; row one holds the right keys.
 *   - The two current cursors are yellow; consumed rows are green.
 *   - Each emitted group is highlighted before the final summary.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Row {
    key: number;
    value: number;
}

interface SortMergeInput {
    left?: Row[];
    right?: Row[];
}

function makeCells(
    left: Row[],
    right: Row[],
    i: number,
    j: number,
    phase: string,
): VisualEntity[] {
    const width = Math.max(left.length, right.length, 1);
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        const source = row === 0 ? left : right;
        const cursor = row === 0 ? i : j;
        for (let col = 0; col < width; col += 1) {
            const entry = source[col];
            let state: EntityState = "idle";
            if (entry && phase === "merge") {
                if (col === cursor) state = "comparing";
                else if (col < cursor) state = "sorted";
            } else if (entry) {
                state = "sorted";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: entry ? `${entry.key}:${entry.value}` : ".",
                value: entry ? entry.key : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, key: entry ? entry.key : -1 },
            });
        }
    }
    return entities;
}

/** Merge sort that records the key order after each merge. */
function mergeSortWithSnapshots(rows: Row[]): { sorted: Row[]; snapshots: number[][] } {
    const snapshots: number[][] = [];
    const sort = (values: Row[]): Row[] => {
        if (values.length <= 1) return [...values];
        const middle = Math.floor(values.length / 2);
        const left = sort(values.slice(0, middle));
        const right = sort(values.slice(middle));
        const merged: Row[] = [];
        let i = 0;
        let j = 0;
        while (i < left.length && j < right.length) {
            const takeLeft = (left[i] as Row).key <= (right[j] as Row).key;
            if (takeLeft) {
                merged.push(left[i] as Row);
                i += 1;
            } else {
                merged.push(right[j] as Row);
                j += 1;
            }
        }
        while (i < left.length) {
            merged.push(left[i] as Row);
            i += 1;
        }
        while (j < right.length) {
            merged.push(right[j] as Row);
            j += 1;
        }
        if (snapshots.length < 40) snapshots.push(merged.map((row) => row.key));
        return merged;
    };
    return { sorted: sort(rows), snapshots };
}

/** The sort-merge join generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SortMergeInput | null) ?? {};
    const toRows = (value: unknown): Row[] => Array.isArray(value)
        ? value
            .filter((row) => row && typeof row === "object")
            .map((row) => ({ key: Math.floor(Number((row as Row).key) || 0), value: Math.floor(Number((row as Row).value) || 0) }))
        : [];
    const leftInput = toRows(task.left);
    const rightInput = toRows(task.right);
    const left = leftInput.length > 0 ? leftInput : [
        { key: 1, value: 10 }, { key: 2, value: 20 }, { key: 2, value: 21 }, { key: 4, value: 40 },
    ];
    const right = rightInput.length > 0 ? rightInput : [
        { key: 2, value: 200 }, { key: 3, value: 300 }, { key: 4, value: 400 }, { key: 4, value: 401 },
    ];

    const leftSort = mergeSortWithSnapshots(left);
    const rightSort = mergeSortWithSnapshots(right);
    const sortedLeft = leftSort.sorted;
    const sortedRight = rightSort.sorted;
    const matches: number[] = [];
    const matchLabels: string[] = [];
    let comparisons = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(left, right, 0, 0, "sort"),
        edges: [],
        description: `Sort-merge join starting with ${left.length} left and ${right.length} right rows; sorting both sides first.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { leftKeys: left.map((r) => r.key), rightKeys: right.map((r) => r.key), i: 0, j: 0, matches: [], matchLabels: [], comparisons, phase: "sort", complete: false },
    };
    step += 1;

    const totalSnapshots = Math.max(leftSort.snapshots.length, rightSort.snapshots.length);
    for (let index = 0; index < totalSnapshots; index += 1) {
        const leftView = leftSort.snapshots[index] ?? leftSort.snapshots[leftSort.snapshots.length - 1] ?? left.map((r) => r.key);
        const rightView = rightSort.snapshots[index] ?? rightSort.snapshots[rightSort.snapshots.length - 1] ?? right.map((r) => r.key);
        yield {
            stepNumber: step,
            entities: makeCells(
                leftView.map((key, at) => ({ key, value: left[at]?.value ?? 0 })),
                rightView.map((key, at) => ({ key, value: right[at]?.value ?? 0 })),
                0,
                0,
                "sort",
            ),
            edges: [],
            description: `Merge-sort pass ${index + 1}: left keys [${leftView.join(", ")}], right keys [${rightView.join(", ")}].`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { leftKeys: leftView, rightKeys: rightView, i: 0, j: 0, matches: [], matchLabels: [], comparisons, phase: "sort", complete: false },
        };
        step += 1;
    }

    let i = 0;
    let j = 0;
    while (i < sortedLeft.length && j < sortedRight.length) {
        const leftKey = (sortedLeft[i] as Row).key;
        const rightKey = (sortedRight[j] as Row).key;
        comparisons += 1;
        yield {
            stepNumber: step,
            entities: makeCells(sortedLeft, sortedRight, i, j, "merge"),
            edges: [],
            description: `Comparing left key ${leftKey} with right key ${rightKey}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { leftKeys: sortedLeft.map((r) => r.key), rightKeys: sortedRight.map((r) => r.key), i, j, matches: [...matches], matchLabels: [...matchLabels], comparisons, phase: "merge", complete: false },
        };
        step += 1;

        if (leftKey === rightKey) {
            let leftEnd = i;
            while (leftEnd < sortedLeft.length && (sortedLeft[leftEnd] as Row).key === leftKey) leftEnd += 1;
            let rightEnd = j;
            while (rightEnd < sortedRight.length && (sortedRight[rightEnd] as Row).key === rightKey) rightEnd += 1;
            for (let a = i; a < leftEnd; a += 1) {
                for (let b = j; b < rightEnd; b += 1) {
                    const lrow = sortedLeft[a] as Row;
                    const rrow = sortedRight[b] as Row;
                    matches.push(lrow.key, lrow.value, rrow.key, rrow.value);
                    matchLabels.push(`(${lrow.key},${lrow.value}) x (${rrow.key},${rrow.value})`);
                }
            }
            i = leftEnd;
            j = rightEnd;
            yield {
                stepNumber: step,
                entities: makeCells(sortedLeft, sortedRight, i, j, "merge"),
                edges: [],
                description: `Matched key ${leftKey}: emitted the cross product of the equal-key groups, now ${matchLabels.length} pair(s).`,
                codeLineNumber: 5,
                layout: "grid",
                meta: { leftKeys: sortedLeft.map((r) => r.key), rightKeys: sortedRight.map((r) => r.key), i, j, matches: [...matches], matchLabels: [...matchLabels], comparisons, phase: "merge", complete: false },
            };
            step += 1;
        } else if (leftKey < rightKey) {
            i += 1;
        } else {
            j += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(sortedLeft, sortedRight, i, j, "done"),
        edges: [],
        description: `Sort-merge join complete after ${comparisons} comparison(s): ${matchLabels.length} matching row pair(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { leftKeys: sortedLeft.map((r) => r.key), rightKeys: sortedRight.map((r) => r.key), i, j, matches, matchLabels, comparisons, phase: "done", complete: true },
    };
}

/** The sort-merge join module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If both tables are sorted by the join key, matching them is like zipping two lists. Move whichever cursor points at the smaller key forward; when both point at the same key, dump every combination of the rows that share it. Sorting costs more than the merge, but the merge itself touches each row only once.",
        invariants: [
            "Both sides are in nondecreasing key order before merging.",
            "A cursor never moves backward, so each row is examined once.",
            "When keys match, the full equal-key group is emitted on both sides.",
            "Output pairs always have equal join keys.",
        ],
        correctness:
            "Because both streams are sorted, when the left cursor's key is smaller than the right's, no later left row can match the current right row, so advancing is safe; the symmetric argument holds for the right cursor. When the keys are equal, taking the maximal contiguous group on each side captures every row with that key in both relations, and their cross product is exactly the set of matching pairs. Each pair is emitted once because cursors jump past the whole group.",
        complexityRationale:
            "Merge sort dominates at O((left plus right) log (left plus right)) time and linear auxiliary space. The merge performs at most left plus right comparisons plus the size of the output, so it is linear in the input plus output size.",
        uses: [
            "Equi-joins when inputs are already sorted or indexed",
            "External-memory joins where each side is sorted in runs",
            "Streaming joins over ordered event feeds",
        ],
        references: [
            "Blasgen and Katz, Storage and Access in Relational Data Bases, 1977",
            "Garcia-Molina, Ullman, and Widom, Database Systems: The Complete Book, Chapter 14",
        ],
        workedExample:
            "Left keys 1, 2, 2, 4 and right keys 2, 3, 4, 4. Cursors skip left key 1, match key 2 emitting two pairs from the left group against one right row, skip right key 3, and match key 4 emitting one left row against two right rows, for five pairs total.",
    },
    id: "sort-merge-join",
    name: "Sort-Merge Join",
    category: "production-systems",
    complexity: { time: "O((L + R) log(L + R))", space: "O(L + R)" },
    defaultInput: {
        left: [
            { key: 1, value: 10 },
            { key: 2, value: 20 },
            { key: 2, value: 21 },
            { key: 4, value: 40 },
        ],
        right: [
            { key: 2, value: 200 },
            { key: 3, value: 300 },
            { key: 4, value: 400 },
            { key: 4, value: 401 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the left and right relations",
        "merge sort both relations by join key",
        "set both cursors to the first row",
        "while both cursors are inside their relation",
        "if keys are equal emit the cross product of equal-key groups",
        "otherwise advance the cursor with the smaller key",
        "after the scan report the total matching pairs",
    ],
};

export default module;
