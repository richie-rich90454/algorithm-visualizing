/**
 * count-sketch.ts – Count Sketch
 *
 * Unbiased frequency sketch: each row hashes an item to a counter and a
 * random sign, so overestimates cancel out and the median row estimate
 * is right in expectation – unlike Count-Min's one-sided error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = 3;
const WIDTH = 5;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stream?: string[]; query?: string } | null) ?? {};
    const stream = task.stream ?? ["a", "b", "a", "c", "a"];
    const query = task.query ?? "a";
    let step = 0;

    const hash = (s: string, seed: number): number => {
        let h = seed;
        for (const ch of s) {
            h = (h * 31 + ch.charCodeAt(0)) % 101;
        }
        return h;
    };
    const table: number[][] = Array.from({ length: ROWS }, () => new Array<number>(WIDTH).fill(0));
    const snap = (hot: Set<string>, message: string, line: number, est: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        table.forEach((row, r) => {
            row.forEach((c, col) => {
                entities.push({
                    id: `cs-${r}-${col}`,
                    type: "cell" as const,
                    label: String(c),
                    value: c,
                    state: (hot.has(`${r}:${col}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col },
                });
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { rows: ROWS, width: WIDTH, estimate: est },
        };
    };

    const cellsOf = (item: string): Array<[number, number, number]> => {
        const out: Array<[number, number, number]> = [];
        for (let r = 0; r < ROWS; r += 1) {
            const col = hash(item, r + 1) % WIDTH;
            const sign = hash(item, 100 + r) % 2 === 0 ? 1 : -1;
            out.push([r, col, sign]);
        }
        return out;
    };

    yield snap(
        new Set(),
        `Empty ${ROWS}x${WIDTH} count sketch over ${stream.length} updates.`,
        0,
        0,
    );
    step += 1;
    for (const item of stream) {
        const cells = cellsOf(item);
        for (const [r, col, sign] of cells) {
            const row = table[r];
            if (row !== undefined) {
                row[col] = (row[col] ?? 0) + sign;
            }
        }
        yield snap(
            new Set(cells.map(([r, c]) => `${r}:${c}`)),
            `Update "${item}" – signed counters shift.`,
            1,
            0,
        );
        step += 1;
    }
    const perRow = cellsOf(query).map(([r, col, sign]) => (table[r]?.[col] ?? 0) * sign);
    const sorted = [...perRow].sort((a, b) => a - b);
    const estimate = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const truth = stream.filter((s) => s === query).length;
    yield snap(
        new Set(cellsOf(query).map(([r, c]) => `${r}:${c}`)),
        `Query "${query}": row reads [${perRow.join(",")}], median ${estimate} (true ${truth}).`,
        2,
        estimate,
    );
}

const module: AlgorithmModule = {
    id: "count-sketch",
    name: "Count Sketch",
    category: "data-structures",
    complexity: { time: "O(rows)", space: "O(rows x width)" },
    defaultInput: { stream: ["a", "b", "a", "c", "a"], query: "a" },
    visualType: "grid",
    run,
};

export default module;
