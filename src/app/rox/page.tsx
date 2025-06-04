"use client";

import React, { useState, useEffect, useRef } from "react";
// First import group consolidated into the main import below
import Image from "next/image";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  DataPacket_Kind,
  LocalParticipant, // For type hints
  RpcError, // For error handling in registration
  RpcInvocationData, // For RPC method signature
} from "livekit-client";
import SimpleTavusDisplay from "@/components/SimpleTavusDisplay";
import { getTokenEndpointUrl, tokenServiceConfig } from "@/config/services";
import AgentTextInput from "@/components/ui/AgentTextInput";
// Import other UI components if needed, e.g., Button from '@/components/ui/button';
import StudentStatusDisplay from "@/components/StudentStatusDisplay";
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import LiveKitSession, { LiveKitRpcAdapter } from "@/components/LiveKitSession"; // Import LiveKitRpcAdapter
import {
  FrontendButtonClickRequest, // Existing F2B
  AgentResponse, // Existing F2B
  // Add these for B2F
  AgentToClientUIActionRequest,
  NotifyPageLoadRequest, // For F2B Page Load Notification
  ClientUIActionResponse,
  ClientUIActionType,
} from "@/generated/protos/interaction";

interface UserProfile {
  id: string;
  // Add other relevant properties if known, e.g., name, email
  [key: string]: any; // Allows for other properties not explicitly defined
}

// Helper functions for Base64
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary); // btoa is a standard browser function
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64); // atob is a standard browser function
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

export default function RoxPage() {
  const [token, setToken] = useState<string>("");
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [rpcCallStatus, setRpcCallStatus] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'agent', content: string }[]>([]);
  const roomRef = useRef<Room | null>(null);
  const [isStudentStatusDisplayOpen, setIsStudentStatusDisplayOpen] =
    useState(false);
  const docsIconRef = useRef<HTMLImageElement>(null);
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);

  // State for agent-controlled UI elements
  const [agentUpdatableTextState, setAgentUpdatableTextState] = useState(
    "Initial text in RoxPage. Agent can change me!"
  );
  const [isAgentElementVisible, setIsAgentElementVisible] = useState(true);

  const roomName = "Roxpage"; // Or dynamically set if needed
  const userName = "TestUser"; // Or dynamically set if needed

  const handlePerformUIAction = async (
    rpcInvocationData: RpcInvocationData
  ): Promise<string> => {
    const payloadString = rpcInvocationData.payload as string | undefined; // Extract payload
    let requestId = rpcInvocationData.requestId || ""; // Get requestId from RpcInvocationData
    console.log(
      "[RoxPage] B2F RPC (handlePerformUIAction) invoked by agent. Request ID:",
      requestId
    );
    try {
      if (!payloadString) {
        console.error(
          "[RoxPage] B2F Agent PerformUIAction: No payload received."
        );
        const errResponse = ClientUIActionResponse.create({
          requestId,
          success: false,
          message: "Error: No payload",
        });
        return uint8ArrayToBase64(
          ClientUIActionResponse.encode(errResponse).finish()
        );
      }

      const decodedPayload = base64ToUint8Array(payloadString);
      const request = AgentToClientUIActionRequest.decode(decodedPayload);
      // Ensure requestId from decoded payload is used if available, otherwise stick to invocation data's
      if (request.requestId) {
        requestId = request.requestId;
      }
      console.log(
        "[RoxPage] B2F Agent PerformUIAction Request Received: ",
        request
      );

      let success = true;
      let message = "Action performed successfully by RoxPage.";

      switch (request.actionType) {
        case ClientUIActionType.SHOW_ALERT:
          const alertMsg = request.parameters["message"] || "Agent alert!";
          alert(`[RoxPage] Agent Alert: ${alertMsg}`); // Browser alert
          message = `Alert shown: ${alertMsg}`;
          break;
        case ClientUIActionType.UPDATE_TEXT_CONTENT:
          const newText = request.parameters["text"];
          if (request.targetElementId && newText !== undefined) {
            if (request.targetElementId === "agentUpdatableTextRoxPage") {
              // Match the ID you'll use in JSX
              setAgentUpdatableTextState(newText);
              message = `Element '${request.targetElementId}' text updated (React state).`;
            } else {
              // Fallback for other elements (less ideal in React)
              const element = document.getElementById(request.targetElementId);
              if (element) {
                element.innerText = newText;
              } else {
                success = false;
                message = `Error: Element '${request.targetElementId}' not found.`;
              }
            }
          } else {
            success = false;
            message =
              "Error: Missing targetElementId or text for UPDATE_TEXT_CONTENT.";
          }
          break;
        case ClientUIActionType.TOGGLE_ELEMENT_VISIBILITY:
          const visibleParam = request.parameters["visible"];
          if (request.targetElementId) {
            if (
              request.targetElementId === "agentToggleVisibilityElementRoxPage"
            ) {
              if (visibleParam === "true") {
                setIsAgentElementVisible(true);
                message = `Element '${request.targetElementId}' visibility set to true (React state).`;
              } else if (visibleParam === "false") {
                setIsAgentElementVisible(false);
                message = `Element '${request.targetElementId}' visibility set to false (React state).`;
              } else {
                setIsAgentElementVisible((prev) => !prev);
                message = `Element '${request.targetElementId}' visibility toggled (React state).`;
              }
            } else {
              // Fallback for other elements (direct DOM manipulation)
              const element = document.getElementById(request.targetElementId);
              if (element) {
                if (visibleParam === "true") {
                  element.style.display = "";
                  message = `Element '${request.targetElementId}' display set to visible.`;
                } else if (visibleParam === "false") {
                  element.style.display = "none";
                  message = `Element '${request.targetElementId}' display set to none.`;
                } else {
                  element.style.display =
                    element.style.display === "none" ? "" : "none"; // Toggle
                  message = `Element '${request.targetElementId}' display toggled.`;
                }
              } else {
                success = false;
                message = `Error: Element '${request.targetElementId}' not found for direct DOM manipulation.`;
              }
            }
          } else {
            success = false;
            message =
              "Error: Missing targetElementId for TOGGLE_ELEMENT_VISIBILITY.";
          }
          break;
        default:
          success = false;
          message = `Error: Unknown action_type '${request.actionType}'.`;
          console.warn(
            `[RoxPage] B2F: Unknown agent UI action: ${request.actionType}`
          );
      }
      const response = ClientUIActionResponse.create({
        requestId,
        success,
        message,
      });
      return uint8ArrayToBase64(
        ClientUIActionResponse.encode(response).finish()
      );
    } catch (error) {
      console.error(
        "[RoxPage] B2F: Error handling Agent PerformUIAction:",
        error
      );
      const errMessage = error instanceof Error ? error.message : String(error);
      const errResponse = ClientUIActionResponse.create({
        requestId,
        success: false,
        message: `Client error processing UI action: ${errMessage}`,
      });
      return uint8ArrayToBase64(
        ClientUIActionResponse.encode(errResponse).finish()
      );
    }
  };

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const tokenUrl = `${tokenServiceConfig.url}/api/token`; // Base endpoint for POST
        console.log(
          "[rox/page.tsx] Attempting to POST to token URL:",
          tokenUrl
        );

        // IMPORTANT: Replace 'YOUR_PRONITY_SESSION_TOKEN' with the actual session token
        const pronitySessionToken = localStorage.getItem("token"); // TODO: Get this from auth state/context/storage
        const userJsonString = localStorage.getItem("user"); // TODO: Get this from auth state/context/storage
        let User: UserProfile | null = null;

        if (userJsonString) {
          try {
            User = JSON.parse(userJsonString) as UserProfile; // Assume it matches UserProfile
            console.log("[rox/page.tsx] Parsed User Object:", User);
          } catch (parseError) {
            console.error(
              "[rox/page.tsx] Failed to parse User from localStorage:",
              parseError
            );
            // User remains null if parsing fails, User?.id will be undefined
          }
        } else {
          console.log("[rox/page.tsx] User string not found in localStorage.");
          // User remains null
        }

        const User_id = User?.id;
        if (
          !pronitySessionToken ||
          pronitySessionToken === "YOUR_PRONITY_SESSION_TOKEN"
        ) {
          console.error(
            "[rox/page.tsx] Pronity session token is missing or is a placeholder. Cannot authenticate."
          );
          setError("Pronity session token is missing. Please log in.");
          return; // Prevent API call without a token
        }

        const fetchOptions: RequestInit = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pronitySessionToken}`,
          },
          body: JSON.stringify({
            room_name: roomName, // Backend expects 'room_name'
            participant_identity: userName, // Backend expects 'participant_identity'
            User_id: User_id,
          }),
        };
        const resp = await fetch(tokenUrl, fetchOptions);
        if (!resp.ok) throw new Error(`Token service error: ${resp.status}`);
        const data = await resp.json();
        if (data.token) setToken(data.token);
        else throw new Error("No token in response");
      } catch (err) {
        setError((err as Error).message);
      }
    };
    fetchToken();
  }, [roomName, userName]);

  const handleTestRpcCall = async () => {
    if (!liveKitRpcAdapterRef.current) {
      const errorMessage =
        "LiveKitRpcAdapter not available. Cannot call HandleFrontendButton.";
      console.error(errorMessage);
      setRpcCallStatus(errorMessage);
      return;
    }
    try {
      setRpcCallStatus("Sending RPC call...");
      const requestMessage = FrontendButtonClickRequest.create({
        buttonId: "test_rpc_button",
        customData: "Hello from frontend via LiveKitRpcAdapter!",
      });
      const serializedRequest =
        FrontendButtonClickRequest.encode(requestMessage).finish();

      console.log(
        "Calling RPC: Service 'rox.interaction.AgentInteraction', Method 'HandleFrontendButton' with request:",
        requestMessage
      );

      const serializedResponse = await liveKitRpcAdapterRef.current.request(
        "rox.interaction.AgentInteraction", // Fully qualified service name from proto package and service
        "HandleFrontendButton",
        serializedRequest
      );

      const responseMessage = AgentResponse.decode(serializedResponse);
      console.log("RPC Response from HandleFrontendButton:", responseMessage);

      const successMessage = `RPC call successful: ${
        responseMessage.statusMessage || "No status message"
      }. Data: ${responseMessage.dataPayload || "No data"}`;
      setRpcCallStatus(successMessage);
    } catch (e) {
      const errorMessage = `Error calling HandleFrontendButton RPC: ${
        e instanceof Error ? e.message : String(e)
      }`;
      console.error(errorMessage, e);
      setRpcCallStatus(errorMessage);
    }
  };

  useEffect(() => {
    if (!token || room) return; // Don't connect if no token or already connected/connecting

    const connect = async () => {
      const newRoomInstance = new Room();

      newRoomInstance.on(RoomEvent.Connected, () => {
        console.log("Connected to LiveKit room:", newRoomInstance.name);
        setIsConnected(true);
        setRoom(newRoomInstance); // Update state for rendering
        roomRef.current = newRoomInstance; // Store in ref for cleanup

        // Setup RPC client once connected
        if (newRoomInstance.localParticipant) {
          // Initialize RPC adapter with a fallback identity first - we'll update it when we detect the agent
          const fallbackAgentIdentity = "rox-custom-llm-agent"; // Fallback identity
          liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
            newRoomInstance.localParticipant,
            fallbackAgentIdentity
          );
          console.log(
            "LiveKitRpcAdapter initialized with fallback identity. Will update when agent is detected."
          );

          const localP = newRoomInstance.localParticipant; // Define localP

          // ---- B2F RPC Handler Registration ----
          const b2f_rpcMethodName =
            "rox.interaction.ClientSideUI/PerformUIAction";
          console.log(
            `[RoxPage] Attempting to register B2F RPC handler for: ${b2f_rpcMethodName}`
          );
          try {
            localP.registerRpcMethod(b2f_rpcMethodName, handlePerformUIAction);
            console.log(
              `[RoxPage] B2F RPC Handler registered successfully for: ${b2f_rpcMethodName}`
            );
          } catch (e) {
            if (
              e instanceof RpcError &&
              e.message.includes("already registered")
            ) {
              console.warn(
                `[RoxPage] B2F RPC method ${b2f_rpcMethodName} already registered (this might be due to hot reload).`
              );
            } else {
              console.error(
                "[RoxPage] Failed to register B2F RPC handler 'PerformUIAction':",
                e
              );
            }
          }
          const sendPageLoadNotificationToAgent = async (
            roomInstance: Room
          ) => {
            if (!liveKitRpcAdapterRef.current) {
              console.error(
                "[WritingPracticeTestPage] LiveKitRpcAdapter not available. Cannot send PageLoad notification."
              );

              return;
            }

            try {
              const pageLoadData = NotifyPageLoadRequest.create({
                taskStage: "ROX_WELCOME_INIT", // Specific to writing practice page

                userId: userName, // userName is 'TestUser' from component scope

                currentPage: "P2_WritingPractice", // Specific to writing practice page

                sessionId: (roomInstance as any).sid || roomInstance.name, // Attempt to get session ID, fallback to room name

                chatHistory: JSON.stringify(chatMessages), // Send current chat history

                transcript: "client_loaded_rox_page", // Updated to rox_page
              });

              const serializedRequest =
                NotifyPageLoadRequest.encode(pageLoadData).finish();

              console.log(
                "[WritingPracticeTestPage] Calling RPC: Service 'rox.interaction.AgentInteraction', Method 'NotifyPageLoad' with request:",
                pageLoadData
              );

              const serializedResponse =
                await liveKitRpcAdapterRef.current.request(
                  "rox.interaction.AgentInteraction",

                  "NotifyPageLoad",

                  serializedRequest
                );

              const responseMessage = AgentResponse.decode(serializedResponse);

              console.log(
                "[WritingPracticeTestPage] RPC Response from NotifyPageLoad:",
                responseMessage
              );

              // Optionally, update UI or state based on responseMessage
            } catch (e) {
              console.error(
                `[WritingPracticeTestPage] Error calling NotifyPageLoad RPC: ${
                  e instanceof Error ? e.message : String(e)
                }`,
                e
              );
            }
          };

          setTimeout(
            () => sendPageLoadNotificationToAgent(newRoomInstance),
            2000
          ); // Added 2s delay
          // Setup a listener for when participants join to identify the agent
          newRoomInstance.on(
            RoomEvent.ParticipantConnected,
            (participant: RemoteParticipant) => {
              console.log(`New participant connected: ${participant.identity}`);
              if (
                participant.identity !==
                newRoomInstance.localParticipant.identity
              ) {
                // This is likely the agent
                console.log(
                  `Found agent with identity: ${participant.identity}`
                );
                // Update the RPC adapter with the correct agent identity
                if (liveKitRpcAdapterRef.current) {
                  liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
                    newRoomInstance.localParticipant,
                    participant.identity
                  );
                  console.log(
                    "LiveKitRpcAdapter updated with detected agent identity."
                  );
                }
              }
            }
          );

          // Setup a listener for when participants join to identify the agent
          newRoomInstance.on(
            RoomEvent.ParticipantConnected,
            (participant: RemoteParticipant) => {
              console.log(`New participant connected: ${participant.identity}`);
              if (
                participant.identity !==
                newRoomInstance.localParticipant.identity
              ) {
                // This is likely the agent
                console.log(
                  `Found agent with identity: ${participant.identity}`
                );
                // Update the RPC adapter with the correct agent identity
                if (liveKitRpcAdapterRef.current) {
                  liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
                    newRoomInstance.localParticipant,
                    participant.identity
                  );
                  console.log(
                    "LiveKitRpcAdapter updated with detected agent identity."
                  );
                }
              }
            }
          );

          // Also check if there are already remote participants in the room
          // In some LiveKit versions, we need to use .remoteParticipants instead of .participants
          const remoteParticipantsMap =
            newRoomInstance.remoteParticipants ||
            (newRoomInstance as any).participants;

          if (
            remoteParticipantsMap &&
            typeof remoteParticipantsMap.values === "function"
          ) {
            try {
              const remoteParticipants = Array.from(
                remoteParticipantsMap.values()
              ) as RemoteParticipant[];
              console.log(
                "Remote participants already in room:",
                remoteParticipants.map((p) => p.identity)
              );

              // Find the first participant that's not us
              const agentParticipant = remoteParticipants.find(
                (p) => p.identity !== newRoomInstance.localParticipant.identity
              );

              if (agentParticipant) {
                console.log(
                  `Found existing agent with identity: ${agentParticipant.identity}`
                );
                // Update the RPC adapter with the correct agent identity
                liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
                  newRoomInstance.localParticipant,
                  agentParticipant.identity
                );
                console.log(
                  "LiveKitRpcAdapter updated with existing agent identity."
                );
              }
            } catch (err) {
              console.warn("Error checking existing participants:", err);
            }
          } else {
            console.log(
              "No remote participants collection available yet or it doesn't have a values() method"
            );
          }
        } else {
          console.error(
            "LocalParticipant not available after connection, cannot set up RPC client."
          );
        }
      });

      newRoomInstance.on(
        RoomEvent.DataReceived,
        (
          payload: Uint8Array,
          participant?: RemoteParticipant,
          kind?: DataPacket_Kind,
          topic?: string
        ) => {
          if (participant) {
            console.log(
              `Received data from participant ${participant.identity} (kind: ${kind}, topic: ${topic})`
            );
            try {
              const messageStr = new TextDecoder().decode(payload);
              const message = JSON.parse(messageStr);
              console.log("Decoded message:", message);

              // Check for chat messages with metadata carrying dom_actions
              // The structure might depend on how CustomLLMBridge wraps it.
              // Assuming it's a ChatChunk-like structure or similar.
              if (message?.delta?.metadata?.dom_actions) {
                const domActionsStr = message.delta.metadata.dom_actions;
                try {
                  const domActions = JSON.parse(domActionsStr);
                  if (Array.isArray(domActions)) {
                    domActions.forEach((actionItem: any) => {
                      console.log(
                        "Processing DOM action from metadata:",
                        actionItem
                      );
                      if (
                        actionItem.action === "click" &&
                        actionItem.payload?.selector === "#statusViewButton"
                      ) {
                        console.log(
                          "Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from metadata"
                        );
                        toggleStudentStatusDisplay();
                      } else if (
                        actionItem.action === "click" &&
                        actionItem.payload?.selector
                      ) {
                        console.log(
                          `Agent requested click on other selector from metadata: ${actionItem.payload.selector}`
                        );
                        // Potentially handle other selectors if needed in the future, e.g., #startLearningButton
                      }
                    });
                  }
                } catch (e) {
                  console.error(
                    "Failed to parse dom_actions from metadata:",
                    e
                  );
                }
              }
              // Handle agent's text response from ChatChunk
              if (message?.delta?.content && message?.delta?.role === 'assistant') {
                const agentText = message.delta.content;
                if (agentText.trim()) { // Avoid adding empty messages
                  setChatMessages(prev => [...prev, { role: 'agent', content: agentText }]);
                }
              }

              // Fallback: Check for simpler action/payload structure directly if CustomLLMBridge might send it this way.
              // This is based on rox_agent.py returning dom_actions directly in its JSON response.
              // CustomLLMBridge might pick this up and send it without the delta/metadata wrapper in some configurations.
              else if (
                message?.dom_actions &&
                Array.isArray(message.dom_actions)
              ) {
                message.dom_actions.forEach((actionItem: any) => {
                  console.log(
                    "Processing DOM action from direct message property:",
                    actionItem
                  );
                  if (
                    actionItem.action === "click" &&
                    actionItem.payload?.selector === "#statusViewButton"
                  ) {
                    console.log(
                      "Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from direct message property"
                    );
                    toggleStudentStatusDisplay();
                  }
                });
              }
              // Further fallback for direct action/payload if it's a single action not in an array
              else if (
                message?.action === "click" &&
                message?.payload?.selector === "#statusViewButton"
              ) {
                console.log(
                  "Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from single direct action"
                );
                toggleStudentStatusDisplay();
              }
            } catch (e) {
              console.error("Failed to parse data packet:", e);
            }
          }
        }
      );

      newRoomInstance.on(RoomEvent.Disconnected, () => {
        console.log("Disconnected from LiveKit room");
        setIsConnected(false);
        setRoom(null);
        if (roomRef.current === newRoomInstance) {
          roomRef.current = null;
        }
      });

      try {
        await newRoomInstance.connect(
          process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
          token,
          {
            autoSubscribe: true, // Automatically subscribe to all tracks
          }
        );
      } catch (err) {
        setError(`Failed to connect: ${(err as Error).message}`);
        setRoom(null); // Ensure state room is null on failed connection
        roomRef.current = null; // Ensure ref is also null
      }
    };

    if (token && !roomRef.current) {
      // Only connect if token exists and not already connected/connecting
      connect();
    }

    return () => {
      console.log("Cleaning up LiveKit room connection");
      roomRef.current?.disconnect();
      roomRef.current = null; // Clear the ref on cleanup
    };
  }, [token]); // Effect dependencies

  const handleSendMessageToAgent = async () => {
    if (userInput.trim() && liveKitRpcAdapterRef.current && roomRef.current) {
      const currentMessage = userInput.trim();
      const currentUserId = userName; // Or from a more robust auth state
      const currentSessionId = (roomRef.current as any).sid || roomName;

      // Optimistically update UI with user's message
      setChatMessages(prev => [...prev, { role: 'user', content: currentMessage }]);
      setUserInput(""); // Clear input immediately

      const payload = {
        message: currentMessage,
        chatHistory: chatMessages, // Send history *before* adding the current user message
        userId: currentUserId,
        sessionId: currentSessionId,
      };

      try {
        const requestMessage = FrontendButtonClickRequest.create({
          buttonId: "send_chat_message", // Specific ID for chat messages
          customData: JSON.stringify(payload),
        });
        const serializedRequest = FrontendButtonClickRequest.encode(requestMessage).finish();

        console.log(
          "Calling RPC: Service 'rox.interaction.AgentInteraction', Method 'HandleFrontendButton' for chat with request:",
          requestMessage
        );

        // No need to await response for chat if it comes via DataReceived, but good to log if it's an ack
        const serializedResponse = await liveKitRpcAdapterRef.current.request(
          "rox.interaction.AgentInteraction",
          "HandleFrontendButton",
          serializedRequest
        );
        const responseMessage = AgentResponse.decode(serializedResponse);
        console.log("RPC Response from HandleFrontendButton (chat send ack):", responseMessage);
        // Agent's actual chat reply will come via RoomEvent.DataReceived

      } catch (e) {
        const errorMessage = `Error sending chat message via RPC: ${
          e instanceof Error ? e.message : String(e)
        }`;
        console.error(errorMessage, e);
        // Optionally, add error message to chat or revert optimistic update
        setChatMessages(prev => [...prev, { role: 'agent', content: `Error: Could not send message. ${errorMessage}` }]);
      }
    } else {
      console.warn("Cannot send message: No input, or RPC adapter/room not ready.");
    }
  };

  const handleDisconnect = () => {
    roomRef.current?.disconnect(); // Use ref for manual disconnect as well
    // State will update via RoomEvent.Disconnected listener
  };

  const toggleStudentStatusDisplay = () => {
    setIsStudentStatusDisplayOpen(!isStudentStatusDisplayOpen);
  };

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden bg-[image:radial-gradient(ellipse_at_top_right,_#B7C8F3_0%,_transparent_70%),_radial-gradient(ellipse_at_bottom_left,_#B7C8F3_0%,_transparent_70%)]">
      {/* Sidebar */}
      <aside className="w-20 p-4 flex flex-col items-center space-y-6">
        <Image
          src="/final-logo-1.png"
          alt="Logo"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <div className="flex-grow flex flex-col items-center justify-center space-y-4">
          <Image
            src="/user.svg"
            alt="User Profile"
            width={24}
            height={24}
            className="cursor-pointer hover:opacity-75"
          />
          <Image
            src="/mic-on.svg"
            alt="Mic On"
            width={24}
            height={24}
            className="cursor-pointer hover:opacity-75"
          />
          <Image
            src="/next.svg"
            alt="Next"
            width={24}
            height={24}
            className="cursor-pointer hover:opacity-75"
          />
          <Image
            ref={docsIconRef}
            id="statusViewButton"
            src="/docs.svg"
            alt="Docs"
            width={24}
            height={24}
            className="cursor-pointer hover:opacity-75"
            onClick={toggleStudentStatusDisplay}
          />
        </div>
        {/* RPC Test Button - Placed in sidebar */}
        {isConnected && room && (
          <div className="mt-auto mb-4 w-full flex flex-col items-center">
            <Button
              onClick={handleTestRpcCall}
              variant="outline"
              className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md truncate"
            >
              Test RPC
            </Button>
            {rpcCallStatus && (
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 text-center w-full break-words">
                {rpcCallStatus}
              </p>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Agent Controllable UI Elements in RoxPage */}

        {/* Avatar Display - Centered */}
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{ top: "30%" }}
        >
          {isConnected && room ? (
            <SimpleTavusDisplay room={room} />
          ) : (
            <div className="w-40 h-40 bg-slate-200 rounded-full flex items-center justify-center text-gray-700">
              {error && <p className="text-red-500">Error: {error}</p>}
            </div>
          )}
        </div>

        <div className="w-full max-w-3xl absolute bottom-0 mb-12 flex flex-col items-center">
          <p
            className="text-xl mb-6 text-gray-600"
            style={{ marginTop: "100px" }}
          >
            Hello, I am Rox, your AI Assistant!
          </p>

          {/* Chat Display Area */}
          <div className="w-full max-w-3xl h-64 overflow-y-auto mb-4 p-4 border border-gray-300 rounded-lg bg-white/80 flex flex-col space-y-2">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`p-2 rounded-lg max-w-[70%] ${
                  msg.role === 'user' ? 'bg-blue-500 text-white self-end' : 'bg-gray-200 text-gray-800 self-start'
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>

          {/* Input Area */}_COMMENT_END_
          <div
            className="w-full bg-white border border-gray-300 rounded-xl p-1 flex items-center shadow-xl relative"
            style={{ minHeight: "56px" }}
          >
            <AgentTextInput
              value={userInput}
              onChange={setUserInput} // Pass setUserInput directly
              onSubmit={handleSendMessageToAgent} // Use the new submit handler
              placeholder="Ask me anything!"
              className="flex-grow bg-transparent border-none focus:ring-0 resize-none text-gray-800 placeholder-gray-500 p-3 leading-tight"
              rows={1}
            />
          </div>

          {/* Suggestion Boxes */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {[
              "Summarize my learning so far, what have I covered and how well?",
              "Improve my speaking skills where am I lacking and how to fix it?",
              "Show me my mistakes and how I can improve them.",
            ].map((text, i) => (
              <div
                key={i}
                onClick={() => setUserInput(text)}
                className="bg-white border border-gray-200 p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
              >
                <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Error display - optional, can be placed elsewhere */}
        {error && (
          <div className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-md shadow-lg">
            Error: {error}
          </div>
        )}
        {/* Disconnect button - optional, can be placed elsewhere or removed */}
        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="absolute top-4 left-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Disconnect
          </button>
        )}

        <StudentStatusDisplay
          isOpen={isStudentStatusDisplayOpen}
          anchorElement={docsIconRef.current}
          onClose={toggleStudentStatusDisplay}
        />
      </main>
    </div>
  );
}
