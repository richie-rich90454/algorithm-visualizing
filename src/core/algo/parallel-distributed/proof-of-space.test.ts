/**
 * proof-of-space.test.ts - Chain verification and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./proof-of-space";
import { hash32 } from "./proof-of-space";
import type { VisualFrame } from "@/types";

function referenceChain(seed: number, n: number): number[] {
    const chain = [hash32(seed >>> 0)];
    for (let i = 1; i <= n; i += 1) chain.push(hash32(chain[i - 1]!));
    return chain;
}

function verifyCheckpoint(value: number, fromIndex: number, chainLength: number, root: number): boolean {
    let cursor = value;
    for (let i = fromIndex + 1; i <= chainLength; i += 1) cursor = hash32(cursor);
    return cursor === root;
}

function checkFrames(frames: VisualFrame[], checks: number): void {
    expect(frames.length).toBe(2 * checks + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(checks + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Sequential proof of space", () => {
    it("builds the right root and verifies every checkpoint", () => {
        const settings = { seed: 12345, chainLength: 64, checks: 4 };
        const frames = [...mod.run(settings)];
        checkFrames(frames, settings.checks);
        const final = frames[frames.length - 1]!.meta;
        const chain = referenceChain(settings.seed, settings.chainLength);
        expect(Number(final["root"])).toBe(chain[settings.chainLength]!);
        expect(final["allPass"]).toBe(true);
        expect(Number(final["verifiedCount"])).toBe(settings.checks);
        const indices = final["checkpointIndices"] as number[];
        const values = final["checkpointValues"] as number[];
        for (let m = 0; m < settings.checks; m += 1) {
            expect(values[m]).toBe(chain[indices[m]!]!);
            expect(verifyCheckpoint(values[m]!, indices[m]!, settings.chainLength, chain[settings.chainLength]!)).toBe(true);
        }
    });

    it("rejects tampered checkpoints", () => {
        const seed = 42;
        const chainLength = 40;
        const chain = referenceChain(seed, chainLength);
        const root = chain[chainLength]!;
        const index = 15;
        const wrong = (chain[index]! ^ 0xffffffff) >>> 0;
        expect(verifyCheckpoint(chain[index]!, index, chainLength, root)).toBe(true);
        expect(verifyCheckpoint(wrong, index, chainLength, root)).toBe(false);
    });

    it("depends on the challenge seed", () => {
        const a = [...mod.run({ seed: 1, chainLength: 32, checks: 2 })];
        const b = [...mod.run({ seed: 2, chainLength: 32, checks: 2 })];
        expect(a[a.length - 1]!.meta["root"]).not.toBe(b[b.length - 1]!.meta["root"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
