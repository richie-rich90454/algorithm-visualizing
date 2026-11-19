/**
 * hooke-jeeves.test.ts - Known-minimum and descent checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { objective } from "./hooke-jeeves";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Hooke-Jeeves", () => {
    it("finds the known minimum of the default quadratic", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        const best = last?.["best"] as number[];
        expect(best[0]).toBeCloseTo(1, 3);
        expect(best[1]).toBeCloseTo(2, 3);
        expect(last?.["value"] as number).toBeLessThan(1e-4);
    });

    it("never increases the objective and shrinks the step", () => {
        for (const start of [[0, 0], [-2, 5]]) {
            const frames = [...mod.run({ func: "quadratic", start, step: 1, iterations: 120, tolerance: 1e-6 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const history = last?.["history"] as number[];
            for (let i = 1; i < history.length; i += 1) {
                expect(history[i] as number).toBeLessThanOrEqual((history[i - 1] as number) + 1e-10);
            }
            expect(last?.["step"] as number).toBeLessThan(1e-6);
        }
    });

    it("converges on the sphere function", () => {
        const frames = [...mod.run({ func: "sphere", start: [3, -3], step: 1, iterations: 120, tolerance: 1e-6 })];
        checkFrames(frames);
        const best = frames[frames.length - 1]?.meta["best"] as number[];
        expect(objective("sphere", best[0] ?? 0, best[1] ?? 0)).toBeLessThan(1e-5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
