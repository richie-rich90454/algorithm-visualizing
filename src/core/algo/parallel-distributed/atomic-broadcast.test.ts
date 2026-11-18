/**
 * atomic-broadcast.test.ts - Total-order, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./atomic-broadcast";
import type { VisualFrame } from "@/types";

interface Message {
    sender: number;
    localSeq: number;
    content: string;
}

function checkFrames(frames: VisualFrame[], messages: number, processes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(messages + processes);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Canonical total order: by local sequence number, then sender id. */
function canonicalOrder(messages: Message[]): number[] {
    return messages
        .map((message, index) => ({ message, index }))
        .sort((a, b) => a.message.localSeq - b.message.localSeq || a.message.sender - b.message.sender)
        .map((entry) => entry.index);
}

describe("Atomic Broadcast", () => {
    it("delivers every message to all processes in one identical total order", () => {
        const scenarios: Message[][] = [
            [
                { sender: 1, localSeq: 0, content: "a" },
                { sender: 0, localSeq: 0, content: "b" },
                { sender: 2, localSeq: 0, content: "c" },
                { sender: 1, localSeq: 1, content: "d" },
            ],
            [
                { sender: 2, localSeq: 2, content: "x" },
                { sender: 0, localSeq: 2, content: "y" },
                { sender: 2, localSeq: 0, content: "z" },
                { sender: 1, localSeq: 2, content: "w" },
                { sender: 0, localSeq: 1, content: "v" },
            ],
            [],
        ];
        for (let trial = 0; trial < 60; trial += 1) {
            const count = 1 + (trial % 6);
            const messages: Message[] = Array.from({ length: count }, (_, index) => ({
                sender: (index * 3 + trial) % 4,
                localSeq: (index * 7 + trial) % 4,
                content: `m${index}`,
            }));
            scenarios.push(messages);
        }

        for (const messages of scenarios) {
            if (messages.length === 0) {
                continue;
            }
            const processes = 3;
            const frames = [...mod.run({ messages, processes })];
            checkFrames(frames, messages.length, processes);
            const order = frames[frames.length - 1]!.meta["order"] as number[];
            expect(order).toEqual(canonicalOrder(messages));
            expect([...order].sort((a, b) => a - b)).toEqual(
                messages.map((_message, index) => index),
            );
            expect(frames[frames.length - 1]!.meta["delivered"]).toBe(messages.length);

            for (let position = 0; position < frames.length - 2; position += 1) {
                expect(frames[position + 1]!.meta["delivered"]).toBe(position + 1);
            }
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
