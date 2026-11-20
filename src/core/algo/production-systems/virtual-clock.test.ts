/**
 * virtual-clock.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { virtualClock } from "./virtual-clock";
import type { VisualFrame } from "@/types";

type Packet = { flow: string; arrival: number; length: number };

function reference(packets: Packet[], rates: Record<string, number>) {
    const clocks: Record<string, number> = {};
    const tags = packets.map((p) => {
        const r = rates[p.flow] ?? 1;
        const next = Math.max(clocks[p.flow] ?? 0, p.arrival) + p.length / r;
        clocks[p.flow] = next;
        return next;
    });
    const order = tags.map((_t, i) => i).sort((a, b) => (tags[a]! - tags[b]!) || (a - b));
    return { tags, order };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Virtual Clock", () => {
    it("matches an independent reference on random packet traces", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
            const flows = ["A", "B", "C"].slice(0, 1 + (seed % 3));
            const packets: Packet[] = Array.from({ length: 3 + (seed % 8) }, (_unused, i) => ({
                flow: flows[i % flows.length]!,
                arrival: (seed + i * 3) % 11,
                length: 1 + ((seed * (i + 2)) % 9),
            }));
            const rates: Record<string, number> = {};
            flows.forEach((f, i) => { rates[f] = 0.5 + (i + 1); });
            const frames = [...mod.run({ packets, rates })];
            checkFrames(frames, packets.length);
            const expected = reference(packets, rates);
            const final = frames[frames.length - 1]!.meta;
            (final["tags"] as number[]).forEach((t, i) => expect(t).toBeCloseTo(expected.tags[i]!, 10));
            expect(final["order"]).toEqual(expected.order);
            expect(virtualClock(packets, rates).order).toEqual(expected.order);
        }
    });

    it("tags are at least arrivals and monotone per flow", () => {
        const packets: Packet[] = [
            { flow: "A", arrival: 0, length: 10 },
            { flow: "A", arrival: 2, length: 10 },
            { flow: "A", arrival: 12, length: 10 },
        ];
        const { steps } = virtualClock(packets, { A: 2 });
        steps.forEach((s) => expect(s.tag).toBeGreaterThanOrEqual(s.arrival));
        for (let i = 1; i < steps.length; i += 1) expect(steps[i]!.tag).toBeGreaterThan(steps[i - 1]!.tag);
        // Idle time is not banked: the third packet jumps to its real arrival.
        expect(steps[2]!.tag).toBeCloseTo(17, 10);
    });

    it("a higher reserved rate yields a smaller tag", () => {
        const packet: Packet[] = [{ flow: "X", arrival: 0, length: 10 }];
        expect(virtualClock(packet, { X: 5 }).steps[0]!.tag).toBeLessThan(virtualClock(packet, { X: 1 }).steps[0]!.tag);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
