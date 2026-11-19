/** sum-check-protocol.test.ts - Brute-force sum, transcript verification, tamper rejection, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { challenges, g, proverMessages, sumAll, verify } from "./sum-check-protocol";
import type { VisualFrame } from "@/types";

const P = 101;
const mp = (v: number): number => ((v % P) + P) % P;

/** Independent polynomial definition and brute-force sum. */
function refG(p: number[]): number {
    const [x = 0, y = 0, z = 0] = p;
    return mp(3 * x + 5 * y + 7 * z + 11 * x * y - 2 * y * z + 4);
}
function refSum(): number {
    let total = 0;
    for (let x = 0; x < 2; x += 1) {
        for (let y = 0; y < 2; y += 1) {
            for (let z = 0; z < 2; z += 1) {
                total = mp(total + refG([x, y, z]));
            }
        }
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Sum-Check Protocol (toy)", () => {
    it("the claimed sum matches brute force and g is consistent", () => {
        expect(sumAll()).toBe(refSum());
        for (let x = 0; x < 2; x += 1) {
            for (let y = 0; y < 2; y += 1) {
                for (let z = 0; z < 2; z += 1) {
                    expect(g([x, y, z])).toBe(refG([x, y, z]));
                }
            }
        }
    });

    it("honest transcripts verify for many challenge seeds", () => {
        const claim = refSum();
        for (let seed = 0; seed < 60; seed += 1) {
            const choices = challenges(seed);
            const messages = proverMessages(claim, choices);
            expect(messages).toHaveLength(3);
            let expected = claim;
            for (let round = 0; round < 3; round += 1) {
                const message = messages[round]!;
                expect(mp(message.atZero + message.atOne)).toBe(expected);
                expected = mp((1 - (choices[round] ?? 0)) * message.atZero + (choices[round] ?? 0) * message.atOne);
            }
            expect(expected).toBe(refG(choices));
            expect(verify(claim, choices, messages)).toBe(true);
        }
    });

    it("rejects a wrong claim or a tampered round message", () => {
        const claim = refSum();
        const choices = challenges(11);
        const messages = proverMessages(claim, choices);
        expect(verify(claim + 1, choices, messages)).toBe(false);
        expect(verify(claim, choices, [{ ...messages[0]!, atZero: mp(messages[0]!.atZero + 1) }, ...messages.slice(1)])).toBe(false);
        expect(verify(claim, choices, messages.slice(0, 2))).toBe(false);
        expect(verify(claim, choices.slice(0, 2), messages)).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["verified"]).toBe(true);
        expect(mod.run({ seed: 11, tamper: true }).next().done).toBe(false);
        const tampered = [...mod.run({ seed: 11, tamper: true })];
        expect(tampered[tampered.length - 1]?.meta["verified"]).toBe(false);
        expect(generator.next().done).toBe(true);
    });
});
