/**
 * proof-of-replication.test.ts - Seal bijection and challenge verification, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./proof-of-replication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Proof of Replication", () => {
    it("seals a bijection and verifies every challenge", () => {
        for (const input of [
            mod.defaultInput as object,
            { sectors: 3, blocks: 6, seed: 21, challenges: [0, 1, 5, 12, 17] },
        ]) {
            const frames = [...mod.run(input)];
            const total = Number(frames[0]!.meta["total"]);
            checkFrames(frames, total);
            const final = frames[frames.length - 1]!.meta;
            const data = final["data"] as number[];
            const replica = final["replica"] as number[];
            const permutation = final["permutation"] as number[];
            const masks = final["masks"] as number[];
            const challenges = (input as { challenges: number[] }).challenges;

            expect(new Set(permutation).size).toBe(total);
            for (let index = 0; index < total; index += 1) {
                const expected = ((data[permutation[index]!] ?? 0) + (masks[index] ?? 0)) % 251;
                expect(replica[index]).toBe(expected);
                expect(data[permutation[index]!]).toBe((replica[index]! - masks[index]! + 251) % 251);
            }
            const challengeFrames = frames.filter((frame) => frame.meta["phase"] === "challenge");
            expect(challengeFrames.length).toBe(challenges.length);
            for (const frame of challengeFrames) expect(frame.meta["valid"]).toBe(true);
            expect(Number(final["validCount"])).toBe(challenges.length);
        }
    });

    it("a tampered replica block would fail its challenge", () => {
        const frames = [...mod.run(mod.defaultInput as object)];
        const final = frames[frames.length - 1]!.meta;
        const data = final["data"] as number[];
        const replica = final["replica"] as number[];
        const permutation = final["permutation"] as number[];
        const masks = final["masks"] as number[];
        const tampered = [...replica];
        const target = 3;
        tampered[target] = (tampered[target]! + 1) % 251;
        const expected = ((data[permutation[target]!] ?? 0) + (masks[target] ?? 0)) % 251;
        expect(tampered[target]).not.toBe(expected);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
