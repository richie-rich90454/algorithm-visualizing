/**
 * hierarchical-token-bucket.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hierarchical-token-bucket";
import type { VisualFrame } from "@/types";

interface Bucket {
    name?: string;
    rate?: number;
    burst?: number;
    parent?: string;
}
interface Packet {
    cls?: string;
    size?: number;
    t?: number;
}
interface Input {
    buckets: Bucket[];
    packets: Packet[];
}

/** Independent simulation of the same refill and borrow rules. */
function reference(input: Input) {
    const names = input.buckets.map((b, i) => String(b.name ?? `class-${i}`));
    const idx = new Map(names.map((n, i) => [n, i] as const));
    const rates = input.buckets.map((b) => Math.max(0, Number(b.rate) || 0));
    const bursts = input.buckets.map((b) => Math.max(1, Number(b.burst) || 1));
    const parents = input.buckets.map((b) => (b.parent ? (idx.get(b.parent) ?? -1) : -1));
    const tokens = bursts.slice();
    const verdicts: string[] = [];
    let last = Number(input.packets[0]?.t) || 0;
    for (const packet of input.packets) {
        const time = Number(packet.t) || 0;
        const size = Math.max(0, Number(packet.size) || 0);
        const cls = idx.get(String(packet.cls ?? "")) ?? -1;
        const dt = Math.max(0, time - last);
        last = time;
        for (let c = 0; c < tokens.length; c += 1) tokens[c] = Math.min(bursts[c]!, tokens[c]! + rates[c]! * dt);
        if (cls < 0) {
            verdicts.push("unknown");
        } else if (tokens[cls]! >= size) {
            tokens[cls] = tokens[cls]! - size;
            verdicts.push("sent");
        } else if (parents[cls]! >= 0 && tokens[parents[cls]!]! >= size) {
            tokens[parents[cls]!] = tokens[parents[cls]!]! - size;
            verdicts.push("borrowed");
        } else {
            verdicts.push("dropped");
        }
    }
    return { verdicts, tokens };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const bursts = frame.meta["bursts"] as number[];
        const tokens = frame.meta["tokens"] as number[];
        tokens.forEach((token, i) => {
            expect(token).toBeGreaterThanOrEqual(0);
            expect(token).toBeLessThanOrEqual((bursts[i] ?? 0) + 1e-9);
        });
    });
}

describe("Hierarchical Token Bucket", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent scheduler and keeps tokens within burst bounds", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input);
        expect(final?.["verdicts"]).toEqual(expected.verdicts);
        (final?.["tokens"] as number[]).forEach((token, i) => {
            expect(token).toBeCloseTo(expected.tokens[i]!, 6);
        });
    });

    it("matches the reference across randomized class trees and packet traces", () => {
        let seed = 777;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const buckets: Bucket[] = [
                { name: "root", rate: (rand() % 20) / 100, burst: 20 + (rand() % 20) },
                { name: "a", rate: (rand() % 10) / 100, burst: 5 + (rand() % 15), parent: "root" },
                { name: "b", rate: (rand() % 10) / 100, burst: 5 + (rand() % 15), parent: "root" },
            ];
            const packets: Packet[] = Array.from({ length: 15 }, () => ({
                cls: ["a", "b", "missing"][rand() % 3],
                size: 1 + (rand() % 12),
                t: rand() % 150,
            }));
            const testInput: Input = { buckets, packets };
            const frames = [...mod.run(testInput)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(testInput);
            expect(final?.["verdicts"]).toEqual(expected.verdicts);
            (final?.["tokens"] as number[]).forEach((token, i) => {
                expect(token).toBeCloseTo(expected.tokens[i]!, 6);
            });
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
