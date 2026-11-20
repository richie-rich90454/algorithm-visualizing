/** rosenbrock-method.test.ts - Accuracy, order, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./rosenbrock-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(1);
        expect(frame.entities[0]?.type).toBe("bar");
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const final = (frames: VisualFrame[]) => frames[frames.length - 1]?.meta;

describe("Rosenbrock ROS2", () => {
    it("tracks the exact solution on all three built-in equations", () => {
        const cases: Array<{ equation: string; lambda: number; y0: number; exact: number }> = [
            { equation: "stiff", lambda: 50, y0: 1, exact: Math.cos(1) },
            { equation: "decay", lambda: 5, y0: 2, exact: 2 * Math.exp(-5) },
            { equation: "linear", lambda: 1, y0: 0.5, exact: 1.5 },
        ];
        for (const c of cases) {
            const frames = [...mod.run({ equation: c.equation, lambda: c.lambda, y0: c.y0, t0: 0, tEnd: 1, h: 0.0025 })];
            checkFrames(frames);
            const meta = final(frames);
            expect(meta?.["y"]).toBeCloseTo(c.exact, 2);
            expect(meta?.["exact"]).toBeCloseTo(c.exact, 12);
        }
    });

    it("matches an independent step replay and shows second-order refinement", () => {
        const input = { equation: "decay", lambda: 4, y0: 1, t0: 0, tEnd: 1, h: 0.05 };
        const frames = [...mod.run(input)];
        let y = input.y0;
        const gamma = 1 - 1 / Math.SQRT2;
        const b2 = gamma - 0.5;
        const b1 = 1 - b2;
        for (const frame of frames.filter((f) => f.meta["phase"] === "step")) {
            const den = 1 - input.h * gamma * (-input.lambda);
            const k1 = (-input.lambda * y) / den;
            const k2 = (-input.lambda * (y + input.h * k1) + input.h * (-input.lambda) * (-2) * k1) / den;
            y = y + input.h * (b1 * k1 + b2 * k2);
            expect(frame.meta["y"] as number).toBeCloseTo(y, 10);
        }

        const coarse = final([...mod.run({ ...input, h: 0.1 })])?.["error"] as number;
        const fine = final([...mod.run({ ...input, h: 0.05 })])?.["error"] as number;
        expect(fine).toBeLessThan(coarse);
        expect(coarse / Math.max(fine, 1e-15)).toBeGreaterThan(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
