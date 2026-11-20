/** ddpm.test.ts - Forward noising, posterior mean, oracle reconstruction, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./ddpm";
import type { VisualFrame } from "@/types";

interface Input {
    x0: number[];
    betas: number[];
    eps?: number[][];
    epsHat?: number[][];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(4);
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

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function reference(input: Input) {
    const x0 = input.x0;
    const betas = input.betas;
    const T = betas.length;
    const d = x0.length;
    const eps: number[][] = input.eps ?? Array.from({ length: T }, (_, t) =>
        Array.from({ length: d }, (_, j) => 0.4 * Math.sin(1.7 * (t + 1) + 0.9 * (j + 1))),
    );
    const epsHat = input.epsHat ?? eps;
    const alpha = betas.map((b) => 1 - b);
    const alphaBar: number[] = [];
    let acc = 1;
    for (let t = 0; t < T; t += 1) {
        acc *= alpha[t]!;
        alphaBar.push(acc);
    }
    const forward: number[][] = [];
    const x0hat: number[][] = [];
    const losses: number[] = [];
    for (let t = 0; t < T; t += 1) {
        const sb = Math.sqrt(alphaBar[t]!);
        const s1b = Math.sqrt(1 - alphaBar[t]!);
        forward.push(x0.map((v, j) => sb * v + s1b * eps[t]![j]!));
        x0hat.push(forward[t]!.map((v, j) => (v - s1b * epsHat[t]![j]!) / sb));
        losses.push(mean(eps[t]!.map((v, j) => (v - epsHat[t]![j]!) ** 2)));
    }
    const reverse: number[][] = [];
    for (let t = T - 1; t >= 0; t -= 1) {
        const xt = forward[t]!;
        const prevBar = t === 0 ? 1 : alphaBar[t - 1]!;
        const c0 = (Math.sqrt(prevBar) * betas[t]!) / (1 - alphaBar[t]!);
        const cx = (Math.sqrt(alpha[t]!) * (1 - prevBar)) / (1 - alphaBar[t]!);
        reverse.push(xt.map((v, j) => c0 * x0hat[t]![j]! + cx * v));
    }
    reverse.reverse();
    return { alpha, alphaBar, forward, x0hat, reverse, losses, totalLoss: mean(losses) };
}

describe("DDPM", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent forward, loss, and reverse reference", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input);
        (meta["alphaBar"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.alphaBar[i]!, 8));
        (meta["forward"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.forward.flat()[i]!, 6));
        (meta["x0hat"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.x0hat.flat()[i]!, 6));
        (meta["reverse"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.reverse.flat()[i]!, 6));
        (meta["losses"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.losses[i]!, 8));
        expect(Number(meta["totalLoss"])).toBeCloseTo(expected.totalLoss, 8);
    });

    it("alpha-bar decreases monotonically and starts near one", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const alphaBar = meta["alphaBar"] as number[];
        expect(alphaBar[0]).toBe(1 - input.betas[0]!);
        for (let t = 1; t < alphaBar.length; t += 1) {
            expect(alphaBar[t]!).toBeLessThan(alphaBar[t - 1]!);
        }
    });

    it("oracle noise reconstructs the clean signal exactly at every step", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const x0hat = meta["x0hat"] as number[];
        const T = input.betas.length;
        const d = input.x0.length;
        for (let t = 0; t < T; t += 1) {
            for (let j = 0; j < d; j += 1) {
                expect(x0hat[t * d + j]!).toBeCloseTo(input.x0[j]!, 6);
            }
        }
        expect(Number(meta["finalError"])).toBeCloseTo(0, 6);
    });

    it("a biased noise prediction gives a positive loss", () => {
        const input2: Input = {
            x0: [1, 2],
            betas: [0.1, 0.2],
            eps: [[0.3, -0.4], [0.1, 0.5]],
            epsHat: [[0.4, -0.2], [0.0, 0.7]],
        };
        const meta = [...mod.run(input2)].at(-1)!.meta;
        expect(Number(meta["totalLoss"])).toBeGreaterThan(0);
        expect(Number(meta["finalError"])).toBeGreaterThan(0);
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
