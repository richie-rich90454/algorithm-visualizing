/**
 * dh-psi.test.ts - Brute-force comparison against naive intersection,
 * privacy checks, frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { GENERATOR, PRIME, dhPsi, hashExponent, modPow } from "./dh-psi";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(24);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(8);
        expect(Array.isArray(frame.meta["intersection"])).toBe(true);
    });
}

describe("DH-based PSI (toy field)", () => {
    it("has correct modular exponentiation and item hashing", () => {
        expect(modPow(2, 10, 1009)).toBe(1024 % 1009);
        expect(modPow(7, 0, 1009)).toBe(1);
        expect(modPow(3, 5, 1009)).toBe(243);
        for (let item = 0; item < 200; item += 1) {
            const h = hashExponent(item);
            expect(h).toBeGreaterThan(0);
            expect(h).toBeLessThan(PRIME - 1);
            expect(h).toBe(hashExponent(item));
        }
        expect(modPow(GENERATOR, PRIME - 1, PRIME)).toBe(1);
        for (const primeFactor of [2, 3, 7]) {
            expect(modPow(GENERATOR, (PRIME - 1) / primeFactor, PRIME)).not.toBe(1);
        }
    });

    it("matches a brute-force naive intersection across random sets", () => {
        for (let trial = 0; trial < 120; trial += 1) {
            const client = Array.from({ length: trial % 7 }, (_, i) => (trial * 13 + i * 17) % 60);
            const server = Array.from({ length: trial % 5 }, (_, i) => (trial * 7 + i * 23 + 3) % 60);
            const a = 3 + (trial % 41);
            const b = 5 + (trial % 37);
            const result = dhPsi(client, server, a, b);
            const expected = client.filter((x) => server.includes(x));
            expect(result.intersection).toEqual(expected);
            expect(result.clientBlinded.length).toBe(client.length);
            expect(result.serverBlinded.length).toBe(server.length);
            expect(result.serverAnswer.length).toBe(client.length);
            expect(result.clientCheck.length).toBe(server.length);
        }
    });

    it("hides nonmatching items in the transmitted values", () => {
        const client = [11, 22, 33, 44];
        const server = [22, 44, 66];
        const result = dhPsi(client, server, 13, 17);
        expect(result.clientBlinded.every((v) => v >= 0 && v < PRIME)).toBe(true);
        expect(result.serverBlinded.every((v) => v >= 0 && v < PRIME)).toBe(true);
        expect(result.clientBlinded).not.toEqual(client);
        expect(result.serverBlinded).not.toEqual(server);
        const changed = dhPsi(client, server, 13, 19);
        expect(changed.serverBlinded).not.toEqual(result.serverBlinded);
        expect(changed.intersection).toEqual(result.intersection);
        expect(dhPsi(client, server, 13, 17)).toEqual(result);
    });

    it("emits well-formed frames matching a fresh run", () => {
        const input = mod.defaultInput as { clientItems: number[]; serverItems: number[]; clientSecret: number; serverSecret: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = dhPsi(input.clientItems, input.serverItems, input.clientSecret, input.serverSecret).intersection;
        expect(frames[frames.length - 1]!.meta["intersection"]).toEqual(expected);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(4);
        expect(gen.next().done).toBe(true);
    });
});
