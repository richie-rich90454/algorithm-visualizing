/**
 * pattern-database-search.ts - A* with a Pattern Database Heuristic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A pattern database stores the exact solution cost of a relaxed problem: only
 * a chosen subset of puzzle tiles is tracked and every other tile is treated as
 * interchangeable. Solving that small state space once gives an admissible
 * heuristic, because any real move is also a legal move in the relaxation.
 * This module builds the database for tiles 0 through 3 of a 2 by 3 sliding
 * puzzle with breadth-first search, then runs A* with that heuristic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P + log S) where P is the abstract state count and S the search
 *   Space: O(P + S) for the database and the open list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the sliding puzzle, with the blank labeled as an empty box.
 *   - The state currently being expanded is yellow; the goal is green.
 *   - Each frame reports the pattern-database lower bound for that state.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Puzzle = number[];
const GOAL: Puzzle = [1, 2, 3, 4, 5, 0];
const TRACKED = [0, 1, 2, 3];

function neighbors(index: number): number[] {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const result: number[] = [];
    if (row > 0) result.push(index - 3);
    if (row < 1) result.push(index + 3);
    if (col > 0) result.push(index - 1);
    if (col < 2) result.push(index + 1);
    return result;
}

function moves(puzzle: Puzzle): Puzzle[] {
    const blank = puzzle.indexOf(0);
    if (blank < 0) return [];
    return neighbors(blank).map((target) => {
        const next = [...puzzle];
        next[blank] = puzzle[target] ?? 0;
        next[target] = 0;
        return next;
    });
}

function abstraction(puzzle: Puzzle): string {
    return puzzle.map((tile) => (TRACKED.includes(tile) ? tile : -1)).join(",");
}

function buildDatabase(): Map<string, number> {
    const start = GOAL.map((tile) => (TRACKED.includes(tile) ? tile : -1)).join(",");
    const distance = new Map<string, number>([[start, 0]]);
    const queue: Array<{ key: string; d: number }> = [{ key: start, d: 0 }];
    for (let head = 0; head < queue.length; head += 1) {
        const item = queue[head];
        if (!item) continue;
        const blank = item.key.split(",").indexOf("0");
        if (blank < 0) continue;
        for (const target of neighbors(blank)) {
            const parts = item.key.split(",");
            parts[blank] = parts[target] ?? "-1";
            parts[target] = "0";
            const key = parts.join(",");
            if (!distance.has(key)) {
                distance.set(key, item.d + 1);
                queue.push({ key, d: item.d + 1 });
            }
        }
    }
    return distance;
}

function makeCells(puzzle: Puzzle, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return puzzle.map((tile, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: tile === 0 ? "_" : String(tile),
        value: tile,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 3), col: index % 3, index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: Puzzle; goal?: Puzzle } | null) ?? {};
    const goal = (task.goal ?? GOAL).slice(0, 6);
    let start = (task.start ?? [1, 2, 3, 0, 4, 5]).slice(0, 6);
    while (start.length < 6) start.push(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(start),
        edges: [],
        description: `Pattern database search on a 2 by 3 puzzle, tracking tiles 0 through 3.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { abstractStates: 0, expansions: 0, heuristic: 0 },
    };
    step += 1;

    const database = buildDatabase();
    yield {
        stepNumber: step,
        entities: makeCells(start),
        edges: [],
        description: `Built an exact database of ${database.size} abstract states by breadth-first search.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { abstractStates: database.size, expansions: 0, heuristic: database.get(abstraction(start)) ?? 0 },
    };
    step += 1;

    const heuristic = (puzzle: Puzzle): number => database.get(abstraction(puzzle)) ?? 0;
    const startKey = start.join(",");
    const goalKey = goal.join(",");
    interface Node {
        puzzle: Puzzle;
        g: number;
        f: number;
        path: Puzzle[];
    }
    const open: Node[] = [{ puzzle: start, g: 0, f: heuristic(start), path: [start] }];
    const best = new Map<string, number>([[startKey, 0]]);
    let expansions = 0;
    let solution: Puzzle[] | null = null;
    const limit = 160;

    while (open.length > 0 && expansions < limit) {
        let bestIndex = 0;
        for (let i = 1; i < open.length; i += 1) {
            const candidate = open[i];
            const current = open[bestIndex];
            if (candidate && current && (candidate.f < current.f || (candidate.f === current.f && candidate.g > current.g))) {
                bestIndex = i;
            }
        }
        const node = open.splice(bestIndex, 1)[0];
        if (!node) break;
        const key = node.puzzle.join(",");
        if (key === goalKey) {
            solution = node.path;
            break;
        }
        expansions += 1;
        const h = heuristic(node.puzzle);
        const states = new Map<number, EntityState>();
        for (let i = 0; i < node.puzzle.length; i += 1) {
            if (node.puzzle[i] === goal[i]) states.set(i, "path");
        }
        yield {
            stepNumber: step,
            entities: makeCells(node.puzzle, states),
            edges: [],
            description: `Expand state [${node.puzzle.join(",")}]: g=${node.g}, database lower bound=${h}, f=${node.f}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { abstractStates: database.size, expansions, heuristic: h, g: node.g, f: node.f },
        };
        step += 1;

        for (const next of moves(node.puzzle)) {
            const nextKey = next.join(",");
            const tentative = node.g + 1;
            if ((best.get(nextKey) ?? Number.POSITIVE_INFINITY) <= tentative) continue;
            best.set(nextKey, tentative);
            open.push({ puzzle: next, g: tentative, f: tentative + heuristic(next), path: [...node.path, next] });
        }
    }

    if (solution) {
        let previous = solution[0] ?? start;
        for (let i = 0; i < solution.length; i += 1) {
            const puzzle = solution[i] ?? previous;
            const states = new Map<number, EntityState>();
            for (let j = 0; j < puzzle.length; j += 1) {
                if (puzzle[j] === goal[j]) states.set(j, "sorted");
            }
            const blank = previous.indexOf(0);
            const now = puzzle.indexOf(0);
            if (blank >= 0 && now >= 0) states.set(now, "comparing");
            yield {
                stepNumber: step,
                entities: makeCells(puzzle, states),
                edges: [],
                description: `Solution step ${i}: move tile ${previous[now] ?? 0} into the blank at position ${blank}.`,
                codeLineNumber: 6,
                layout: "grid",
                meta: { abstractStates: database.size, expansions, solutionLength: solution.length - 1, step: i },
            };
            step += 1;
            previous = puzzle;
        }
    } else {
        yield {
            stepNumber: step,
            entities: makeCells(start),
            edges: [],
            description: `No solution found within ${limit} expansions; the start may be unsolvable.`,
            codeLineNumber: 7,
            layout: "grid",
            meta: { abstractStates: database.size, expansions, solutionLength: -1 },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A pattern database trades memory for a stronger heuristic. Instead of solving the whole puzzle, solve a tiny version that tracks only a few special tiles. Because deleting information can only shorten paths, the exact cost in that relaxed problem never overestimates the real cost, so A* can use it safely.",
        invariants: [
            "The abstract distance of any state is a lower bound on its true distance to the goal.",
            "Every real puzzle move maps to at most one abstract move, so the heuristic changes by no more than one per step.",
            "A* always expands the open node with the smallest g plus h.",
        ],
        correctness:
            "The relaxation drops constraints, so its shortest path is no longer than the real one, proving admissibility. Since a single tile move changes the abstract state by at most one step, the heuristic is consistent. A* with an admissible and consistent heuristic returns an optimal path when the goal is removed from the open list.",
        complexityRationale:
            "The database is built by one breadth-first traversal of at most 6!/2! abstract states, and A* runs in time logarithmic in the open-list size per expansion with O(database + open) space.",
        uses: [
            "Optimal solving of sliding-tile and Rubik-style puzzles",
            "Heuristic design for real-time strategy game pathfinding",
            "Teaching the accuracy versus memory trade-off in search",
        ],
        references: [
            "Korf, Real-Time Heuristic Search Using Pattern Databases (1997)",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, Chapter 3",
        ],
        workedExample:
            "For the start 1,2,3,0,4,5 the tracked tiles already sit in goal order except for the blank, so the database reports a lower bound of two. A* expands only a handful of states before finding the two-move solution that slides the blank to the far right.",
    },
    id: "pattern-database-search",
    name: "Pattern Database Search",
    category: "searching",
    complexity: { time: "O(P + log S)", space: "O(P + S)" },
    defaultInput: { start: [1, 2, 3, 0, 4, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a small pattern of tracked puzzle tiles",
        "breadth-first search the abstract goal to build exact distances",
        "read each state's lower bound from that pattern database",
        "push the start onto an open list ordered by g plus h",
        "expand the open state with the smallest f value",
        "relax each legal move and update the best known cost",
        "stop when the goal leaves the open list",
        "done: replay the optimal move sequence",
    ],
};

export default module;
