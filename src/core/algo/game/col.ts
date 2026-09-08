// col.ts – Col (partisan): paint a cell your colour; neighbours must differ.
// Enemy adjacency is fine, so on 1×4 the line L0, R1, L2, R3 fills the
// board and the second player makes the last move. Legal by construction.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function colCells(board: string[], hot = -1): VisualEntity[] {
    return board.map((v, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: v === "" ? "" : v,
        value: v === "" ? 0 : 1,
        state: (v === ""
            ? "idle"
            : i === hot
              ? "comparing"
              : v === "L"
                ? "sorted"
                : "highlight") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number } | null) ?? {};
    const size =
        typeof task.size === "number" && task.size >= 2 ? Math.min(6, Math.floor(task.size)) : 4;
    const board = new Array<string>(size).fill("");
    let step = 0;
    yield {
        stepNumber: step,
        entities: colCells(board),
        edges: [],
        description: `Col on 1×${size} – Left (L) moves first; same colours may never touch.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size },
    };
    step += 1;
    // ponytail: one illustrative legal line; full Col theory when analysis input exists.
    const line = (
        [
            [0, "L"],
            [1, "R"],
            [2, "L"],
            [3, "R"],
        ] as Array<[number, string]>
    ).slice(0, size);
    for (const [at, who] of line) {
        board[at] = who;
        yield {
            stepNumber: step,
            entities: colCells(board, at),
            edges: [],
            description: `${who === "L" ? "Left" : "Right"} paints cell ${at} ${who} (neighbour ${at > 0 ? board[at - 1] || "empty" : "none"} differs).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { size, at, who },
        };
        step += 1;
    }
    const winner = line.length % 2 === 0 ? "Right" : "Left";
    yield {
        stepNumber: step,
        entities: colCells(board),
        edges: [],
        description: `Board full after ${line.length} moves – ${winner} made the last move and wins this line.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { size, winner },
    };
}

const module: AlgorithmModule = {
    id: "col",
    name: "Col",
    category: "game",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { size: 4 },
    visualType: "grid",
    run,
};

export default module;
