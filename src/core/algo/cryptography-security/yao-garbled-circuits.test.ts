/** yao-garbled-circuits.test.ts - Exhaustive AND truth table, single-row decryption, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { evaluate, garble, hashLabels } from "./yao-garbled-circuits";
import type { VisualFrame } from "@/types";

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

describe("Yao Garbled Circuit for AND (toy)", () => {
    it("evaluates the AND truth table for every seed and input pair", () => {
        for (let seed = 0; seed < 60; seed += 1) {
            const gate = garble(seed);
            const labels = [gate.inputA[0]!, gate.inputA[1]!];
            const others = [gate.inputB[0]!, gate.inputB[1]!];
            const seenRows = new Set<number>();
            for (const la of labels) {
                for (const lb of others) {
                    seenRows.add(la.color * 2 + lb.color);
                }
            }
            expect(seenRows.size).toBe(4);
            for (let a = 0; a < 2; a += 1) {
                for (let b = 0; b < 2; b += 1) {
                    const la = a === 0 ? gate.inputA[0]! : gate.inputA[1]!;
                    const lb = b === 0 ? gate.inputB[0]! : gate.inputB[1]!;
                    expect(evaluate(gate, la, lb)).toBe(a & b);
                }
            }
        }
    });

    it("only the matching label pair decrypts to a valid output label", () => {
        const gate = garble(4);
        const valid = new Set([gate.output[0]!.value, gate.output[1]!.value]);
        for (let a = 0; a < 2; a += 1) {
            for (let b = 0; b < 2; b += 1) {
                const la = a === 0 ? gate.inputA[0]! : gate.inputA[1]!;
                const lb = b === 0 ? gate.inputB[0]! : gate.inputB[1]!;
                const row = la.color * 2 + lb.color;
                const label = (gate.rows[row]! ^ hashLabels(la.value, lb.value)) & 0xffff;
                expect(valid.has(label)).toBe(true);
                const wrongRow = (row + 1) % 4;
                const wrongLabel = (gate.rows[wrongRow]! ^ hashLabels(la.value, lb.value)) & 0xffff;
                expect(valid.has(wrongLabel)).toBe(false);
            }
        }
    });

    it("rejects an unknown label value", () => {
        const gate = garble(4);
        const la = gate.inputA[0]!;
        const lb = gate.inputB[0]!;
        expect(evaluate(gate, { value: (la.value + 2) & 0xffff, color: la.color }, lb)).toBe(-1);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["output"]).toBe(1);
        expect(frames[frames.length - 1]?.meta["expected"]).toBe(1);
        expect(generator.next().done).toBe(true);
    });
});
