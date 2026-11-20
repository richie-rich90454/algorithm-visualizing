/**
 * cache-coherency-moesi.test.ts - Independent state-machine reference, coherence invariants, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cache-coherency-moesi";
import type { VisualFrame } from "@/types";

interface Operation { cache: number; action: "read" | "write" }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("cell");
            expect(["M", "O", "E", "S", "I"]).toContain(entity.label);
            expect(entity.metadata["state"]).toBe(entity.label);
        }
    });
}

/** Independent MOESI transition function written from the protocol rules. */
function refStep(states: string[], cache: number, action: "read" | "write"): { states: string[]; bus: string } {
    const out = states.slice();
    const self = out[cache]!;
    const otherIdx = states.map((s, i) => ({ s, i })).filter((x) => x.i !== cache);
    let bus = "None";
    if (action === "read") {
        bus = "BusRd";
        if (self === "I") out[cache] = otherIdx.some((x) => x.s !== "I") ? "S" : "E";
        for (const o of otherIdx) {
            if (states[o.i] === "M") out[o.i] = "O";
            if (states[o.i] === "E") out[o.i] = "S";
        }
    } else {
        if (self === "M" || self === "E") bus = "None";
        else if (self === "O") bus = otherIdx.some((x) => x.s === "S" || x.s === "O") ? "BusUpgr" : "None";
        else bus = self === "S" ? "BusUpgr" : "BusRdX";
        out[cache] = "M";
        for (const o of otherIdx) {
            if (bus === "BusRdX") out[o.i] = "I";
            else if (bus === "BusUpgr" && (states[o.i] === "S" || states[o.i] === "O")) out[o.i] = "I";
        }
    }
    return { states: out, bus };
}

function refTrace(cacheCount: number, ops: Operation[]): { trace: string[]; bus: string[] } {
    let states = Array.from({ length: cacheCount }, () => "I");
    const trace: string[] = [];
    const bus: string[] = [];
    ops.forEach((op) => {
        const r = refStep(states, op.cache, op.action);
        states = r.states;
        trace.push(states.join(""));
        bus.push(r.bus);
    });
    return { trace, bus };
}

function assertCoherence(trace: string[]): void {
    for (const row of trace) {
        const chars = row.split("");
        expect(chars.filter((c) => c === "M").length).toBeLessThanOrEqual(1);
        expect(chars.filter((c) => c === "O").length).toBeLessThanOrEqual(1);
        const unique = chars.filter((c) => c === "M" || c === "E");
        if (unique.length > 0) {
            expect(chars.filter((c) => c !== "I").length).toBe(1);
        }
    }
}

describe("CacheCoherencyMoesi", () => {
    const defaultInput = mod.defaultInput as { cacheCount: number; operations: Operation[] };

    it("matches an independent MOESI state machine on the default input", () => {
        const frames = [...mod.run(defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        const ref = refTrace(defaultInput.cacheCount, defaultInput.operations);
        expect(last["trace"]).toEqual(ref.trace);
        expect(last["bus"]).toEqual(ref.bus);
        expect(last["finalStates"]).toBe(ref.trace[ref.trace.length - 1]);
        assertCoherence(ref.trace);
    });

    it("turns a modified supplier into the sole owner on a remote read", () => {
        const ops: Operation[] = [
            { cache: 0, action: "read" },
            { cache: 0, action: "write" },
            { cache: 1, action: "read" },
        ];
        const frames = [...mod.run({ cacheCount: 2, operations: ops })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["finalStates"]).toBe("OS");
        expect(last["bus"]).toEqual(["BusRd", "None", "BusRd"]);
        assertCoherence(last["trace"] as string[]);
    });

    it("invalidates all sharers on a bus upgrade", () => {
        const ops: Operation[] = [
            { cache: 0, action: "read" },
            { cache: 1, action: "read" },
            { cache: 2, action: "read" },
            { cache: 1, action: "write" },
        ];
        const frames = [...mod.run({ cacheCount: 3, operations: ops })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["finalStates"]).toBe("IMI");
        expect((last["bus"] as string[])[3]).toBe("BusUpgr");
        assertCoherence(last["trace"] as string[]);
        const ref = refTrace(3, ops);
        expect(last["trace"]).toEqual(ref.trace);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
