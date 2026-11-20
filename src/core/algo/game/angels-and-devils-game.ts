/**
 * angels-and-devils-game.ts - Angels and Devils Game
 *
 * On a bounded square board an angel starts at the center and can jump up to a
 * given Chebyshev distance each turn. Before every jump the devil burns one
 * square that the angel does not occupy, and burned squares can never be used
 * again. The angel wins if it survives a fixed number of rounds, otherwise the
 * devil wins. The position is solved with a memoized minimax search over the
 * angel position, the burned-square bit mask, and the number of rounds left.
 *
 * Time O(b^(r+1) * a^r) for b burn choices and a angel moves per round;
 * space O(b^r * a^r) for the memo table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Config {
    n: number;
    power: number;
    rounds: number;
    start: number;
}

function chebyshev(n: number, a: number, b: number): number {
    return Math.max(Math.abs(Math.floor(a / n) - Math.floor(b / n)), Math.abs((a % n) - (b % n)));
}

function legalMoves(cfg: Config, pos: number, burned: number): number[] {
    const moves: number[] = [];
    for (let q = 0; q < cfg.n * cfg.n; q += 1) {
        if ((burned & (1 << q)) !== 0) continue;
        if (chebyshev(cfg.n, pos, q) <= cfg.power && q !== pos) moves.push(q);
    }
    return moves;
}

type WinFunction = (pos: number, burned: number, left: number) => boolean;

function makeSolver(cfg: Config): { wins: WinFunction; memo: Map<string, boolean> } {
    const memo = new Map<string, boolean>();
    const cells = cfg.n * cfg.n;

    function wins(pos: number, burned: number, left: number): boolean {
        if (left <= 0) return true;
        const key = `${pos}|${burned}|${left}`;
        const cached = memo.get(key);
        if (cached !== undefined) return cached;

        let devilCanStop = false;
        for (let d = 0; d < cells && !devilCanStop; d += 1) {
            if ((burned & (1 << d)) !== 0 || d === pos) continue;
            const nextBurned = burned | (1 << d);
            const moves = legalMoves(cfg, pos, nextBurned);
            if (moves.length === 0) {
                devilCanStop = true;
                break;
            }
            let angelSurvives = false;
            for (const q of moves) {
                if (wins(q, nextBurned, left - 1)) {
                    angelSurvives = true;
                    break;
                }
            }
            if (!angelSurvives) devilCanStop = true;
        }
        const result = !devilCanStop;
        memo.set(key, result);
        return result;
    }

    return { wins, memo };
}

function bestResponse(wins: WinFunction, cfg: Config, pos: number, burned: number, left: number): number {
    const moves = legalMoves(cfg, pos, burned);
    for (const q of moves) {
        if (wins(q, burned, left - 1)) return q;
    }
    return moves[0] ?? -1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { boardSize?: number; power?: number; rounds?: number } | null) ?? {};
    const n = Math.max(3, Math.min(4, typeof task.boardSize === "number" ? Math.floor(task.boardSize) : 4));
    const power = Math.max(1, Math.min(2, typeof task.power === "number" ? Math.floor(task.power) : 1));
    const rounds = Math.max(1, Math.min(4, typeof task.rounds === "number" ? Math.floor(task.rounds) : 3));
    const cfg: Config = { n, power, rounds, start: Math.floor(n / 2) * n + Math.floor(n / 2) };
    const cells = n * n;
    const { wins, memo } = makeSolver(cfg);
    const verdict = { angelWins: wins(cfg.start, 0, cfg.rounds), memoSize: memo.size };

    const cellsView = (pos: number, burned: number, response: number): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < cells; i += 1) {
            let state: EntityState = "idle";
            if ((burned & (1 << i)) !== 0) state = "error";
            else if (i === pos) state = "active";
            else if (i === response) state = "sorted";
            out.push({
                id: `cell-${i}`,
                type: "cell",
                label: i === pos ? "A" : (burned & (1 << i)) !== 0 ? "x" : String(i),
                value: i,
                state,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { row: Math.floor(i / n), col: i % n, burned: (burned & (1 << i)) !== 0 },
            });
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: cellsView(cfg.start, 0, -1),
        edges: [],
        description: `Angels and devils on a ${n} by ${n} board: power ${power} angel at the center, ${rounds} rounds to survive.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, boardSize: n, power, rounds, start: cfg.start, burned: 0, angelWins: verdict.angelWins },
    };
    step += 1;

    for (let d = 0; d < cells; d += 1) {
        if (d === cfg.start) continue;
        const burned = 1 << d;
        const response = bestResponse(wins, cfg, cfg.start, burned, rounds);
        const survives = response >= 0;
        yield {
            stepNumber: step,
            entities: cellsView(cfg.start, burned, response),
            edges: [],
            description: `Devil burns square ${d}; the angel ${survives ? `jumps to ${response}` : "has no legal jump"} and ${survives ? "can continue" : "is trapped"}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: n, cols: n, burn: d, response, survives, burned, rounds, power },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cellsView(cfg.start, 0, -1),
        edges: [],
        description: `Minimax over ${verdict.memoSize} memoized states says the angel ${verdict.angelWins ? "survives all rounds" : "is eventually trapped"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n, cols: n, angelWins: verdict.angelWins, memoSize: verdict.memoSize,
            boardSize: n, power, rounds, start: cfg.start,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The devil tries to box in the angel by destroying one square per turn, while the angel tries to keep jumping to fresh squares. We solve the finite version by asking, for each possible burned set and angel location, whether some angel move survives every devil response. A position is winning for the angel only if every devil burn still leaves at least one move that leads to another winning position.",
        invariants: [
            "The devil never burns the square currently occupied by the angel.",
            "Burned squares stay burned for the rest of the game.",
            "A state is angel-winning if and only if all devil burns admit an angel move to another angel-winning state.",
        ],
        correctness:
            "The recursion is an induction on the number of rounds left. With zero rounds the angel has already survived, so the state is winning. For more rounds, the devil chooses the worst legal burn, and the angel then chooses the best legal jump; the angel wins exactly when no devil burn can force a position with no winning jump. Memoization caches identical (position, burned set, rounds) states without changing the recurrence, so the returned verdict is the exact game-theoretic value.",
        complexityRationale:
            "There are at most b choices for each of r devil burns and a choices for each angel jump, giving a search tree of size roughly b^(r+1) times a^r; memoization collapses repeated states to O(b^r * a^r) stored entries, which is why small boards and round budgets are used for visualization.",
        uses: [
            "Illustrating the Bowditch Kloster theorem that a high-power angel wins",
            "Teaching minimax search on games with imperfect spatial state",
            "A testbed for retrograde analysis and state hashing",
        ],
        references: [
            "Conway, The Angel and the Devil (1982)",
            "Bowditch, Angel of power 2 wins (2019)",
        ],
        workedExample:
            "On a 3 by 3 board with a power-one angel starting at the center and two rounds, the devil burns a corner. The angel can step to an adjacent edge square, and after the second burn another move remains, so that branch is winning; the minimax search checks every first burn before declaring the whole position won or lost.",
    },
    id: "angels-and-devils-game",
    name: "Angels and Devils Game",
    category: "game",
    complexity: { time: "O(b^(r+1) * a^r)", space: "O(b^r * a^r)" },
    defaultInput: { boardSize: 4, power: 1, rounds: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "place the angel at the center of the board",
        "for each possible devil burn of an unoccupied square",
        "list the angel's legal jumps to unburned nearby squares",
        "if no jump exists then this burn defeats the angel",
        "otherwise recurse on each jump with one fewer round",
        "the angel wins only if every burn has a winning jump",
        "memoize states and report the final verdict",
    ],
};

export default module;
