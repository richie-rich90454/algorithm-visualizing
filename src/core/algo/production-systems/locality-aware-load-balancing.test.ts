/** locality-aware-load-balancing.test.ts - Independent balancer, preference property, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./locality-aware-load-balancing";
import type { VisualFrame } from "@/types";

interface Request { id: string; doc: string }

function reference(requests: Request[], servers: number, capacity: number, cacheSize: number): number[] {
    const loads = Array<number>(servers).fill(0);
    const caches: string[][] = Array.from({ length: servers }, () => []);
    const least = (list: number[]): number => {
        let best = list[0] ?? 0;
        for (const i of list) { if (loads[i] < loads[best]) { best = i; } }
        return best;
    };
    const chosen: number[] = [];
    for (const r of requests) {
        const candidates: number[] = [];
        for (let i = 0; i < servers; i += 1) {
            if (caches[i].includes(r.doc) && loads[i] < capacity) { candidates.push(i); }
        }
        const server = candidates.length > 0
            ? least(candidates)
            : least(Array.from({ length: servers }, (_, i) => i));
        loads[server] += 1;
        caches[server] = [r.doc, ...caches[server].filter((d) => d !== r.doc)].slice(0, cacheSize);
        chosen.push(server);
    }
    return chosen;
}

function checkFrames(frames: VisualFrame[], requestCount: number, servers: number, cacheSize: number): void {
    expect(frames.length).toBe(requestCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(servers * cacheSize);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LocalityAwareLoadBalancing", () => {
    it("matches an independent balancer", () => {
        const cases = [
            {
                servers: 3, capacity: 4, cacheSize: 2,
                requests: [
                    { id: "r1", doc: "A" }, { id: "r2", doc: "B" }, { id: "r3", doc: "A" },
                    { id: "r4", doc: "C" }, { id: "r5", doc: "B" }, { id: "r6", doc: "A" },
                ],
            },
            {
                servers: 2, capacity: 2, cacheSize: 1,
                requests: [
                    { id: "a", doc: "X" }, { id: "b", doc: "X" }, { id: "c", doc: "Y" }, { id: "d", doc: "X" },
                ],
            },
        ];
        for (const input of cases) {
            const expected = reference(input.requests, input.servers, input.capacity, input.cacheSize);
            const frames = [...mod.run(input)];
            checkFrames(frames, input.requests.length, input.servers, input.cacheSize);
            expect(frames[frames.length - 1]?.meta["assignments"]).toEqual(expected);
        }
    });

    it("respects the locality preference and capacity on random traffic", () => {
        let seed = 71;
        for (let trial = 0; trial < 20; trial += 1) {
            const servers = 2 + (trial % 4);
            const capacity = 2 + (trial % 4);
            const cacheSize = 1 + (trial % 3);
            const requests: Request[] = [];
            for (let i = 0; i < 18; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                requests.push({ id: `r${i}`, doc: String.fromCharCode(65 + (seed % 4)) });
            }
            const expected = reference(requests, servers, capacity, cacheSize);
            const frames = [...mod.run({ servers, capacity, cacheSize, requests })];
            checkFrames(frames, requests.length, servers, cacheSize);
            expect(frames[frames.length - 1]?.meta["assignments"]).toEqual(expected);

            const loads = frames.slice(1, -1).map((frame) => frame.meta["loads"] as number[]);
            loads.forEach((snapshot) => {
                expect(Math.min(...snapshot)).toBeGreaterThanOrEqual(0);
            });
            expect([...mod.run({ servers, capacity, cacheSize, requests })]).toEqual(frames);
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
