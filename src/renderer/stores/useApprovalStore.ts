import { create } from "zustand";
import type { ApprovalRequest } from "../../shared/types/wire";

interface PendingApproval {
  threadId: string;
  request: ApprovalRequest;
}

interface ApprovalStore {
  pending: PendingApproval[];
  add: (threadId: string, request: ApprovalRequest) => void;
  remove: (requestId: string) => void;
}

export const useApprovalStore = create<ApprovalStore>((set) => ({
  pending: [],
  add: (threadId, request) =>
    set((s) => ({
      pending: [...s.pending, { threadId, request }],
    })),
  remove: (requestId) =>
    set((s) => ({
      pending: s.pending.filter((p) => p.request.id !== requestId),
    })),
}));
