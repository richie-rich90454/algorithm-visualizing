/**
 * bacon-shor-code.test.ts - Syndrome decoding and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { baconShorCorrect, baconShorSyndrome } from "./bacon-shor-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities).toHaveLength(9);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Brute-force decode of a row or column coordinate into its two-check pattern. */
function bruteDecode(coordinate: number): number {
    const flips = [false, false];
    if (coordinate === 0) {
        flips[0] = true;
    } else if (coordinate === 1) {
        flips[0] = true;
        flips[1] = true;
    } else {
        flips[1] = true;
    }
    return flips[0] && flips[1] ? 1 : flips[0] ? 0 : 2;
}

describe("Bacon-Shor Code", () => {
    it("decodes the X error row for every grid position", () => {
        for (let index = 0; index < 9; index += 1) {
            const syndrome = baconShorSyndrome([{ type: "X", index }]);
            expect(syndrome.xRow).toBe(bruteDecode(Math.floor(index / 3)));
            expect(syndrome.zColumn).toBeNull();
        }
    });

    it("clears the syndrome for every X and Z placement", () => {
        for (let x = 0; x < 9; x += 1) {
            for (let z = 0; z < 9; z += 1) {
                const result = baconShorCorrect([{ type: "X", index: x }, { type: "Z", index: z }]);
                expect(result.cleared).toBe(true);
                expect(result.logicalPreserved).toBe(true);
                expect(result.syndrome.xRow).toBe(bruteDecode(Math.floor(x / 3)));
                expect(result.syndrome.zColumn).toBe(bruteDecode(z % 3));
            }
        }
    });

    it("reports the decoded positions in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["cleared"]).toBe(true);
        expect(final?.["logicalPreserved"]).toBe(true);
        const syndrome = final?.["syndrome"] as { xRow: number; zColumn: number };
        expect(syndrome.xRow).toBe(Math.floor(5 / 3));
        expect(syndrome.zColumn).toBe(3 % 3);
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
