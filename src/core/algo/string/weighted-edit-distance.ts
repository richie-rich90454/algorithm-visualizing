/**
 * weighted-edit-distance.ts - Weighted Edit Distance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Unlike plain Levenshtein distance, every operation has its own price: a
 * deletion, an insertion, and a substitution that may depend on the exact pair
 * of characters. The DP cell (i, j) is the cheapest way to turn the first i
 * characters of the source into the first j characters of the target.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m)
 *   Space: O(n * m) for the replayable matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell shows the accumulated cost for its two prefixes.
 *   - The cell being computed is YELLOW; finished cells are GREEN.
 *   - The final frame marks the bottom-right answer.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    dp: number[][],
    rows: number,
    cols: number,
    active: [number, number] | null,
    final: boolean,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const value = dp[i]?.[j] ?? 0;
            let state: EntityState = "unvisited";
            if (final) {
                state = i === rows - 1 && j === cols - 1 ? "sorted" : "visited";
            } else if (active && active[0] === i && active[1] === j) {
                state = "comparing";
            } else if (i > 0 || j > 0) {
                state = "visited";
            }
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: String(value),
                value,
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
    const task = (input as {
        source?: string;
        target?: string;
        insertCost?: number;
        deleteCost?: number;
        replace?: Record<string, number>;
    } | null) ?? {};
    const source = typeof task.source === "string" ? task.source : "cat";
    const target = typeof task.target === "string" ? task.target : "cut";
    const insertCost = Math.max(0, Number(task.insertCost) || 0);
    const deleteCost = Math.max(0, Number(task.deleteCost) || 0);
    const defaultReplace = task.replace && typeof task.replace["*"] === "number" ? task.replace["*"] : 1;
    const replace = (a: string, b: string): number => {
        if (a === b) return 0;
        const pair = task.replace?.[`${a}:${b}`];
        return typeof pair === "number" ? pair : defaultReplace;
    };
    const rows = source.length + 1;
    const cols = target.length + 1;
    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    let step = 0;

    const frame = (
        active: [number, number] | null,
        final: boolean,
        description: string,
        line: number,
        answer: number | null,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(dp, rows, cols, active, final),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows, cols, answer, source, target, cost: dp.map((r) => [...r]) },
    });

    yield frame(null, false, `Aligning "${source}" to "${target}" with weighted edits.`, 0, null);

    for (let i = 1; i < rows; i += 1) dp[i]![0] = (dp[i - 1]![0] ?? 0) + deleteCost;
    for (let j = 1; j < cols; j += 1) dp[0]![j] = (dp[0]![j - 1] ?? 0) + insertCost;
    yield frame(null, false, "The first row and column are prefix insertion and deletion costs.", 2, null);

    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const del = (dp[i - 1]![j] ?? 0) + deleteCost;
            const ins = (dp[i]![j - 1] ?? 0) + insertCost;
            const sub = (dp[i - 1]![j - 1] ?? 0) + replace(source[i - 1]!, target[j - 1]!);
            dp[i]![j] = Math.min(del, ins, sub);
        }
        yield frame(
            [i, cols - 1],
            false,
            `Row ${i}: combine delete, insert, and substitution of ${source[i - 1]}.`,
            4,
            null,
        );
    }

    const answer = dp[rows - 1]![cols - 1] ?? 0;
    const finalFrame = frame(null, true, `Minimum weighted edit cost is ${answer}.`, 7, answer);
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Build a grid of prefix pairs and fill each cell from the three neighboring cells that represent deleting a source character, inserting a target character, or substituting one for the other. Because each operation has its own price, the cheapest predecessor may be any of the three rather than always the diagonal.",
        invariants: [
            "dp[i][j] is the least cost to convert the first i source characters to the first j target characters.",
            "Deleting advances only the source index; inserting advances only the target index.",
            "Substitution advances both indices and uses the pair's configured price.",
        ],
        correctness:
            "The last operation in any optimal alignment must be a deletion, an insertion, or a substitution, and removing it leaves an optimal subproblem for smaller prefixes. Considering all three predecessors and picking the cheapest therefore gives the optimum by induction. Empty prefixes are handled by Cumulative delete and insert costs.",
        complexityRationale:
            "The nested loops fill (n+1)(m+1) cells with constant work each, so the time is O(n*m). The matrix needed for replay uses O(n*m) space.",
        uses: [
            "Spell checking with keyboard-aware substitution costs",
            "Biological sequence alignment with custom gap penalties",
            "Record linkage where field errors have different prices",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 11",
            "Levenshtein, Binary Codes Capable of Correcting Deletions, 1966",
        ],
        workedExample:
            "Turning cat into cut with unit substitution and deletion and insertion cost two, substituting a for u costs one and the other letters match for zero, so the total cost is one.",
    },
    id: "weighted-edit-distance",
    name: "Weighted Edit Distance",
    category: "string",
    complexity: { time: "O(n * m)", space: "O(n * m)" },
    defaultInput: { source: "cat", target: "cut", insertCost: 2, deleteCost: 2, replace: { "*": 1 } },
    visualType: "grid",
    run,
    pseudocode: [
        "read the source and target strings and the three operation costs",
        "create a matrix of size source length plus one by target length plus one",
        "fill the first column with cumulative deletion costs",
        "fill the first row with cumulative insertion costs",
        "for each cell i j with both indices positive",
        "set delete to dp[i-1][j] plus deleteCost",
        "set insert to dp[i][j-1] plus insertCost",
        "set substitute to dp[i-1][j-1] plus the substitution price",
        "store the minimum of the three as dp[i][j]",
        "report the bottom-right cell as the minimum cost",
    ],
};

export default module;
