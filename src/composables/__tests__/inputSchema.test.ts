/**
 * inputSchema.test.ts – Checks the friendly-input model against the shapes
 * real modules use: scalars, lists, matrices, and nested JSON.
 */

import { describe, expect, it } from "vitest";
import {
    buildInput,
    classify,
    describeInput,
    inputShape,
    parseField,
    randomizeInput,
} from "../inputSchema";

describe("input schema", () => {
    it("derives fields from a mixed object input", () => {
        const input = { array: [3, 1, 2], target: 1, label: "demo" };
        expect(inputShape(input)).toBe("object");
        const fields = describeInput(input);
        expect(fields.map((field) => field.kind)).toEqual(["numberArray", "number", "string"]);
        expect(fields[0]?.label).toBe("Array");
        expect(fields[0]?.initial).toBe("3, 1, 2");
    });

    it("recognizes a bare array and a matrix", () => {
        expect(inputShape([4, 1, 3])).toBe("array");
        expect(classify([[1, 2], [3, 4]])).toBe("numberMatrix");
        expect(describeInput([4, 1, 3])[0]?.key).toBe("values");
    });

    it("reports plain-language parse errors", () => {
        expect(parseField("abc", "number")).toEqual({ ok: false, error: "Enter a number." });
        expect(parseField("1, x, 3", "numberArray")).toMatchObject({ ok: false });
        expect(parseField("1, 2\n3", "numberMatrix")).toEqual({
            ok: false,
            error: "Every row must have the same number of values.",
        });
        expect(parseField("{oops", "complex")).toMatchObject({ ok: false });
    });

    it("builds an input from edited fields", () => {
        const input = { values: [1, 2], times: 3 };
        const fields = describeInput(input);
        const result = buildInput(fields, { values: "5, 6, 7", times: "4" }, "object");
        expect(result).toEqual({ ok: true, value: { values: [5, 6, 7], times: 4 } });
    });

    it("randomizes numbers while keeping the shape", () => {
        const input = { keys: [5, 3, 7], name: "demo" };
        const random = randomizeInput(input) as { keys: number[]; name: string };
        expect(random.keys).toHaveLength(3);
        expect(random.keys.every((value) => Number.isFinite(value))).toBe(true);
        expect(random.name).toBe("demo");
    });
});
