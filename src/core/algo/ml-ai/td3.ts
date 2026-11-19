/**
 * td3.ts - Twin Delayed DDPG Update (Toy Linear Critics)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TD3 fixes two failure modes of DDPG. It keeps two critics and backs up the
 * smaller of their targets, which reduces overestimation. It also updates the
 * actor and the target networks only every few steps, and adds clipped noise
 * to the target action to smooth the critic. This toy uses linear critics so
 * one full update, including the seeded smoothing noise, is exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * features) for two critic gradients and delayed actor steps
 *   Space: O(features) for online and target parameters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show both critic values, the clipped-noise target, and the actor.
 *   - The min-target bar is highlighted on every step.
 *   - Meta records both critics, both targets, the noise, and the actor.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Td3Input {
    state?: number;
    nextState?: number;
    reward?: number;
    gamma?: number;
    criticRate?: number;
    actorRate?: number;
    tau?: number;
    policyDelay?: number;
    noiseStd?: number;
    steps?: number;
    w1?: number[];
    w2?: number[];
    theta?: number;
    seed?: number;
}

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal draw from two uniform samples (Box-Muller). */
function gaussian(random: () => number): number {
    const u1 = Math.max(1e-12, random());
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const qValue = (w: number[], action: number, state: number) => (w[0] ?? 0) * action + (w[1] ?? 0) * state;
const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

function makeBars(values: number[], labels: string[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]}=${value.toFixed(3)}`,
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, series: labels[index] ?? "" },
    }));
}

/** The TD3 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Td3Input | null) ?? {};
    const state = typeof task.state === "number" ? task.state : 1;
    const nextState = typeof task.nextState === "number" ? task.nextState : 0.8;
    const reward = typeof task.reward === "number" ? task.reward : 1;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.99;
    const criticRate = typeof task.criticRate === "number" && task.criticRate > 0 ? task.criticRate : 0.1;
    const actorRate = typeof task.actorRate === "number" && task.actorRate > 0 ? task.actorRate : 0.1;
    const tau = typeof task.tau === "number" ? Math.min(1, Math.max(0, task.tau)) : 0.05;
    const policyDelay = typeof task.policyDelay === "number" ? Math.max(1, Math.floor(task.policyDelay)) : 2;
    const noiseStd = typeof task.noiseStd === "number" && task.noiseStd > 0 ? task.noiseStd : 0.2;
    const steps = typeof task.steps === "number" ? Math.max(0, Math.floor(task.steps)) : 8;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 11;
    const clip = 0.5;
    const random = mulberry32(seed);

    const w1 = Array.isArray(task.w1) && task.w1.length >= 2 ? [task.w1[0] ?? 0, task.w1[1] ?? 0] : [0.5, 0.2];
    const w2 = Array.isArray(task.w2) && task.w2.length >= 2 ? [task.w2[0] ?? 0, task.w2[1] ?? 0] : [0.4, 0.3];
    const w1Target = [...w1];
    const w2Target = [...w2];
    let theta = typeof task.theta === "number" ? task.theta : 0.3;
    let thetaTarget = theta;

    const labels = ["Q1", "Q2", "minTarget", "noise", "actor"];
    const snapshot = (active: number, q1: number, q2: number, noise: number, y: number) =>
        makeBars([q1, q2, y, noise, theta * state], labels, active);

    let step = 0;
    yield {
        stepNumber: step,
        entities: snapshot(-1, qValue(w1, theta * state, state), qValue(w2, theta * state, state), 0, 0),
        edges: [],
        description: `TD3 setup with ${steps} step(s), two critics, policy delay ${policyDelay}, and clipped target noise.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, w1: [...w1], w2: [...w2], w1Target: [...w1Target], w2Target: [...w2Target], theta, thetaTarget, noise: 0, q1: 0, q2: 0, y: 0 },
    };
    step += 1;

    for (let iteration = 1; iteration <= steps; iteration += 1) {
        const action = theta * state;
        const q1 = qValue(w1, action, state);
        const q2 = qValue(w2, action, state);
        const noise = clamp(gaussian(random) * noiseStd, clip);
        const targetAction = thetaTarget * nextState + noise;
        const y = reward + gamma * Math.min(
            qValue(w1Target, targetAction, nextState),
            qValue(w2Target, targetAction, nextState),
        );

        w1[0] = (w1[0] ?? 0) + criticRate * (y - q1) * action;
        w1[1] = (w1[1] ?? 0) + criticRate * (y - q1) * state;
        w2[0] = (w2[0] ?? 0) + criticRate * (y - q2) * action;
        w2[1] = (w2[1] ?? 0) + criticRate * (y - q2) * state;

        let delayed = false;
        if (iteration % policyDelay === 0) {
            theta += actorRate * (w1[0] ?? 0) * state;
            w1Target[0] = tau * (w1[0] ?? 0) + (1 - tau) * (w1Target[0] ?? 0);
            w1Target[1] = tau * (w1[1] ?? 0) + (1 - tau) * (w1Target[1] ?? 0);
            w2Target[0] = tau * (w2[0] ?? 0) + (1 - tau) * (w2Target[0] ?? 0);
            w2Target[1] = tau * (w2[1] ?? 0) + (1 - tau) * (w2Target[1] ?? 0);
            thetaTarget = tau * theta + (1 - tau) * thetaTarget;
            delayed = true;
        }

        yield {
            stepNumber: step,
            entities: snapshot(2, q1, q2, noise, y),
            edges: [],
            description: `Step ${iteration}: Q1 ${q1.toFixed(3)}, Q2 ${q2.toFixed(3)}, min target ${y.toFixed(3)}, noise ${noise.toFixed(3)}${delayed ? "; delayed actor and target update applied" : ""}.`,
            codeLineNumber: delayed ? 6 : 5,
            layout: "array",
            meta: { step: iteration, w1: [...w1], w2: [...w2], w1Target: [...w1Target], w2Target: [...w2Target], theta, thetaTarget, noise, q1, q2, y, delayed },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: snapshot(4, qValue(w1, theta * state, state), qValue(w2, theta * state, state), 0, 0),
        edges: [],
        description: `Final actor parameter ${theta.toFixed(4)} with twin critics Q1 ${(w1[0] ?? 0).toFixed(3)} and Q2 ${(w2[0] ?? 0).toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: steps, w1: [...w1], w2: [...w2], w1Target: [...w1Target], w2Target: [...w2Target], theta, thetaTarget, noise: 0, q1: qValue(w1, theta * state, state), q2: qValue(w2, theta * state, state), y: 0 },
    };
}

/** The TD3 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "TD3 addresses two ways DDPG overestimates action values. Two independent critics give two estimates, and using the smaller one as the learning target keeps optimism from compounding. The actor and target networks are updated less often than the critics, so the target moves more slowly, and clipped noise added to the target action smooths out sharp peaks the critic might exploit.",
        invariants: [
            "The learning target is reward plus gamma times the minimum of the two target critics.",
            "Clipped noise is added only to the target action, never to the action used by the actor.",
            "Actor and target parameters change only on steps divisible by the policy delay.",
        ],
        correctness:
            "Taking the minimum of two critic estimates gives a lower bound in expectation on the true value when the critics' errors are not perfectly correlated, so the backup cannot systematically inflate Q. Delayed policy updates let the critics become more accurate before the actor exploits them, and smoothing the target action averages the critic over a neighborhood, which reduces variance and removes the incentive to favor narrow spikes. Together these changes preserve the deterministic policy gradient direction while lowering its bias.",
        complexityRationale:
            "Each step evaluates two linear critics and performs two constant-time critic updates, so a step is O(features); delayed actor and target updates happen on a fraction of steps and do not change the order. Parameters use O(features) space.",
        uses: [
            "Continuous control where value overestimation hurts performance",
            "Robotics and locomotion benchmarks with deterministic policies",
            "A baseline for follow-up maximum-entropy methods",
        ],
        references: [
            "Fujimoto, van Hoof, and Meger, Addressing Function Approximation Error in Actor-Critic Methods, 2018",
            "Lillicrap et al., Continuous Control with Deep Reinforcement Learning, 2015",
        ],
        workedExample:
            "With state 1, reward 1, gamma 0.99, two critics near (0.5, 0.2) and (0.4, 0.3), and theta 0.3, a step draws a Gaussian noise sample, clips it to within 0.5, and evaluates both target critics at thetaTarget times the next state plus that noise. The smaller value forms the target, both critics step toward it, and only every second step does the actor parameter grow and the targets drift toward the online weights.",
    },
    id: "td3",
    name: "Twin Delayed Deep Deterministic Policy Gradient",
    category: "ml-ai",
    complexity: { time: "O(steps * features)", space: "O(features)" },
    defaultInput: { state: 1, nextState: 0.8, reward: 1, gamma: 0.99, criticRate: 0.1, actorRate: 0.1, tau: 0.05, policyDelay: 2, noiseStd: 0.2, steps: 8, w1: [0.5, 0.2], w2: [0.4, 0.3], theta: 0.3, seed: 11 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize twin online critics, their targets, and the actor",
        "for each replayed update step",
        "draw clipped Gaussian noise for target policy smoothing",
        "set target to reward plus gamma times the min of both target critics",
        "step both critics toward the target by their TD errors",
        "when the step is a multiple of the policy delay update the actor and targets",
        "move each target parameter toward its online parameter by tau",
        "done: report the actor parameter and both critic weights",
    ],
};

export default module;
