/**
 * tabu-search.ts – Tabu Search.
 * Minimizes (x-2)^2 on 0..9 from x=8: each step moves to the best
 * non-tabu neighbor (±1), remembering the last 2 positions. Aspiration
 * allows a tabu move that beats the all-time best.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const f = (x: number): number => (x - 2) * (x - 2);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { start?: number; iters?: number; tenure?: number } | null) ?? {};
    let cur = Math.max(0, Math.min(9, cfg.start ?? 8));
    const iters = Math.max(1, Math.min(10, cfg.iters ?? 6));
    const tenure = Math.max(1, Math.min(5, cfg.tenure ?? 2));
    let best = cur;
    const tabu: number[] = [];
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = Array.from({ length: 10 }, (_, x) => ({
            id: `x-${x}`,
            type: "bar" as const,
            label: String(f(x)),
            value: f(x),
            state: (x === best
                ? "sorted"
                : x === cur
                  ? "comparing"
                  : tabu.includes(x)
                    ? "visited"
                    : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: x },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "array",
            meta: { cur, best, bestFit: f(best) },
        };
    };
    yield frame(`Start at x=${cur} (f=${f(cur)}); tabu list empty.`, 0);
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        const cands = [cur - 1, cur + 1].filter((x) => x >= 0 && x <= 9);
        const free = cands.filter((x) => !tabu.includes(x) || f(x) < f(best));
        const pool = free.length > 0 ? free : cands;
        const nxt = pool.reduce((a, b) => (f(b) < f(a) ? b : a), pool[0] ?? cur);
        tabu.push(cur);
        while (tabu.length > tenure) tabu.shift();
        cur = nxt;
        if (f(cur) < f(best)) best = cur;
        yield frame(`Step ${t}: moved to x=${cur} (f=${f(cur)}); tabu=[${tabu.join(",")}].`, t);
        step += 1;
    }
    yield frame(`Done: minimum x=${best} with f=${f(best)} (optimum x=2).`, iters + 1);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Tabu search is a local search that avoids getting stuck by forbidding, or making tabu, recently visited moves for a fixed tenure. At each step it moves to the best non-tabu neighbor, with an aspiration rule that allows a tabu move when it beats the all-time best. This helps the search escape cycles and local optima.",
        "invariants": [
            "The tabu list holds at most tenure recent positions.",
            "A move is allowed if its target is not tabu or if it satisfies aspiration by beating the best.",
            "The all-time best position and its fitness never worsen."
        ],
        "correctness": "Tabu search is a metaheuristic without a general optimality guarantee. Aspiration ensures an improving move is never discarded, so the best-found solution is monotone, and the tabu list discourages revisiting recent positions, reducing cycling. For the demo's convex quadratic the search reliably reaches the global minimum at x=2.",
        "complexityRationale": "Each iteration examines a constant number of neighbors and maintains a tabu list of bounded length, O(1) per step and O(t·neighbors) for t steps. Storing the tabu list and a few scalars is O(tabu) space.",
        "uses": [
            "Job-shop scheduling and vehicle routing",
            "Assignment and timetabling problems",
            "Telecommunication network design and portfolio optimization",
            "Feature selection and other hard discrete problems"
        ],
        "references": [
            "Glover, Future Paths for Integer Programming and Links to Artificial Intelligence, Computers & Operations Research, 1986",
            "Glover and Laguna, Tabu Search, Kluwer, 1997"
        ],
        "workedExample": "Minimize f(x)=(x-2)^2 on 0..9 from x=8 with tenure 2. Step 1 compares neighbors 7 (f=25) and 9 (f=49), moving to 7 with tabu=[8]. Step 2 skips tabu 8 and moves to 6, tabu=[8,7]. The search continues leftward toward x=2, where f=0."
    },
    id: "tabu-search",
    name: "Tabu Search",
    category: "math",
    complexity: { time: "O(t·n)", space: "O(tabu)" },
    defaultInput: { start: 8, iters: 6, tenure: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize search at start x with empty tabu list",
        "for step t <- 1 to iters",
        "evaluate neighbors excluding tabu unless aspirated",
        "move to best allowed neighbor candidate",
        "push prior position with fixed tenure length",
        "track best solution found across all steps",
        "done: minimum x reported near optimum 2",
    ],
};

export default module;
