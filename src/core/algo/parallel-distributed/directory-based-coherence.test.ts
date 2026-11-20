/** directory-based-coherence.test.ts - Coherence invariant, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./directory-based-coherence";
import type { VisualFrame } from "@/types";

interface Access {
    proc: number;
    op: "read" | "write";
    addr: string;
    value?: number;
}

function checkFrames(frames: VisualFrame[], accesses: number, procs: number, addresses: number): void {
    expect(frames.length).toBe(accesses + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(addresses * 2 + procs * addresses);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["valid"]).toBe(true);
    });
}

/** Independent oracle: a single-copy memory model updated in program order. */
function oracle(accesses: Access[], addresses: string[]): Record<string, number> {
    const memory: Record<string, number> = {};
    for (const addr of addresses) memory[addr] = 0;
    for (const access of accesses) {
        if (access.op === "write") memory[access.addr] = access.value ?? 0;
    }
    return memory;
}

describe("Directory-based MSI coherence", () => {
    it("preserves the invariant on a fixed access sequence and matches a memory oracle", () => {
        const accesses: Access[] = (mod.defaultInput as { accesses: Access[] }).accesses;
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, accesses.length, 3, 2);
        expect(frames[frames.length - 1]!.meta["view"]).toEqual(oracle(accesses, ["A", "B"]));
    });

    it("preserves the invariant under many generated access sequences", () => {
        const addresses = ["A", "B", "C"];
        for (let seed = 1; seed <= 40; seed += 1) {
            const accesses: Access[] = [];
            let s = seed;
            const rand = (): number => {
                s = (s * 1103515245 + 12345) & 0x7fffffff;
                return s;
            };
            for (let i = 0; i < 25; i += 1) {
                const proc = rand() % 4;
                const addr = addresses[rand() % addresses.length]!;
                if (rand() % 2 === 0) accesses.push({ proc, op: "read", addr });
                else accesses.push({ proc, op: "write", addr, value: (rand() % 100) + 1 });
            }
            const frames = [...mod.run({ procs: 4, addresses, accesses })];
            checkFrames(frames, accesses.length, 4, addresses.length);
            expect(frames[frames.length - 1]!.meta["view"]).toEqual(oracle(accesses, addresses));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
