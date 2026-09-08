// treblecross.ts – Treblecross: X's on a 1-D board; first to make 3 in a row wins.
// Demo scans every empty cell for an immediate win, then plays one.
// Default X at 2,3 threatens wins at 1 and 4 (computed, not hardcoded).
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function completesThree(marks: Set<number>, at: number, size: number): boolean {
    if (marks.has(at)) return false;
    const with_ = new Set(marks);
    with_.add(at);
    for (let s = Math.max(0, at - 2); s + 2 < size && s <= at; s += 1) {
        if (with_.has(s) && with_.has(s + 1) && with_.has(s + 2)) return true;
    }
    return false;
}

function boardCells(
    size: number,
    marks: Set<number>,
    hot: Set<number> = new Set(),
    won: Set<number> = new Set(),
): VisualEntity[] {
    return Array.from({ length: size }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: marks.has(i) ? "X" : "",
        value: marks.has(i) ? 1 : 0,
        state: (won.has(i)
            ? "sorted"
            : hot.has(i)
              ? "comparing"
              : marks.has(i)
                ? "highlight"
                : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number; marks?: number[] } | null) ?? {};
    const size =
        typeof task.size === "number" && task.size > 0 ? Math.min(11, Math.floor(task.size)) : 7;
    const raw = Array.isArray(task.marks) ? task.marks : [2, 3];
    const marks = new Set<number>();
    for (const m of raw) {
        if (Number.isInteger(m) && m >= 0 && m < size) marks.add(m);
    }
    let step = 0;
    yield {
        stepNumber: step,
        entities: boardCells(size, marks),
        edges: [],
        description: `Treblecross on 1×${size} with X at [${[...marks].sort((a, b) => a - b).join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size, marks: [...marks] },
    };
    step += 1;
    const threats: number[] = [];
    for (let i = 0; i < size; i += 1) {
        if (!marks.has(i) && completesThree(marks, i, size)) threats.push(i);
    }
    yield {
        stepNumber: step,
        entities: boardCells(size, marks, new Set(threats)),
        edges: [],
        description:
            threats.length > 0
                ? `Immediate winning squares: ${threats.join(", ")} (each completes XXX).`
                : "No immediate win – no empty square completes three in a row.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { size, threats },
    };
    step += 1;
    if (threats.length === 0) {
        yield {
            stepNumber: step,
            entities: boardCells(size, marks),
            edges: [],
            description: "Position is quiet; the game continues without a forced win this move.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { size, winning: false },
        };
        return;
    }
    const play = threats[0] as number;
    const after = new Set(marks);
    after.add(play);
    yield {
        stepNumber: step,
        entities: boardCells(size, after, new Set([play])),
        edges: [],
        description: `Playing X at ${play}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { size, play },
    };
    step += 1;
    const line = new Set<number>();
    for (let s = Math.max(0, play - 2); s + 2 < size && s <= play; s += 1) {
        if (after.has(s) && after.has(s + 1) && after.has(s + 2)) {
            line.add(s);
            line.add(s + 1);
            line.add(s + 2);
        }
    }
    yield {
        stepNumber: step,
        entities: boardCells(size, after, new Set(), line),
        edges: [],
        description: `XXX complete at [${[...line].sort((a, b) => a - b).join(", ")}] – X wins.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size, play, winning: true },
    };
}

const module: AlgorithmModule = {
    id: "treblecross",
    name: "Treblecross",
    category: "game",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { size: 7, marks: [2, 3] },
    visualType: "grid",
    run,
};

export default module;
