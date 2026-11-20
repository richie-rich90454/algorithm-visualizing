/**
 * rectified-flow.test.ts - Independent interpolation and Euler-integration
 * checks, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rectified-flow";
import type { VisualFrame } from "@/types";

interface Pair {
    x0: [number, number];
    x1: [number, number];
}

function eulerEndpoint(pair: Pair, steps: number): [number, number] {
    const vx = (pair.x1[0] - pair.x0[0]) / steps;
    const vy = (pair.x1[1] - pair.x0[1]) / steps;
    let x = pair.x0[0];
    let y = pair.x0[1];
    for (let k = 0; k < steps; k += 1) {
        x += vx;
        y += vy;
    }
    return [x, y];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["pairs"]).toBeDefined();
        expect(frame.meta["steps"]).toBeDefined();
    });
}

describe("RectifiedFlow", () => {
    it("reports velocities and Euler endpoints matching independent math", () => {
        const input = mod.defaultInput as { pairs: Pair[]; steps: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const flatVelocities = final?.["velocities"] as number[];
        const flatEndpoints = final?.["endpoints"] as number[];
        const velocities = input.pairs.map((_p, i) => [flatVelocities[2 * i] ?? 0, flatVelocities[2 * i + 1] ?? 0]);
        const endpoints = input.pairs.map((_p, i) => [flatEndpoints[2 * i] ?? 0, flatEndpoints[2 * i + 1] ?? 0]);
        expect(final?.["reachedTarget"]).toBe(true);
        input.pairs.forEach((pair, i) => {
            expect(velocities[i]).toEqual([pair.x1[0] - pair.x0[0], pair.x1[1] - pair.x0[1]]);
            const expected = eulerEndpoint(pair, input.steps);
            expect(Math.abs((endpoints[i]?.[0] ?? 0) - expected[0])).toBeLessThan(1e-6);
            expect(Math.abs((endpoints[i]?.[1] ?? 0) - expected[1])).toBeLessThan(1e-6);
            expect(Math.abs((endpoints[i]?.[0] ?? 0) - pair.x1[0])).toBeLessThan(1e-6);
            expect(Math.abs((endpoints[i]?.[1] ?? 0) - pair.x1[1])).toBeLessThan(1e-6);
        });
    });

    it("places the t=0.5 interpolation point at the exact midpoint", () => {
        const input = mod.defaultInput as { pairs: Pair[] };
        const frames = [...mod.run(input)];
        const midFrame = frames.find((frame) => frame.meta["t"] === 0.5);
        expect(midFrame).toBeDefined();
        for (let p = 0; p < input.pairs.length; p += 1) {
            const mid = midFrame?.entities.find((entity) => entity.id === `p-${p}-2`);
            const pair = input.pairs[p]!;
            expect(mid?.x).toBeCloseTo((pair.x0[0] + pair.x1[0]) / 2, 6);
            expect(mid?.y).toBeCloseTo((pair.x0[1] + pair.x1[1]) / 2, 6);
        }
    });

    it("works for a single pair and one Euler step", () => {
        const pairs: Pair[] = [{ x0: [0, 0], x1: [2, 4] }];
        const frames = [...mod.run({ pairs, steps: 1 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["endpoints"]).toEqual([2, 4]);
        expect(final?.["reachedTarget"]).toBe(true);
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
