/**
 * artificial-potential-field.ts - Gradient-descent robot navigation.
 *
 * The goal pulls the robot with a conical attractive potential and each
 * obstacle pushes it away with a short-range repulsive bump. Starting from
 * the initial cell, the robot repeatedly steps to the neighboring free cell
 * with the lowest potential.
 *
 * Time: O(maxSteps * (1 + obstacles) * 8). Space: O(rows * cols).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = [number, number];

function potential(q: Cell, goal: Cell, obstacles: Cell[], rho: number, kAtt: number, kRep: number): number {
    let value = kAtt * Math.hypot(q[0] - goal[0], q[1] - goal[1]);
    for (const o of obstacles) {
        const d = Math.hypot(q[0] - o[0], q[1] - o[1]);
        if (d < rho) value += kRep * (1 - d / rho) ** 2;
    }
    return value;
}

function cellEntity(row: number, col: number, state: EntityState, label: string): VisualEntity {
    return {
        id: `cell-${row}-${col}`,
        type: "cell" as const,
        label,
        value: [row, col],
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        rows?: number;
        cols?: number;
        start?: Cell;
        goal?: Cell;
        obstacles?: Cell[];
        rho?: number;
        kAtt?: number;
        kRep?: number;
        maxSteps?: number;
    } | null) ?? {};
    const rows = typeof task.rows === "number" ? Math.max(2, Math.floor(task.rows)) : 8;
    const cols = typeof task.cols === "number" ? Math.max(2, Math.floor(task.cols)) : 8;
    const start: Cell = task.start ?? [0, 0];
    const goal: Cell = task.goal ?? [rows - 1, cols - 1];
    const obstacles: Cell[] = task.obstacles ?? [
        [3, 3],
        [3, 4],
        [4, 3],
        [4, 4],
    ];
    const rho = typeof task.rho === "number" && task.rho > 0 ? task.rho : 2.5;
    const kAtt = typeof task.kAtt === "number" ? task.kAtt : 1;
    const kRep = typeof task.kRep === "number" ? task.kRep : 3;
    const maxSteps = typeof task.maxSteps === "number" ? Math.max(1, Math.floor(task.maxSteps)) : 60;

    const blocked = new Set(obstacles.map(([r, c]) => `${r},${c}`));
    const path: Cell[] = [start];
    let step = 0;

    const frameFor = (current: Cell, done: boolean): VisualFrame => {
        const pathSet = new Set(path.map(([r, c]) => `${r},${c}`));
        const entities: VisualEntity[] = [];
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                const key = `${r},${c}`;
                let state: EntityState = "unvisited";
                let label = "";
                if (blocked.has(key)) {
                    state = "error";
                    label = "#";
                } else if (r === goal[0] && c === goal[1]) {
                    state = "sorted";
                    label = "G";
                } else if (r === start[0] && c === start[1]) {
                    state = "pivot";
                    label = "S";
                } else if (pathSet.has(key)) {
                    state = "visited";
                }
                if (r === current[0] && c === current[1] && !done) state = "active";
                entities.push(cellEntity(r, c, state, label));
            }
        }
        const reached = current[0] === goal[0] && current[1] === goal[1];
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: done
                ? `Final: ${path.length} cell(s), ${reached ? "goal reached" : "stopped before the goal"}.`
                : `Step ${step}: at (${current[0]}, ${current[1]}), potential ${potential(current, goal, obstacles, rho, kAtt, kRep).toFixed(2)}.`,
            codeLineNumber: done ? 6 : 3,
            layout: "grid",
            meta: {
                rows,
                cols,
                start: [start[0], start[1]],
                goal: [goal[0], goal[1]],
                obstacles: obstacles.flatMap(([r, c]) => [r, c]),
                path: path.flatMap(([r, c]) => [r, c]),
                reached,
                steps: step,
            },
        };
    };

    if (blocked.has(`${start[0]},${start[1]}`) || blocked.has(`${goal[0]},${goal[1]}`)) {
        yield frameFor(start, true);
        return;
    }

    yield frameFor(start, false);
    step += 1;

    let current: Cell = start;
    while (step < maxSteps && !(current[0] === goal[0] && current[1] === goal[1])) {
        const here = potential(current, goal, obstacles, rho, kAtt, kRep);
        let next: Cell | null = null;
        let bestValue = here;
        for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
                if (dr === 0 && dc === 0) continue;
                const r = current[0] + dr;
                const c = current[1] + dc;
                if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
                if (blocked.has(`${r},${c}`)) continue;
                const value = potential([r, c], goal, obstacles, rho, kAtt, kRep);
                if (value < bestValue - 1e-9) {
                    bestValue = value;
                    next = [r, c];
                }
            }
        }
        if (next === null) break;
        current = next;
        path.push(current);
        yield frameFor(current, false);
        step += 1;
    }

    yield frameFor(current, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the goal as a valley and obstacles as hills. The robot always walks downhill: an attractive term grows with distance to the goal, and each obstacle adds a local bump that fades with distance. Taking the steepest downhill neighboring step repeatedly traces a path around the hills toward the valley.",
        invariants: [
            "The robot only ever occupies a free grid cell.",
            "The potential strictly decreases at every accepted step.",
            "Because the potential decreases, the robot can never revisit a cell or cycle.",
        ],
        correctness:
            "Each move is chosen from the eight neighboring free cells with strictly smaller potential, so the sequence cannot revisit a state and must terminate. When the goal has the globally lowest potential and the attractive field dominates near it, the only local minimum is the goal, so the walk ends there. If a local minimum appears between obstacles, the walk stops there and reports that the goal was not reached rather than wandering.",
        complexityRationale:
            "Each of the at most maxSteps moves checks eight neighbors and evaluates a potential that sums over the obstacles, giving O(maxSteps * obstacles) time. The grid occupancy set uses O(rows * cols) space.",
        uses: [
            "Reactive navigation for mobile robots in known workspaces",
            "Steering behaviors in video-game characters",
            "Motion planning baselines for comparison with global planners",
        ],
        references: [
            "Khatib, Real-Time Obstacle Avoidance for Manipulators and Mobile Robots, International Journal of Robotics Research, 1986",
            "Siegwart and Nourbakhsh, Introduction to Autonomous Mobile Robots, Chapter 5",
        ],
        workedExample:
            "On an 8 by 8 grid from (0,0) to (7,7) with a solid 2 by 2 obstacle at the center, the attractive pull points diagonally. Near the obstacle the repulsive bump raises the potential of the blocked diagonal cells, so the robot slides around the block and then resumes its diagonal descent to the goal.",
    },
    id: "artificial-potential-field",
    name: "Artificial Potential Field",
    category: "geometry",
    complexity: { time: "O(s * o)", space: "O(rows * cols)" },
    defaultInput: {
        rows: 8,
        cols: 8,
        start: [0, 0],
        goal: [7, 7],
        obstacles: [
            [3, 3],
            [3, 4],
            [4, 3],
            [4, 4],
        ],
        rho: 2.5,
        kAtt: 1,
        kRep: 3,
        maxSteps: 60,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "define attractive potential toward the goal",
        "define repulsive potential around each obstacle",
        "start at the initial cell",
        "while the goal is not reached",
        "move to the free neighbor with lowest potential",
        "stop if no neighbor lowers the potential",
        "done: report the descending path",
    ],
};

export default module;
