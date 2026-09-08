/**
 * beap.ts – Beap (Bi-parental Heap)
 *
 * A heap on a 2D grid: each cell's parents sit above and to the left,
 * so search walks a Young-tableau-like staircase while inserts and
 * extracts bubble along grid paths.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = task.keys ?? [1, 4, 2, 7, 5, 3];
    const query = task.query ?? 5;
    let step = 0;

    const grid: number[][] = [[], [], []];
    const flat = [...keys].sort((a, b) => a - b);
    let idx = 0;
    for (let r = 0; r < 3 && idx < flat.length; r += 1) {
        for (let c = 0; c <= r && idx < flat.length; c += 1) {
            grid[r]?.push(flat[idx] ?? 0);
            idx += 1;
        }
    }
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: grid.flatMap((row, r) =>
            row.map((k, c) => ({
                id: `be-${r}-${c}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (hot.has(`${r},${c}`) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            })),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { stored: flat.length, query },
    });

    yield snap(new Set(), `Beap triangle rows grow 1-2-3 from [${keys.join(",")}].`, 0);
    step += 1;
    let r = 0;
    let c = (grid[0] ?? []).length - 1;
    const visited: string[] = [];
    let found = false;
    while (r < grid.length && c >= 0) {
        const v = grid[r]?.[c];
        visited.push(`${r},${c}`);
        yield snap(new Set(visited), `Staircase at (${r},${c}) = ${v} vs ${query}.`, 1);
        step += 1;
        if (v === query) {
            found = true;
            break;
        }
        if ((v ?? Infinity) < query) {
            r += 1;
        } else {
            c -= 1;
        }
    }
    yield snap(
        new Set(visited),
        found ? `${query} found on the staircase.` : `${query} stepped off – absent.`,
        2,
    );
}

const module: AlgorithmModule = {
    id: "beap",
    name: "Beap",
    category: "data-structures",
    complexity: { time: "O(sqrt n) search", space: "O(n)" },
    defaultInput: { keys: [1, 4, 2, 7, 5, 3], query: 5 },
    visualType: "grid",
    run,
};

export default module;
