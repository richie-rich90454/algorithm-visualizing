/**
 * coalitional-game-core.ts - Core of a Coalitional Game
 *
 * For a cooperative game given by a characteristic function v(S), the core is
 * the set of payoff vectors that distribute exactly v(all players) and give
 * every coalition at least what it can earn on its own. The visualization
 * starts from all integer imputations and removes those violated by each
 * coalition constraint in turn.
 *
 * Time: O(C * 2^n * n) where C is the number of candidate imputations.
 * Space: O(C * n) for the candidate sets shown in the frames.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Game {
    n: number;
    values: Map<string, number>;
    vAll: number;
    coalitions: number[][];
}

function keyOf(subset: number[]): string {
    return [...subset].sort((a, b) => a - b).join(",");
}

function buildGame(players: number, raw: Record<string, number>): Game {
    const values = new Map<string, number>();
    for (const [key, value] of Object.entries(raw)) {
        values.set(key.split(",").filter((s) => s.trim() !== "").map(Number).sort((a, b) => a - b).join(","), Number(value));
    }
    const all = Array.from({ length: players }, (_, i) => i);
    const coalitions: number[][] = [];
    for (let mask = 1; mask < 1 << players; mask += 1) {
        const subset: number[] = [];
        for (let i = 0; i < players; i += 1) if (mask & (1 << i)) subset.push(i);
        coalitions.push(subset);
    }
    return { n: players, values, vAll: values.get(keyOf(all)) ?? 0, coalitions };
}

function valueOf(game: Game, subset: number[]): number {
    return game.values.get(keyOf(subset)) ?? 0;
}

/** Enumerate imputations that are nonnegative, individually rational and sum to v(N). */
function enumerateImputations(game: Game, step: number): number[][] {
    const out: number[][] = [];
    const lower = Array.from({ length: game.n }, (_, i) => valueOf(game, [i]));
    const visit = (index: number, remaining: number, current: number[]) => {
        if (out.length >= 2000) return;
        if (index === game.n - 1) {
            const last = remaining;
            if (last >= lower[index] && Math.abs(last / step - Math.round(last / step)) < 1e-9) {
                out.push([...current, last]);
            }
            return;
        }
        const floor = Math.max(lower[index], 0);
        for (let x = floor; x <= remaining; x += step) visit(index + 1, remaining - x, [...current, x]);
    };
    if (step > 0) visit(0, game.vAll, []);
    return out;
}

function makeCells(
    allocations: number[][],
    n: number,
    constraint: Set<number> | null,
    final: boolean,
): VisualEntity[] {
    const shown = allocations.slice(0, 12);
    const cells: VisualEntity[] = [];
    for (let r = 0; r < shown.length; r += 1) {
        const row = shown[r] ?? [];
        for (let c = 0; c < n; c += 1) {
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: String(row[c] ?? 0),
                value: row[c] ?? 0,
                state: final ? "sorted" : constraint ? "comparing" : "visited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, player: c, payoff: row[c] ?? 0 },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { players?: number; values?: Record<string, number>; step?: number } | null) ?? {};
    const players = Math.min(5, Math.max(2, Math.floor(typeof task.players === "number" ? task.players : 3)));
    const values: Record<string, number> = task.values ?? {
        "0": 0, "1": 0, "2": 0,
        "0,1": 4, "0,2": 4, "1,2": 4,
        "0,1,2": 6,
    };
    const step = Math.max(1, Math.floor(typeof task.step === "number" ? task.step : 1));
    const game = buildGame(players, values);
    const candidates = enumerateImputations(game, step);
    let survivors = candidates;
    let stepNo = 0;

    yield {
        stepNumber: stepNo,
        entities: makeCells(survivors, players, null, false),
        edges: [],
        description: `Testing the core of a ${players}-player game with v(N)=${game.vAll} over ${candidates.length} candidate imputations.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: Math.min(12, survivors.length), cols: players, players, vAll: game.vAll, candidates: candidates.length, survivors: survivors.length, core: [], nonempty: false },
    };
    stepNo += 1;

    for (const coalition of game.coalitions) {
        if (coalition.length === 0 || coalition.length === players) continue;
        const required = valueOf(game, coalition);
        const before = survivors.length;
        survivors = survivors.filter((allocation) => {
            let sum = 0;
            for (const member of coalition) sum += allocation[member] ?? 0;
            return sum >= required;
        });
        yield {
            stepNumber: stepNo,
            entities: makeCells(survivors, players, new Set(coalition), false),
            edges: [],
            description: `Coalition {${coalition.join(",")}} must receive at least ${required}; ${before - survivors.length} imputation(s) eliminated, ${survivors.length} remain.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: Math.min(12, survivors.length),
                cols: players,
                players,
                vAll: game.vAll,
                candidates: candidates.length,
                survivors: survivors.length,
                core: [],
                nonempty: false,
                coalition: [...coalition],
                required,
            },
        };
        stepNo += 1;
    }

    yield {
        stepNumber: stepNo,
        entities: makeCells(survivors, players, null, true),
        edges: [],
        description: survivors.length === 0
            ? `The core is empty: no imputation satisfies every coalition constraint.`
            : `The core contains ${survivors.length} imputation(s), shown as payoff rows.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: Math.min(12, survivors.length),
            cols: players,
            players,
            vAll: game.vAll,
            candidates: candidates.length,
            survivors: survivors.length,
            core: survivors.map((s) => s.join(",")),
            nonempty: survivors.length > 0,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A coalition will walk away unless the proposed payoffs give it at least what it can guarantee by itself. The core collects every division of the grand coalition's value that no coalition can profitably block. We enumerate the plausible integer divisions and discard any that a coalition can improve upon.",
        invariants: [
            "Every surviving imputation distributes exactly the grand coalition value.",
            "A survivor pays each player at least that player's singleton value.",
            "Survivors after a constraint satisfy every constraint processed so far.",
        ],
        correctness:
            "The core is defined by the grand equality plus one weakly-greater-or-equal inequality per coalition. Enumeration produces every individually rational imputation on the chosen grid, and filtering removes exactly those failing a constraint. After all constraints are processed the survivors satisfy every defining condition, so they are precisely the core on that grid; an empty survivor set certifies an empty core over the enumerated imputations.",
        complexityRationale:
            "With C candidate imputations, n players and 2 to the n coalitions, each constraint scans every survivor summing at most n payoffs, giving O(C * n * 2^n) time. Holding the candidate lists uses O(C * n) space.",
        uses: [
            "Assessing stability of cost-sharing and profit-sharing agreements",
            "Checking whether a proposed allocation can be blocked",
            "A companion to the Shapley value for cooperative game analysis",
        ],
        references: [
            "von Neumann and Morgenstern, Theory of Games and Economic Behavior, 1944",
            "Osborne, An Introduction to Game Theory, Chapter 13",
        ],
        workedExample:
            "For three players where every pair earns 4 and the grand coalition earns 6, the constraints force each pair to get at least 4. Summing the three pair inequalities gives 12, exactly twice 6, so every pair constraint must be tight and only the division 2, 2, 2 lies in the core.",
    },
    id: "coalitional-game-core",
    name: "Core of a Coalitional Game",
    category: "game",
    complexity: { time: "O(C * n * 2^n)", space: "O(C * n)" },
    defaultInput: {
        players: 3,
        values: { "0": 0, "1": 0, "2": 0, "0,1": 4, "0,2": 4, "1,2": 4, "0,1,2": 6 },
        step: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the number of players and the characteristic function values",
        "enumerate every imputation summing to the grand coalition value",
        "keep only imputations that pay each player their singleton value",
        "for each proper coalition",
        "discard imputations paying that coalition less than its value",
        "after all coalitions the survivors form the core",
        "report the core or that it is empty",
    ],
};

export default module;
