/**
 * best-response-dynamics.ts - Best Response Dynamics
 *
 * Two players repeatedly alternate moves in a normal-form game. On her turn a
 * player switches to an action that maximizes her payoff given the opponent's
 * current pure action, keeping her action on a tie. The process stops when the
 * profile is a pure Nash equilibrium, when a profile repeats (a cycle), or at
 * a step budget. It differs from fictitious play, which best-responds to the
 * opponent's empirical frequency rather than to her current action.
 *
 * Time O(t * a^2) for t steps and a actions; space O(t) for the path.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Payoffs = [[number, number], [number, number]];

interface Step {
    turn: number;
    mover: number;
    from: [number, number];
    to: [number, number];
}

function bestIndexFirst(row: [number, number], current: number): number {
    const other = 1 - current;
    if ((row[other] ?? 0) > (row[current] ?? 0)) return other;
    return current;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { payoffsA?: Payoffs; payoffsB?: Payoffs; maxSteps?: number } | null) ?? {};
    const A: Payoffs = task.payoffsA ?? [[3, 0], [5, 1]];
    const B: Payoffs = task.payoffsB ?? [[3, 5], [0, 1]];
    const maxSteps = Math.max(2, Math.min(16, typeof task.maxSteps === "number" ? Math.floor(task.maxSteps) : 12));

    let a = 0;
    let b = 0;
    const path: Array<[number, number]> = [[a, b]];
    const visited = new Set<string>(["0,0"]);
    const steps: Step[] = [];
    let converged = false;
    let cycle = false;

    for (let turn = 0; turn < maxSteps; turn += 1) {
        const bestA = bestIndexFirst([A[0]?.[b] ?? 0, A[1]?.[b] ?? 0] as [number, number], a);
        const bestB = bestIndexFirst([B[a]?.[0] ?? 0, B[a]?.[1] ?? 0] as [number, number], b);
        if (bestA === a && bestB === b) {
            converged = true;
            break;
        }
        const mover = turn % 2 === 0 ? 0 : 1;
        const from: [number, number] = [a, b];
        if (mover === 0) a = bestA;
        else b = bestB;
        const to: [number, number] = [a, b];
        steps.push({ turn: turn + 1, mover, from, to });
        path.push(to);
        const key = `${a},${b}`;
        if (visited.has(key)) {
            cycle = true;
            break;
        }
        visited.add(key);
    }

    const bestA = bestIndexFirst([A[0]?.[b] ?? 0, A[1]?.[b] ?? 0] as [number, number], a);
    const bestB = bestIndexFirst([B[a]?.[0] ?? 0, B[a]?.[1] ?? 0] as [number, number], b);
    const equilibrium = bestA === a && bestB === b;

    const cells = (profile: [number, number], highlight: [number, number] | null): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let x = 0; x < 2; x += 1) {
            for (let y = 0; y < 2; y += 1) {
                out.push({
                    id: `A-${x}-${y}`,
                    type: "cell",
                    label: `A:${A[x]?.[y] ?? 0}`,
                    value: A[x]?.[y] ?? 0,
                    state: (highlight && highlight[0] === x && highlight[1] === y ? "comparing" : profile[0] === x && profile[1] === y ? "sorted" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: x, col: y, player: "A" },
                });
                out.push({
                    id: `B-${x}-${y}`,
                    type: "cell",
                    label: `B:${B[x]?.[y] ?? 0}`,
                    value: B[x]?.[y] ?? 0,
                    state: (highlight && highlight[0] === x && highlight[1] === y ? "comparing" : profile[0] === x && profile[1] === y ? "sorted" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row: x + 2, col: y, player: "B" },
                });
            }
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells([0, 0], null),
        edges: [],
        description: `Best-response dynamics on a 2 by 2 game starting at profile (0,0) for at most ${maxSteps} steps.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: 2, payA: A.flat(), payB: B.flat(), profile: [0, 0], path: [0, 0], maxSteps },
    };
    step += 1;

    for (const s of steps) {
        yield {
            stepNumber: step,
            entities: cells(s.to, s.from),
            edges: [],
            description: `Turn ${s.turn}: player ${s.mover} best-responds and moves the profile from (${s.from.join(",")}) to (${s.to.join(",")}).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 4, cols: 2, turn: s.turn, mover: s.mover, from: s.from, to: s.to,
                profile: s.to, path: path.flat(), converged, cycle,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells([a, b], null),
        edges: [],
        description: `Final profile (${a},${b}) is ${equilibrium ? "a pure Nash equilibrium" : cycle ? "on a repeating cycle" : "not yet stable"}; the run took ${steps.length} moves.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 4, cols: 2, profile: [a, b], equilibrium, converged, cycle,
            path: path.flat(), moves: steps.length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine two players taking turns, each switching to the move that gives the highest payoff against whatever the other player is currently doing. If the process settles on a pair of actions where neither wants to change, it has found a pure Nash equilibrium. If it revisits a previous pair instead, the dynamics have entered a cycle and no stable outcome was reached along that path.",
        invariants: [
            "On her turn a player chooses an action that maximizes her payoff against the opponent's current action.",
            "Only one player changes action per step.",
            "A repeated profile means the future play will repeat exactly because the rules are deterministic.",
        ],
        correctness:
            "The best-response test chooses action 1 only when it strictly beats the current action, so the selected action is an exact maximizer of a two-element payoff row. The profile is declared an equilibrium only when both players' chosen actions equal their current actions, which is precisely the definition of a pure Nash equilibrium. Because the state space is finite and the transition is deterministic, any repeated profile seals a cycle, so the stopping conditions are sound and the run always terminates within the step budget.",
        complexityRationale:
            "Each step evaluates at most two payoffs per player and stores one profile, so t steps take O(t * a^2) time in general and O(t) space for the path and visited set; for two actions this is O(t).",
        uses: [
            "Modeling myopic learning in repeated normal-form games",
            "Finding pure Nash equilibria in small games",
            "Demonstrating that learning dynamics need not converge",
        ],
        references: [
            "Fudenberg and Levine, The Theory of Learning in Games (1998)",
            "Nash, Non-cooperative games (1951)",
        ],
        workedExample:
            "In the prisoner's dilemma with payoffs where defecting dominates cooperating, the pair starts by both cooperating. Player A defects first, then player B defects, reaching mutual defection where neither player gains by switching alone, so the dynamics converge to the unique pure Nash equilibrium.",
    },
    id: "best-response-dynamics",
    name: "Best Response Dynamics",
    category: "game",
    complexity: { time: "O(t * a^2)", space: "O(t)" },
    defaultInput: {
        payoffsA: [[3, 0], [5, 1]],
        payoffsB: [[3, 5], [0, 1]],
        maxSteps: 12,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start both players at their first actions",
        "record the current profile as visited",
        "let the next player find a payoff-maximizing action",
        "switch that player to the chosen action",
        "stop if neither player wants to change",
        "stop if the new profile was seen before",
        "report the equilibrium, cycle, and path",
    ],
};

export default module;
