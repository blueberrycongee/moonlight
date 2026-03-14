import { useEffect } from "react";
import { useThreadStore } from "../stores/useThreadStore";
import { useMessageStore } from "../stores/useMessageStore";
import { useApprovalStore } from "../stores/useApprovalStore";

export function useWireEvents() {
  useEffect(() => {
    const unsubEvent = window.electronAPI.on("thread:event", (payload: any) => {
      const { threadId, event } = payload;
      useMessageStore.getState().handleWireEvent(threadId, event);
    });

    const unsubStatus = window.electronAPI.on(
      "thread:status",
      (payload: any) => {
        const { threadId, status } = payload;
        useThreadStore.getState().updateThread(threadId, { status });
      },
    );

    const unsubApproval = window.electronAPI.on(
      "thread:approval",
      (payload: any) => {
        const { threadId, request } = payload;
        useApprovalStore.getState().add(threadId, request);
      },
    );

    return () => {
      unsubEvent();
      unsubStatus();
      unsubApproval();
    };
  }, []);
}
