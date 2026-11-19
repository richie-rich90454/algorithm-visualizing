/** okasaki-real-time-queue.test.ts - FIFO reference cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./okasaki-real-time-queue";
import type { VisualFrame } from "@/types";

type Command = { op: "enqueue"; value: number } | { op: "dequeue" };

function referenceOutput(commands: Command[]): number[] {
    const queue: number[] = [];
    const output: number[] = [];
    for (const command of commands) {
        if (command.op === "enqueue") queue.push(command.value);
        else if (queue.length > 0) output.push(queue.shift() as number);
    }
    return output;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Real-Time Queue", () => {
    it("dequeues values in first-in-first-out order", () => {
        const input = mod.defaultInput as { commands: Command[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const output = frames[frames.length - 1]?.meta["output"] as number[];
        expect(output).toEqual(referenceOutput(input.commands));
    });

    it("handles interleaved enqueues and dequeues", () => {
        const commands: Command[] = [
            { op: "enqueue", value: 1 },
            { op: "enqueue", value: 2 },
            { op: "dequeue" },
            { op: "enqueue", value: 3 },
            { op: "enqueue", value: 4 },
            { op: "dequeue" },
            { op: "dequeue" },
            { op: "dequeue" },
            { op: "dequeue" },
        ];
        const frames = [...mod.run({ commands })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["output"]).toEqual(referenceOutput(commands));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
