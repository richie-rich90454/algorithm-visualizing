/** homophonic-substitution.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./homophonic-substitution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Homophonic Substitution", () => {
    it("round-trips the default message and uses multiple codes for E", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
        const back = [...mod.run({ text: tokens.join(" "), mode: "decode" })];
        expect(back[back.length - 1]?.meta["output"]).toBe(input.text);

        const eTokens = tokens.filter((_, i) => input.text[i] === "E");
        expect(new Set(eTokens).size).toBeGreaterThan(1);
    });

    it("assigns unique codes and round-trips random letter strings", () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let seed = 808;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        const allCodes = new Set<string>();
        for (let trial = 0; trial < 100; trial += 1) {
            const text = Array.from({ length: 1 + rand(30) }, () => alphabet[rand(26)]).join("");
            const frames = [...mod.run({ text, mode: "encode" })];
            const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
            tokens.forEach((token) => allCodes.add(token));
            const back = [...mod.run({ text: tokens.join(" "), mode: "decode" })];
            expect(back[back.length - 1]?.meta["output"]).toBe(text);
        }
        expect(allCodes.size).toBeGreaterThan(26);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
