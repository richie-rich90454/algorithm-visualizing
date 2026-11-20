/**
 * trajectory-transformer.ts - Trajectory Transformer Tokenized Planning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Trajectory Transformer discretizes continuous states, actions, and
 * rewards into token bins, learns a next-token transition model from a dataset
 * of trajectories, then plans by beam search: from the start state it expands
 * every candidate by every action, scores the partial plans by cumulative
 * reward, and keeps only the best beam-width of them at each horizon step.
 * With a wide enough beam the search reproduces an exhaustive action-sequence
 * enumeration; a narrow beam trades completeness for a bounded amount of work.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(H * B * A) for horizon H, beam width B, and A distinct actions
 *   Space: O(B * H + |transitions|)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Transition rules and beam candidates are drawn as grid cells.
 *   - The best candidate of each step is GREEN; the rest are ACTIVE.
 *   - The final frame lists the reward-maximizing action plan.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Step {
    state: number;
    action: number;
    reward: number;
}

interface Range {
    min: number;
    max: number;
}

interface Transition {
    stateToken: number;
    rewardToken: number;
    count: number;
}

interface Model {
    bins: number;
    stateRange: Range;
    actionRange: Range;
    rewardRange: Range;
    transitions: Map<string, Transition>;
    actionTokens: number[];
}

interface Candidate {
    stateToken: number;
    actions: number[];
    totalReward: number;
}

function rangeOf(values: number[]): Range {
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
        if (value < min) {
            min = value;
        }
        if (value > max) {
            max = value;
        }
    }
    if (!Number.isFinite(min)) {
        return { min: 0, max: 1 };
    }
    if (min === max) {
        max = min + 1;
    }
    return { min, max };
}

function tokenOf(value: number, range: Range, bins: number): number {
    const span = range.max - range.min;
    const scaled = Math.round(((value - range.min) / span) * (bins - 1));
    return Math.max(0, Math.min(bins - 1, scaled));
}

function valueOf(token: number, range: Range, bins: number): number {
    return range.min + (token / (bins - 1)) * (range.max - range.min);
}

function buildModel(trajectories: Step[][], bins: number): Model {
    const states: number[] = [];
    const actions: number[] = [];
    const rewards: number[] = [];
    for (const trajectory of trajectories) {
        for (const step of trajectory) {
            states.push(step.state);
            actions.push(step.action);
            rewards.push(step.reward);
        }
    }
    const stateRange = rangeOf(states);
    const actionRange = rangeOf(actions);
    const rewardRange = rangeOf(rewards);
    const transitions = new Map<string, Transition>();
    const actionTokens = new Set<number>();

    for (const trajectory of trajectories) {
        for (let i = 0; i < trajectory.length - 1; i += 1) {
            const current = trajectory[i];
            const next = trajectory[i + 1];
            if (!current || !next) {
                continue;
            }
            const stateToken = tokenOf(current.state, stateRange, bins);
            const actionToken = tokenOf(current.action, actionRange, bins);
            const nextToken = tokenOf(next.state, stateRange, bins);
            const rewardToken = tokenOf(current.reward, rewardRange, bins);
            actionTokens.add(actionToken);
            const key = `${stateToken},${actionToken}`;
            const existing = transitions.get(key);
            if (existing) {
                if (nextToken !== existing.stateToken || rewardToken !== existing.rewardToken) {
                    existing.count += 1;
                } else {
                    existing.count += 1;
                }
            } else {
                transitions.set(key, { stateToken: nextToken, rewardToken, count: 1 });
            }
        }
    }

    return {
        bins,
        stateRange,
        actionRange,
        rewardRange,
        transitions,
        actionTokens: [...actionTokens].sort((a, b) => a - b),
    };
}

function cell(
    id: string,
    label: string,
    row: number,
    col: number,
    state: EntityState,
    metadata: Record<string, number | string | boolean>,
): VisualEntity {
    return {
        id,
        type: "cell",
        label,
        value: label,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col, ...metadata },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        trajectories?: Step[][];
        startState?: number;
        horizon?: number;
        beamWidth?: number;
        bins?: number;
    } | null) ?? {};
    const trajectories: Step[][] = Array.isArray(task.trajectories) ? task.trajectories : [];
    const bins = Math.max(2, Math.min(64, Math.floor(task.bins ?? 4)));
    const horizon = Math.max(0, Math.min(12, Math.floor(task.horizon ?? 4)));
    const beamWidth = Math.max(1, Math.min(64, Math.floor(task.beamWidth ?? 4)));
    const startState = task.startState ?? 0;

    if (trajectories.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No trajectories supplied, so there is nothing to tokenize or plan.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 1, cols: 1, bestReward: 0, plan: [], reason: "empty dataset" },
        };
        return;
    }

    const model = buildModel(trajectories, bins);
    const startToken = tokenOf(startState, model.stateRange, bins);

    const setupCells: VisualEntity[] = [];
    const keys = [...model.transitions.keys()].sort();
    keys.forEach((key, index) => {
        const transition = model.transitions.get(key);
        if (!transition) {
            return;
        }
        const [s, a] = key.split(",");
        setupCells.push(
            cell(
                `rule-${index}`,
                `s${s} a${a}->s${transition.stateToken} r${transition.rewardToken}`,
                index,
                0,
                "idle",
                {
                    stateToken: Number(s),
                    actionToken: Number(a),
                    nextToken: transition.stateToken,
                    rewardToken: transition.rewardToken,
                },
            ),
        );
    });
    yield {
        stepNumber: 0,
        entities: setupCells,
        edges: [],
        description: `Discretized the data into ${bins} token bins and learned ${keys.length} transition rules.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {
            rows: Math.max(1, setupCells.length),
            cols: 1,
            phase: "model",
            bins,
            transitionCount: keys.length,
            actionTokens: model.actionTokens,
            stateRange: [model.stateRange.min, model.stateRange.max],
            rewardRange: [model.rewardRange.min, model.rewardRange.max],
        },
    };

    let beam: Candidate[] = [{ stateToken: startToken, actions: [], totalReward: 0 }];
    let step = 1;
    let best: Candidate = beam[0] ?? { stateToken: startToken, actions: [], totalReward: 0 };

    for (let tick = 0; tick < horizon; tick += 1) {
        const expansions: Candidate[] = [];
        for (const candidate of beam) {
            const keyPrefix = `${candidate.stateToken},`;
            for (const actionToken of model.actionTokens) {
                const transition = model.transitions.get(`${keyPrefix}${actionToken}`);
                if (!transition) {
                    continue;
                }
                const reward = valueOf(transition.rewardToken, model.rewardRange, bins);
                expansions.push({
                    stateToken: transition.stateToken,
                    actions: [...candidate.actions, actionToken],
                    totalReward: candidate.totalReward + reward,
                });
            }
        }
        if (expansions.length === 0) {
            break;
        }
        expansions.sort(
            (lhs, rhs) =>
                rhs.totalReward - lhs.totalReward ||
                lhs.actions.join(",").localeCompare(rhs.actions.join(",")),
        );
        beam = expansions.slice(0, beamWidth);
        best = beam[0] ?? best;

        const beamCells = beam.map((candidate, index) =>
            cell(
                `beam-${tick}-${index}`,
                `c${index}: s${candidate.stateToken} R${candidate.totalReward.toFixed(2)}`,
                0,
                index,
                index === 0 ? "sorted" : "active",
                {
                    step: tick + 1,
                    candidate: index,
                    stateToken: candidate.stateToken,
                    reward: candidate.totalReward,
                },
            ),
        );
        yield {
            stepNumber: step,
            entities: beamCells,
            edges: [],
            description: `Planning step ${tick + 1}: expanded ${expansions.length} candidates and kept the best ${beam.length}.`,
            codeLineNumber: tick === horizon - 1 ? 7 : 5,
            layout: "grid",
            meta: {
                rows: 1,
                cols: Math.max(1, beamCells.length),
                phase: "plan",
                step: tick + 1,
                beam: beam.map((candidate) => ({
                    stateToken: candidate.stateToken,
                    actions: candidate.actions,
                    totalReward: candidate.totalReward,
                })),
                bestReward: best.totalReward,
            },
        };
        step += 1;
    }

    const planCells = best.actions.map((actionToken, index) =>
        cell(
            `plan-${index}`,
            `a${actionToken}`,
            0,
            index,
            "sorted",
            { index, actionToken },
        ),
    );
    yield {
        stepNumber: step,
        entities: planCells,
        edges: [],
        description: `Beam search selected a ${best.actions.length}-step plan with cumulative reward ${best.totalReward.toFixed(2)}.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            rows: 1,
            cols: Math.max(1, planCells.length),
            phase: "result",
            plan: best.actions,
            planValues: best.actions.map((token) => valueOf(token, model.actionRange, bins)),
            bestReward: best.totalReward,
            finalStateToken: best.stateToken,
            beamWidth,
            horizon,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Turn raw trajectory numbers into discrete tokens, learn which token tends to follow each state-action pair, and then plan by trying actions ahead of time while remembering only the most promising partial plans. Keeping a beam of plans lets the model look further ahead than a single greedy choice without enumerating every possible action sequence.",
        invariants: [
            "Every token maps back to the exact value range bin it came from.",
            "Each beam entry records a state token, an action sequence, and the summed reward so far.",
            "Expanding a candidate only uses transition rules actually seen in the training data.",
            "Widening the beam can never lower the best cumulative reward found.",
        ],
        correctness:
            "Because the learned model is first-order (the next state and reward depend only on the current state token and action token), a partial plan is fully summarized by its current state and cumulative reward. Beam search therefore keeps the highest-reward prefix for each reachable state; when the beam is at least as wide as the number of reachable states it retains the optimal prefix at every step, so the returned plan attains the maximum cumulative reward over all action sequences of that horizon.",
        complexityRationale:
            "Building the transition table scans every trajectory step once. Each of the H planning steps expands at most B beam entries over A actions and sorts O(B * A) candidates, giving O(H * B * A) planning time and O(B * H + transitions) space.",
        uses: [
            "Offline reinforcement learning from fixed datasets",
            "Sequence-model approaches to robot motion planning",
            "Reward-aware decoding in decision-making transformers",
        ],
        references: [
            "Chen et al., Decision Transformer: Reinforcement Learning via Sequence Modeling, 2021",
            "Janner et al., Offline Reinforcement Learning as One Big Sequence Modeling Problem, 2021",
        ],
        workedExample:
            "With transitions (state 0, action 0) to state 1 for reward 1, (1, 1) to state 1 for reward 2, (1, 0) to state 0 for reward 3, and (0, 1) to state 0 for reward 0, a four-step plan from state 0 can alternate through state 1 to collect reward 3 repeatedly, reaching cumulative reward 8.",
    },
    id: "trajectory-transformer",
    name: "Trajectory Transformer",
    category: "ml-ai",
    complexity: { time: "O(H * B * A)", space: "O(B * H + |T|)" },
    defaultInput: {
        trajectories: [
            [
                { state: 0, action: 0, reward: 1 },
                { state: 1, action: 1, reward: 2 },
                { state: 1, action: 0, reward: 3 },
            ],
            [
                { state: 0, action: 1, reward: 0 },
                { state: 0, action: 0, reward: 1 },
                { state: 1, action: 1, reward: 2 },
            ],
            [
                { state: 1, action: 0, reward: 3 },
                { state: 0, action: 1, reward: 0 },
                { state: 0, action: 0, reward: 1 },
            ],
            [
                { state: 1, action: 1, reward: 2 },
                { state: 1, action: 1, reward: 2 },
                { state: 1, action: 1, reward: 2 },
            ],
        ],
        startState: 0,
        horizon: 4,
        beamWidth: 4,
        bins: 4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "discretize each trajectory value into a token bin",
        "count state-action-next-reward transitions from the data",
        "pick the most likely successor and reward for each pair",
        "place the start state token in the initial beam",
        "for each planning step expand every beam entry by every action",
        "score each candidate by its cumulative reward",
        "keep only the best beam-width candidates",
        "remember the highest scoring candidate",
        "return the plan with the largest cumulative reward",
    ],
};

export default module;
