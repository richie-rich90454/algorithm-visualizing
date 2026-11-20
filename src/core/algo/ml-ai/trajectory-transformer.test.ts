/**
 * trajectory-transformer.test.ts - Brute-force planning check, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./trajectory-transformer";
import type { VisualFrame } from "@/types";

interface Step {
    state: number;
    action: number;
    reward: number;
}

/** Independent reference: build the raw transition map and enumerate all plans. */
function bruteForceBest(
    trajectories: Step[][],
    startState: number,
    horizon: number,
): { reward: number; plan: number[] } {
    const transitions = new Map<string, { next: number; reward: number }>();
    const actions = new Set<number>();
    for (const trajectory of trajectories) {
        for (let i = 0; i < trajectory.length - 1; i += 1) {
            const current = trajectory[i];
            const next = trajectory[i + 1];
            if (!current || !next) {
                continue;
            }
            actions.add(current.action);
            transitions.set(`${current.state},${current.action}`, {
                next: next.state,
                reward: current.reward,
            });
        }
    }
    const actionList = [...actions].sort((a, b) => a - b);
    let best = -Infinity;
    let bestPlan: number[] = [];

    const walk = (state: number, depth: number, reward: number, plan: number[]): void => {
        if (depth === horizon) {
            if (reward > best) {
                best = reward;
                bestPlan = plan.slice();
            }
            return;
        }
        for (const action of actionList) {
            const transition = transitions.get(`${state},${action}`);
            if (!transition) {
                continue;
            }
            walk(transition.next, depth + 1, reward + transition.reward, [...plan, action]);
        }
    };
    walk(startState, 0, 0, []);
    return { reward: best, plan: bestPlan };
}

/** Check a frame sequence is well formed and that the generator terminates. */
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBeDefined();
        expect(frame.meta["cols"]).toBeDefined();
    });
}

describe("Trajectory Transformer", () => {
    it("finds the brute-force optimal reward-maximizing plan", () => {
        const input = mod.defaultInput as {
            trajectories: Step[][];
            startState: number;
            horizon: number;
            beamWidth: number;
            bins: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);

        const expected = bruteForceBest(input.trajectories, input.startState, input.horizon);
        expect(expected.reward).toBeGreaterThan(-Infinity);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["bestReward"]).toBe(expected.reward);

        const plan = finalMeta?.["plan"] as number[];
        expect(Array.isArray(plan)).toBe(true);
        expect(plan.length).toBe(input.horizon);

        const transitions = new Map<string, { next: number; reward: number }>();
        for (const trajectory of input.trajectories) {
            for (let i = 0; i < trajectory.length - 1; i += 1) {
                const current = trajectory[i];
                const next = trajectory[i + 1];
                if (current && next) {
                    transitions.set(`${current.state},${current.action}`, {
                        next: next.state,
                        reward: current.reward,
                    });
                }
            }
        }
        let state = input.startState;
        let reward = 0;
        for (const action of plan) {
            const transition = transitions.get(`${state},${action}`);
            expect(transition).toBeDefined();
            if (transition) {
                state = transition.next;
                reward += transition.reward;
            }
        }
        expect(reward).toBe(expected.reward);
    });

    it("never scores worse with a wider beam", () => {
        const input = mod.defaultInput as {
            trajectories: Step[][];
            startState: number;
            horizon: number;
            bins: number;
        };
        const narrow = [...mod.run({ ...input, beamWidth: 1 })];
        const wide = [...mod.run({ ...input, beamWidth: 32 })];
        const narrowReward = Number(narrow[narrow.length - 1]?.meta["bestReward"]);
        const wideReward = Number(wide[wide.length - 1]?.meta["bestReward"]);
        expect(wideReward).toBeGreaterThanOrEqual(narrowReward);
    });

    it("handles an empty dataset without crashing", () => {
        const frames = [...mod.run({ trajectories: [], horizon: 3 })];
        expect(frames.length).toBe(1);
        expect(frames[0]?.meta["bestReward"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
