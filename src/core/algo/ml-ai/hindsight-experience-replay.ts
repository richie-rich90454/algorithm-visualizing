/**
 * hindsight-experience-replay.ts - Hindsight Experience Replay Goal Relabeling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hindsight experience replay lets an agent learn from a failed episode by
 * pretending a state it did reach was the goal all along. For each transition
 * the goal is replaced with a state achieved later in the episode, and the
 * reward is recomputed against that new goal. A trajectory that missed its
 * intended target still teaches the agent how to reach the places it visited.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(transitions * futureGoals) relabeled transitions
 *   Space: O(transitions * futureGoals) for the augmented replay buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row is a relabeled transition: state, action, achieved, goal, reward.
 *   - Rows are added one at a time; the newest row is highlighted.
 *   - Meta records the relabeled rows and the goal each row was assigned.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HerInput {
    states?: number[];
    actions?: number[];
    kFuture?: number;
    rewardSuccess?: number;
    rewardFail?: number;
}

type Row = [number, number, number, number, number];
const rewardFor = (achieved: number, goal: number, success: number, fail: number) => (achieved === goal ? success : fail);

function makeCells(rows: Row[], activeRow: number, processed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        for (let c = 0; c < 5; c += 1) {
            const value = rows[r]![c] ?? 0;
            const state: EntityState = r === activeRow ? "active" : r < processed ? "sorted" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, index: r * 5 + c, totalRows: rows.length },
            });
        }
    }
    return entities;
}

/** The hindsight experience replay generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HerInput | null) ?? {};
    const states = Array.isArray(task.states) && task.states.length >= 2 ? [...task.states] : [0, 1, 2, 3];
    const transitions = states.length - 1;
    const actions = Array.isArray(task.actions) && task.actions.length >= transitions
        ? task.actions.slice(0, transitions)
        : Array.from({ length: transitions }, () => 0);
    const kFuture = typeof task.kFuture === "number" ? Math.max(1, Math.floor(task.kFuture)) : 2;
    const success = typeof task.rewardSuccess === "number" ? task.rewardSuccess : 1;
    const fail = typeof task.rewardFail === "number" ? task.rewardFail : 0;

    const finalGoal = states[transitions] ?? 0;
    const rows: Row[] = [];
    for (let i = 0; i < transitions; i += 1) {
        const achieved = states[i + 1] ?? 0;
        const start = Math.max(i + 1, transitions - kFuture + 1);
        for (let j = start; j <= transitions; j += 1) {
            const goal = states[j] ?? 0;
            rows.push([states[i] ?? 0, actions[i] ?? 0, achieved, goal, rewardFor(achieved, goal, success, fail)]);
        }
    }
    const totalRows = rows.length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, 0),
        edges: [],
        description: `Hindsight replay relabeling a ${transitions}-step episode with up to ${kFuture} future goals per transition.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: totalRows, cols: 5, relabeled: rows.flat(), count: 0, totalRows },
    };
    step += 1;

    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeCells(rows, index, index + 1),
            edges: [],
            description: `Relabeled transition ${index + 1}: goal ${row[3]}, achieved ${row[2]}, new reward ${row[4]}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { rows: totalRows, cols: 5, relabeled: rows.flat(), count: index + 1, totalRows, goal: row[3], achieved: row[2], reward: row[4] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, totalRows),
        edges: [],
        description: `Built ${totalRows} replay entries from a ${transitions}-step episode by relabeling goals in hindsight.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: totalRows, cols: 5, relabeled: rows.flat(), count: totalRows, totalRows, finalGoal },
    };
}

/** The hindsight experience replay module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Hindsight replay turns a miss into a lesson. If a robot was told to reach one shelf but stopped at another, the episode still contains a valid demonstration of how to reach the shelf it did get to. HER relabels each transition with a goal that was actually achieved later and recomputes the reward. The same experience therefore teaches many goals without new environment interaction.",
        invariants: [
            "Every relabeled goal is a state actually visited later in the episode.",
            "The reward is one exactly when the achieved state equals the relabeled goal.",
            "The original transition and each future-goal relabel share the same state and action.",
        ],
        correctness:
            "Relabeling changes the goal of a transition but leaves the dynamics true: from state s taking action a the agent really did reach the achieved state, so the tuple (s, a, achieved, new goal) is a valid experience for the new goal. Recomputing the reward with the indicator of achieved equals goal gives the correct sparse reward for that goal. Adding these truthful tuples to the replay buffer preserves the validity of every Q-learning or policy update that consumes them.",
        complexityRationale:
            "Each of the transitions produces at most kFuture relabels, so the time and the number of stored rows are O(transitions * futureGoals). The augmented buffer holds one row per relabel using O(transitions * futureGoals) space.",
        uses: [
            "Sparse-reward goal-conditioned reinforcement learning",
            "Robotic manipulation with many possible target states",
            "Replay buffers that reuse a single trajectory for many goals",
        ],
        references: [
            "Andrychowicz et al., Hindsight Experience Replay, 2017",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 11",
        ],
        workedExample:
            "In an episode visiting states 0, 1, 2, 3 with intended goal 3, the transition from 0 to 1 originally earns reward zero. HER also relabels it with the future goal 1, for which the achieved state equals the goal, so the reward becomes one and the agent learns a successful step even though the original goal was missed.",
    },
    id: "hindsight-experience-replay",
    name: "Hindsight Experience Replay",
    category: "ml-ai",
    complexity: { time: "O(transitions * futureGoals)", space: "O(transitions * futureGoals)" },
    defaultInput: { states: [0, 1, 2, 3], actions: [0, 1, 0], kFuture: 2, rewardSuccess: 1, rewardFail: 0 },
    visualType: "grid",
    run,
    pseudocode: [
        "record every state visited in the episode",
        "for each transition in the episode",
        "keep the original transition with the intended goal",
        "choose goals from states achieved later in the episode",
        "relabel the transition goal to each chosen future state",
        "recompute reward as success when achieved equals goal",
        "store every relabeled transition in the replay buffer",
        "done: report the augmented replay entries",
    ],
};

export default module;
