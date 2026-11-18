/**
 * inputSchema.ts – Friendly form model derived from an algorithm's input.
 *
 * Algorithms declare their starting data as `defaultInput`, an arbitrary JSON
 * value. This module inspects that value's shape and produces editable fields:
 * scalars get plain inputs, lists get comma-separated text, matrices get one
 * row per line, and genuinely nested data (graphs, records, tuples) falls back
 * to a JSON editor. It also parses edits back into the original shape with
 * plain-language error messages.
 */

export type FieldKind =
    | "number"
    | "string"
    | "boolean"
    | "numberArray"
    | "stringArray"
    | "numberMatrix"
    | "stringMatrix"
    | "complex";

export interface InputField {
    /** Key in the original object, or a synthetic key for a bare input. */
    key: string;
    /** Human-readable field label. */
    label: string;
    /** Which editor and parser this field uses. */
    kind: FieldKind;
    /** Short guidance shown next to the field. */
    hint: string;
    /** The default value rendered as editable text. */
    initial: string;
}

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

export type InputShape = "object" | "array" | "value";

/** @returns Whether a value is a plain object rather than an array or null. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @returns The overall shape of an algorithm input. */
export function inputShape(input: unknown): InputShape {
    if (Array.isArray(input)) {
        return "array";
    }
    if (isPlainObject(input)) {
        return "object";
    }
    return "value";
}

/** @returns The editor kind that best fits a value. */
export function classify(value: unknown): FieldKind {
    if (typeof value === "number") {
        return "number";
    }
    if (typeof value === "string") {
        return "string";
    }
    if (typeof value === "boolean") {
        return "boolean";
    }
    if (Array.isArray(value)) {
        if (value.length === 0 || value.every((item) => typeof item === "number")) {
            return "numberArray";
        }
        if (value.every((item) => typeof item === "string")) {
            return "stringArray";
        }
        if (value.every(Array.isArray)) {
            const flat = value.flat();
            if (flat.every((item) => typeof item === "number")) {
                return "numberMatrix";
            }
            if (flat.every((item) => typeof item === "string")) {
                return "stringMatrix";
            }
        }
        return "complex";
    }
    return "complex";
}

/** @returns A Title Case label from a kebab-, snake-, or space-separated key. */
function labelFor(key: string): string {
    const words = key.split(/[-_\s]+/).filter(Boolean);
    if (words.length === 0) {
        return "Value";
    }
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** @returns A one-line hint for an editor kind. */
function hintFor(kind: FieldKind): string {
    switch (kind) {
        case "number":
            return "Enter a number.";
        case "string":
            return "Enter text.";
        case "boolean":
            return "Turn the option on or off.";
        case "numberArray":
            return "Separate numbers with commas, like 3, 1, 4.";
        case "stringArray":
            return "Separate words with commas, like cat, dog, bird.";
        case "numberMatrix":
            return "One row per line; separate values with commas.";
        case "stringMatrix":
            return "One row per line; separate values with commas.";
        case "complex":
            return "Enter JSON, for example {\"from\": [[\"to\", 2]]}.";
    }
}

/** @returns The text shown in an editor for a value of a given kind. */
export function toEditable(value: unknown, kind: FieldKind): string {
    switch (kind) {
        case "number":
        case "string":
            return String(value);
        case "boolean":
            return value ? "true" : "false";
        case "numberArray":
        case "stringArray":
            return (value as Array<number | string>).join(", ");
        case "numberMatrix":
        case "stringMatrix":
            return (value as Array<Array<number | string>>)
                .map((row) => row.join(", "))
                .join("\n");
        case "complex":
            return JSON.stringify(value, null, 2);
    }
}

/** @returns Editable fields describing an algorithm input. */
export function describeInput(input: unknown): InputField[] {
    const shape = inputShape(input);
    const entries: Array<[string, unknown]> =
        shape === "object"
            ? Object.entries(input as Record<string, unknown>)
            : shape === "array"
              ? [["values", input]]
              : [["value", input]];

    return entries.map(([key, value]) => {
        const kind = classify(value);
        return {
            key,
            label: labelFor(key),
            kind,
            hint: hintFor(kind),
            initial: toEditable(value, kind),
        };
    });
}

/** @returns The finite number in a string, or null when it is not one number. */
function parseNumber(raw: string): number | null {
    const text = raw.trim();
    if (text === "") {
        return null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
}

/** Parse one edited field back into a value, or a plain-language error. */
export function parseField(raw: string, kind: FieldKind): ParseResult {
    switch (kind) {
        case "number": {
            const value = parseNumber(raw);
            return value === null ? { ok: false, error: "Enter a number." } : { ok: true, value };
        }
        case "string":
            return { ok: true, value: raw };
        case "boolean": {
            const text = raw.trim().toLowerCase();
            if (text === "true" || text === "false") {
                return { ok: true, value: text === "true" };
            }
            return { ok: false, error: "Choose true or false." };
        }
        case "numberArray": {
            if (raw.trim() === "") {
                return { ok: true, value: [] };
            }
            const parts = raw.split(",").map((part) => part.trim());
            const values: number[] = [];
            for (const part of parts) {
                const value = parseNumber(part);
                if (value === null) {
                    return {
                        ok: false,
                        error: "Use numbers separated by commas, like 3, 1, 4.",
                    };
                }
                values.push(value);
            }
            return { ok: true, value: values };
        }
        case "stringArray": {
            const values = raw
                .split(",")
                .map((part) => part.trim())
                .filter((part) => part !== "");
            return { ok: true, value: values };
        }
        case "numberMatrix":
        case "stringMatrix": {
            const rows = raw
                .split("\n")
                .map((row) => row.trim())
                .filter((row) => row !== "");
            if (rows.length === 0) {
                return { ok: true, value: [] };
            }
            const parsed: Array<Array<number | string>> = [];
            let width = -1;
            for (const row of rows) {
                const cells = row.split(",").map((cell) => cell.trim());
                if (width !== -1 && cells.length !== width) {
                    return { ok: false, error: "Every row must have the same number of values." };
                }
                width = cells.length;
                const values: Array<number | string> = [];
                for (const cell of cells) {
                    if (kind === "numberMatrix") {
                        const value = parseNumber(cell);
                        if (value === null) {
                            return {
                                ok: false,
                                error: "Use one row per line and numbers separated by commas.",
                            };
                        }
                        values.push(value);
                    } else {
                        values.push(cell);
                    }
                }
                parsed.push(values);
            }
            return { ok: true, value: parsed };
        }
        case "complex": {
            try {
                return { ok: true, value: JSON.parse(raw) as unknown };
            } catch {
                return { ok: false, error: "Enter valid JSON, using double quotes around names." };
            }
        }
    }
}

/** @returns The validated input built from edited field values. */
export function buildInput(
    fields: InputField[],
    edits: Record<string, string>,
    shape: InputShape,
): ParseResult {
    const values: Record<string, unknown> = {};
    for (const field of fields) {
        const raw = edits[field.key] ?? field.initial;
        const parsed = parseField(raw, field.kind);
        if (!parsed.ok) {
            return { ok: false, error: `${field.label}: ${parsed.error}` };
        }
        values[field.key] = parsed.value;
    }

    if (shape === "object") {
        return { ok: true, value: values };
    }
    const only = fields[0];
    if (!only) {
        return { ok: false, error: "This algorithm has no input to edit." };
    }
    const value = values[only.key];
    if (shape === "array" && !Array.isArray(value)) {
        return { ok: false, error: "This algorithm needs a list of values." };
    }
    return { ok: true, value };
}

/** @returns A same-shaped input with numbers and arrays randomized. */
export function randomizeInput(input: unknown): unknown {
    if (typeof input === "number") {
        const span = Math.max(5, Math.abs(Math.trunc(input)));
        return Math.floor(Math.random() * (2 * span + 1)) - span;
    }
    if (Array.isArray(input)) {
        return input.map(randomizeInput);
    }
    if (isPlainObject(input)) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input)) {
            result[key] = randomizeInput(value);
        }
        return result;
    }
    return input;
}
