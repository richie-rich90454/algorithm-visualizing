/**
 * determinant-leibniz.ts - Leibniz Formula for the Determinant.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Leibniz formula defines the determinant as a signed sum over all
 * permutations of the column indices: each term is the sign of the
 * permutation times the product of the entries chosen one per row. This
 * direct definition is factorial time, so it is used for teaching and for
 * tiny matrices rather than computation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n!) permutations, each costing O(n) work
 *   Space: O(n) for the current permutation and recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the matrix and the current permutation with its term.
 *   - Entries used by the current permutation are highlighted.
 *   - The final frame reports the determinant and the number of terms examined.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DeterminantInput {
    matrix?: number[][];
    frameLimit?: number;
}

function makeEntities(
    matrix: number[][],
    permutation: number[],
    term: number,
    running: number,
    count: number,
    done: boolean,
): VisualEntity[] {
    const size = matrix.length;
    const entities: VisualEntity[] = [];
    for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
            const used = permutation.length > 0 && permutation[r] === c;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(matrix[r]?.[c] ?? 0),
                value: matrix[r]?.[c] ?? 0,
                state: (done ? "sorted" : used ? "active" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    const info = [
        { field: "permutation", value: `[${permutation.join(",")}]` },
        { field: "term", value: term },
        { field: "running det", value: running },
        { field: "terms seen", value: count },
    ];
    info.forEach((entry, i) => {
        entities.push({
            id: `info-${i}`,
            type: "cell" as const,
            label: `${entry.field}: ${entry.value}`,
            value: entry.value,
            state: (done ? "sorted" : "comparing") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: size, col: i },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeterminantInput | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : null;
    const matrix = raw && raw.length > 0 && raw.every((row) => Array.isArray(row) && row.length === raw.length)
        ? raw.map((row) => row.slice())
        : [
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 10],
          ];
    const size = matrix.length;
    const frameLimit = typeof task.frameLimit === "number" && task.frameLimit > 0 ? Math.trunc(task.frameLimit) : 40;
    const permutation = Array.from({ length: size }, (_, i) => i);
    const used = new Array<boolean>(size).fill(false);
    let running = 0;
    let count = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(matrix, [], 0, 0, 0, false),
        edges: [],
        description: `Evaluate the Leibniz determinant of a ${size}x${size} matrix over all ${size}! permutations.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: size + 1, cols: Math.max(size, 4), size },
    };
    step += 1;

    const walk = function* (position: number): Generator<{ permutation: number[]; sign: number; term: number }> {
        if (position === size) {
            let inversions = 0;
            for (let i = 0; i < size; i += 1) {
                for (let j = i + 1; j < size; j += 1) {
                    if ((permutation[i] ?? 0) > (permutation[j] ?? 0)) {
                        inversions += 1;
                    }
                }
            }
            const sign = inversions % 2 === 0 ? 1 : -1;
            let product = 1;
            for (let i = 0; i < size; i += 1) {
                product *= matrix[i]?.[permutation[i] ?? 0] ?? 0;
            }
            yield { permutation: permutation.slice(), sign, term: sign * product };
            return;
        }
        for (let column = 0; column < size; column += 1) {
            if (used[column]) {
                continue;
            }
            used[column] = true;
            permutation[position] = column;
            yield* walk(position + 1);
            used[column] = false;
        }
    };

    for (const entry of walk(0)) {
        running += entry.term;
        count += 1;
        if (count <= frameLimit) {
            yield {
                stepNumber: step,
                entities: makeEntities(matrix, entry.permutation, entry.term, running, count, false),
                edges: [],
                description: `Permutation [${entry.permutation.join(",")}] has sign ${entry.sign > 0 ? "+" : "-"} and term ${entry.term}; partial sum ${running}.`,
                codeLineNumber: entry.term > 0 ? 2 : 3,
                layout: "grid",
                meta: { rows: size + 1, cols: Math.max(size, 4), size, permutation: entry.permutation, sign: entry.sign, term: entry.term, running, count },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(matrix, [], 0, running, count, true),
        edges: [],
        description: `Done: after ${count} terms the determinant is ${running}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: size + 1, cols: Math.max(size, 4), size, determinant: running, terms: count },
    };
}

const module: AlgorithmModule = {
    id: "determinant-leibniz",
    name: "Determinant by Leibniz Formula",
    category: "math",
    complexity: { time: "O(n!)", space: "O(n)" },
    defaultInput: {
        matrix: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 10],
        ],
        frameLimit: 40,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start the determinant sum at zero",
        "for every permutation p of the column indices 0..n-1",
        "compute the sign from the parity of inversions of p",
        "add sign times the product over rows of matrix[row][p[row]]",
        "continue until all n factorial permutations are used",
        "return the accumulated sum as the determinant",
    ],
    education: {
        intuition:
            "The determinant can be read straight from its definition. Pick one entry from each row and column according to a permutation, multiply those entries, and attach a plus or minus sign depending on whether the permutation is even or odd. Adding all such signed products gives the determinant.",
        invariants: [
            "Each permutation selects exactly one entry in every row and every column.",
            "The sign is plus for an even number of inversions and minus for an odd number.",
            "After k permutations the running sum is the Leibniz partial sum over those k terms.",
        ],
        correctness:
            "The Leibniz formula is the definition of the determinant and equals the alternating multilinear form that also drives Gaussian elimination. Enumerating every permutation once and multiplying the selected entries implements each term exactly; counting inversions computes the permutation's parity, so every term carries its correct sign and the total is the determinant.",
        complexityRationale:
            "There are n factorial permutations and each term needs O(n) work to find its sign and product, giving O(n!) time. Recursion stores one permutation and one used array of length n, so space is O(n).",
        uses: [
            "Defining the determinant in linear algebra courses",
            "Checking small determinants where clarity beats speed",
            "Deriving properties such as multilinearity and antisymmetry",
        ],
        references: [
            "Gelfand, Lectures on Linear Algebra, determinant axioms",
            "Wikipedia, Leibniz formula for determinants",
        ],
        workedExample:
            "For [[1,2],[3,4]] the identity permutation gives +1*4 = 4 and the swap gives -(2*3) = -6, so the determinant is 4 - 6 = -2.",
    },
};

export default module;
