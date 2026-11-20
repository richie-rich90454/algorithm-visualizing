/**
 * slru.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./slru";
import type { VisualFrame } from "@/types";

/** Independent SLRU simulation matching the module's segment policy. */
function reference(capacity: number, fraction: number, accesses: number[]) {
    const protCap = capacity >= 2 ? Math.max(1, Math.floor(capacity * fraction)) : 0;
    const probCap = capacity - protCap;
    let prot: number[] = [];
    let prob: number[] = [];
    let faults = 0;
    for (const page of accesses) {
        const inProt = prot.indexOf(page);
        const inProb = prob.indexOf(page);
        if (inProt >= 0) {
            prot = prot.filter((_, i) => i !== inProt);
            prot.push(page);
        } else if (inProb >= 0) {
            prob = prob.filter((_, i) => i !== inProb);
            prot.push(page);
        } else {
            faults += 1;
            prob.push(page);
        }
        while (prot.length > protCap) {
            prob.push(prot.shift() ?? 0);
        }
        while (prob.length > probCap) {
            prob.shift();
        }
    }
    return { faults, prot, prob, protCap, probCap };
}

function checkFrames(frames: VisualFrame[], accesses: number): void {
    expect(frames.length).toBe(accesses + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(3);
    });
}

describe("SLRU", () => {
    it("matches an independent SLRU simulation", () => {
        const input = mod.defaultInput as { capacity: number; protectedFraction: number; accesses: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.accesses.length);
        const expected = reference(input.capacity, input.protectedFraction, input.accesses);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["faults"])).toBe(expected.faults);
        expect(final?.["protected"]).toEqual(expected.prot);
        expect(final?.["probationary"]).toEqual(expected.prob);
    });

    it("keeps both segments within capacity on every frame", () => {
        const input = mod.defaultInput as { capacity: number; protectedFraction: number; accesses: number[] };
        const frames = [...mod.run(input)];
        for (const frame of frames) {
            const prot = frame.meta["protected"] as number[];
            const prob = frame.meta["probationary"] as number[];
            expect(prot.length).toBeLessThanOrEqual(Number(frame.meta["protCap"]));
            expect(prob.length).toBeLessThanOrEqual(Number(frame.meta["probCap"]));
            expect(prot.length + prob.length).toBeLessThanOrEqual(input.capacity);
        }
    });

    it("agrees with the reference across several capacities", () => {
        const accesses = [1, 2, 3, 2, 1, 4, 5, 1, 3, 6, 2, 1, 7, 4];
        for (const capacity of [2, 3, 5]) {
            const frames = [...mod.run({ capacity, protectedFraction: 0.4, accesses })];
            const actual = Number(frames[frames.length - 1]?.meta["faults"]);
            expect(actual).toBe(reference(capacity, 0.4, accesses).faults);
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
