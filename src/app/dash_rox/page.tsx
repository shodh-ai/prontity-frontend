"use client";

import React, { useRef, useCallback } from "react";
import { Q } from "../../screens/Q";
import { RpcInvocationData } from 'livekit-client';
import {
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
} from '@/generated/protos/interaction';
import LiveKitSession, { LiveKitRpcAdapter } from '@/components/LiveKitSession';

// Helper function for Base64 encoding
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export default function DashRoxPage() {
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);

  const handlePerformUIAction = useCallback(async (rpcInvocationData: RpcInvocationData): Promise<string> => {
    const payloadString = rpcInvocationData.payload as string | undefined;
    let requestId = rpcInvocationData.requestId || "";
    console.log("[DashRoxPage] B2F RPC received. Request ID:", requestId);

    try {
      if (!payloadString) throw new Error("No payload received.");

      const request = AgentToClientUIActionRequest.fromJSON(JSON.parse(payloadString));
      let success = true;
      let message = "Action processed successfully.";

      console.log(`[DashRoxPage] Received action: ${request.actionType}`, request);
      // This page doesn't have complex UI elements like an editor,
      // so we'll just log the action for now.

      const response = ClientUIActionResponse.create({ requestId, success, message });
      return uint8ArrayToBase64(ClientUIActionResponse.encode(response).finish());
    } catch (innerError) {
      console.error('[DashRoxPage] Error handling Agent PerformUIAction:', innerError);
      const errMessage = innerError instanceof Error ? innerError.message : String(innerError);
      const errResponse = ClientUIActionResponse.create({
        requestId,
        success: false,
        message: `Client error processing UI action: ${errMessage}`
      });
      return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
    }
  }, []);

  return (
    <>
      <Q />
      <div style={{ display: 'none' }}>
        <LiveKitSession
          roomName="dash-rox-room" // Using a unique room name for this page
          userName="dash-rox-user"
          onConnected={(connectedRoom, rpcAdapter) => {
            console.log("LiveKit connected in DashRoxPage, room:", connectedRoom);
            liveKitRpcAdapterRef.current = rpcAdapter;
            console.log("LiveKitRpcAdapter assigned in DashRoxPage:", liveKitRpcAdapterRef.current);
          }}
          onPerformUIAction={handlePerformUIAction}
        />
      </div>
    </>
  );
}
