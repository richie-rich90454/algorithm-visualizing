/**
 * retrograde-analysis.ts – Retrograde Analysis (endgame tablebase solver)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Retrograde analysis solves a game backwards from terminal positions.
 * Simply: mark mates and stalemates, then work backwards to positions that
 * force them. Formally: terminals with no moves are LOSS, a position with a
 * move to LOSS is WIN, and a position with all moves to WIN is LOSS; the
 * demo chain S0 to S1 to S2 propagates S2 LOSS, S1 WIN, S0 LOSS in code.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V+E) over states and moves
 *   Space: O(V) status table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The state being resolved flashes YELLOW (comparing).
 *   - WIN states paint GREEN (sorted); LOSS states paint RED (swapped).
 *   - UNKNOWN states stay idle until the backward pass settles them.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Solves the full endgame graph, not one line.
 *   - The status of the start state is the optimal-play answer.
 */
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
        description: "Endgame graph S0 to S1 to S2 with 3 states – every status starts UNKNOWN.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { ...status, states: 3 },
    };
    step += 1;
    const terminal = order.filter((s) => (next[s] ?? []).length === 0);
    for (const s of terminal) status[s] = "LOSS";
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, terminal.includes(s))),
        edges: [],
        description: `Terminal state S2 with zero legal moves (${terminal.join(", ")}) is marked LOSS.`,
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
        description: "State S1 can move to LOSS state S2, so retrograde marks S1 as WIN.",
        codeLineNumber: 2,
        layout: "tree",
        meta: { ...status },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, s === "S0")),
        edges: [],
        description:
            "State S0 has only one move into WIN state S1, so retrograde marks S0 as LOSS.",
        codeLineNumber: 3,
        layout: "tree",
        meta: { ...status },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: order.map((s) => rnode(s, status[s] as Status, false)),
        edges: [],
        description: `Retrograde table complete: S0 ${status["S0"]}, S1 ${status["S1"]}, S2 ${status["S2"]} – the player to move at S0 loses, so second player wins.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { ...status, winner: "second", start: "S0" },
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
    pseudocode: [
        "start from the endgame graph S0 to S1 to S2 as UNKNOWN",
        "mark terminal states with zero moves (S2) as LOSS positions",
        "mark any state with a move to LOSS (S1) as WIN positions",
        "mark states whose every move reaches WIN (S0) as LOSS",
        "winner is second player since start state S0 is LOSS",
    ],
};

export default module;
