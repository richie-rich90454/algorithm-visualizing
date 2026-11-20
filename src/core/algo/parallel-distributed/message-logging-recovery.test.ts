import { describe, expect, it } from "vitest";
import mod from "./message-logging-recovery";
import type { VisualFrame } from "@/types";

type LogMessage = { id: number; from: number; to: number; seq: number; delta: number };

function reference(processes: number, checkpointState: number[], messages: LogMessage[]) {
    const states = Array.from({ length: processes }, (_, p) => checkpointState[p] ?? 0);
    for (const m of messages) {
        states[m.to] = (states[m.to] as number) + m.delta;
    }
    return states;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const states = frame.meta["states"] as number[];
        expect(Array.isArray(states)).toBe(true);
        expect(states.length).toBeGreaterThan(0);
        expect(Number(frame.meta["replayed"])).toBeGreaterThanOrEqual(0);
    });
}

describe("Message-Logging Recovery", () => {
    it("reconstructs states matching a direct delta-sum reference", () => {
        const input = mod.defaultInput as {
            processes: number;
            checkpointState: number[];
            messages: LogMessage[];
            failed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.processes, input.checkpointState, input.messages);
        const final = frames[frames.length - 1]?.meta;
        const states = final?.["states"] as number[];
        expect(states).toEqual(expected);
        expect(Number(final?.["recovered"])).toBe(expected[input.failed]);
        expect(Number(final?.["replayed"])).toBe(input.messages.length);
    });

    it("handles out-of-order logs and negative deltas", () => {
        const messages: LogMessage[] = [
            { id: 5, from: 0, to: 1, seq: 3, delta: -4 },
            { id: 2, from: 1, to: 1, seq: 1, delta: 7 },
            { id: 9, from: 0, to: 1, seq: 2, delta: 2 },
            { id: 7, from: 0, to: 0, seq: 1, delta: -9 },
        ];
        const input = { processes: 2, checkpointState: [100, 200], failed: 1, messages };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.processes, input.checkpointState, input.messages);
        expect((frames[frames.length - 1]?.meta["states"] as number[])).toEqual(expected);
        const midFrame = frames[3];
        expect(midFrame).toBeDefined();
        expect(Number(midFrame?.meta["replayed"])).toBeGreaterThan(0);
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
