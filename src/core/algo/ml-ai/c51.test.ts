/**
 * c51.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { categoricalProject, crossEntropy } from "./c51";
import type { VisualFrame } from "@/types";

type Input = {
    vmin: number; vmax: number; atoms: number; reward: number;
    gamma: number; done: boolean; nextProbs: number[]; currentProbs: number[];
};

/** Independent reference projection written from the categorical definition. */
function referenceProject(input: Input): number[] {
    const { vmin, vmax, atoms: n, reward, gamma, done, nextProbs } = input;
    const step = (vmax - vmin) / (n - 1);
    const support = Array.from({ length: n }, (_, i) => vmin + i * step);
    const out = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        const z = support[i]!;
        const raw = Math.min(vmax, Math.max(vmin, reward + (done ? 0 : gamma * z)));
        const pos = (raw - vmin) / step;
        let low = Math.floor(pos);
        if (low > n - 2) low = n - 2;
        if (low < 0) low = 0;
        const frac = pos - low;
        out[low] += nextProbs[i]! * (1 - frac);
        out[low + 1] += nextProbs[i]! * frac;
    }
    return out;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("C51", () => {
    const makeInput = (seed: number): Input => {
        const n = 3 + (seed % 8);
        const raw = Array.from({ length: n }, (_, i) => 0.2 + ((seed * 7 + i * 3) % 11) / 11);
        const sum = raw.reduce((a, b) => a + b, 0);
        return {
            vmin: -6, vmax: 6, atoms: n, reward: (seed % 7) - 3, gamma: 0.8 + (seed % 3) * 0.05,
            done: seed % 4 === 0,
            nextProbs: raw.map((x) => x / sum),
            currentProbs: raw.map((x, i) => x + (i % 2 ? 0.01 : -0.005)),
        };
    };

    it("matches an independent projection on random distributions", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
            const input = makeInput(seed);
            const frames = [...mod.run(input)];
            checkFrames(frames, input.atoms, 5);
            const got = frames[frames.length - 1]!.meta["target"] as number[];
            const expected = referenceProject(input);
            got.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 8));
        }
    });

    it("conserves mass and clips extreme rewards", () => {
        const input = makeInput(9);
        input.reward = 1000;
        input.gamma = 1;
        const target = [...mod.run(input)][0]!.meta["target"] as number[];
        const mass = target.reduce((a, b) => a + b, 0);
        expect(mass).toBeCloseTo(1, 8);
        // A huge positive reward pushes all mass to the top atom.
        expect(target[target.length - 1]).toBeCloseTo(1, 8);
        expect(target.slice(0, -1).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 8);
    });

    it("cross-entropy is minimized when the prediction matches the target", () => {
        const input = makeInput(5);
        const target = categoricalProject(
            Array.from({ length: input.atoms }, (_, i) => input.vmin + i * (input.vmax - input.vmin) / (input.atoms - 1)),
            input.nextProbs, input.reward, input.gamma, input.done, input.vmin, input.vmax,
        );
        const wrong = target.map((_v, i) => (i === 0 ? 1 : 0));
        expect(crossEntropy(target, target)).toBeLessThan(crossEntropy(target, wrong));
        expect(crossEntropy(target, wrong)).toBeGreaterThan(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
