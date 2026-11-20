/**
 * total-order-broadcast.test.ts - Sorted-delivery property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./total-order-broadcast";
import type { VisualFrame } from "@/types";

interface Message {
    id: string;
    seq: number;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Total-order broadcast (teaching simulation)", () => {
    it("delivers messages in sorted sequence order for many inputs and seeds", () => {
        const cases: Message[][] = [
            [
                { id: "m1", seq: 3 },
                { id: "m2", seq: 1 },
                { id: "m3", seq: 5 },
                { id: "m4", seq: 2 },
                { id: "m5", seq: 4 },
            ],
            [
                { id: "a", seq: 10 },
                { id: "b", seq: -2 },
                { id: "c", seq: 7 },
            ],
            [{ id: "only", seq: 42 }],
        ];
        for (const messages of cases) {
            for (const seed of [1, 2, 17, 99]) {
                const frames = [...mod.run({ messages, replicas: 4, seed })];
                checkFrames(frames, messages.length);
                const want = [...messages].sort((x, y) => x.seq - y.seq).map((m) => m.id);
                const last = frames[frames.length - 1]?.meta;
                expect(last?.["deliveryOrder"]).toEqual(want);
                expect(last?.["delivered"]).toBe(messages.length);
                expect(last?.["arrivalRows"]).toBe(4);
                expect((last?.["arrivalOrders"] as number[])?.length).toBe(4 * messages.length);
                const labels = frames[0]?.entities.map((e) => e.label);
                expect(labels).toEqual(want);
            }
        }
    });

    it("gives each replica a permutation of the same messages", () => {
        const frames = [...mod.run({ replicas: 5, seed: 3 })];
        checkFrames(frames, 5);
        const flat = frames[0]?.meta["arrivalOrders"] as number[];
        const cols = Number(frames[0]?.meta["arrivalCols"]);
        const orders: number[][] = [];
        for (let r = 0; r < 5; r += 1) {
            orders.push(flat.slice(r * cols, (r + 1) * cols));
        }
        for (const order of orders) {
            expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
