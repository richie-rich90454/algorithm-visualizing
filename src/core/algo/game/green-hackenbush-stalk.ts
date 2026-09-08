// green-hackenbush-stalk.ts – Green Hackenbush stalk: a single bamboo column.
// A cut removes that edge and everything above, so the stalk is a Nim heap:
// any n > 0 is N, and cutting at the base (taking all) always wins.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function stalkCells(edges: number, cut = -1): VisualEntity[] {
    return Array.from({ length: Math.max(edges, 1) }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: i < edges ? "┃" : "",
        value: i < edges ? 1 : 0,
        state: (i >= edges ? "unvisited" : i === cut ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.max(edges, 1) - 1 - i, col: 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: number } | null) ?? {};
    const edges =
        typeof task.edges === "number" && task.edges >= 0 ? Math.min(9, Math.floor(task.edges)) : 5;
    let step = 0;
    yield {
        stepNumber: step,
        entities: stalkCells(edges),
        edges: [],
        description: `Green Hackenbush stalk of ${edges} edge${edges === 1 ? "" : "s"} – a Nim heap of size ${edges}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { edges },
    };
    step += 1;
    if (edges === 0) {
        yield {
            stepNumber: step,
            entities: stalkCells(0),
            edges: [],
            description: "Empty stalk – no cut exists, so the player to move loses.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { edges, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: stalkCells(0),
            edges: [],
            description: "The empty stalk is a P-position.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { edges, winning: false },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: stalkCells(edges, 0),
        edges: [],
        description:
            "A cut at any edge removes it and everything above – the stalk can move to any smaller size.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { edges },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: stalkCells(edges, 0),
        edges: [],
        description: "Winning move: cut the base edge, removing the whole stalk at once.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { edges, cut: 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: stalkCells(0),
        edges: [],
        description: "Nothing remains – the opponent has no cut and loses.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { edges: 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: stalkCells(0),
        edges: [],
        description: `First player wins the ${edges}-edge stalk by taking it all.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { edges, winning: true },
    };
}

const module: AlgorithmModule = {
    id: "green-hackenbush-stalk",
    name: "Green Hackenbush Stalk",
    category: "game",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { edges: 5 },
    visualType: "grid",
    run,
};

export default module;
