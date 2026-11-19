/**
 * petersons-algorithm.test.ts - Brute-force safety check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./petersons-algorithm";
import type { VisualFrame } from "@/types";

interface State {
    flag: [boolean, boolean];
    turn: number;
    inCS: [boolean, boolean];
    pc: [number, number];
    entries: [number, number];
}

function initial(): State {
    return {
        flag: [false, false],
        turn: 0,
        inCS: [false, false],
        pc: [0, 0],
        entries: [0, 0],
    };
}

function clone(state: State): State {
    return {
        flag: [state.flag[0], state.flag[1]],
        turn: state.turn,
        inCS: [state.inCS[0], state.inCS[1]],
        pc: [state.pc[0], state.pc[1]],
        entries: [state.entries[0], state.entries[1]],
    };
}

/**
 * Independent atomic execution of Peterson's six statements for one process.
 * Program counters: 0 raise flag, 1 give turn, 2 wait check, 3 enter, 4 exit.
 */
function execute(state: State, p: number): State {
    const next = clone(state);
    const other = 1 - p;
    const action = next.pc[p];
    if (action === 0) {
        next.flag[p] = true;
        next.pc[p] += 1;
    } else if (action === 1) {
        next.turn = other;
        next.pc[p] += 1;
    } else if (action === 2) {
        if (!(next.flag[other] && next.turn === other)) {
            next.pc[p] += 1;
        }
    } else if (action === 3) {
        next.inCS[p] = true;
        next.entries[p] += 1;
        next.pc[p] += 1;
    } else if (action === 4) {
        next.inCS[p] = false;
        next.flag[p] = false;
        next.pc[p] += 1;
    }
    return next;
}

function key(state: State): string {
    return [
        state.flag[0] ? 1 : 0,
        state.flag[1] ? 1 : 0,
        state.turn,
        state.pc[0],
        state.pc[1],
        state.inCS[0] ? 1 : 0,
        state.inCS[1] ? 1 : 0,
    ].join("");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["mutualExclusion"]).toBe(true);
    });
}

describe("Peterson's Algorithm", () => {
    it("never lets both processes into the critical section under any interleaving", () => {
        const queue: State[] = [initial()];
        const visited = new Set<string>();
        let reachedEnd = false;
        let explored = 0;
        while (queue.length > 0 && explored < 20000) {
            const state = queue.shift() as State;
            const id = key(state);
            if (visited.has(id)) {
                continue;
            }
            visited.add(id);
            explored += 1;
            expect(state.inCS[0] && state.inCS[1]).toBe(false);
            if (state.pc[0] === 5 && state.pc[1] === 5) {
                reachedEnd = true;
                expect(state.inCS[0]).toBe(false);
                expect(state.inCS[1]).toBe(false);
                expect(state.entries[0]).toBeGreaterThan(0);
                expect(state.entries[1]).toBeGreaterThan(0);
                continue;
            }
            queue.push(execute(state, 0));
            queue.push(execute(state, 1));
        }
        expect(explored).toBeLessThan(20000);
        expect(reachedEnd).toBe(true);
    });

    it("replays the contended schedule with each process entering once", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        const entries = last?.["entries"] as number[];
        expect(entries).toEqual([1, 1]);
        expect(frames.some((frame) => frame.meta["waiting"] === true)).toBe(true);
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
