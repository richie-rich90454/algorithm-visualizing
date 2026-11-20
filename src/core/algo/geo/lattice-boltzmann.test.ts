/** lattice-boltzmann.test.ts - Mass-conservation property, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./lattice-boltzmann";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedCells: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(expectedCells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number" && typeof e.metadata["col"] === "number")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBeDefined();
        expect(frame.meta["cols"]).toBeDefined();
    });
}

describe("Lattice Boltzmann D2Q9", () => {
    it("conserves total mass across every step and keeps density positive", () => {
        for (const config of [
            { width: 8, height: 9, steps: 6, tau: 0.8 },
            { width: 10, height: 10, steps: 12, tau: 0.65 },
            { width: 6, height: 6, steps: 4, tau: 0.95 },
        ]) {
            const frames = [...mod.run(config)];
            checkFrames(frames, (config.width as number) * (config.height as number));
            const initialMass = Number(frames[0]?.meta["mass"]);
            for (const frame of frames) {
                const mass = Number(frame.meta["mass"]);
                expect(Math.abs(mass - initialMass)).toBeLessThan(1e-6 * initialMass);
                for (const entity of frame.entities) {
                    expect(Number(entity.value)).toBeGreaterThan(0);
                }
            }
            const maxSpeed = Number(frames[frames.length - 1]?.meta["maxSpeed"]);
            expect(Number.isFinite(maxSpeed)).toBe(true);
            expect(maxSpeed).toBeGreaterThan(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
