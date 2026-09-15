// kayles.ts – Kayles: knock down 1 pin or 2 adjacent pins; last move wins.
// Simply, split the row into dead segments; formally Grundy numbers are
// memoized in-code and a move wins exactly when it leaves xor 0.
// Default row of 8 has G=1, winning move removes pins 3 and 4.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function grundy(n: number, memo: Map<number, number>): number {
    const hit = memo.get(n);
    if (hit !== undefined) return hit;
    const seen = new Set<number>();
    for (let i = 0; i < n; i += 1) {
        seen.add(grundy(i, memo) ^ grundy(n - 1 - i, memo));
        if (i + 1 < n) seen.add(grundy(i, memo) ^ grundy(n - 2 - i, memo));
    }
    let g = 0;
    while (seen.has(g)) g += 1;
    memo.set(n, g);
    return g;
}

function rowCells(present: boolean[], down: Set<number> = new Set()): VisualEntity[] {
    return present.map((up, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: up ? "●" : "",
        value: up ? 1 : 0,
        state: (!up ? "unvisited" : down.has(i) ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pins?: number } | null) ?? {};
    const n =
        typeof task.pins === "number" && task.pins >= 0 ? Math.min(12, Math.floor(task.pins)) : 8;
    const memo = new Map<number, number>();
    const g = grundy(n, memo);
    let step = 0;
    const present = new Array<boolean>(n).fill(true);
    yield {
        stepNumber: step,
        entities: rowCells(present),
        edges: [],
        description: `Kayles row of ${n} pins – Grundy G(${n}) = ${g}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { pins: n, grundy: g },
    };
    step += 1;
    const singles: number[] = [];
    for (let i = 0; i < n; i += 1) singles.push(grundy(i, memo) ^ grundy(n - 1 - i, memo));
    const singleWin = singles.findIndex((v) => v === 0);
    yield {
        stepNumber: step,
        entities: rowCells(present),
        edges: [],
        description:
            singleWin >= 0
                ? `Single-pin knockdown at pin ${singleWin} splits row ${n} into xor 0 segments.`
                : `Every single-pin knockdown on row ${n} leaves xor in {${[...new Set(singles)].join(", ")}} – no instant win there.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { pins: n, grundy: g, singles, singleWin },
    };
    step += 1;
    // ponytail: single-row demo; full split-position search when multi-row input exists.
    let move: number[] = singleWin >= 0 ? [singleWin] : [];
    if (move.length === 0) {
        for (let i = 0; i + 1 < n; i += 1) {
            if ((grundy(i, memo) ^ grundy(n - 2 - i, memo)) === 0) {
                move = [i, i + 1];
                break;
            }
        }
    }
    if (move.length === 0) {
        yield {
            stepNumber: step,
            entities: rowCells(present),
            edges: [],
            description:
                "No winning knockdown – a P-position, so the player to move loses with perfect play.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { pins: n, grundy: g, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: rowCells(present),
            edges: [],
            description: `Kayles(${n}) with Grundy G = ${g} is losing for the player to move.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { pins: n, grundy: g, winning: false },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: rowCells(present, new Set(move)),
        edges: [],
        description: `Winning move on Kayles(${n}): knock down pin${move.length > 1 ? "s" : ""} ${move.join(" and ")} (remaining segments xor to 0).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { pins: n, grundy: g, move, winning: true },
    };
    step += 1;
    const after = present.map((up, i) => up && !move.includes(i));
    yield {
        stepNumber: step,
        entities: rowCells(after),
        edges: [],
        description: `After knocking down ${move.join(" and ")} the remaining segments of Kayles(${n}) form a P-position.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { pins: n, grundy: 0, move, winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: rowCells(after),
        edges: [],
        description: `First player wins Kayles(${n}) via the highlighted knockdown of ${move.join(" and ")}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { pins: n, grundy: g, move, winning: true },
    };
}

const module: AlgorithmModule = {
    id: "kayles",
    name: "Kayles",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { pins: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "start from a row of n standing pins with Grundy G(n)",
        "test each single-pin knockdown for split xor equal to 0",
        "test each adjacent-pair knockdown for split xor equal to 0",
        "if a zero-xor knockdown exists: highlight it as winning move",
        "remove the pins and show segments forming a P-position",
        "winner is first player except G(n) = 0 where second wins",
    ],
};

export default module;
