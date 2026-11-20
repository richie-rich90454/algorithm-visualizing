/**
 * chandy-misra-haas.test.ts - Safety (never early), weight conservation,
 * completion across random workloads, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chandy-misra-haas";
import type { VisualFrame, MetaValue } from "@/types";

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

function nums(meta: Record<string, MetaValue>, key: string): number[] {
    const raw = meta[key];
    return Array.isArray(raw) ? raw.map((v) => Number(v)) : [];
}

describe("Chandy-Misra-Haas termination detection", () => {
    it("detects termination with all work exhausted and weight conserved", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["terminated"]).toBe(true);
        expect(Math.abs(Number(last["received"]) - 1)).toBeLessThan(1e-9);
        expect(nums(last, "work").reduce((a, b) => a + b, 0)).toBe(0);
        expect(Number(last["activeCount"])).toBe(0);
    });

    it("never declares termination while work remains", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const terminated = frame.meta["terminated"] === true;
            const active = Number(frame.meta["activeCount"]);
            if (terminated) expect(active).toBe(0);
            const totalWork = nums(frame.meta, "work").reduce((a, b) => a + b, 0);
            if (totalWork > 0) expect(terminated).toBe(false);
        }
    });

    it("completes on varied workloads on the same tree", () => {
        const parent = [-1, 0, 0, 1, 1, 2, 2];
        const workloads = [
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1],
            [0, 2, 1, 0, 0, 0, 0],
            [1, 0, 0, 5, 0, 2, 3],
        ];
        for (const work of workloads) {
            const frames = [...mod.run({ parent, work })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            expect(last["terminated"]).toBe(true);
            expect(Math.abs(Number(last["received"]) - 1)).toBeLessThan(1e-9);
            expect(nums(last, "work").reduce((a, b) => a + b, 0)).toBe(0);
        }
    });

    it("reports a nonnegative returned weight on every frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const received = Number(frame.meta["received"]);
            expect(received).toBeGreaterThanOrEqual(0);
            expect(received).toBeLessThanOrEqual(1 + 1e-9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
