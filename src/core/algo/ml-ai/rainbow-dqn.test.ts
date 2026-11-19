/** rainbow-dqn.test.ts - Double Q selection, C51 projection, cross-entropy, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./rainbow-dqn";
import type { VisualFrame } from "@/types";

interface Input {
    atoms: number[];
    reward: number;
    gamma: number;
    nextProbsByAction: number[][];
    onlineNextProbsByAction: number[][];
    predProbs: number[];
    done: boolean;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
    });
}

function expectedQ(probs: number[], atoms: number[]): number {
    return probs.reduce((s, p, j) => s + p * atoms[j]!, 0);
}

function reference(input: Input) {
    const atoms = input.atoms;
    const N = atoms.length;
    const qOnline = input.onlineNextProbsByAction.map((row) => expectedQ(row, atoms));
    let action = 0;
    for (let a = 1; a < qOnline.length; a += 1) {
        if (qOnline[a]! > qOnline[action]!) {
            action = a;
        }
    }
    const target = input.done
        ? atoms.map((_, j) => (j === 0 ? 1 : 0))
        : input.nextProbsByAction[action]!;
    const zMin = atoms[0]!;
    const step = N > 1 ? (atoms[N - 1]! - zMin) / (N - 1) : 1;
    const projected = Array(N).fill(0) as number[];
    for (let j = 0; j < N; j += 1) {
        const tz = input.done ? input.reward : input.reward + input.gamma * atoms[j]!;
        const raw = step !== 0 ? (tz - zMin) / step : 0;
        const b = Math.min(N - 1, Math.max(0, raw));
        const lo = Math.floor(b);
        const hi = Math.ceil(b);
        const p = target[j]!;
        if (lo === hi) {
            projected[lo] += p;
        } else {
            projected[lo] += p * (hi - b);
            projected[hi] += p * (b - lo);
        }
    }
    const loss = -projected.reduce((s, p, j) => s + p * Math.log(input.predProbs[j]! + 1e-8), 0);
    return { qOnline, action, projected, loss };
}

describe("Rainbow DQN", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent Double Q and C51 projection reference", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input);
        expect(meta["selectedAction"]).toBe(expected.action);
        (meta["qOnline"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.qOnline[i]!, 8));
        (meta["projected"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.projected[i]!, 8));
        expect(Number(meta["loss"])).toBeCloseTo(expected.loss, 8);
    });

    it("projected distribution is nonnegative and conserves total probability", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const projected = meta["projected"] as number[];
        projected.forEach((p) => expect(p).toBeGreaterThanOrEqual(-1e-12));
        const total = projected.reduce((s, p) => s + p, 0);
        const targetTotal = (meta["targetDist"] as number[]).reduce((s, p) => s + p, 0);
        expect(total).toBeCloseTo(targetTotal, 8);
        expect(total).toBeCloseTo(1, 8);
    });

    it("a terminal reward collapses the target distribution to a point mass and stays in support", () => {
        const terminal = { ...input, done: true, reward: 3 };
        const meta = [...mod.run(terminal)].at(-1)!.meta;
        const target = meta["targetDist"] as number[];
        expect(target[0]).toBe(1);
        target.slice(1).forEach((p) => expect(p).toBe(0));
        const projected = meta["projected"] as number[];
        expect(projected.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 8);
        projected.forEach((p) => expect(p).toBeGreaterThanOrEqual(-1e-12));
    });

    it("Double Q picks the action with the larger online expected return", () => {
        const online = [
            [1, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
        ];
        const altered = { ...input, onlineNextProbsByAction: online };
        const meta = [...mod.run(altered)].at(-1)!.meta;
        expect(meta["selectedAction"]).toBe(1);
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
