/**
 * orthogonal-list.ts – Orthogonal List
 *
 * A sparse matrix threaded twice: every non-zero belongs to a row ring
 * and a column ring, so rows and columns both traverse in order.
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
};

export default module;
