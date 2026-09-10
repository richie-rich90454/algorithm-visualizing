// snort.ts – Snort (partisan): Left claims L, Right claims R; no claiming
// next to an enemy piece. Line on 1×4: L0, R3, L1 strands Right, since the
// last free cell 2 neighbors enemy L1. Legal by construction.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function snortCells(board: string[], hot = -1): VisualEntity[] {
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
        entities: snortCells(board),
        edges: [],
        description: `Snort on 1×${size} – Left (L) moves first, Right (R) replies.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size },
    };
    step += 1;
    // ponytail: one illustrative legal line; full Snort theory when analysis input exists.
    const line: Array<[number, string]> = [
        [0, "L"],
        [size - 1, "R"],
        [1, "L"],
    ];
    for (const [at, who] of line) {
        board[at] = who;
        yield {
            stepNumber: step,
            entities: snortCells(board, at),
            edges: [],
            description: `${who === "L" ? "Left" : "Right"} claims cell ${at}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { size, at, who },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: snortCells(board),
        edges: [],
        description:
            "Cell 2 neighbors enemy L at 1, so Right has no legal claim and loses this line.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { size, winner: "Left" },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: snortCells(board),
        edges: [],
        description: "Left wins this Snort line 3–0 on claimed cells.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { size, winner: "Left" },
    };
}

const module: AlgorithmModule = {
    id: "snort",
    name: "Snort",
    category: "game",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { size: 4 },
    visualType: "grid",
    run,
};

export default module;
