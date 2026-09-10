// go-atari-capture.ts – Go atari: a group with one liberty is captured by
// filling it. Default 3×3: black center with white on three sides has a
// single liberty at (2,1); White fills it and removes the stone.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function goCells(board: string[][], hot: string | null = null): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
            const v = board[r]?.[c] ?? ".";
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: v === "." ? "" : v,
                value: v === "." ? 0 : 1,
                state: (`${r},${c}` === hot
                    ? "comparing"
                    : v === "B"
                      ? "sorted"
                      : v === "W"
                        ? "highlight"
                        : "idle") as EntityState,
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

function liberties(board: string[][], r: number, c: number): number {
    const color = board[r]?.[c];
    if (color !== "B" && color !== "W") return 0;
    const seen = new Set<string>();
    const libs = new Set<string>();
    const stack: Array<[number, number]> = [[r, c]];
    while (stack.length > 0) {
        const [cr, cc] = stack.pop() as [number, number];
        const k = `${cr},${cc}`;
        if (seen.has(k)) continue;
        seen.add(k);
        for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
            const v = board[nr]?.[nc] ?? ".";
            if (v === ".") libs.add(`${nr},${nc}`);
            else if (v === color) stack.push([nr, nc]);
        }
    }
    return libs.size;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number } | null) ?? {};
    void task;
    const board = [
        [".", "W", "."],
        ["W", "B", "W"],
        [".", ".", "."],
    ];
    let step = 0;
    const libs = liberties(board, 1, 1);
    yield {
        stepNumber: step,
        entities: goCells(board, "1,1"),
        edges: [],
        description: `Black at (1,1) has ${libs} libert${libs === 1 ? "y" : "ies"} – in atari.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { liberties: libs },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: goCells(board, "2,1"),
        edges: [],
        description: "White's only productive move is filling the last liberty at (2,1).",
        codeLineNumber: 1,
        layout: "grid",
        meta: { liberties: libs, play: [2, 1] },
    };
    step += 1;
    board[2] = [".", "W", "."];
    const libsAfter = liberties(board, 1, 1);
    yield {
        stepNumber: step,
        entities: goCells(board, "1,1"),
        edges: [],
        description: `After W(2,1) the black group has ${libsAfter} liberties – it is captured and removed.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { liberties: libsAfter },
    };
    step += 1;
    board[1] = ["W", ".", "W"];
    yield {
        stepNumber: step,
        entities: goCells(board),
        edges: [],
        description: "Black removed; White holds the center territory.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { captured: 1 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: goCells(board),
        edges: [],
        description: "Atari capture complete: reduce to one liberty, then fill it.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { captured: 1 },
    };
}

const module: AlgorithmModule = {
    id: "go-atari-capture",
    name: "Go Atari Capture",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { size: 3 },
    visualType: "grid",
    run,
};

export default module;
