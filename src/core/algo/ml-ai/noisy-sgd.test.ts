/**
 * noisy-sgd.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./noisy-sgd";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function gaussian(rng: () => number): number {
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function reference(
    points: Point[],
    lr: number,
    sigma: number,
    seed: number,
    epochs: number,
) {
    let w = 0;
    let b = 0;
    const rng = makeRng(seed);
    let noiseW = 0;
    let noiseB = 0;
    for (let epoch = 0; epoch < epochs; epoch += 1) {
        let dw = 0;
        let db = 0;
        for (const [x, y] of points) {
            const err = w * x + b - y;
            dw += err * x;
            db += err;
        }
        const n = Math.max(1, points.length);
        dw /= n;
        db /= n;
        noiseW = sigma * gaussian(rng);
        noiseB = sigma * gaussian(rng);
        w -= lr * (dw + noiseW);
        b -= lr * (db + noiseB);
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, noiseW, noiseB };
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount + 2);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(1);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        const line = frame.codeLineNumber ?? -1;
        expect(line).toBeGreaterThanOrEqual(0);
        expect(line).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["noiseW"]).toBe("number");
        expect(typeof frame.meta["noiseB"]).toBe("number");
    });
}

describe("Noisy SGD", () => {
    it("matches an independent seeded replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            sigma: number;
            seed: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(
            input.points,
            input.learningRate,
            input.sigma,
            input.seed,
            input.epochs,
        );
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("is deterministic for the same seed and differs for another seed", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            sigma: number;
            seed: number;
            epochs: number;
        };
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(Number(a[a.length - 1]?.meta["w"])).toBe(Number(b[b.length - 1]?.meta["w"]));
        const c = [...mod.run({ ...input, seed: input.seed + 1 })];
        expect(Number(c[c.length - 1]?.meta["w"])).not.toBe(Number(a[a.length - 1]?.meta["w"]));
    });

    it("reduces to plain SGD when sigma is zero", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            sigma: number;
            seed: number;
            epochs: number;
        };
        const frames = [...mod.run({ ...input, sigma: 0 })];
        checkFrames(frames, input.points.length);
        for (const frame of frames) {
            expect(Number(frame.meta["noiseW"])).toBeCloseTo(0, 12);
            expect(Number(frame.meta["noiseB"])).toBeCloseTo(0, 12);
        }
        const expected = reference(input.points, input.learningRate, 0, input.seed, input.epochs);
        expect(Number(frames[frames.length - 1]?.meta["w"])).toBeCloseTo(expected.w, 10);
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
