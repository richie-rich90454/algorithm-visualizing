// euclids-game.ts – Euclid's Game: subtract a positive multiple of the smaller.
// Position (a,b), a>=b: win if floor(a/b)>=2 or the forced reply loses.
// Computed in-code; default (12,7) wins via (12,7)->(7,5)->(5,2)->(3,2)->(1,2)->(0,1).
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function euclidWin(a: number, b: number): boolean {
    const memo = new Map<string, boolean>();
    const win = (p: number, q: number): boolean => {
        if (q === 0) return false;
        const k = `${p},${q}`;
        const hit = memo.get(k);
        if (hit !== undefined) return hit;
        const quo = Math.floor(p / q);
        const rem = p % q;
        // ponytail: closed-form shortcut – quotient >= 2 is an immediate win.
        const res = quo >= 2 || !win(q, rem);
        memo.set(k, res);
        return res;
    };
    return win(Math.max(a, b), Math.min(a, b));
}

function pairCells(a: number, b: number, hot: boolean): VisualEntity[] {
    return [a, b].map((v, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(v),
        value: v,
        state: (hot ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number } | null) ?? {};
    const a = typeof task.a === "number" && task.a >= 0 ? Math.min(99, Math.floor(task.a)) : 12;
    const b = typeof task.b === "number" && task.b >= 0 ? Math.min(99, Math.floor(task.b)) : 7;
    let x = Math.max(a, b);
    let y = Math.min(a, b);
    let step = 0;
    yield {
        stepNumber: step,
        entities: pairCells(x, y, false),
        edges: [],
        description: `Euclid position (${x}, ${y}) with quotient ${y === 0 ? "–" : Math.floor(x / y)} – player to move ${euclidWin(x, y) ? "wins" : "loses"} with perfect play.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { a: x, b: y, winning: euclidWin(x, y) },
    };
    step += 1;
    let mover = "First";
    while (y !== 0 && step < 12) {
        const quo = Math.floor(x / y);
        const rem = x % y;
        // Winning choice: jump (when quo >= 2) or the reply that loses; else forced.
        let k = 1;
        if (quo >= 2) {
            for (let t = 1; t <= quo; t += 1) {
                if (!euclidWin(x - t * y, y)) {
                    k = t;
                    break;
                }
                if (t === quo) k = quo;
            }
            if (k === 1 && euclidWin(x - quo * y, y) && quo > 1) k = 1;
        }
        if (quo < 2) k = 1;
        const nx = x - k * y;
        yield {
            stepNumber: step,
            entities: pairCells(x, y, true),
            edges: [],
            description: `${mover} plays Euclid (${x}, ${y}) with quotient ${quo} -> subtract ${k}×${y} -> (${y}, ${nx}).${quo >= 2 ? " Quotient ≥ 2 controls the game." : " Forced reply."}`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { a: x, b: y, k, quo, rem, next: [y, nx], mover },
        };
        step += 1;
        x = y;
        y = nx;
        if (x < y) {
            const t = x;
            x = y;
            y = t;
        }
        mover = mover === "First" ? "Second" : "First";
    }
    yield {
        stepNumber: step,
        entities: pairCells(x, y, false),
        edges: [],
        description: `Reached Euclid (${x}, ${y}) – ${mover} has no move and loses, so ${mover === "First" ? "Second" : "First"} wins the pair.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { a: x, b: y, winner: mover === "First" ? "Second" : "First", terminal: true },
    };
}

const module: AlgorithmModule = {
    id: "euclids-game",
    name: "Euclid's Game",
    category: "game",
    complexity: { time: "O(log min(a,b))", space: "O(log min(a,b))" },
    defaultInput: { a: 12, b: 7 },
    visualType: "grid",
    run,
    pseudocode: [
        "order Euclid position (a, b) so a ≥ b with subtraction moves",
        "if floor(a/b) ≥ 2: winning, the player controls the forced reply",
        "else only one legal multiple exists, play forced subtract 1 × b",
        "move to (b, a - k×b) and swap to keep the larger value first",
        "repeat quotient and remainder steps until (x, 0) is reached",
        "winner is the player not to move from (x, 0); other wins",
    ],
};

export default module;
