import { describe, expect, it } from "vitest";
import mod from "./columnar-storage";
import type { VisualFrame } from "@/types";

type Row = Record<string, number | string>;
type Predicate = { column: string; op: ">" | "<" | "=" | ">=" | "<="; value: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteForce(rows: Row[], predicate: Predicate): number[] {
    const matches: number[] = [];
    rows.forEach((row, index) => {
        const value = Number(row[predicate.column]);
        const ok = predicate.op === ">" ? value > predicate.value
            : predicate.op === "<" ? value < predicate.value
                : predicate.op === "=" ? value === predicate.value
                    : predicate.op === ">=" ? value >= predicate.value
                        : value <= predicate.value;
        if (ok) {
            matches.push(index);
        }
    });
    return matches;
}

describe("Columnar Storage", () => {
    it("returns exactly the rows a full scan returns and prunes safely", () => {
        const input = mod.defaultInput as { rows: Row[]; predicate: Predicate; rowGroupSize: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["matchedRows"]).toEqual(bruteForce(input.rows, input.predicate));
        expect((meta?.["prunedGroups"] as number[]).length).toBeGreaterThan(0);
        expect((meta?.["prunedGroups"] as number[]).length + (meta?.["scannedGroups"] as number[]).length)
            .toBe(meta?.["groupCount"]);
    });

    it("transposes, dictionary-encodes, and zone-maps columns consistently", () => {
        const input = mod.defaultInput as { rows: Row[]; rowGroupSize: number };
        const frames = [...mod.run(input)];
        const meta = frames[frames.length - 1]?.meta;
        const names = meta?.["columnNames"] as string[];
        const columns = meta?.["columns"] as string[];

        // Transpose back to rows and compare with the original table.
        for (let r = 0; r < input.rows.length; r += 1) {
            names.forEach((name, c) => {
                const value = (columns[c] ?? "").split(",")[r];
                expect(Number(value)).toBe(Number(input.rows[r]?.[name]));
            });
        }

        // Every dictionary entry round-trips its encoded ids.
        for (const entry of meta?.["dictionaries"] as string[]) {
            const [name, distinctPart, idsPart] = entry.split("|");
            const distinct = (distinctPart ?? "").replace(/^\[|\]$/g, "").split(";");
            const ids = (idsPart ?? "").split(",").map(Number);
            const columnIndex = names.indexOf(name ?? "");
            const original = (columns[columnIndex] ?? "").split(",");
            expect(ids.map((id) => distinct[id])).toEqual(original);
        }

        // Zone maps bound the values of every group they describe.
        for (const entry of meta?.["zoneMaps"] as string[]) {
            const [name, groupPart, minPart, maxPart] = entry.split("|");
            const group = Number(groupPart);
            const columnIndex = names.indexOf(name ?? "");
            const values = (columns[columnIndex] ?? "").split(",").slice(
                group * input.rowGroupSize,
                (group + 1) * input.rowGroupSize,
            ).map(Number);
            for (const value of values) {
                expect(value).toBeGreaterThanOrEqual(Number(minPart));
                expect(value).toBeLessThanOrEqual(Number(maxPart));
            }
        }
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
