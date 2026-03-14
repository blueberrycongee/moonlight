// JSON-RPC 2.0 base types
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}
export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: number | string;
  result: unknown;
}
export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number | string;
  error: { code: number; message: string; data?: unknown };
}
export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

// Wire event types
export type WireEventType =
  | "TurnBegin"
  | "TurnEnd"
  | "StepBegin"
  | "StepInterrupted"
  | "CompactionBegin"
  | "CompactionEnd"
  | "StatusUpdate"
  | "ContentPart"
  | "ToolCall"
  | "ToolCallPart"
  | "ToolResult"
  | "ApprovalResponse"
  | "SubagentEvent"
  | "SteerInput";

export interface WireEvent {
  type: WireEventType;
  data: unknown;
}

// ContentPart subtypes
export interface TextPart {
  type: "text";
  text: string;
}
export interface ThinkPart {
  type: "think";
  text: string;
}
export interface ImageURLPart {
  type: "image_url";
  url: string;
}
export type ContentPart = TextPart | ThinkPart | ImageURLPart;

// Display blocks
export interface BriefDisplayBlock {
  type: "brief";
  content: string;
}
export interface DiffDisplayBlock {
  type: "diff";
  path: string;
  old_text: string;
  new_text: string;
}
export interface TodoDisplayBlock {
  type: "todo";
  items: Array<{ text: string; status: "pending" | "done" | "failed" }>;
}
export interface ShellDisplayBlock {
  type: "shell";
  command: string;
  output?: string;
  language?: string;
}
export type DisplayBlock =
  | BriefDisplayBlock
  | DiffDisplayBlock
  | TodoDisplayBlock
  | ShellDisplayBlock;

// Approval
export interface ApprovalRequest {
  id: string;
  type: "command" | "file_change";
  description: string;
  display_blocks?: DisplayBlock[];
}
export type ApprovalDecision = "approve" | "approve_for_session" | "reject";
export interface ApprovalResponse {
  id: string;
  decision: ApprovalDecision;
}

// Status
export interface StatusUpdate {
  context_usage?: number;
  token_usage?: { input: number; output: number };
  plan_mode?: boolean;
}

// Wire client options
export interface WireOptions {
  workDir: string;
  sessionId?: string;
  additionalArgs?: string[];
}
