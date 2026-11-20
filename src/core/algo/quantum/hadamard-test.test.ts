/**
 * hadamard-test.test.ts - Direct expectation comparison and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hadamard-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBe(4);
        const total = frame.entities.reduce((sum, e) => sum + Number(e.value), 0);
        expect(total).toBeCloseTo(1, 8);
    }
}

describe("Hadamard Test", () => {
    it("matches the direct expectation on the default input", () => {
        const input = mod.defaultInput as { theta: number; phi: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const direct = Math.cos(input.phi) ** 2 + Math.sin(input.phi) ** 2 * Math.cos(input.theta);
        expect(final?.["estimate"]).toBeCloseTo(direct, 10);
        expect(final?.["directValue"]).toBeCloseTo(direct, 10);
        expect(final?.["error"] as number).toBeLessThan(1e-9);
        expect(Number(final?.["p0"]) + Number(final?.["p1"])).toBeCloseTo(1, 10);
    });

    it("matches the direct expectation across angles", () => {
        for (const theta of [0, 0.4, 1.2, Math.PI, 2.5]) {
            for (const phi of [0, 0.3, 1.1, Math.PI / 3]) {
                const frames = [...mod.run({ theta, phi })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                const direct = Math.cos(phi) ** 2 + Math.sin(phi) ** 2 * Math.cos(theta);
                expect(final?.["estimate"]).toBeCloseTo(direct, 9);
                expect(Number(final?.["p0"])).toBeCloseTo((1 + direct) / 2, 9);
            }
        }
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
