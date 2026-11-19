/** mayo-signature.test.ts - Exhaustive oil-solve brute force, tamper detection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { buildForms, evaluate, messageTarget, sign, verify } from "./mayo-signature";
import type { VisualFrame } from "@/types";

const P = 31;
const modp = (v: number): number => ((v % P) + P) % P;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(6);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("MAYO-Style Oil-Vinegar Signature (toy)", () => {
    it("signs and verifies for many messages and nonces", () => {
        const forms = buildForms();
        const messages = ["", "a", "hello", "message digest", "post quantum"];
        for (const message of messages) {
            for (let nonce = 0; nonce < 12; nonce += 1) {
                const signature = sign(message, nonce);
                expect(signature).toHaveLength(6);
                expect(signature.every((v) => v >= 0 && v < P)).toBe(true);
                expect(verify(message, signature)).toBe(true);
                const target = messageTarget(message);
                expect(evaluate(forms[0]!, signature)).toBe(target[0]);
                expect(evaluate(forms[1]!, signature)).toBe(target[1]);
            }
        }
    });

    it("the oil values are the unique solution by exhaustive brute force", () => {
        const forms = buildForms();
        for (let nonce = 0; nonce < 5; nonce += 1) {
            const message = `msg-${nonce}`;
            const signature = sign(message, nonce);
            const vinegar = signature.slice(0, 4);
            const target = messageTarget(message);
            const solutions: number[][] = [];
            for (let o0 = 0; o0 < P; o0 += 1) {
                for (let o1 = 0; o1 < P; o1 += 1) {
                    const candidate = [...vinegar, o0, o1];
                    if (evaluate(forms[0]!, candidate) === target[0] && evaluate(forms[1]!, candidate) === target[1]) {
                        solutions.push([o0, o1]);
                    }
                }
            }
            expect(solutions).toEqual([signature.slice(4)]);
        }
    });

    it("rejects malformed and tampered signatures", () => {
        const signature = sign("hello", 1);
        expect(verify("hello", signature)).toBe(true);
        expect(verify("hello", [...signature.slice(0, 5), modp(signature[5]! + 1)])).toBe(false);
        expect(verify("hello", [modp(signature[0]! + 1), ...signature.slice(1)])).toBe(false);
        expect(verify("hello", signature.slice(0, 5))).toBe(false);
        expect(verify("hello", [...signature, 0])).toBe(false);
        expect(verify("hello", [...signature.slice(0, 5), 99])).toBe(false);
        expect(verify("other message", signature)).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["verified"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
