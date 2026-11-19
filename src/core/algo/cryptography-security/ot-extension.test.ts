/** ot-extension.test.ts - Transfer correctness, hiding, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./ot-extension";
import type { VisualFrame } from "@/types";

const pad = (seed: number, index: number, branch: number): number => {
    const mixed = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b9) ^ Math.imul(branch + 1, 0x85ebca6b), 0x27d4eb2f) >>> 0;
    return (mixed ^ (mixed >>> 13)) & 0xff;
};

const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("OT extension toy", () => {
    it("delivers the chosen message and hides the other one", () => {
        const random = rng(5150);
        for (let trial = 0; trial < 80; trial += 1) {
            const seed = Math.floor(random() * 0xffffffff) >>> 0;
            const count = 1 + Math.floor(random() * 8);
            const messages: Array<{ m0: number; m1: number }> = [];
            const choices: number[] = [];
            for (let i = 0; i < count; i += 1) {
                messages.push({ m0: Math.floor(random() * 256), m1: Math.floor(random() * 256) });
                choices.push(random() < 0.5 ? 0 : 1);
            }
            const frames = [...mod.run({ messages, choices, seed })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            expect(meta["allCorrect"]).toBe(true);
            const transcript = meta["transcript"] as string[];
            expect(transcript.length).toBe(count);
            transcript.forEach((entry, i) => {
                const [m0, m1, choice, p0, p1, e0, e1, received] = entry.split(",").map(Number);
                expect(p0).toBe(pad(seed, i, 0));
                expect(p1).toBe(pad(seed, i, 1));
                expect(e0).toBe((m0 as number) ^ (p0 as number));
                expect(e1).toBe((m1 as number) ^ (p1 as number));
                expect(received).toBe(choice === 0 ? m0 : m1);
                if (p0 !== p1) {
                    const wrongPeek = ((choice === 0 ? e1 : e0) as number) ^ (choice === 0 ? p0 : p1 as number);
                    expect(wrongPeek).not.toBe(choice === 0 ? m1 : m0);
                }
            });
        }
    });

    it("reports hiding when the two pads differ", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const meta = finalMeta(frames);
        expect(meta["correct"]).toBe(4);
        expect(meta["hidden"]).toBe(4);
        expect(meta["allHidden"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
