/**
 * stochastic-fair-queuing.test.ts - Independent reference schedule, fairness
 * property, hash determinism, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { hashFlow, schedule } from "./stochastic-fair-queuing";
import type { VisualFrame } from "@/types";

/** Brute-force reference written independently of the module's schedule(). */
function reference(flows: number[][], buckets: number, rounds: number, perturbEvery: number): number[] {
    const remaining = flows.map((q) => [...q]);
    const served = flows.map(() => 0);
    for (let round = 0; round < rounds; round += 1) {
        const seed = Math.floor(round / perturbEvery);
        for (let offset = 0; offset < buckets; offset += 1) {
            const bucket = ((round % buckets) + offset) % buckets;
            for (let flow = 0; flow < flows.length; flow += 1) {
                const hash = (flow * 2654435761 + seed * 40503 + 7) % buckets;
                if (hash === bucket && (remaining[flow]?.length ?? 0) > 0) {
                    remaining[flow]?.shift();
                    served[flow] = (served[flow] ?? 0) + 1;
                }
            }
        }
    }
    return served;
}

function checkFrames(frames: VisualFrame[], flowCount: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(flowCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    for (let i = 1; i < frames.length; i += 1) {
        expect(frames[i]?.stepNumber).toBe((frames[i - 1]?.stepNumber ?? -1) + 1);
    }
}

describe("Stochastic Fair Queuing", () => {
    it("matches an independent reference schedule on many inputs", () => {
        const cases = [
            { flows: [[1, 2, 3], [4, 5], [6, 7, 8, 9]], buckets: 4, rounds: 3, perturbEvery: 2 },
            { flows: [[1], [2], [3]], buckets: 2, rounds: 5, perturbEvery: 1 },
            { flows: [[1, 2], [3, 4], [5, 6], [7, 8]], buckets: 3, rounds: 4, perturbEvery: 3 },
            { flows: [[1, 2, 3, 4, 5]], buckets: 1, rounds: 6, perturbEvery: 2 },
        ];
        for (const testCase of cases) {
            const got = schedule(testCase).served;
            expect(got).toEqual(reference(testCase.flows, testCase.buckets, testCase.rounds, testCase.perturbEvery));
        }
    });

    it("serves each flow exactly once per round when buckets do not collide", () => {
        const flows = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];
        const result = schedule({ flows, buckets: 8, rounds: 3, perturbEvery: 1 });
        for (const count of result.served) {
            expect(count).toBe(3);
        }
        expect(result.events.length).toBe(12);
    });

    it("never serves more packets than a flow has", () => {
        const flows = [[1, 2], [3], [4, 5, 6]];
        const result = schedule({ flows, buckets: 3, rounds: 10, perturbEvery: 2 });
        flows.forEach((queue, index) => {
            expect(result.served[index]).toBeLessThanOrEqual(queue.length);
        });
        expect(result.events.length).toBe(6);
    });

    it("hashes flows deterministically into the valid bucket range", () => {
        for (let seed = 0; seed < 5; seed += 1) {
            for (let flow = 0; flow < 20; flow += 1) {
                const bucket = hashFlow(flow, 4, seed);
                expect(bucket).toBeGreaterThanOrEqual(0);
                expect(bucket).toBeLessThan(4);
                expect(hashFlow(flow, 4, seed)).toBe(bucket);
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
