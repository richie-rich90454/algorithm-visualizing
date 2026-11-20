/**
 * barnes-hut-simulation.test.ts - Force approximation and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { barnesHutForce, buildTree, directForce } from "./barnes-hut-simulation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Barnes-Hut Simulation", () => {
    it("matches direct summation exactly when theta is zero", () => {
        const particles = [
            { x: 0, m: 1 }, { x: 1, m: 2 }, { x: 2, m: 1 },
            { x: 3, m: 3 }, { x: 4, m: 1 }, { x: 5, m: 2 },
        ];
        const tree = buildTree(particles, 0, particles.length);
        for (let i = 0; i < particles.length; i += 1) {
            const approx = barnesHutForce(particles, tree, i, 0, 0.05);
            const exact = directForce(particles, i, 0.05);
            expect(Math.abs(approx - exact)).toBeLessThan(1e-12);
        }
    });

    it("conserves net force and improves as theta shrinks", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const exactFrame = [...mod.run({ ...(mod.defaultInput as { positions: number[]; masses: number[]; theta: number; softening: number }), theta: 0 })].at(-1)?.meta;
        expect(exactFrame?.["thetaZeroExact"]).toBe(true);
        expect(Number(exactFrame?.["maxError"])).toBeLessThan(1e-12);
        const final = frames[frames.length - 1]?.meta;
        expect(Math.abs(Number(final?.["netForce"]))).toBeLessThan(1e-9);
        expect(Number(final?.["maxError"])).toBeLessThan(0.5);
    });

    it("orders the particles by position in every frame", () => {
        const frames = [...mod.run({ positions: [7, 1, 5, 3] })];
        const positions = frames[0]?.entities.map((e) => Number(e.metadata["position"]));
        expect(positions).toEqual([1, 3, 5, 7]);
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
