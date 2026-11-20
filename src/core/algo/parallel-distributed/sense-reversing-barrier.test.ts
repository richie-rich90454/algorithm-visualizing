/**
 * sense-reversing-barrier.test.ts - Sense alternation and release counts,
 * arrival completeness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sense-reversing-barrier";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Sense-reversing barrier", () => {
    it("toggles sense once per epoch and counts releases", () => {
        for (const epochs of [1, 2, 5]) {
            const frames = [...mod.run({ processes: 4, epochs })];
            checkFrames(frames);
            const releaseFrames = frames.filter((f) => f.meta["phase"] === "release");
            expect(releaseFrames.length).toBe(epochs);
            const senses = releaseFrames.map((f) => f.meta["sense"]);
            senses.forEach((s, i) => expect(s).toBe(i % 2 === 0 ? true : false));
            const final = frames[frames.length - 1]!.meta;
            expect(final["releases"]).toBe(epochs);
        }
    });

    it("requires every process to arrive before each release", () => {
        const frames = [...mod.run({ processes: 5, epochs: 3 })];
        checkFrames(frames);
        for (const frame of frames) {
            const count = Number(frame.meta["arrivedCount"]);
            expect(count).toBeGreaterThanOrEqual(0);
            expect(count).toBeLessThanOrEqual(5);
            if (frame.meta["phase"] === "release") expect(count).toBe(0);
        }
        const arrivals = frames.filter((f) => f.meta["phase"] === "arrive");
        expect(arrivals.length).toBe(15);
    });

    it("matches an independent release-count and final-sense reference", () => {
        const processes = 6;
        const epochs = 7;
        const frames = [...mod.run({ processes, epochs })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["releases"]).toBe(epochs);
        expect(final["sense"]).toBe(epochs % 2 === 0 ? false : true);
        expect(frames.length).toBe(1 + epochs * (processes + 1) + 1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
