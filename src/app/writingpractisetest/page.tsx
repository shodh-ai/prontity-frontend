'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor'; // Adjusted path, import handle
import { StarterKit } from '@tiptap/starter-kit';
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension'; // Import the extension instead of the raw plugin
import { Highlight } from '@/components/TiptapEditor/highlightInterface'; // Adjusted path
import Image from 'next/image';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  DataPacket_Kind,
  LocalParticipant, // For type hints
  RpcError,         // For error handling in registration
  RpcInvocationData, // For RPC method signature
} from 'livekit-client';
import { getTokenEndpointUrl, tokenServiceConfig } from '@/config/services';
import AgentTextInput from '@/components/ui/AgentTextInput';
// Import other UI components if needed, e.g., Button from '@/components/ui/button';
import StudentStatusDisplay from '@/components/StudentStatusDisplay';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component
import LiveKitSession, { LiveKitRpcAdapter } from '@/components/LiveKitSession'; // Import LiveKitRpcAdapter
import AudioHandler from '@/components/Audiorendering'; // Import AudioHandler
import Timer, { TimerHandle } from '@/components/Timer'; // Import Timer and TimerHandle
import {
  FrontendButtonClickRequest, // Existing F2B
  AgentResponse,             // Existing F2B
  // Add these for B2F
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
  ClientUIActionType,
  HighlightRangeProto, // Added for text highlighting payload
  NotifyPageLoadRequest,   // For F2B Page Load Notification
} from '@/generated/protos/interaction';

// Helper functions for Base64
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
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
  const [token, setToken] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [rpcCallStatus, setRpcCallStatus] = useState<string>('');
  const roomRef = useRef<Room | null>(null);
  const [isStudentStatusDisplayOpen, setIsStudentStatusDisplayOpen] = useState(false);
  const docsIconRef = useRef<HTMLImageElement>(null);
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);
  const tiptapEditorRef = useRef<TiptapEditorHandle>(null);
  const timerRef = useRef<TimerHandle>(null); // Ref for the Timer component

  // State for agent-controlled UI elements
  const [agentUpdatableTextState, setAgentUpdatableTextState] = useState(
    "Initial text in RoxPage. Agent can change me!"
  );
  const [isAgentElementVisible, setIsAgentElementVisible] = useState(true);

  // State for Tiptap Editor
  const [editorContent, setEditorContent] = useState<string>(
    '<p>Hello from Tiptap! The agent will highlight text in this editor.</p><p>This is a second paragraph to test highlighting across multiple blocks of text. The agent can receive commands to highlight specific ranges here.</p>'
  );
  const [highlightData, setHighlightData] = useState<Highlight[]>([]);
  const [isEditorCurrentlyEditable, setIsEditorCurrentlyEditable] = useState(false); // Added for timer-controlled editability
  const [currentTimerDuration, setCurrentTimerDuration] = useState(0); // To store the duration the timer was started with

  // Callback to handle text suggestion clicks
  const handleTextSuggestionClick = (highlight: Highlight) => {
    const editor = tiptapEditorRef.current?.editor;
    if (!editor) {
      console.error("[RoxPage] Tiptap editor instance not available via ref for handleTextSuggestionClick.");
      return;
    }

    const originalText = highlight.data?.originalText || editor.state.doc.textBetween(highlight.start, highlight.end, " ");
    const newText = highlight.data?.newText;

    if (newText === undefined) {
      console.warn("[RoxPage] Text suggestion clicked, but newText is undefined in highlight data.", highlight);
      setHighlightData(prev => prev.filter(h => h.id !== highlight.id));
      return;
    }

    const userAccepted = window.confirm(
      `Accept suggestion?\n\nOriginal: "${originalText}"\nSuggested: "${newText}"`
    );

    if (userAccepted) {
      console.log(`[RoxPage] User accepted suggestion: ${highlight.id}. Replacing '${originalText}' with '${newText}'`);
      editor.chain().focus()
        .deleteRange({ from: highlight.start, to: highlight.end })
        .insertContent(newText)
        .run();
    } else {
      console.log(`[RoxPage] User rejected suggestion: ${highlight.id}`);
    }
    // Remove the highlight regardless of accept/reject
    setHighlightData(prev => prev.filter(h => h.id !== highlight.id));
  };

  // Tiptap extensions
  const tiptapExtensions = [
    StarterKit.configure(),
    HighlightExtension.configure({
      onHighlightClick: (highlightId) => {
        console.log('[RoxPage] Highlight clicked in Tiptap, ID:', highlightId);
        const clickedHighlight = highlightData.find(h => h.id === highlightId);
        if (clickedHighlight) {
          console.log('[RoxPage] Clicked highlight data:', clickedHighlight);
        }
      },
      onTextSuggestionClick: handleTextSuggestionClick, // Wire up the new callback
    }),
    // Placeholder.configure({ placeholder: 'Start typing...' }),
    // CharacterCount.configure({ limit: 10000 }),
  ];

  const roomName = 'Roxpage'; // Or dynamically set if needed
  const userName = 'TestUser'; // Or dynamically set if needed

  const handlePerformUIAction = useCallback(async (rpcInvocationData: RpcInvocationData): Promise<string> => {
    const payloadString = rpcInvocationData.payload as string | undefined; // Extract payload
    let requestId = rpcInvocationData.requestId || ""; // Get requestId from RpcInvocationData
    console.log(`[RoxPage] B2F RPC (handlePerformUIAction) invoked by agent. Request ID: ${requestId}`);
    console.log(`[RoxPage] handlePerformUIAction: ENTRY: editor object is:`, tiptapEditorRef.current?.editor);
    if (tiptapEditorRef.current?.editor) {
      console.log(`[RoxPage] handlePerformUIAction: ENTRY: editor.isEditable is:`, tiptapEditorRef.current.editor.isEditable);
      console.log(`[RoxPage] handlePerformUIAction: ENTRY: editor.isDestroyed is:`, tiptapEditorRef.current.editor.isDestroyed);
    } else {
      console.error(`[RoxPage] handlePerformUIAction: ENTRY: editor is null or undefined BEFORE switch!`);
    }
    try {
      if (!payloadString) {
        console.error('[RoxPage] B2F Agent PerformUIAction: No payload received.');
        const errResponse = ClientUIActionResponse.create({ requestId, success: false, message: "Error: No payload" });
        return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
      }

      const decodedPayload = base64ToUint8Array(payloadString);
      const request = AgentToClientUIActionRequest.decode(decodedPayload);
      // Ensure requestId from decoded payload is used if available, otherwise stick to invocation data's
      if (request.requestId) {
          requestId = request.requestId;
      }
      console.log('[RoxPage] B2F Agent PerformUIAction Request Received: ', request);

      // Pre-switch check specifically for SET_EDITOR_CONTENT
      if (request.actionType === ClientUIActionType.SET_EDITOR_CONTENT) {
        console.error(`[RoxPage] PRE-SWITCH CHECK for SET_EDITOR_CONTENT: editor object is:`, tiptapEditorRef.current?.editor, `isEditable: ${tiptapEditorRef.current?.editor?.isEditable}, isDestroyed: ${tiptapEditorRef.current?.editor?.isDestroyed}`);
      }

      let success = true;
      let message = "Action performed successfully by RoxPage.";

      // Add a fallback div to display editor content if the editor fails
      if (!document.getElementById('editorFallbackDisplay')) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.id = 'editorFallbackDisplay';
        fallbackDiv.className = 'border-2 border-gray-300 p-4 rounded mt-4';
        fallbackDiv.style.display = 'none';
        document.querySelector('.tiptap-container')?.after(fallbackDiv);
      }

      switch (request.actionType) {
        case ClientUIActionType.SHOW_ALERT:
          const alertMsg = request.parameters["message"] || "Agent alert!";
          alert(`[RoxPage] Agent Alert: ${alertMsg}`); // Browser alert
          message = `Alert shown: ${alertMsg}`;
          break;
        case ClientUIActionType.UPDATE_TEXT_CONTENT:
          const newText = request.parameters["text"];
          if (request.targetElementId && newText !== undefined) {
            if (request.targetElementId === "agentUpdatableTextRoxPage") { // Match the ID you'll use in JSX
              setAgentUpdatableTextState(newText);
              message = `Element '${request.targetElementId}' text updated (React state).`;
            } else {
              // Fallback for other elements (less ideal in React)
              const element = document.getElementById(request.targetElementId);
              if (element) { element.innerText = newText; }
              else { success = false; message = `Error: Element '${request.targetElementId}' not found.`; }
            }
          } else { success = false; message = "Error: Missing targetElementId or text for UPDATE_TEXT_CONTENT."; }
          break;
        case ClientUIActionType.TOGGLE_ELEMENT_VISIBILITY:
          const visibleParam = request.parameters["visible"];
          if (request.targetElementId) {
            if (request.targetElementId === "agentToggleVisibilityElementRoxPage") {
              if (visibleParam === "true") {
                setIsAgentElementVisible(true);
                message = `Element '${request.targetElementId}' visibility set to true (React state).`;
              } else if (visibleParam === "false") {
                setIsAgentElementVisible(false);
                message = `Element '${request.targetElementId}' visibility set to false (React state).`;
              } else {
                setIsAgentElementVisible(prev => !prev);
                message = `Element '${request.targetElementId}' visibility toggled (React state).`;
              }
            } else {
              // Fallback for other elements (direct DOM manipulation)
              const element = document.getElementById(request.targetElementId);
              if (element) {
                if (visibleParam === "true") {
                  element.style.display = '';
                  message = `Element '${request.targetElementId}' display set to visible.`;
                } else if (visibleParam === "false") {
                  element.style.display = 'none';
                  message = `Element '${request.targetElementId}' display set to none.`;
                } else {
                  element.style.display = element.style.display === 'none' ? '' : 'none'; // Toggle
                  message = `Element '${request.targetElementId}' display toggled.`;
                }
              } else {
                success = false;
                message = `Error: Element '${request.targetElementId}' not found for direct DOM manipulation.`;
              }
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for TOGGLE_ELEMENT_VISIBILITY.";
          }
          break;
        case ClientUIActionType.HIGHLIGHT_TEXT_RANGES:
          console.log('[RoxPage] B2F Action: HIGHLIGHT_TEXT_RANGES');
          try { // Outer try for the whole HIGHLIGHT_TEXT_RANGES logic
            // Prioritize using the new highlightRangesPayload
            if (request.highlightRangesPayload && Array.isArray(request.highlightRangesPayload) && request.highlightRangesPayload.length > 0) {
              const newHighlights = request.highlightRangesPayload.map((h: HighlightRangeProto) => ({
                id: h.id || `highlight-${Date.now()}-${Math.random()}`,
                start: h.start,
                end: h.end,
                type: h.type || 'agent_highlight',
                message: h.message,
                wrongVersion: h.wrongVersion,
                correctVersion: h.correctVersion,
              }));
              setHighlightData(newHighlights as Highlight[]); // Ensure Highlight type matches
              message = 'Text ranges highlighted successfully from payload.';
              success = true;
            } else {
              // Fallback to old parameters.highlightData (with a warning)
              const highlightsString = request.parameters["highlightData"];
              if (highlightsString) {
                console.warn('[RoxPage] HIGHLIGHT_TEXT_RANGES: Using fallback "parameters.highlightData". Please update agent to use "highlightRangesPayload".');
                // Inner try for parsing fallback data
                try {
                  const parsedHighlights = JSON.parse(highlightsString) as any[];
                  const newHighlights = parsedHighlights.map((h: any) => ({
                    id: h.id || `highlight-${Date.now()}-${Math.random()}`,
                    start: h.start,
                    end: h.end,
                    type: h.type || 'agent_highlight',
                    message: h.message,
                    wrongVersion: h.wrongVersion,
                    correctVersion: h.correctVersion,
                  }));
                  setHighlightData(newHighlights as Highlight[]);
                  message = 'Text ranges highlighted successfully from fallback parameters.';
                  success = true;
                } catch (parseError) { // Catch for JSON.parse error
                  console.error('[RoxPage] HIGHLIGHT_TEXT_RANGES: Failed to parse fallback highlightData', parseError);
                  success = false;
                  message = "Error: Failed to parse highlightData from parameters.";
                }
              } else {
                // Neither payload nor fallback parameters found
                success = false;
                message = "Error: No highlight data found in payload or parameters for HIGHLIGHT_TEXT_RANGES.";
              }
            }
          } catch (e) { // Catch for the outer try block for HIGHLIGHT_TEXT_RANGES
            console.error('[RoxPage] HIGHLIGHT_TEXT_RANGES: Error processing highlight action:', e);
            success = false;
            message = 'Error: Could not process highlight data.';
          }
          break;

        case ClientUIActionType.SUGGEST_TEXT_EDIT:
          console.log('[RoxPage] B2F Action: SUGGEST_TEXT_EDIT');
          if (request.suggestTextEditPayload) {
            const suggestionPayload = request.suggestTextEditPayload;
            console.log("[RoxPage] Received SUGGEST_TEXT_EDIT payload:", suggestionPayload);
            const newSuggestionHighlight: Highlight = {
              id: suggestionPayload.suggestionId || `suggestion-${Date.now()}-${Math.random()}`,
              start: suggestionPayload.startPos,
              end: suggestionPayload.endPos,
              type: 'text_suggestion', // A new highlight type for suggestions
              message: `Suggest: '${suggestionPayload.originalText || ''}' -> '${suggestionPayload.newText || ''}'`,
              data: {
                originalText: suggestionPayload.originalText,
                newText: suggestionPayload.newText,
                suggestionId: suggestionPayload.suggestionId,
              }
            };
            setHighlightData(prevHighlights => [...prevHighlights, newSuggestionHighlight]);
            success = true;
            message = "Text edit suggestion received and displayed as highlight.";
          } else {
            success = false;
            message = "Error: Missing payload for SUGGEST_TEXT_EDIT.";
            console.error('[RoxPage] SUGGEST_TEXT_EDIT: Payload is missing.');
          }
          break;
        case ClientUIActionType.SHOW_INLINE_SUGGESTION:
          console.log('[RoxPage] B2F Action: SHOW_INLINE_SUGGESTION');
          try {
            if (request.showInlineSuggestionPayload) {
              const payload = request.showInlineSuggestionPayload;
              const newHighlight: Highlight = {
                id: payload.suggestionId || `inline-suggest-${Date.now()}`,
                start: payload.startPos,
                end: payload.endPos,
                type: 'inline_suggestion', // Specific type for styling
                message: payload.suggestionText, // To be shown as tooltip/title
                data: {
                  suggestionId: payload.suggestionId,
                  suggestionType: payload.suggestionType, // For potential varied styling/icons
                },
              };
              setHighlightData(prevHighlights => [...prevHighlights, newHighlight]);
              message = `Inline suggestion '${payload.suggestionId}' received and displayed.`;
              console.log('[RoxPage] Added inline suggestion highlight:', newHighlight);
            } else {
              success = false;
              message = "Error: Missing payload for SHOW_INLINE_SUGGESTION.";
              console.error('[RoxPage] B2F SHOW_INLINE_SUGGESTION: Missing payload.');
            }
          } catch (e: any) {
            console.error('[RoxPage] B2F Error processing SHOW_INLINE_SUGGESTION:', e);
            success = false;
            message = `Error processing SHOW_INLINE_SUGGESTION: ${e.message}`;
          }
          break;
        case ClientUIActionType.SHOW_TOOLTIP_OR_COMMENT:
          console.log('[RoxPage] B2F Action: SHOW_TOOLTIP_OR_COMMENT');
          try {
            if (request.showTooltipOrCommentPayload) {
              const payload = request.showTooltipOrCommentPayload;
              const highlightType = `comment_${payload.tooltipType || 'generic'}`.toLowerCase(); // e.g., comment_info, comment_warning
              const newHighlight: Highlight = {
                id: payload.id || `tooltip-${Date.now()}`,
                start: payload.startPos,
                end: payload.endPos,
                type: highlightType,
                message: payload.text, // For tooltip display
                data: {
                  tooltipId: payload.id, // Store the actual ID used
                  tooltipType: payload.tooltipType,
                },
              };
              setHighlightData(prevHighlights => [...prevHighlights, newHighlight]);
              message = `Tooltip/comment '${payload.id}' (${payload.tooltipType}) received and displayed.`;
              console.log('[RoxPage] Added tooltip/comment highlight:', newHighlight);
            } else {
              success = false;
              message = "Error: Missing payload for SHOW_TOOLTIP_OR_COMMENT.";
              console.error('[RoxPage] B2F SHOW_TOOLTIP_OR_COMMENT: Missing payload.');
            }
          } catch (e: any) {
            console.error('[RoxPage] B2F Error processing SHOW_TOOLTIP_OR_COMMENT:', e);
            success = false;
            message = `Error processing SHOW_TOOLTIP_OR_COMMENT: ${e.message}`;
          }
          break;
        case ClientUIActionType.SET_EDITOR_CONTENT:
          console.log(`[RoxPage] B2F Action: SET_EDITOR_CONTENT`);
          
          // No editor ref? Use state update instead
          if (!request.setEditorContentPayload) {
            console.error(`[RoxPage] SET_EDITOR_CONTENT: No payload provided`);
            success = false;
            message = "SET_EDITOR_CONTENT: No payload provided";
            break;
          }
          
          if (request.setEditorContentPayload?.contentFormat?.$case === 'htmlContent') {
            const htmlContent = request.setEditorContentPayload.contentFormat.htmlContent;
            console.log(`[RoxPage] SET_EDITOR_CONTENT: Got HTML content, length: ${htmlContent.length}`);
            
            // Just update the state which will re-render the editor with new content
            console.log(`[RoxPage] SET_EDITOR_CONTENT: Updating editorContent state with 'testing the editor content' + original content`);
            setEditorContent("<p>testing the editor content</p>" + editorContent);
            success = true;
            message = "Editor content updated via React state";
          } 
          else if (request.setEditorContentPayload?.contentFormat?.$case === 'jsonContent') {
            const jsonContent = request.setEditorContentPayload.contentFormat.jsonContent;
            console.log(`[RoxPage] SET_EDITOR_CONTENT: Got JSON content, length: ${jsonContent.length}`);
            
            try {
              // Just update state with a simple message
              console.log(`[RoxPage] SET_EDITOR_CONTENT: Updating editorContent state for JSON content`);
              setEditorContent("<p>testing the editor content (JSON)</p>" + editorContent);
              success = true;
              message = "Editor content updated via React state (JSON)";
            } catch (e: any) {
              console.error(`[RoxPage] SET_EDITOR_CONTENT: Error processing JSON: ${e.message}`);
              success = false;
              message = `SET_EDITOR_CONTENT: JSON processing error: ${e.message}`;
            }
          } 
          else {
            console.error(`[RoxPage] SET_EDITOR_CONTENT: Invalid content format`);
            success = false;
            message = "SET_EDITOR_CONTENT: No valid content format provided";
          }
          break;



        default:
          success = false;
          message = `Error: Unknown action_type '${request.actionType}'.`;
          console.warn(`[RoxPage] B2F: Unknown agent UI action: ${request.actionType}`);
      }
      const response = ClientUIActionResponse.create({ requestId, success, message });
      return uint8ArrayToBase64(ClientUIActionResponse.encode(response).finish());
    } catch (error) {
      console.error('[RoxPage] B2F: Error handling Agent PerformUIAction:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      const errResponse = ClientUIActionResponse.create({ requestId, success: false, message: `Client error processing UI action: ${errMessage}` });
      return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
    }
  }, [tiptapEditorRef, setAgentUpdatableTextState, setIsAgentElementVisible, setHighlightData, setEditorContent, editorContent]);

  const toggleStudentStatusDisplay = useCallback(() => {
    setIsStudentStatusDisplayOpen(prev => !prev);
  }, [setIsStudentStatusDisplayOpen]);

  const fetchToken = useCallback(async () => {
      try {
        const tokenUrl = getTokenEndpointUrl(roomName, userName);
        console.log('[rox/page.tsx] Attempting to fetch token from URL:', tokenUrl);
        const fetchOptions: RequestInit = { headers: {} };
        if (tokenServiceConfig.includeApiKeyInClient && tokenServiceConfig.apiKey) {
          (fetchOptions.headers as Record<string, string>)['x-api-key'] = tokenServiceConfig.apiKey;
        }
        const resp = await fetch(tokenUrl, fetchOptions);
        if (!resp.ok) throw new Error(`Token service error: ${resp.status}`);
        const data = await resp.json();
        if (data.token) setToken(data.token);
        else throw new Error('No token in response');
      } catch (err) {
        setError((err as Error).message);
      }
    }, [setToken, setError, roomName, userName, tokenServiceConfig.includeApiKeyInClient, tokenServiceConfig.apiKey]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);


  const connect = useCallback(async () => {
      const newRoomInstance = new Room();
      
      newRoomInstance.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room:', newRoomInstance.name);
        setIsConnected(true);
        setRoom(newRoomInstance); // Update state for rendering
        roomRef.current = newRoomInstance; // Store in ref for cleanup

        // Setup RPC client once connected
        if (newRoomInstance.localParticipant) {
          // Initialize RPC adapter with a fallback identity first - we'll update it when we detect the agent
          const fallbackAgentIdentity = "rox-custom-llm-agent"; // Fallback identity
          liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(newRoomInstance.localParticipant, fallbackAgentIdentity);
          console.log('LiveKitRpcAdapter initialized with fallback identity. Will update when agent is detected.');

          const localP = newRoomInstance.localParticipant; // Define localP

          // ---- B2F RPC Handler Registration ----
          const b2f_rpcMethodName = "rox.interaction.ClientSideUI/PerformUIAction";
          console.log(`[RoxPage] Attempting to register B2F RPC handler for: ${b2f_rpcMethodName}`);
          try {
            localP.registerRpcMethod(b2f_rpcMethodName, handlePerformUIAction);
            console.log(`[RoxPage] B2F RPC Handler registered successfully for: ${b2f_rpcMethodName}`);
          } catch (e) {
            if (e instanceof RpcError && e.message.includes("already registered")) {
              console.warn(`[RoxPage] B2F RPC method ${b2f_rpcMethodName} already registered (this might be due to hot reload).`);
            } else {
              console.error("[RoxPage] Failed to register B2F RPC handler 'PerformUIAction':", e);
            }
          }

          // Send Page Load Notification to Agent for Writing Practice Test Page
          const sendPageLoadNotificationToAgent = async (roomInstance: Room) => {
            if (!liveKitRpcAdapterRef.current) {
              console.error("[WritingPracticeTestPage] LiveKitRpcAdapter not available. Cannot send PageLoad notification.");
              return;
            }
            try {
              const pageLoadData = NotifyPageLoadRequest.create({
                taskStage: "WRITING_PRACTICE_INIT", // Specific to writing practice page
                userId: userName, // userName is 'TestUser' from component scope
                currentPage: "P2_WritingPractice", // Specific to writing practice page
                sessionId: (roomInstance as any).sid || roomInstance.name, // Attempt to get session ID, fallback to room name
                chatHistory: JSON.stringify([]), // Empty chat history for initial load, or load from storage
                transcript: "client_loaded_writing_practice_page",
              });
              const serializedRequest = NotifyPageLoadRequest.encode(pageLoadData).finish();

              console.log("[WritingPracticeTestPage] Calling RPC: Service 'rox.interaction.AgentInteraction', Method 'NotifyPageLoad' with request:", pageLoadData);

              const serializedResponse = await liveKitRpcAdapterRef.current.request(
                "rox.interaction.AgentInteraction",
                "NotifyPageLoad",
                serializedRequest
              );
              const responseMessage = AgentResponse.decode(serializedResponse);
              console.log("[WritingPracticeTestPage] RPC Response from NotifyPageLoad:", responseMessage);
              // Optionally, update UI or state based on responseMessage
            } catch (e) {
              console.error(`[WritingPracticeTestPage] Error calling NotifyPageLoad RPC: ${e instanceof Error ? e.message : String(e)}`, e);
            }
          };

          setTimeout(() => sendPageLoadNotificationToAgent(newRoomInstance), 2000); // Added 2s delay
          
          // Setup a listener for when participants join to identify the agent
          newRoomInstance.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            console.log(`New participant connected: ${participant.identity}`);
            if (participant.identity !== newRoomInstance.localParticipant.identity) {
              // This is likely the agent
              console.log(`Found agent with identity: ${participant.identity}`);
              // Update the RPC adapter with the correct agent identity
              if (liveKitRpcAdapterRef.current) {
                liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
                  newRoomInstance.localParticipant, 
                  participant.identity
                );
                console.log('LiveKitRpcAdapter updated with detected agent identity.');
              }
            }
          });
          
          // Also check if there are already remote participants in the room
          // In some LiveKit versions, we need to use .remoteParticipants instead of .participants
          const remoteParticipantsMap = newRoomInstance.remoteParticipants || 
                                     (newRoomInstance as any).participants;
                                     
          if (remoteParticipantsMap && typeof remoteParticipantsMap.values === 'function') {
            try {
              const remoteParticipants = Array.from(remoteParticipantsMap.values()) as RemoteParticipant[];
              console.log('Remote participants already in room:', remoteParticipants.map(p => p.identity));
              
              // Find the first participant that's not us
              const agentParticipant = remoteParticipants.find(p => 
                p.identity !== newRoomInstance.localParticipant.identity
              );
              
              if (agentParticipant) {
                console.log(`Found existing agent with identity: ${agentParticipant.identity}`);
                // Update the RPC adapter with the correct agent identity
                liveKitRpcAdapterRef.current = new LiveKitRpcAdapter(
                  newRoomInstance.localParticipant, 
                  agentParticipant.identity
                );
                console.log('LiveKitRpcAdapter updated with existing agent identity.');
              }
            } catch (err) {
              console.warn('Error checking existing participants:', err);
            }
          } else {
            console.log('No remote participants collection available yet or it doesn\'t have a values() method');
          }
        } else {
          console.error('LocalParticipant not available after connection, cannot set up RPC client.');
        }
      });

      newRoomInstance.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, kind?: DataPacket_Kind, topic?: string) => {
        if (participant) {
          console.log(`Received data from participant ${participant.identity} (kind: ${kind}, topic: ${topic})`);
          try {
            const messageStr = new TextDecoder().decode(payload);
            const message = JSON.parse(messageStr);
            console.log('Decoded message:', message);

            // Check for chat messages with metadata carrying dom_actions
            // The structure might depend on how CustomLLMBridge wraps it.
            // Assuming it's a ChatChunk-like structure or similar.
            if (message?.delta?.metadata?.dom_actions) {
              const domActionsStr = message.delta.metadata.dom_actions;
              try {
                const domActions = JSON.parse(domActionsStr);
                if (Array.isArray(domActions)) {
                  domActions.forEach((actionItem: any) => {
                    console.log('Processing DOM action from metadata:', actionItem);
                    if (actionItem.action === 'click' && actionItem.payload?.selector === '#statusViewButton') {
                      console.log('Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from metadata');
                      toggleStudentStatusDisplay();
                    } else if (actionItem.action === 'click' && actionItem.payload?.selector) {
                      console.log(`Agent requested click on other selector from metadata: ${actionItem.payload.selector}`);
                      // Potentially handle other selectors if needed in the future, e.g., #startLearningButton
                    }
                  });
                }
              } catch (e) {
                console.error('Failed to parse dom_actions from metadata:', e);
              }
            }
            // Fallback: Check for simpler action/payload structure directly if CustomLLMBridge might send it this way.
            // This is based on rox_agent.py returning dom_actions directly in its JSON response.
            // CustomLLMBridge might pick this up and send it without the delta/metadata wrapper in some configurations.
            else if (message?.dom_actions && Array.isArray(message.dom_actions)) {
                message.dom_actions.forEach((actionItem: any) => {
                  console.log('Processing DOM action from direct message property:', actionItem);
                  if (actionItem.action === 'click' && actionItem.payload?.selector === '#statusViewButton') {
                    console.log('Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from direct message property');
                    toggleStudentStatusDisplay();
                  }
                });
            }
            // Further fallback for direct action/payload if it's a single action not in an array
            else if (message?.action === 'click' && message?.payload?.selector === '#statusViewButton') {
              console.log('Agent requested to toggle StudentStatusDisplay via #statusViewButton selector from single direct action');
              toggleStudentStatusDisplay();
            }

          } catch (e) {
            console.error('Failed to parse data packet:', e);
          }
        }
      });

      newRoomInstance.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setIsConnected(false);
        setRoom(null);
        if (roomRef.current === newRoomInstance) {
          roomRef.current = null;
        }
      });

      try {
        await newRoomInstance.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || '', token, {
          autoSubscribe: true, // Automatically subscribe to all tracks
        });
      } catch (err) {
        setError(`Failed to connect: ${(err as Error).message}`);
        setRoom(null); // Ensure state room is null on failed connection
        roomRef.current = null; // Ensure ref is also null
      }
    },
  [token, roomName, userName, setIsConnected, setRoom, roomRef, liveKitRpcAdapterRef, handlePerformUIAction, toggleStudentStatusDisplay]);

  useEffect(() => {
    if (token && !roomRef.current) { // Only connect if token exists and not already connected/connecting
      connect();
    }

    return () => {
      console.log('Cleaning up LiveKit room connection');
      roomRef.current?.disconnect();
      roomRef.current = null; // Clear the ref on cleanup
    };
  }, [token, connect]); // Effect dependencies

  // Callback for when the timer starts (e.g., user clicks 'Start Timer')
  const handleDisconnect = useCallback(() => {
    console.log('[RoxPage] Timer started, making editor editable and disconnecting LiveKit...');
    setIsEditorCurrentlyEditable(true);
    if (roomRef.current) {
      roomRef.current.disconnect();
      // The RoomEvent.Disconnected handler will set roomRef.current to null
      console.log('[RoxPage] Disconnected from LiveKit room by timer start.');
    }
  }, [setIsEditorCurrentlyEditable, roomRef]);

  // Callback for when the timer ends
  const performReconnect = useCallback(async () => {
    console.log('[RoxPage] Timer ended, making editor non-editable and attempting to save submission...');
    setIsEditorCurrentlyEditable(false); // Make editor non-editable

    const editorHtmlContent = tiptapEditorRef.current?.editor?.getHTML() || '';

    // Attempt to save writing submission
    if (currentTimerDuration > 0 && editorHtmlContent) {
      const submissionData = {
        questionText: "Freestyle Writing Practice from Tiptap", // Or a more dynamic question
        writtenText: editorHtmlContent,
        duration: currentTimerDuration, // This is in seconds
        practiceDate: new Date().toISOString(),
        // topicId, taskId, wordCount can be added if available/needed
      };

      try {
        const response = await fetch('http://localhost:3001/api/writing/save-submission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer YOUR_JWT_TOKEN`, // TODO: Add this if your endpoint is protected
          },
          body: JSON.stringify(submissionData),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Writing submission saved successfully:', result);
          setRpcCallStatus('Submission saved!');
        } else {
          const errorResult = await response.json();
          console.error('Failed to save writing submission:', response.status, errorResult);
          setRpcCallStatus(`Error saving: ${errorResult.message || response.statusText}`);
        }
      } catch (error) {
        console.error('Error sending writing submission:', error);
        setRpcCallStatus(`Network error: ${(error as Error).message}`);
      }
    }

    // Original LiveKit reconnection logic
    console.log('[RoxPage] Proceeding with LiveKit reconnection...');
    if (token) {
      connect();
    } else {
      console.warn("[RoxPage] performReconnect called without a token. Fetching token first.");
      fetchToken(); // This will trigger the useEffect to connect once token is fetched
    }
  }, [token, connect, fetchToken, setIsEditorCurrentlyEditable, currentTimerDuration, tiptapEditorRef, setRpcCallStatus]);

  const handleSendMessageToAgent = useCallback(() => {
    if (userInput.trim()) {
      console.log('Sending to agent:', userInput);
      // TODO: Add Socket.IO or LiveKit agent communication logic here
      // For example, if using the LiveKitRpcAdapter:
      // if (liveKitRpcAdapterRef.current) {
      //   const request = AgentResponse.create({ textInput: userInput }); // Assuming AgentResponse is for F2B
      //   liveKitRpcAdapterRef.current.sendRPC('HandleFrontendMessage', AgentResponse.encode(request).finish())
      //     .then(responseBytes => {
      //       // const agentResponse = ...; // Decode agent's response type
      //       console.log('Agent responded to text message (raw):', responseBytes);
      //       setRpcCallStatus('Message sent, agent raw response received.');
      //     })
      //     .catch(err => {
      //       console.error('Error sending message to agent:', err);
      //       setRpcCallStatus(`Error sending message: ${err}`);
      //     });
      // } else {
      //   console.warn('LiveKitRpcAdapter not ready to send message.');
      //   setRpcCallStatus('Cannot send: RPC adapter not ready.');
      // }
      setUserInput(''); // Clear input after sending
    }
  }, [userInput, setUserInput, liveKitRpcAdapterRef]);

  const handleTestRpcCall = useCallback(async () => {
    if (!liveKitRpcAdapterRef.current) {
      setRpcCallStatus('Error: RPC Adapter not initialized.');
      console.error('[RoxPage] RPC Adapter not initialized for handleTestRpcCall.');
      return;
    }
    try {
      setRpcCallStatus('Sending RPC to agent...');
      console.log('[RoxPage] Sending test RPC: HandleFrontendButton');

      const rpcRequest = FrontendButtonClickRequest.create({
        buttonId: "TestRPCButtonFromRoxPage",
      });
      const rpcRequestBytes = FrontendButtonClickRequest.encode(rpcRequest).finish();

      const responseBytes = await liveKitRpcAdapterRef.current.request('rox.interaction.AgentInteraction', 'HandleFrontendButton', rpcRequestBytes);
      
      const agentResponse = AgentResponse.decode(responseBytes); // Assuming AgentResponse is the direct response type
      console.log('[RoxPage] Agent RPC Response:', agentResponse);
      setRpcCallStatus(`Agent response: ${agentResponse.statusMessage || 'No status message'}`);

    } catch (error) {
      console.error('[RoxPage] Error during RPC call:', error);
      if (error instanceof RpcError) {
        setRpcCallStatus(`RPC Error: ${error.message} (Code: ${error.code})`);
      } else {
        setRpcCallStatus(`Error: ${(error as Error).message}`);
      }
    }
  }, [liveKitRpcAdapterRef, setRpcCallStatus]);

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden bg-[image:radial-gradient(ellipse_at_top_right,_#B7C8F3_0%,_transparent_70%),_radial-gradient(ellipse_at_bottom_left,_#B7C8F3_0%,_transparent_70%)]">
      {/* Sidebar */}
      <aside className="w-20 p-4 flex flex-col items-center space-y-6">
        <Image src="/final-logo-1.png" alt="Logo" width={32} height={32} className="rounded-lg" />
        <div className="flex-grow flex flex-col items-center justify-center space-y-4">
          <Image src="/mic-on.svg" alt="Mic On" width={24} height={24} className="cursor-pointer hover:opacity-75" />
          <Image src="/user.svg" alt="User Profile" width={24} height={24} className="cursor-pointer hover:opacity-75" />
          <Image ref={docsIconRef} id="statusViewButton" src="/docs.svg" alt="Docs" width={24} height={24} className="cursor-pointer hover:opacity-75" onClick={toggleStudentStatusDisplay} />
        </div>
        {/* RPC Test Button - Placed in sidebar */}
        {isConnected && room && (
          <div className="mt-auto mb-4 w-full flex flex-col items-center">
            <Button 
              onClick={handleTestRpcCall} 
              variant="outline"
              className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md truncate mb-2"
            >
              Test RPC
            </Button>
            <Button 
              onClick={() => {
              setCurrentTimerDuration(15);
              timerRef.current?.startTimer(15);
            }} 
              variant="outline"
              className="w-full px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md truncate"
            >
              Start Timer Test (15s)
            </Button>
            {rpcCallStatus && <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 text-center w-full break-words">{rpcCallStatus}</p>}
          </div>
        )}</aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
          {isConnected && room && <AudioHandler room={room} />}
        <Timer ref={timerRef} onTimerStarts={handleDisconnect} onTimerEnds={performReconnect} initialSeconds={60} timerLabel="Session Timer" />

        {/* Tiptap Editor Integration */}
        <div style={{
            border: '1px solid #ccc',
            padding: '15px',
            margin: '20px auto',
            backgroundColor: 'rgba(240, 240, 255, 0.9)', // Slightly adjusted background
            borderRadius: '8px',
            maxWidth: '800px', // Constrain width for better readability
            width: '90%', // Ensure it's responsive
        }}>
            <h4 style={{ marginBottom: '10px', color: '#333', textAlign: 'center' }}>Editable Text Area (with Highlights)</h4>
            <TiptapEditor
                initialContent={editorContent}
                extensions={tiptapExtensions}
                highlightData={highlightData}
                isEditable={isEditorCurrentlyEditable} // Controlled by timer state
                // Optional: if you need to sync content back from user edits
                onUpdate={({ editor }) => {
                  // console.log('Editor content updated:', editor.getHTML());
                  // setEditorContent(editor.getHTML()); // Uncomment if you want to save user's edits to state
                }}
                className="min-h-[200px] p-3 border rounded bg-white shadow-inner"
            />
        </div>


        <div className="w-full max-w-3xl absolute bottom-0 mb-12 flex flex-col items-center">
            

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

        
      </main>
    </div>
  );
}
