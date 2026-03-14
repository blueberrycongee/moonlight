export class JsonlParser {
  private buffer = "";

  constructor(
    private onMessage: (msg: unknown) => void,
    private onError?: (err: Error, raw: string) => void,
  ) {}

  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        this.onMessage(JSON.parse(trimmed));
      } catch (err) {
        this.onError?.(err as Error, trimmed);
      }
    }
  }

  reset(): void {
    this.buffer = "";
  }
}
