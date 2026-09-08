// sprouts.ts – Sprouts from 2 spots: join two spots (or loop one) and add
// a new spot on the curve; each spot has 3 lives, a move spends 2 (one per
// endpoint), the newcomer starts with 1. Opening loop on S1 is legal play.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function sproutCells(spots: Array<{ name: string; lives: number }>, hot = ""): VisualEntity[] {
    return spots.map((s, i) => ({
        id: `cell-${s.name}`,
        type: "cell" as const,
        label: `${s.name}(${s.lives})`,
        value: s.lives,
        state: (s.name === hot ? "comparing" : s.lives > 0 ? "sorted" : "swapped") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, lives: s.lives },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { spots?: number } | null) ?? {};
    const start =
        typeof task.spots === "number" && task.spots >= 1 ? Math.min(3, Math.floor(task.spots)) : 2;
    const spots = Array.from({ length: start }, (_, i) => ({ name: `S${i + 1}`, lives: 3 }));
    let step = 0;
    yield {
        stepNumber: step,
        entities: sproutCells(spots),
        edges: [],
        description: `Sprouts with ${start} spot${start === 1 ? "" : "s"} – every spot has 3 lives.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { spots: start },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: sproutCells(spots, "S1"),
        edges: [],
        description: "First draws a loop from S1 back to S1 (uses 2 of its 3 lives).",
        codeLineNumber: 1,
        layout: "grid",
        meta: { spots: start, move: "loop S1" },
    };
    step += 1;
    const first = spots[0];
    if (first) first.lives -= 2;
    const newcomer = { name: `S${spots.length + 1}`, lives: 1 };
    spots.push(newcomer);
    yield {
        stepNumber: step,
        entities: sproutCells(spots, newcomer.name),
        edges: [],
        description: `New spot ${newcomer.name} appears on the loop with 3−2 = 1 life; S1 drops to ${first?.lives}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { spots: spots.length, lives: spots.map((s) => s.lives) },
    };
    step += 1;
    const total = spots.reduce((a, s) => a + s.lives, 0);
    yield {
        stepNumber: step,
        entities: sproutCells(spots),
        edges: [],
        description: `${total} lives remain across ${spots.length} spots – at most ${Math.floor(total / 2)} further moves can exist.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { lives: total },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: sproutCells(spots),
        edges: [],
        description:
            "Legal Sprouts opening complete; play continues until no live spot pair remains.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { spots: spots.length },
    };
}

const module: AlgorithmModule = {
    id: "sprouts",
    name: "Sprouts",
    category: "game",
    complexity: { time: "O(moves)", space: "O(spots)" },
    defaultInput: { spots: 2 },
    visualType: "grid",
    run,
};

export default module;
