/** rejection-sampling-finetuning.test.ts - Selection, dedupe, SFT gradient, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { selectRftSamples, sftStep } from "./rejection-sampling-finetuning";
import type { VisualFrame } from "@/types";

type Candidate = { id: number; tokens: number[]; reward: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Rejection sampling fine-tuning", () => {
    it("keeps the highest-reward unique completions above threshold", () => {
        const input = mod.defaultInput as { candidates: Candidate[]; threshold: number; maxKeep: number };
        const { selected, reasons } = selectRftSamples(input.candidates, input.threshold, input.maxKeep);
        expect(selected.map((c) => c.id)).toEqual([0, 3, 4]);
        selected.forEach((c) => expect(c.reward).toBeGreaterThanOrEqual(input.threshold));
        expect(reasons[2]).toBe("duplicate");
        expect(reasons[1]).toBe("reward");
        expect(reasons[5]).toBe("reward");
    });

    it("respects the keep cap", () => {
        const candidates: Candidate[] = Array.from({ length: 6 }, (_, i) => ({
            id: i,
            tokens: [i],
            reward: 0.9 - i * 0.01,
        }));
        expect(selectRftSamples(candidates, 0.5, 2).selected.map((c) => c.id)).toEqual([0, 1]);
    });

    it("SFT step moves probability toward target tokens", () => {
        const { next, loss } = sftStep([2, 0, 0, 0], [1, 1, 2, 3], 0.5);
        const exps = next.map((v) => Math.exp(v));
        const sum = exps.reduce((a, b) => a + b, 0);
        expect(exps[1]! / sum).toBeGreaterThan(Math.exp(0) / (Math.exp(2) + 3));
        expect(loss).toBeGreaterThan(0);
        next.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
