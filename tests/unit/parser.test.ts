import { describe, it, expect, vi, beforeEach } from "vitest";
import { JsonlParser } from "../../src/main/wire/parser";

describe("JsonlParser", () => {
  let onMessage: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let parser: JsonlParser;

  beforeEach(() => {
    onMessage = vi.fn();
    onError = vi.fn();
    parser = new JsonlParser(onMessage, onError);
  });

  it("parses a single complete JSON line", () => {
    parser.feed('{"id":1,"method":"hello"}\n');
    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith({ id: 1, method: "hello" });
  });

  it("handles chunked input across multiple feeds", () => {
    parser.feed('{"id":');
    parser.feed('1,"method":"hello"}\n');
    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith({ id: 1, method: "hello" });
  });

  it("handles multiple JSON lines in one chunk", () => {
    parser.feed('{"a":1}\n{"b":2}\n{"c":3}\n');
    expect(onMessage).toHaveBeenCalledTimes(3);
    expect(onMessage).toHaveBeenNthCalledWith(1, { a: 1 });
    expect(onMessage).toHaveBeenNthCalledWith(2, { b: 2 });
    expect(onMessage).toHaveBeenNthCalledWith(3, { c: 3 });
  });

  it("calls error handler on invalid JSON", () => {
    parser.feed("not valid json\n");
    expect(onMessage).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][1]).toBe("not valid json");
  });

  it("ignores empty lines", () => {
    parser.feed('\n\n{"id":1}\n\n');
    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith({ id: 1 });
  });

  it("reset clears buffer", () => {
    parser.feed('{"id":');
    parser.reset();
    parser.feed("999}\n");
    // After reset, the partial '{"id":' is gone, so '999}' is invalid JSON
    expect(onMessage).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });
});
