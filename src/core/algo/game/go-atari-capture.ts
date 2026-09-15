/**
 * go-atari-capture.ts – Go Atari Capture (single-liberty tactic)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In Go, a connected group with one empty neighbor (liberty) is in atari
 * and is captured by filling that liberty. Simply: shrink the group to one
 * liberty, then fill it. Formally: liberties are the empty orthogonal
 * neighbors of the group flood fill, and the default 3x3 shows black center
 * with white on three sides holding a single liberty at (2,1) that White
 * fills to remove the stone.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) flood fill over the board
 *   Space: O(n^2) board state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Black stones paint GREEN (sorted); White stones highlight.
 *   - The group in atari and the target liberty flash YELLOW (comparing).
 *   - The capture frame shows the removed stone and White territory.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Zero liberties means immediate capture and removal.
 *   - Filling the last liberty is the winning tactical move.
 */
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
        description: `Black group at (1,1) has ${libs} libert${libs === 1 ? "y" : "ies"} on the 3x3 board – in atari and losing with perfect defense.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { liberties: libs, group: [1, 1], winning: true, winner: "White" },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: goCells(board, "2,1"),
        edges: [],
        description: "White's only productive reply is filling the last empty liberty at (2,1).",
        codeLineNumber: 2,
        layout: "grid",
        meta: { liberties: libs, play: [2, 1], mover: "White" },
    };
    step += 1;
    board[2] = [".", "W", "."];
    const libsAfter = liberties(board, 1, 1);
    yield {
        stepNumber: step,
        entities: goCells(board, "1,1"),
        edges: [],
        description: `After White plays (2,1) the black group at (1,1) has ${libsAfter} liberties – it is captured and removed.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { liberties: libsAfter, captured: 0, mover: "White" },
    };
    step += 1;
    board[1] = ["W", ".", "W"];
    yield {
        stepNumber: step,
        entities: goCells(board),
        edges: [],
        description: "Black stone removed from (1,1); White now holds the center territory.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { captured: 1, winner: "White", winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: goCells(board),
        edges: [],
        description:
            "Atari capture complete: White reduced Black to one liberty, then filled it to win the fight.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { captured: 1, winner: "White", winning: true },
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
    pseudocode: [
        "start from the 3 x 3 board with Black center under White surround",
        "count liberties of the Black group by flood fill of neighbors",
        "if liberties = 1: the group is in atari and can be captured",
        "White fills the last liberty at (2,1) to reach zero liberties",
        "remove the captured Black stone and show White territory",
        "winner is White, who filled the final liberty of the fight",
    ],
};

export default module;
