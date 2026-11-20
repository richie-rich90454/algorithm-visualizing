/**
 * mtdf.ts - MTD(f): Memory-enhanced Test Driver with Bound f
 *
 * MTD(f) drives a sequence of null-window alpha-beta searches. Each call tests
 * a single guess f with a window of width one and returns either an upper or a
 * lower bound on the true minimax value. Repeating the test narrows the bracket
 * until the bounds meet, at which point f is the exact game value. In practice
 * it converges in far fewer full searches than repeated widening windows.
 *
 * Time O(k * b^(d/2)) for k null-window passes; space O(d).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function depthOf(size: number): number {
    let d = 0;
    let n = 1;
    while (n * 2 <= size) {
        n *= 2;
        d += 1;
    }
    return d;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number[]; guess?: number } | null) ?? {};
    const supplied = Array.isArray(task.leaves) && task.leaves.length >= 2 ? task.leaves : [3, 5, 2, 6, 1, 4, 7, 2];
    const depth = depthOf(supplied.length);
    const leaves = supplied.slice(0, 2 ** depth).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0));
    const firstLeaf = 2 ** depth;
    const total = 2 ** (depth + 1) - 1;
    let f = typeof task.guess === "number" && Number.isFinite(task.guess) ? Math.floor(task.guess) : 0;

    const states: EntityState[] = new Array(total + 1).fill("unvisited");
    const values: number[] = new Array(total + 1).fill(0);
    let nodesVisited = 0;

    const edges = Array.from({ length: total }, (_, i) => i + 1)
        .filter((i) => i * 2 <= total)
        .flatMap((i) => [i * 2, i * 2 + 1].filter((c) => c <= total).map((c) => ({
            id: `edge-${i}-${c}`,
            sourceId: `node-${i}`,
            targetId: `node-${c}`,
            label: "",
            state: "idle" as EntityState,
            directed: false,
        })));

    const view = (): VisualEntity[] =>
        Array.from({ length: total }, (_, i) => i + 1).map((i) => {
            const level = Math.floor(Math.log2(i));
            return {
                id: `node-${i}`,
                type: "node" as const,
                label: level === depth ? String(leaves[i - firstLeaf] ?? 0) : String(values[i]),
                value: values[i] ?? 0,
                state: states[i] ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: i === 1 ? "root" : `node-${Math.floor(i / 2)}`, level, index: i },
            };
        });

    const alphaBeta = (i: number, alpha: number, beta: number, isMax: boolean): number => {
        nodesVisited += 1;
        if (i >= firstLeaf) return leaves[i - firstLeaf] ?? 0;
        const children = [i * 2, i * 2 + 1].filter((c) => c <= total);
        if (isMax) {
            let value = -Infinity;
            for (const child of children) {
                value = Math.max(value, alphaBeta(child, alpha, beta, false));
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }
            values[i] = value;
            states[i] = "visited";
            return value;
        }
        let value = Infinity;
        for (const child of children) {
            value = Math.min(value, alphaBeta(child, alpha, beta, true));
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        values[i] = value;
        states[i] = "visited";
        return value;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: view(),
        edges,
        description: `MTD(f) starts with guess f=${f} and brackets the minimax value with null-window alpha-beta tests.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { depth, leaves: [...leaves], guess: f, iterations: 0 },
    };
    step += 1;

    let lower = -Infinity;
    let upper = Infinity;
    let iterations = 0;
    const history: number[] = [];
    while (lower < upper && iterations < 64) {
        const beta = f === lower ? f + 1 : f;
        const bound = alphaBeta(1, beta - 1, beta, true);
        if (bound < beta) upper = bound;
        else lower = bound;
        f = bound;
        iterations += 1;
        history.push(f);
        states[1] = "comparing";
        yield {
            stepNumber: step,
            entities: view(),
            edges,
            description: `Pass ${iterations}: null window (${beta - 1}, ${beta}) returned ${bound}, so the true value lies in [${lower}, ${upper}].`,
            codeLineNumber: iterations === 1 ? 2 : 4,
            layout: "tree",
            meta: { f, beta, bound, lower: String(lower), upper: String(upper), iterations, nodesVisited, history: [...history] },
        };
        step += 1;
    }

    states[1] = "sorted";
    yield {
        stepNumber: step,
        entities: view(),
        edges,
        description: `MTD(f) converged to game value ${f} after ${iterations} null-window pass(es) and ${nodesVisited} node visits.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { value: f, optimal: f, iterations, nodesVisited, history: [...history], depth },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than search the whole window, MTD(f) asks a yes or no question about one guessed value at a time. A search with window (f-1, f) either proves the true value is at most f-1 or at least f. Each answer moves one end of a bracket, and when the bracket collapses the guess is exact.",
        invariants: [
            "The true minimax value always stays inside the current bracket [lower, upper].",
            "Every search uses a window of width one around the current guess.",
            "When lower equals upper, that common value is the exact game value.",
        ],
        correctness:
            "A fail-soft alpha-beta search with window (beta-1, beta) returns a value below beta only when the true value is at most that result, giving a valid upper bound; otherwise it returns a valid lower bound. Updating the bracket by these bounds preserves the invariant that the true value is enclosed, so termination at lower equals upper must report the exact minimax value.",
        complexityRationale:
            "Each pass is a null-window alpha-beta search costing O(b^(d/2)) with good ordering, and the number of passes k is usually small and bounded by the score range; recursion uses O(d) space.",
        uses: [
            "Game engines that reuse a transposition table across repeated searches",
            "Iterative deepening where the previous score gives a strong starting guess",
            "Any setting where narrow-window searches are cheaper than a full window",
        ],
        references: [
            "Plaat, Bratko, and Muetze, MTD(f): A Minimax Algorithm Faster than Alpha-Beta (1996)",
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning (1975)",
        ],
        workedExample:
            "Starting with guess 0 on a tree whose true value is 6, a search of window (-1, 0) returns at least 0 and so raises the lower bound. The guess advances to that bound; after a few such tests the bracket tightens to [6, 6], and 6 is returned as the exact value.",
    },
    id: "mtdf",
    name: "MTD(f) Search",
    category: "game",
    complexity: { time: "O(k * b^(d/2))", space: "O(d)" },
    defaultInput: { leaves: [3, 5, 2, 6, 1, 4, 7, 2], guess: 0 },
    visualType: "tree",
    run,
    pseudocode: [
        "set guess f, lower bound -inf, upper bound +inf",
        "choose beta as f+1 when f is the lower bound, otherwise f",
        "run a null-window alpha-beta search over (beta-1, beta)",
        "if the result is below beta set the upper bound, else the lower bound",
        "replace f with the returned bound and repeat",
        "stop when the two bounds are equal",
        "report f as the exact minimax game value",
    ],
};

export default module;
