// cram.ts – Cram: players alternate placing dominoes; last move wins.
// One greedy line on 3×3: four dominoes fill 8 cells, the single leftover
// cell strands the second player. The line is legal by construction.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Domino = [string, string];

function cramCells(used: Map<string, number>, last: Domino | null): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
            const id = `${r},${c}`;
            const owner = used.get(id);
            cells.push({
                id: `cell-${id}`,
                type: "cell" as const,
                label: owner === undefined ? "" : `D${owner}`,
                value: owner ?? 0,
                state: (owner === undefined
                    ? "idle"
                    : last && (last[0] === id || last[1] === id)
                      ? "comparing"
                      : "sorted") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number } | null) ?? {};
    void task;
    const line: Domino[] = [
        ["0,0", "0,1"],
        ["1,0", "1,1"],
        ["2,0", "2,1"],
        ["0,2", "1,2"],
    ];
    const used = new Map<string, number>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: cramCells(used, null),
        edges: [],
        description: "Cram on 3×3 – empty board, first player to move.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: 3 },
    };
    step += 1;
    let mover = "First";
    line.forEach(([a, b], i) => {
        used.set(a, i + 1);
        used.set(b, i + 1);
    });
    for (let i = 0; i < line.length; i += 1) {
        const dom = line[i] as Domino;
        const partial = new Map<string, number>();
        line.slice(0, i + 1).forEach(([a, b], j) => {
            partial.set(a, j + 1);
            partial.set(b, j + 1);
        });
        yield {
            stepNumber: step,
            entities: cramCells(partial, dom),
            edges: [],
            description: `${mover} places domino D${i + 1} on ${dom[0]}–${dom[1]}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { size: 3, domino: i + 1, cells: dom },
        };
        step += 1;
        mover = mover === "First" ? "Second" : "First";
    }
    yield {
        stepNumber: step,
        entities: cramCells(used, null),
        edges: [],
        description:
            "Only cell (2,2) is free – no domino fits, so the player to move (Second) loses this line.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { size: 3, winner: "First" },
    };
}

const module: AlgorithmModule = {
    id: "cram",
    name: "Cram",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { size: 3 },
    visualType: "grid",
    run,
};

export default module;
