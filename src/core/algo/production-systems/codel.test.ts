/**
 * codel.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { codelSteps } from "./codel";
import type { VisualFrame } from "@/types";

type Packet = { time: number; sojourn: number };
type Input = { packets: Packet[]; target: number; interval: number };

function reference(input: Input) {
    let dropping = false;
    let next = 0;
    let count = 0;
    const window: Packet[] = [];
    return input.packets.map((p) => {
        window.push(p);
        while (window.length && window[0]!.time <= p.time - input.interval) window.shift();
        const min = Math.min(...window.map((x) => x.sojourn));
        let drop = false;
        if (min > input.target) {
            if (!dropping) {
                dropping = true;
                next = p.time + input.interval;
            } else if (p.time >= next) {
                drop = true;
                count += 1;
                next = p.time + input.interval / Math.sqrt(count);
            }
        } else {
            dropping = false;
        }
        return { min, drop, dropping, intervalToNext: next - p.time };
    });
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

describe("CoDel", () => {
    it("matches an independent state-machine reference", () => {
        for (let seed = 1; seed <= 20; seed += 1) {
            const packets: Packet[] = Array.from({ length: 5 + (seed % 12) }, (_, i) => ({
                time: i * (3 + (seed % 4)),
                sojourn: 2 + ((seed * (i + 2)) % 40),
            }));
            const input: Input = { packets, target: 5, interval: 100 };
            const frames = [...mod.run(input)];
            checkFrames(frames, packets.length);
            const expected = reference(input);
            const final = frames[frames.length - 1]!.meta;
            expect(final["dropped"]).toEqual(expected.map((e) => (e.drop ? 1 : 0)));
            (final["minSojourns"] as number[]).forEach((m, i) => expect(m).toBeCloseTo(expected[i]!.min, 10));
            expect(codelSteps(packets, 5, 100).filter((s) => s.drop).length)
                .toBe(expected.filter((e) => e.drop).length);
        }
    });

    it("never drops while the minimum is at or below target", () => {
        const packets: Packet[] = Array.from({ length: 30 }, (_, i) => ({ time: i * 5, sojourn: i % 2 ? 20 : 1 }));
        const steps = codelSteps(packets, 5, 50);
        steps.forEach((s) => {
            if (s.minSojourn <= 5) expect(s.drop).toBe(false);
        });
    });

    it("dropping accelerates as the drop count grows", () => {
        const packets: Packet[] = Array.from({ length: 60 }, (_, i) => ({ time: i, sojourn: 100 }));
        const steps = codelSteps(packets, 5, 10);
        const drops = steps.filter((s) => s.drop);
        expect(drops.length).toBeGreaterThan(2);
        const gaps: number[] = [];
        for (let i = 1; i < drops.length; i += 1) gaps.push(drops[i]!.time - drops[i - 1]!.time);
        // The schedule interval shrinks as 1/sqrt(k), so later gaps are shorter on average.
        const firstHalf = gaps.slice(0, Math.floor(gaps.length / 2));
        const secondHalf = gaps.slice(Math.floor(gaps.length / 2));
        const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        expect(avg(secondHalf)).toBeLessThan(avg(firstHalf));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
