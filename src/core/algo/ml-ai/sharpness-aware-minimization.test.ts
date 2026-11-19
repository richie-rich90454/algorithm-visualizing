/** sharpness-aware-minimization.test.ts - Independent SAM step, radius and ascent properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./sharpness-aware-minimization";
import type { VisualFrame } from "@/types";

interface Input {
    weights: number[];
    target: number[];
    rho: number;
    lr: number;
}

function checkFrames(frames: VisualFrame[], d: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["d"]).toBe(d);
    });
}

/** Recompute the full SAM update without calling the module's helpers. */
function reference(input: Input) {
    const g = input.weights.map((w, i) => w - input.target[i]!);
    const norm = Math.sqrt(g.reduce((s, v) => s + v * v, 0));
    const delta = g.map((v) => (input.rho * v) / norm);
    const perturbed = input.weights.map((w, i) => w + delta[i]!);
    const gAdv = perturbed.map((w, i) => w - input.target[i]!);
    const next = input.weights.map((w, i) => w - input.lr * gAdv[i]!);
    const loss = (w: number[]) => 0.5 * w.reduce((s, v, i) => s + Math.pow(v - input.target[i]!, 2), 0);
    return { g, norm, delta, perturbed, gAdv, next, lossBefore: loss(input.weights), lossAfter: loss(next) };
}

describe("Sharpness-Aware Minimization", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent SAM step at every stage", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(4);
        checkFrames(frames, input.weights.length);
        const expected = reference(input);
        const final = frames.at(-1)!.meta;
        (final["gradient"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.gAdv[i]!, 10));
        (final["weights"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.next[i]!, 10));
        (final["perturbation"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.delta[i]!, 10));
        expect(Number(final["gradNorm"])).toBeCloseTo(expected.norm, 10);
        expect(Number(final["lossBefore"])).toBeCloseTo(expected.lossBefore, 10);
        expect(Number(final["lossAfter"])).toBeCloseTo(expected.lossAfter, 10);
    });

    it("keeps the perturbation on the sphere of radius rho and pointing uphill", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const delta = meta["perturbation"] as number[];
        const norm = Math.sqrt(delta.reduce((s, v) => s + v * v, 0));
        expect(norm).toBeCloseTo(input.rho, 10);
        expect(Number(meta["ascentGain"])).toBeCloseTo(input.rho * Number(meta["gradNorm"]), 10);
        expect(Number(meta["lossAtPerturbed"])).toBeGreaterThan(Number(meta["lossBefore"]));
    });

    it("lowers the loss after the descent step", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        expect(Number(meta["lossAfter"])).toBeLessThanOrEqual(Number(meta["lossBefore"]));
    });

    it("handles a zero gradient without dividing by zero", () => {
        const atTarget = { ...input, weights: input.target.slice() };
        const meta = [...mod.run(atTarget)].at(-1)!.meta;
        (meta["perturbation"] as number[]).forEach((v) => expect(v).toBe(0));
        expect(Number.isFinite(Number(meta["lossAfter"]))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
