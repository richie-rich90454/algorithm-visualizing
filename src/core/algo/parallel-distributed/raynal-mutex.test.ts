/** raynal-mutex.test.ts - Independent predecessor-ACK check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./raynal-mutex";
import type { VisualFrame } from "@/types";

interface Req {
    proc: number;
    time: number;
}

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((entity) => entity.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Raynal distributed mutual exclusion", () => {
    it("needs acknowledgments exactly from predecessor requests", () => {
        const cases: Req[][] = [
            [
                { proc: 0, time: 1 },
                { proc: 2, time: 2 },
                { proc: 1, time: 3 },
                { proc: 3, time: 4 },
            ],
            [
                { proc: 3, time: 1 },
                { proc: 1, time: 1 },
                { proc: 0, time: 5 },
                { proc: 2, time: 7 },
            ],
        ];
        for (const requests of cases) {
            const frames = [...mod.run({ processes: 4, requests })];
            checkFrames(frames, mod.pseudocode?.length ?? 0);
            const final = frames[frames.length - 1]?.meta;
            const order = [...requests].sort((a, b) => (a.time !== b.time ? a.time - b.time : a.proc - b.proc));
            expect(final?.["order"]).toEqual(order.map((r) => `S${r.proc}@${r.time}`));
            expect(final?.["grantOrder"]).toEqual(order.map((r) => r.proc));
            for (let i = 0; i < order.length; i += 1) {
                const ackFrame = frames.find(
                    (frame) => frame.meta["last"] === "acknowledged" && frame.meta["waiting"] === (order[i]?.proc ?? -1),
                );
                expect(ackFrame).toBeDefined();
                const expectedAcks = [...new Set(order.slice(0, i).map((r) => r.proc))].filter((p) => p !== order[i]?.proc);
                expect(ackFrame?.meta["ackFrom"]).toEqual(expectedAcks);
                expect(Number(ackFrame?.meta["acksNeeded"])).toBe(expectedAcks.length);
                expect(expectedAcks.length).toBeLessThanOrEqual(3);
            }
            for (const frame of frames) {
                const inSection = frame.entities.filter((entity) => entity.metadata["inCS"] === true);
                expect(inSection.length).toBeLessThanOrEqual(1);
            }
            expect(frames.filter((frame) => Number(frame.meta["inCS"]) >= 0).length).toBe(order.length);
        }
    });

    it("reports fewer replies than Lamport for a short queue", () => {
        const frames = [...mod.run({ processes: 5, requests: [{ proc: 2, time: 1 }] })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["acksNeeded"])).toBe(0);
        expect(Number(final?.["lamportAcks"])).toBe(4);
        expect(Number(final?.["messagesSaved"])).toBe(4);
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
