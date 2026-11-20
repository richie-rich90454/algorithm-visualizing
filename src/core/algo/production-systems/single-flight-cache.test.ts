/** single-flight-cache.test.ts - Independent event simulation, coalescing property, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./single-flight-cache";
import type { VisualFrame } from "@/types";

interface Request { key: string; step: number }

function reference(requests: Request[], loadTime: number): { loads: number; waits: number; hits: number } {
    const cached = new Set<string>();
    const inFlight = new Map<string, number>();
    let loads = 0;
    let waits = 0;
    let hits = 0;
    const maxStep = Math.max(0, ...requests.map((r) => r.step));
    for (let time = 0; time <= maxStep; time += 1) {
        for (const [key, finish] of [...inFlight]) {
            if (finish === time) { cached.add(key); inFlight.delete(key); }
        }
        for (const r of requests.filter((item) => item.step === time)) {
            if (cached.has(r.key)) { hits += 1; }
            else if (inFlight.has(r.key)) { waits += 1; }
            else { inFlight.set(r.key, time + loadTime); loads += 1; }
        }
    }
    return { loads, waits, hits };
}

function checkFrames(frames: VisualFrame[], requestCount: number, keys: number): void {
    expect(frames.length).toBe(requestCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(keys * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SingleFlightCache", () => {
    it("matches an independent event simulation", () => {
        const cases = [
            {
                requests: [
                    { key: "a", step: 0 }, { key: "a", step: 0 }, { key: "b", step: 0 },
                    { key: "a", step: 1 }, { key: "b", step: 1 }, { key: "a", step: 2 },
                ],
                loadTime: 2,
            },
            {
                requests: [
                    { key: "x", step: 0 }, { key: "x", step: 1 }, { key: "x", step: 2 }, { key: "x", step: 3 },
                ],
                loadTime: 2,
            },
        ];
        for (const input of cases) {
            const expected = reference(input.requests, input.loadTime);
            const frames = [...mod.run(input)];
            const keys = new Set(input.requests.map((r) => r.key)).size;
            checkFrames(frames, input.requests.length, keys);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["loads"]).toBe(expected.loads);
            expect(final?.["waits"]).toBe(expected.waits);
            expect(final?.["hits"]).toBe(expected.hits);
            expect(expected.loads + expected.waits + expected.hits).toBe(input.requests.length);
        }
    });

    it("never starts more loads than distinct cold keys on random traffic", () => {
        let seed = 83;
        for (let trial = 0; trial < 20; trial += 1) {
            const loadTime = 1 + (trial % 4);
            const requests: Request[] = [];
            for (let i = 0; i < 20; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                requests.push({ key: String.fromCharCode(97 + (seed % 5)), step: i % 6 });
            }
            const expected = reference(requests, loadTime);
            const frames = [...mod.run({ requests, loadTime })];
            const keys = new Set(requests.map((r) => r.key)).size;
            checkFrames(frames, requests.length, keys);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["loads"]).toBe(expected.loads);
            expect(final?.["loads"] as number).toBeLessThanOrEqual(keys);
            expect([...mod.run({ requests, loadTime })]).toEqual(frames);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
