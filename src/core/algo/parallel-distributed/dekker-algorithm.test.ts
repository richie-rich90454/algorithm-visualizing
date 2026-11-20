/**
 * dekker-algorithm.test.ts - Mutual exclusion verification and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { dekkerExplore, dekkerSchedule, dekkerStep } from "./dekker-algorithm";
import type { DekkerState } from "./dekker-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent state-space search written from the textbook pseudocode. */
function bruteExplore(): { states: number; violations: number; terminal: boolean } {
    const encode = (s: { pc: number[]; flag: boolean[]; turn: number }) =>
        `${s.pc[0]}${s.pc[1]}${s.flag[0] ? 1 : 0}${s.flag[1] ? 1 : 0}${s.turn}`;
    const move = (s: { pc: number[]; flag: boolean[]; turn: number }, i: number) => {
        const other = 1 - i;
        const pc = s.pc.slice();
        const flag = s.flag.slice();
        let turn = s.turn;
        const at = pc[i] as number;
        if (at === 0) { flag[i] = true; pc[i] = 1; }
        else if (at === 1) {
            if (!flag[other]) { pc[i] = 5; }
            else if (turn === other) { pc[i] = 2; }
        } else if (at === 2) { flag[i] = false; pc[i] = 3; }
        else if (at === 3) { if (turn !== other) { pc[i] = 4; } }
        else if (at === 4) { flag[i] = true; pc[i] = 1; }
        else if (at === 5) { turn = other; flag[i] = false; pc[i] = 6; }
        return { pc, flag, turn };
    };
    const start = { pc: [0, 0], flag: [false, false], turn: 0 };
    const seen = new Set<string>([encode(start)]);
    const stack = [start];
    let violations = 0;
    let terminal = false;
    while (stack.length > 0) {
        const state = stack.pop() as { pc: number[]; flag: boolean[]; turn: number };
        if (state.pc[0] === 5 && state.pc[1] === 5) { violations += 1; }
        if (state.pc[0] === 6 && state.pc[1] === 6) { terminal = true; }
        for (const i of [0, 1]) {
            const next = move(state, i);
            const k = encode(next);
            if (!seen.has(k)) { seen.add(k); stack.push(next); }
        }
    }
    return { states: seen.size, violations, terminal };
}

describe("Dekker's Algorithm", () => {
    it("matches an independent exhaustive state-space search", () => {
        const result = dekkerExplore();
        const reference = bruteExplore();
        expect(result.states).toBe(reference.states);
        expect(result.bothInCritical).toBe(reference.violations);
        expect(result.terminalReached).toBe(reference.terminal);
        expect(result.mutualExclusion).toBe(true);
        expect(result.terminalReached).toBe(true);
    });

    it("keeps at most one process in the critical section along a concrete schedule", () => {
        const schedule = dekkerSchedule();
        expect(schedule.length).toBeGreaterThan(1);
        for (const state of schedule) {
            expect(state.pc[0] === 5 && state.pc[1] === 5).toBe(false);
        }
        const last = schedule[schedule.length - 1] as DekkerState;
        expect(last.pc).toEqual([6, 6]);
    });

    it("follows the textbook transition table for a single step", () => {
        const start: DekkerState = { pc: [0, 0], flag: [false, false], turn: 0, actor: -1 };
        const after = dekkerStep(start, 0);
        expect(after.pc).toEqual([1, 0]);
        expect(after.flag).toEqual([true, false]);
        const both: DekkerState = { pc: [1, 1], flag: [true, true], turn: 0, actor: -1 };
        expect(dekkerStep(both, 1).pc).toEqual([1, 2]);
        expect(dekkerStep(both, 0).pc).toEqual([1, 1]);
        const otherDown: DekkerState = { pc: [1, 1], flag: [true, false], turn: 0, actor: -1 };
        expect(dekkerStep(otherDown, 0).pc).toEqual([5, 1]);
    });

    it("reports a verified result in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["correct"]).toBe(true);
        expect(final?.["mutualExclusion"]).toBe(true);
        expect(Number(final?.["states"])).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
