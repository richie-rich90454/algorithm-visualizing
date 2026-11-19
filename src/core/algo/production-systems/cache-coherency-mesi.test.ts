/**
 * cache-coherency-mesi.test.ts - Independent snooping reference, invariant
 * checks, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cache-coherency-mesi";
import type { VisualFrame } from "@/types";

type Letter = "M" | "E" | "S" | "I";
type Op = { cache: number; op: "read" | "write" };

/** Independent reference state machine written with explicit case analysis. */
function reference(states: Letter[], cache: number, op: "read" | "write"): Letter[] {
    const next = states.slice();
    const mine = states[cache];
    if (op === "read" && mine !== "I") {
        return next;
    }
    if (op === "read") {
        const sharers = states.filter((state, index) => index !== cache && state !== "I").length;
        for (let i = 0; i < next.length; i += 1) {
            if (i !== cache && (next[i] === "M" || next[i] === "E")) {
                next[i] = "S";
            }
        }
        next[cache] = sharers > 0 ? "S" : "E";
        return next;
    }
    if (mine === "M" || mine === "E") {
        next[cache] = "M";
        return next;
    }
    for (let i = 0; i < next.length; i += 1) {
        if (i !== cache) {
            next[i] = "I";
        }
    }
    next[cache] = "M";
    return next;
}

function assertInvariants(states: Letter[]): void {
    const modified = states.filter((state) => state === "M").length;
    const exclusive = states.filter((state) => state === "E").length;
    expect(modified + exclusive).toBeLessThanOrEqual(1);
    if (modified === 1) {
        expect(states.filter((state) => state === "S").length).toBe(0);
        expect(exclusive).toBe(0);
    }
}

function checkFrames(frames: VisualFrame[], cacheCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cacheCount);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["states"])).toBe(true);
        assertInvariants(frame.meta["states"] as Letter[]);
    });
}

describe("MESI Cache Coherence", () => {
    it("matches an independent state machine on the default trace", () => {
        const input = mod.defaultInput as { caches: number; operations: Op[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.caches);
        let expected: Letter[] = Array.from({ length: input.caches }, () => "I");
        for (let i = 0; i < input.operations.length; i += 1) {
            expected = reference(expected, input.operations[i]!.cache, input.operations[i]!.op);
            const frame = frames[i + 1];
            expect(frame?.meta["states"]).toEqual(expected);
        }
    });

    it("preserves single-writer invariants across varying traces", () => {
        const operations: Op[] = [
            { cache: 0, op: "write" },
            { cache: 1, op: "write" },
            { cache: 2, op: "read" },
            { cache: 0, op: "read" },
            { cache: 1, op: "write" },
        ];
        const frames = [...mod.run({ caches: 4, operations })];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta["states"] as Letter[];
        expect(final.filter((state) => state === "M").length).toBe(1);
        expect(final.filter((state) => state === "I").length).toBe(3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
