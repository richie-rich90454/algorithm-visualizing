/**
 * residue-number-system.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./residue-number-system";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Residue Number System", () => {
    it("recovers every representable value by brute force", () => {
        const moduli = [3, 5, 7];
        const M = 105;
        for (let x = 0; x < M; x += 1) {
            const frames = [...mod.run({ moduli, x })];
            const recovered = Number(frames[frames.length - 1]?.meta["recovered"]);
            expect(recovered).toBe(x);
        }
    });

    it("reports the correct residues and dynamic range", () => {
        const frames = [...mod.run({ moduli: [3, 5, 7], x: 23 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["M"]).toBe(105);
        expect(final?.meta["residues"]).toEqual([2, 3, 2]);
    });

    it("rejects non-coprime moduli", () => {
        const frames = [...mod.run({ moduli: [2, 4], x: 3 })];
        expect(frames[0]?.meta["error"]).toBe(true);
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
