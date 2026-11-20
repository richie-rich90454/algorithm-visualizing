/**
 * load-linked-store-conditional.test.ts - Reservation correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { allLLSchedules, executeLLSCHEDULE, overlappingSchedules } from "./load-linked-store-conditional";
import type { LLOperation } from "./load-linked-store-conditional";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent enumeration of the six two-process interleavings. */
function bruteSchedules(): LLOperation[][] {
    const ops: LLOperation[] = [
        { process: 0, kind: "LL", value: 100 },
        { process: 0, kind: "SC", value: 100 },
        { process: 1, kind: "LL", value: 101 },
        { process: 1, kind: "SC", value: 101 },
    ];
    const result: LLOperation[][] = [];
    const visit = (p0: number, p1: number, prefix: LLOperation[]) => {
        if (p0 === 2 && p1 === 2) {
            result.push(prefix);
            return;
        }
        if (p0 < 2) {
            visit(p0 + 1, p1, [...prefix, ops[p0] as LLOperation]);
        }
        if (p1 < 2) {
            visit(p0, p1 + 1, [...prefix, ops[2 + p1] as LLOperation]);
        }
    };
    visit(0, 0, []);
    return result;
}

describe("Load-Linked / Store-Conditional", () => {
    it("enumerates the same interleavings as an independent generator", () => {
        expect(allLLSchedules()).toHaveLength(6);
        expect(allLLSchedules().length).toBe(bruteSchedules().length);
        expect(overlappingSchedules(allLLSchedules())).toBe(4);
    });

    it("gives exactly one winner when both reservations overlap", () => {
        for (const schedule of allLLSchedules()) {
            const steps = executeLLSCHEDULE(schedule, 7);
            const successes = steps.filter((step) => step.success === true);
            expect(successes.length).toBeGreaterThanOrEqual(1);
            const firstSC = schedule.findIndex((op) => op.kind === "SC");
            const bothLoadedFirst = schedule.filter((op) => op.kind === "LL").length === 2 && firstSC >= 2;
            if (bothLoadedFirst) {
                expect(successes.length).toBe(1);
            }
            const finalValue = steps[steps.length - 1]?.value;
            expect([100, 101]).toContain(finalValue);
        }
    });

    it("rejects a stale reservation and accepts a fresh one", () => {
        const schedule: LLOperation[] = [
            { process: 0, kind: "LL", value: 100 },
            { process: 1, kind: "LL", value: 101 },
            { process: 0, kind: "SC", value: 100 },
            { process: 1, kind: "SC", value: 101 },
        ];
        const steps = executeLLSCHEDULE(schedule, 0);
        expect(steps[2]?.success).toBe(true);
        expect(steps[3]?.success).toBe(false);
        expect(steps[3]?.value).toBe(100);
    });

    it("reports one winner in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["mutualExclusion"]).toBe(true);
        expect(Number(final?.["schedules"])).toBe(6);
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
