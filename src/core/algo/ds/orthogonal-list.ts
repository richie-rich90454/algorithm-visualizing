/**
 * orthogonal-list.ts – Orthogonal List
 *
 * A sparse matrix threaded twice: every non-zero belongs to a row ring
 * and a column ring, so rows and columns both traverse in order.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sparse matrix threaded twice: every non-zero belongs to a row ring and a column ring, so rows and columns both traverse in order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(nonzeros)
 *   Space: O(nonzeros)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Cells form rows or columns of values.
 *    - The touched cell is YELLOW (comparing).
 *    - Finished cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Orthogonal List behavior with textbook operation costs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { entries?: Array<[number, number, number]> } | null) ?? {};
    const entries = task.entries ?? [
        [0, 1, 5],
        [1, 0, 3],
        [2, 2, 7],
    ];
    let step = 0;

    const snap = (
        hot: Set<string>,
        message: string,
        line: number,
        rowH: number,
        colH: number,
    ): VisualFrame => {
        const entities: VisualEntity[] = entries.map(([r, c, v], i) => ({
            id: `ol-${i}`,
            type: "cell" as const,
            label: `(${r},${c})=${v}`,
            value: v,
            state: (hot.has(`e${i}`) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: r, col: c },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { nonzeros: entries.length, rowWalk: rowH, colWalk: colH },
        };
    };

    yield snap(
        new Set(),
        `Empty orthogonal list – threading ${entries.length} non-zeros.`,
        0,
        0,
        0,
    );
    step += 1;
    entries.forEach((_, i) => {
        void 0;
    });
    for (let i = 0; i < entries.length; i += 1) {
        const [r, c, v] = entries[i] ?? [0, 0, 0];
        void v;
        yield snap(
            new Set([`e${i}`]),
            `Linked (${r},${c}) into row ring ${r} and column ring ${c}.`,
            1,
            0,
            0,
        );
        step += 1;
    }
    const rowOrder = [...entries]
        .map((e, i) => ({ e, i }))
        .sort((a, b) => a.e[0] - b.e[0] || a.e[1] - b.e[1])
        .map((x) => x.i);
    const rowVals = rowOrder.map((i) => entries[i]?.[2] ?? 0);
    yield snap(
        new Set(rowOrder.map((i) => `e${i}`)),
        `Row-major walk visits values [${rowVals.join(",")}].`,
        2,
        rowOrder.length,
        0,
    );
    step += 1;
    const colOrder = [...entries]
        .map((e, i) => ({ e, i }))
        .sort((a, b) => a.e[1] - b.e[1] || a.e[0] - b.e[0])
        .map((x) => x.i);
    const colVals = colOrder.map((i) => entries[i]?.[2] ?? 0);
    yield snap(
        new Set(colOrder.map((i) => `e${i}`)),
        `Column-major walk visits values [${colVals.join(",")}].`,
        3,
        rowOrder.length,
        colOrder.length,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An orthogonal list stores each nonzero of a sparse matrix as a node threaded into two circular lists, one for its row and one for its column. Row-major and column-major walks both follow pointers in index order without ever scanning zero entries.",
        "invariants": [
            "Every nonzero belongs to exactly one row ring and one column ring.",
            "Entries inside a ring are ordered by their index.",
            "Row and column header rings anchor the two traversals."
        ],
        "correctness": "Splicing a node into both rings in sorted order keeps each ring ordered, so walking a row ring yields its nonzeros in column order and a column ring in row order. Every nonzero is reachable from both its row header and its column header, so neither traversal can miss an entry.",
        "complexityRationale": "Insertion is constant time once the header and splice position are known, and traversals visit one node per nonzero, so both are O(nonzeros). Storage is one node with two links per nonzero, O(nonzeros).",
        "uses": [
            "Sparse adjacency representation of graphs",
            "Finite-element stiffness matrices",
            "Sparse algebra where both row and column scans are needed"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 1, Section 2.2.6 on doubly linked lists",
            "Sahni, Data Structures, Algorithms, and Applications in C++, sparse matrix chapter"
        ],
        "workedExample": "Entries (0,1,5) and (1,0,3) are threaded into row ring 0 and row ring 1 plus their column rings. A row-major walk visits 5 then 3, while a column-major walk visits 3 then 5, touching only nonzeros."
    },
    id: "orthogonal-list",
    name: "Orthogonal List",
    category: "data-structures",
    complexity: { time: "O(nonzeros)", space: "O(nonzeros)" },
    defaultInput: {
        entries: [
            [0, 1, 5],
            [1, 0, 3],
            [2, 2, 7],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty row and column header rings",
        "insert entry (r, c, v): locate row ring r and column ring c",
        "splice the new node into both rings in sorted order",
        "repeat until every nonzero is threaded twice",
        "row-major walk follows each row ring in order",
        "column-major walk follows each column ring in order",
        "done: matrix is threaded and both walks visit every nonzero",
    ],
};

export default module;
