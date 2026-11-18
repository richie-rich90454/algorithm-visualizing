/**
 * kademlia-dht.test.ts - Brute-force nearest-peer check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kademlia-dht";
import type { VisualFrame } from "@/types";

function xorDistance(a: number, b: number): number {
    return (a ^ b) >>> 0;
}

/** Reference: the globally closest k peers, computed by full enumeration. */
function bruteForceNearest(ids: number[], target: number, k: number): number[] {
    return [...ids].sort((a, b) => xorDistance(a, target) - xorDistance(b, target)).slice(0, k);
}

function checkFrames(frames: VisualFrame[], nodeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodeCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Kademlia DHT", () => {
    it("finds the globally closest peers under XOR distance", () => {
        const ids = [1, 7, 12, 40, 90, 130, 200, 255];
        for (let target = 0; target < 256; target += 13) {
            for (const k of [1, 2, 3]) {
                const frames = [...mod.run({ ids, target, k })];
                checkFrames(frames, ids.length);
                const result = frames[frames.length - 1]!.meta["result"] as number[];
                expect(result).toEqual(bruteForceNearest(ids, target, k));
                const distances = frames[frames.length - 1]!.meta["resultDistances"] as number[];
                expect(distances).toEqual(result.map((id) => xorDistance(id, target)));
            }
        }
    });

    it("finds the nearest peer for random id sets and targets", () => {
        let seed = 12345;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const ids = Array.from({ length: 8 }, () => rand() & 63);
            const unique = [...new Set(ids)];
            const target = rand() & 63;
            const k = 1 + (rand() % 3);
            const frames = [...mod.run({ ids: unique, target, k })];
            const result = frames[frames.length - 1]!.meta["result"] as number[];
            expect(result).toEqual(bruteForceNearest(unique, target, k));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
