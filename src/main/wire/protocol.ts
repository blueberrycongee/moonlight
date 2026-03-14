import type { JsonRpcRequest } from "../../shared/types/wire";

let nextId = 1;

export function createRequest(
  method: string,
  params?: unknown,
): JsonRpcRequest {
  return { jsonrpc: "2.0", id: nextId++, method, params };
}

export function createInitialize(): JsonRpcRequest {
  return createRequest("initialize", { protocol_version: "1.5" });
}

export function createPrompt(text: string): JsonRpcRequest {
  return createRequest("prompt", { content: text });
}

export function createCancel(): JsonRpcRequest {
  return createRequest("cancel");
}

export function createSteer(message: string): JsonRpcRequest {
  return createRequest("steer", { content: message });
}

export function createSetPlanMode(enabled: boolean): JsonRpcRequest {
  return createRequest("set_plan_mode", { enabled });
}

export function serialize(msg: object): string {
  return JSON.stringify(msg) + "\n";
}

// Reset ID counter (for testing)
export function resetIdCounter(): void {
  nextId = 1;
}
