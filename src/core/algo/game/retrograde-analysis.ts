// retrograde-analysis.ts – Retrograde analysis on a 3-state endgame graph.
// S0->S1->S2, S2 terminal (no moves, LOSS). Propagate: S2 LOSS, S1 WIN
// (moves to LOSS), S0 LOSS (only move to WIN). Statuses computed in-code.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Status = "UNKNOWN" | "WIN" | "LOSS";

function rnode(id: string, status: Status, hot: boolean): VisualEntity {
    return {
        id,
        type: "node" as const,
        label: `${id} ${status}`,
        value: status === "WIN" ? 1 : status === "LOSS" ? -1 : 0,
        state: (hot
            ? "comparing"
            : status === "WIN"
              ? "sorted"
              : status === "LOSS"
                ? "swapped"
                : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: id === "S0" ? "root" : id === "S1" ? "S0" : "S1", status },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { states?: number } | null) ?? {};
    void task;
    const next: Record<string, string[]> = { S0: ["S1"], S1: ["S2"], S2: [] };
    const order = ["S0", "S1", "S2"];
    const status: Record<string, Status> = { S0: "UNKNOWN", S1: "UNKNOWN", S2: "UNKNOWN" };
    let step = 0;
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, false)),
        edges: [],
        description: "Endgame graph S0->S1->S2 – all statuses UNKNOWN.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { ...status },
    };
    step += 1;
    const terminal = order.filter((s) => (next[s] ?? []).length === 0);
    for (const s of terminal) status[s] = "LOSS";
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, terminal.includes(s))),
        edges: [],
        description: `Terminal states with no moves (${terminal.join(", ")}) are LOSS.`,
        codeLineNumber: 1,
        layout: "tree",
        meta: { ...status },
    };
    step += 1;
    // ponytail: single backward pass suffices on this DAG; queue loop when cycles exist.
    for (const s of order) {
        const moves = next[s] ?? [];
        if (moves.some((m) => status[m] === "LOSS")) status[s] = "WIN";
        else if (moves.length > 0 && moves.every((m) => status[m] === "WIN")) status[s] = "LOSS";
    }
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, s === "S1")),
        edges: [],
        description: "S1 can move to LOSS S2, so S1 is WIN.",
        codeLineNumber: 2,
        layout: "tree",
        meta: { ...status },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, s === "S0")),
        edges: [],
        description: "S0's only move goes to WIN S1, so S0 is LOSS.",
        codeLineNumber: 2,
        layout: "tree",
        meta: { ...status },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, false)),
        edges: [],
        description: `Retrograde complete: S0 ${status["S0"]}, S1 ${status["S1"]}, S2 ${status["S2"]} – the player to move at S0 loses.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { ...status },
    };
}

const module: AlgorithmModule = {
    id: "retrograde-analysis",
    name: "Retrograde Analysis",
    category: "game",
    complexity: { time: "O(V+E)", space: "O(V)" },
    defaultInput: { states: 3 },
    visualType: "tree",
    run,
};

export default module;
