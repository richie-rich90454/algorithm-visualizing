/** batch-queue.test.ts - FIFO reference cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./batch-queue";
import type { VisualFrame } from "@/types";

type Command = { op: "enqueue"; value: number } | { op: "dequeue" };

/** Independent plain-array FIFO used as the correctness oracle. */
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

describe("Batch Queue (Hood-Melville)", () => {
    it("dequeues values in first-in-first-out order", () => {
        const input = mod.defaultInput as { commands: Command[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const output = frames[frames.length - 1]?.meta["output"] as number[];
        expect(output).toEqual(referenceOutput(input.commands));
    });

    it("matches the FIFO oracle on interleaved and adversarial command streams", () => {
        const streams: Command[][] = [
            [
                { op: "dequeue" },
                { op: "enqueue", value: 1 },
                { op: "enqueue", value: 2 },
                { op: "dequeue" },
                { op: "dequeue" },
                { op: "dequeue" },
            ],
            [
                ...Array.from({ length: 12 }, (_, i): Command => ({ op: "enqueue", value: i })),
                ...Array.from({ length: 12 }, (): Command => ({ op: "dequeue" })),
            ],
            [
                { op: "enqueue", value: 4 },
                { op: "enqueue", value: 5 },
                { op: "dequeue" },
                { op: "enqueue", value: 6 },
                { op: "enqueue", value: 7 },
                { op: "dequeue" },
                { op: "dequeue" },
            ],
        ];
        for (const commands of streams) {
            const frames = [...mod.run({ commands })];
            checkFrames(frames);
            const output = frames[frames.length - 1]?.meta["output"] as number[];
            expect(output).toEqual(referenceOutput(commands));
        }
    });

    it("keeps the copy buffer a prefix of the logical queue on every frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const front = frame.meta["front"] as number[];
            const rear = frame.meta["rear"] as number[];
            const buffer = frame.meta["buffer"] as number[];
            const logical = [...front, ...[...rear].reverse()];
            expect(logical.slice(0, buffer.length)).toEqual(buffer);
        }
    });

    it("terminates cleanly on empty and populated inputs", () => {
        for (const input of [{ commands: [] }, mod.defaultInput]) {
            const generator = mod.run(input);
            let count = 0;
            for (const _frame of generator) count += 1;
            expect(count).toBeGreaterThan(0);
            expect(generator.next().done).toBe(true);
        }
    });
});
