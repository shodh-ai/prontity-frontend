'use client';

import React, { useRef } from 'react';
import { 
  RpcInvocationData
} from 'livekit-client';
import {
  AgentToClientUIActionRequest,
  ClientUIActionResponse
} from '@/generated/protos/interaction';

// First, let's extend the existing ClientUIActionType enum from your protos
export enum ReactUIActionType {
  // Basic actions - match ClientUIActionType enum from proto
  NO_ACTION = 0,
  SHOW_ALERT = 1,
  UPDATE_TEXT_CONTENT = 2,
  TOGGLE_ELEMENT_VISIBILITY = 3,
  
  // Timer actions - match ClientUIActionType enum from proto
  START_TIMER = 4,
  STOP_TIMER = 5,
  PAUSE_TIMER = 6,
  RESET_TIMER = 7,
  UPDATE_PROGRESS_INDICATOR = 8,
  UPDATE_SCORE_OR_PROGRESS = 9,

  // UI Control actions - match ClientUIActionType enum from proto
  SHOW_ELEMENT = 10,
  HIDE_ELEMENT = 11,
  NAVIGATE_TO_PAGE = 12,

  // Content Display actions - match ClientUIActionType enum from proto
  UPDATE_LIVE_TRANSCRIPT = 13,
  DISPLAY_TRANSCRIPT_OR_TEXT = 14,
  DISPLAY_REMARKS_LIST = 15,
  
  // Additional content & display actions (internal only, not in proto)
  SET_EDITOR_CONTENT = 16,
  APPEND_TEXT_TO_EDITOR_REALTIME = 17,
  DISPLAY_THINK_ALOUD_ANNOTATION = 18,
  DISPLAY_TEACHING_CONTENT_JSON = 19,
  DISPLAY_FORMATTED_NOTES = 20,
  
  // New UI control actions
  SET_BUTTON_PROPERTIES = 21,
  ENABLE_BUTTON = 22,
  DISABLE_BUTTON = 23,
  SHOW_BUTTON_OPTIONS = 24,
  CLEAR_INPUT_FIELD = 25,
  SET_EDITOR_READONLY_SECTIONS = 26,
  SHOW_LOADING_INDICATOR = 27,
  
  // Feedback page specific actions
  HIGHLIGHT_TEXT_RANGES = 28,
  STRIKETHROUGH_TEXT_RANGES = 29,
  SUGGEST_TEXT_EDIT = 30,
  SHOW_INLINE_SUGGESTION = 31,
  SHOW_TOOLTIP_OR_COMMENT = 32
}

// Helper functions for Base64 encoding/decoding
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// Define our request and response interfaces
export interface ReactUIActionRequest {
  requestId: string;
  actionType: ReactUIActionType;
  targetElementId: string;
  parameters: { [key: string]: string };
  
  // Feedback page specific payloads
  highlightRangesPayload?: any[];
  strikethroughRangesPayload?: any[];
  suggestTextEditPayload?: {
    suggestionId: string;
    startPos: number;
    endPos: number;
    originalText: string;
    newText: string;
  };
  showInlineSuggestionPayload?: {
    suggestionId: string;
    startPos: number;
    endPos: number;
    suggestionText: string;
    suggestionType?: string;
  };
  showTooltipOrCommentPayload?: {
    id: string;
    startPos: number;
    endPos: number;
    text: string;
    tooltipType?: string;
  };
  appendTextToEditorRealtimePayload?: {
    textChunk: string;
    streamId?: string;
  };
}

export interface ReactUIActionResponse {
  requestId: string;
  success: boolean;
  message: string;
}

// Types of state updater functions that we'll need to pass from parent components
export type TextStateUpdater = (text: string) => void;
export type VisibilityStateUpdater = (visible: boolean) => void;
export type EditorContentUpdater = (content: string, isHtml: boolean) => void;
export type TranscriptUpdater = (chunk: string, isFinal: boolean) => void;
export type RemarksListUpdater = (remarks: any[]) => void;
export type TeachingContentUpdater = (elements: any[]) => void;
export type FormattedNotesUpdater = (notes: any) => void;
export type TimerControlUpdater = (action: 'start' | 'stop' | 'pause' | 'reset', options?: any) => void;
export type ProgressUpdater = (current: number, total: number, message?: string) => void;
export type ScoreUpdater = (scoreText: string, progressPercentage?: number) => void;
export type NavigationUpdater = (page: string, data?: any) => void;

// New updater types
export interface ButtonProperties {
  label?: string;
  disabled?: boolean;
  taskData?: any;
  styleClass?: string;
}
export type ButtonPropertiesUpdater = (properties: ButtonProperties) => void;
export type ButtonOptionsUpdater = (buttons: Array<{label: string, actionContextUpdate: any}>) => void;
export type InputFieldClearer = () => void;
export type EditorReadonlySectionsUpdater = (ranges: Array<{start: any, end: any, readOnly: boolean}>) => void;
export type AudioCuePlayer = (soundName: string) => void;
export type LoadingIndicatorUpdater = (isLoading: boolean, message?: string) => void;

// Feedback page specific types
export interface Highlight {
  id: string;
  start: number;
  end: number;
  type: string;
  message?: string;
  data?: {
    originalText?: string;
    newText?: string;
    suggestionId?: string;
    suggestionType?: string;
    tooltipId?: string;
    tooltipType?: string;
  };
}

export interface StrikeThroughRange {
  id: string;
  start: number;
  end: number;
  type: string;
  message?: string;
}

export interface TextEditSuggestion {
  suggestionId: string;
  startPos: number;
  endPos: number;
  originalText: string;
  newText: string;
}

export interface TooltipOrComment {
  id: string;
  startPos: number;
  endPos: number;
  text: string;
  tooltipType?: string;
}

export type HighlightUpdater = (highlights: Highlight[]) => void;
export type StrikeThroughUpdater = (ranges: StrikeThroughRange[]) => void;
export type TextEditSuggestionUpdater = (suggestion: TextEditSuggestion) => void;
export type TooltipOrCommentUpdater = (tooltip: TooltipOrComment) => void;
export type EditorContentSetterUpdater = (content: string) => void;
export type EditorAppendTextUpdater = (textChunk: string, streamId?: string) => void;

// Main props interface for our React UI Actions component
export interface ReactUIActionsProps {
  // Element state updaters (to be provided by parent components)
  textStateUpdaters?: { [elementId: string]: TextStateUpdater };
  visibilityStateUpdaters?: { [elementId: string]: VisibilityStateUpdater };
  editorContentUpdaters?: { [elementId: string]: EditorContentUpdater };
  transcriptUpdaters?: { [elementId: string]: TranscriptUpdater };
  remarksListUpdaters?: { [elementId: string]: RemarksListUpdater };
  teachingContentUpdaters?: { [elementId: string]: TeachingContentUpdater };
  formattedNotesUpdaters?: { [elementId: string]: FormattedNotesUpdater };
  timerControlUpdaters?: { [elementId: string]: TimerControlUpdater };
  progressIndicatorUpdaters?: { [elementId: string]: ProgressUpdater };
  scoreUpdaters?: { [elementId: string]: ScoreUpdater };
  navigationUpdaters?: { [elementId: string]: NavigationUpdater };
  
  // New updaters for button controls and other UI elements
  buttonPropertiesUpdaters?: { [elementId: string]: ButtonPropertiesUpdater };
  buttonOptionsUpdaters?: { [elementId: string]: ButtonOptionsUpdater };
  inputFieldClearers?: { [elementId: string]: InputFieldClearer };
  editorReadonlySectionsUpdaters?: { [elementId: string]: EditorReadonlySectionsUpdater };
  audioCuePlayers?: { [elementId: string]: AudioCuePlayer };
  loadingIndicatorUpdaters?: { [elementId: string]: LoadingIndicatorUpdater };
  
  // Feedback page specific updaters
  highlightUpdaters?: { [elementId: string]: HighlightUpdater };
  strikeThroughUpdaters?: { [elementId: string]: StrikeThroughUpdater };
  textEditSuggestionUpdaters?: { [elementId: string]: TextEditSuggestionUpdater };
  tooltipOrCommentUpdaters?: { [elementId: string]: TooltipOrCommentUpdater };
  editorContentSetters?: { [elementId: string]: EditorContentSetterUpdater };
  editorAppendTextUpdaters?: { [elementId: string]: EditorAppendTextUpdater };
  
  // Debugging options
  logActions?: boolean;
}

/**
 * ReactUIActions component - Handles all UI actions from the agent
 * 
 * Usage: Include this component in your page and pass state updater functions
 * for the elements you want the agent to be able to control.
 */
export const ReactUIActions: React.FC<ReactUIActionsProps> = ({
  textStateUpdaters = {},
  visibilityStateUpdaters = {},
  editorContentUpdaters = {},
  transcriptUpdaters = {},
  remarksListUpdaters = {},
  teachingContentUpdaters = {},
  formattedNotesUpdaters = {},
  timerControlUpdaters = {},
  progressIndicatorUpdaters = {},
  scoreUpdaters = {},
  navigationUpdaters = {},
  buttonPropertiesUpdaters = {},
  buttonOptionsUpdaters = {},
  inputFieldClearers = {},
  editorReadonlySectionsUpdaters = {},
  audioCuePlayers = {},
  loadingIndicatorUpdaters = {},
  logActions = false
}) => {
  // This component doesn't render anything visible
  return null;
};

/**
 * Handle UI actions from the agent
 * This function can be called from any page that needs to process UI actions
 */
export const handleReactUIAction = async (
  rpcInvocationData: RpcInvocationData,
  props: ReactUIActionsProps
): Promise<string> => {
  const {
    textStateUpdaters = {},
    visibilityStateUpdaters = {},
    editorContentUpdaters = {},
    transcriptUpdaters = {},
    remarksListUpdaters = {},
    teachingContentUpdaters = {},
    formattedNotesUpdaters = {},
    timerControlUpdaters = {},
    progressIndicatorUpdaters = {},
    scoreUpdaters = {},
    navigationUpdaters = {},
    buttonPropertiesUpdaters = {},
    buttonOptionsUpdaters = {},
    inputFieldClearers = {},
    editorReadonlySectionsUpdaters = {},
    audioCuePlayers = {},
    loadingIndicatorUpdaters = {},
    // Feedback page specific updaters
    highlightUpdaters = {},
    strikeThroughUpdaters = {},
    textEditSuggestionUpdaters = {},
    tooltipOrCommentUpdaters = {},
    editorContentSetters = {},
    editorAppendTextUpdaters = {},
    logActions = false
  } = props;

  const payloadString = rpcInvocationData.payload as string | undefined;
  let requestId = rpcInvocationData.requestId || "";
  
  if (logActions) {
    console.log('[ReactUIActions] RPC invoked by agent. Request ID:', requestId);
  }

  try {
    if (!payloadString) {
      console.error('[ReactUIActions] No payload received.');
      const errResponse: ReactUIActionResponse = {
        requestId,
        success: false,
        message: "Error: No payload"
      };
      return uint8ArrayToBase64(new TextEncoder().encode(JSON.stringify(errResponse)));
    }

    const decodedPayload = base64ToUint8Array(payloadString);
    
    // Use the imported protobuf message type to decode the payload
    let request: ReactUIActionRequest;
    try {
      // Decode the protobuf message using the imported type
      const protoRequest = AgentToClientUIActionRequest.decode(decodedPayload);
      
      // Convert the protobuf message to our internal format
      // Cast the action type to ReactUIActionType since they should have the same numeric values
      request = {
        requestId: protoRequest.requestId,
        actionType: protoRequest.actionType as unknown as ReactUIActionType,
        targetElementId: protoRequest.targetElementId,
        parameters: protoRequest.parameters
      };
      
      if (logActions) {
        console.log('[ReactUIActions] Protobuf request decoded:', request);
      }
    } catch (error) {
      console.error('[ReactUIActions] Error decoding protobuf message:', error);
      // Fallback to JSON parsing as a last resort
      try {
        request = JSON.parse(new TextDecoder().decode(decodedPayload));
        console.log('[ReactUIActions] Fallback to JSON parsing successful');
      } catch (jsonError) {
        console.error('[ReactUIActions] Failed to parse message as JSON too:', jsonError);
        // Create error response
        const responseProto = ClientUIActionResponse.create({
          requestId: requestId,
          success: false,
          message: `Error decoding message: ${error}`
        });
        const serializedResponse = ClientUIActionResponse.encode(responseProto).finish();
        return uint8ArrayToBase64(serializedResponse);
      }
    }
    
    // Use request ID from payload if available
    if (request.requestId) {
      requestId = request.requestId;
    }

    if (logActions) {
      console.log('[ReactUIActions] Request received:', request);
    }

    let success = true;
    let message = "Action performed successfully.";

    switch (request.actionType) {
      // Basic actions
      case ReactUIActionType.SHOW_ALERT:
        const alertMsg = request.parameters["message"] || "Agent alert!";
        alert(alertMsg);
        message = `Alert shown: ${alertMsg}`;
        break;

      case ReactUIActionType.UPDATE_TEXT_CONTENT:
        const newText = request.parameters["text"];
        const shouldAppend = request.parameters["append"] === "true";
        
        if (request.targetElementId && newText !== undefined) {
          const updater = textStateUpdaters[request.targetElementId];
          
          if (updater) {
            if (shouldAppend && request.parameters["currentText"]) {
              updater(request.parameters["currentText"] + newText);
            } else {
              updater(newText);
            }
            message = `Element '${request.targetElementId}' text updated.`;
          } else {
            // Fallback to DOM manipulation
            const element = document.getElementById(request.targetElementId);
            if (element) {
              if (shouldAppend) {
                element.innerText += newText;
              } else {
                element.innerText = newText;
              }
              message = `Element '${request.targetElementId}' text updated via DOM.`;
            } else {
              success = false;
              message = `Error: Element '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId or text for UPDATE_TEXT_CONTENT.";
        }
        break;

      case ReactUIActionType.TOGGLE_ELEMENT_VISIBILITY:
        const visibleParam = request.parameters["visible"];
        const forceState = request.parameters["force_state"];
        
        if (request.targetElementId) {
          const updater = visibilityStateUpdaters[request.targetElementId];
          
          if (updater) {
            if (visibleParam === "true" || forceState === "true") {
              updater(true);
              message = `Element '${request.targetElementId}' visibility set to true.`;
            } else if (visibleParam === "false" || forceState === "false") {
              updater(false);
              message = `Element '${request.targetElementId}' visibility set to false.`;
            } else {
              // Toggle visibility by getting current state through DOM
              // (This is a fallback, ideally component should pass current state)
              const element = document.getElementById(request.targetElementId);
              const isCurrentlyVisible = element ? 
                window.getComputedStyle(element).display !== 'none' : false;
              updater(!isCurrentlyVisible);
              message = `Element '${request.targetElementId}' visibility toggled.`;
            }
          } else {
            // Fallback for direct DOM manipulation
            const element = document.getElementById(request.targetElementId);
            if (element) {
              if (visibleParam === "true" || forceState === "true") {
                element.style.display = '';
                message = `Element '${request.targetElementId}' display set to visible via DOM.`;
              } else if (visibleParam === "false" || forceState === "false") {
                element.style.display = 'none';
                message = `Element '${request.targetElementId}' display set to none via DOM.`;
              } else {
                element.style.display = element.style.display === 'none' ? '' : 'none';
                message = `Element '${request.targetElementId}' display toggled via DOM.`;
              }
            } else {
              success = false;
              message = `Error: Element '${request.targetElementId}' not found for visibility toggle.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for TOGGLE_ELEMENT_VISIBILITY.";
        }
        break;
        
      case ReactUIActionType.SHOW_ELEMENT:
        if (request.targetElementId) {
          const updater = visibilityStateUpdaters[request.targetElementId];
          
          if (updater) {
            updater(true);
            message = `Element '${request.targetElementId}' visibility set to true.`;
          } else {
            // Fallback for direct DOM manipulation
            const element = document.getElementById(request.targetElementId);
            if (element) {
              element.style.display = '';
              message = `Element '${request.targetElementId}' display set to visible via DOM.`;
            } else {
              success = false;
              message = `Error: Element '${request.targetElementId}' not found for SHOW_ELEMENT.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for SHOW_ELEMENT.";
        }
        break;
        
      case ReactUIActionType.HIDE_ELEMENT:
        if (request.targetElementId) {
          const updater = visibilityStateUpdaters[request.targetElementId];
          
          if (updater) {
            updater(false);
            message = `Element '${request.targetElementId}' visibility set to false.`;
          } else {
            // Fallback for direct DOM manipulation
            const element = document.getElementById(request.targetElementId);
            if (element) {
              element.style.display = 'none';
              message = `Element '${request.targetElementId}' display set to none via DOM.`;
            } else {
              success = false;
              message = `Error: Element '${request.targetElementId}' not found for HIDE_ELEMENT.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for HIDE_ELEMENT.";
        }
        break;
        
      case ReactUIActionType.NAVIGATE_TO_PAGE:
        const pageName = request.parameters["page_name"];
        const pageData = request.parameters["data_for_page"];
        
        if (pageName) {
          const updater = navigationUpdaters[pageName];
          
          if (updater) {
            try {
              // Parse page data if provided
              const parsedData = pageData ? JSON.parse(pageData) : undefined;
              updater(pageName, parsedData);
              message = `Navigation to page '${pageName}' triggered.`;
            } catch (error) {
              success = false;
              message = `Error navigating to page: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            // Fallback to use window.location or router
            try {
              // This is a simplified approach - in a real app you'd use Next.js router
              window.location.href = `/${pageName}`;
              message = `Navigation to /${pageName} triggered via window.location.`;
            } catch (error) {
              success = false;
              message = `Error navigating to page: ${error instanceof Error ? error.message : String(error)}`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing page_name parameter for NAVIGATE_TO_PAGE.";
        }
        break;

      // Advanced editor actions
      case ReactUIActionType.SET_EDITOR_CONTENT:
        const htmlContent = request.parameters["html_content"];
        const jsonContent = request.parameters["json_content"];
        
        if (request.targetElementId) {
          const updater = editorContentUpdaters[request.targetElementId];
          
          if (updater) {
            if (htmlContent) {
              updater(htmlContent, true);
              message = `Editor '${request.targetElementId}' HTML content updated.`;
            } else if (jsonContent) {
              updater(jsonContent, false);
              message = `Editor '${request.targetElementId}' JSON content updated.`;
            } else {
              success = false;
              message = `Error: Neither html_content nor json_content provided for SET_EDITOR_CONTENT.`;
            }
          } else {
            success = false;
            message = `Error: No editor state updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for SET_EDITOR_CONTENT.";
        }
        break;

      case ReactUIActionType.APPEND_TEXT_TO_EDITOR_REALTIME:
        const textChunk = request.parameters["text_chunk"];
        
        if (request.targetElementId && textChunk) {
          const updater = editorContentUpdaters[request.targetElementId];
          
          if (updater) {
            // We need the current content to append to it
            // This should be handled in the parent component
            const currentContent = request.parameters["current_content"] || "";
            updater(currentContent + textChunk, true);
            message = `Text chunk appended to editor '${request.targetElementId}'.`;
          } else {
            success = false;
            message = `Error: No editor state updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId or text_chunk for APPEND_TEXT_TO_EDITOR_REALTIME.";
        }
        break;

      case ReactUIActionType.UPDATE_LIVE_TRANSCRIPT:
        const newChunk = request.parameters["new_chunk"];
        const isFinalForSentence = request.parameters["is_final_for_sentence"] === "true";
        const fullSentenceTranscript = request.parameters["full_sentence_transcript"];
        
        if (request.targetElementId) {
          const updater = transcriptUpdaters[request.targetElementId];
          
          if (updater) {
            if (fullSentenceTranscript) {
              // If we have a full sentence, use that directly
              updater(fullSentenceTranscript, true);
              message = `Full transcript updated for '${request.targetElementId}'.`;
            } else if (newChunk) {
              // Otherwise use the chunk update approach
              updater(newChunk, isFinalForSentence);
              message = `Transcript chunk added to '${request.targetElementId}'.`;
            } else {
              success = false;
              message = `Error: Neither new_chunk nor full_sentence_transcript provided.`;
            }
          } else {
            // Fallback to DOM manipulation
            const element = document.getElementById(request.targetElementId);
            if (element) {
              // For simple DOM fallback, just append or replace the content
              if (fullSentenceTranscript) {
                element.innerText = fullSentenceTranscript;
              } else if (newChunk) {
                if (isFinalForSentence) {
                  // If final, replace the content
                  element.innerText = newChunk;
                } else {
                  // Otherwise append
                  element.innerText += newChunk;
                }
              }
              message = `Transcript updated in '${request.targetElementId}' via DOM.`;
            } else {
              success = false;
              message = `Error: Element '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for UPDATE_LIVE_TRANSCRIPT.";
        }
        break;


      case ReactUIActionType.DISPLAY_TRANSCRIPT_OR_TEXT:
        const textContent = request.parameters["text_content"];
        
        if (request.targetElementId && textContent) {
          const updater = textStateUpdaters[request.targetElementId];
          
          if (updater) {
            updater(textContent);
            message = `Text content displayed in '${request.targetElementId}'.`;
          } else {
            // Fallback to DOM
            const element = document.getElementById(request.targetElementId);
            if (element) {
              element.innerText = textContent;
              message = `Text content displayed in '${request.targetElementId}' via DOM.`;
            } else {
              success = false;
              message = `Error: Element '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId or text_content for DISPLAY_TRANSCRIPT_OR_TEXT.";
        }
        break;

      case ReactUIActionType.DISPLAY_REMARKS_LIST:
        const remarksJson = request.parameters["remarks"];
        
        if (request.targetElementId && remarksJson) {
          const updater = remarksListUpdaters[request.targetElementId];
          
          if (updater) {
            try {
              const remarks = JSON.parse(remarksJson);
              updater(remarks);
              message = `Remarks list displayed in '${request.targetElementId}'.`;
            } catch (error) {
              success = false;
              message = `Error parsing remarks JSON: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No remarks list updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId or remarks for DISPLAY_REMARKS_LIST.";
        }
        break;

      case ReactUIActionType.DISPLAY_THINK_ALOUD_ANNOTATION:
        const thinkAloudText = request.parameters["text"];
        
        if (request.targetElementId && thinkAloudText) {
          const updater = textStateUpdaters[request.targetElementId];
          
          if (updater) {
            updater(thinkAloudText);
            message = `Think-aloud annotation displayed in '${request.targetElementId}'.`;
          } else {
            // Fallback to DOM
            const element = document.getElementById(request.targetElementId);
            if (element) {
              element.innerText = thinkAloudText;
              message = `Think-aloud annotation displayed in '${request.targetElementId}' via DOM.`;
            } else {
              success = false;
              message = `Error: Element '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId or text for DISPLAY_THINK_ALOUD_ANNOTATION.";
        }
        break;

      case ReactUIActionType.DISPLAY_TEACHING_CONTENT_JSON:
        const elementsJson = request.parameters["elements"];
        
        if (request.targetElementId && elementsJson) {
          const updater = teachingContentUpdaters[request.targetElementId];
          
          if (updater) {
            try {
              const elements = JSON.parse(elementsJson);
              updater(elements);
              message = `Teaching content displayed in '${request.targetElementId}'.`;
            } catch (error) {
              success = false;
              message = `Error parsing teaching content JSON: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No teaching content updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId or elements for DISPLAY_TEACHING_CONTENT_JSON.";
        }
        break;

      case ReactUIActionType.DISPLAY_FORMATTED_NOTES:
        const notesObjectJson = request.parameters["notes_object"];
        
        if (request.targetElementId && notesObjectJson) {
          const updater = formattedNotesUpdaters[request.targetElementId];
          
          if (updater) {
            try {
              const notesObject = JSON.parse(notesObjectJson);
              updater(notesObject);
              message = `Formatted notes displayed in '${request.targetElementId}'.`;
            } catch (error) {
              success = false;
              message = `Error parsing notes object JSON: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No formatted notes updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId or notes_object for DISPLAY_FORMATTED_NOTES.";
        }
        break;

      // Timer control actions
      case ReactUIActionType.START_TIMER:
        if (request.targetElementId) {
          const updater = timerControlUpdaters[request.targetElementId];
          if (updater) {
            try {
              const durationSeconds = request.parameters["duration_seconds"] ? 
                parseInt(request.parameters["duration_seconds"]) : 60;
              const timerType = request.parameters["timer_type"] || "task";
              const onCompleteContext = request.parameters["on_complete_context_update"] ? 
                JSON.parse(request.parameters["on_complete_context_update"]) : undefined;
                
              updater('start', { durationSeconds, timerType, onCompleteContext });
              message = `Timer '${request.targetElementId}' started with duration ${durationSeconds}s and type '${timerType}'.`;
            } catch (error) {
              success = false;
              message = `Error starting timer: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No timer controller registered for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for START_TIMER.";
        }
        break;
        
      case ReactUIActionType.STOP_TIMER:
        if (request.targetElementId) {
          const updater = timerControlUpdaters[request.targetElementId];
          if (updater) {
            updater('stop');
            message = `Timer '${request.targetElementId}' stopped.`;
          } else {
            success = false;
            message = `Error: No timer controller registered for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for STOP_TIMER.";
        }
        break;
        
      case ReactUIActionType.PAUSE_TIMER:
        if (request.targetElementId) {
          const updater = timerControlUpdaters[request.targetElementId];
          if (updater) {
            const pauseState = request.parameters["pause"] === "false" ? false : true;
            updater('pause', { pause: pauseState });
            message = `Timer '${request.targetElementId}' ${pauseState ? 'paused' : 'resumed'}.`;
          } else {
            success = false;
            message = `Error: No timer controller registered for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for PAUSE_TIMER.";
        }
        break;
        
      case ReactUIActionType.RESET_TIMER:
        if (request.targetElementId) {
          const updater = timerControlUpdaters[request.targetElementId];
          if (updater) {
            updater('reset');
            message = `Timer '${request.targetElementId}' reset.`;
          } else {
            success = false;
            message = `Error: No timer controller registered for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for RESET_TIMER.";
        }
        break;
        
      // Progress indicator actions
      case ReactUIActionType.UPDATE_PROGRESS_INDICATOR:
        if (request.targetElementId) {
          const updater = progressIndicatorUpdaters[request.targetElementId];
          if (updater) {
            try {
              const currentStep = request.parameters["current_step"] ? 
                parseInt(request.parameters["current_step"]) : 1;
              const totalSteps = request.parameters["total_steps"] ? 
                parseInt(request.parameters["total_steps"]) : 1;
              const progressMessage = request.parameters["message"] || undefined;
                
              updater(currentStep, totalSteps, progressMessage);
              message = `Progress indicator '${request.targetElementId}' updated to ${currentStep}/${totalSteps}.`;
            } catch (error) {
              success = false;
              message = `Error updating progress: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No progress indicator registered for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for UPDATE_PROGRESS_INDICATOR.";
        }
        break;
        
      case ReactUIActionType.UPDATE_SCORE_OR_PROGRESS:
        if (request.targetElementId) {
          const updater = scoreUpdaters[request.targetElementId];
          if (updater) {
            try {
              const scoreText = request.parameters["score_text"] || "";
              const progressPercentage = request.parameters["progress_percentage"] ? 
                parseInt(request.parameters["progress_percentage"]) : undefined;
                
              updater(scoreText, progressPercentage);
              message = `Score display '${request.targetElementId}' updated with score: '${scoreText}' and progress: ${progressPercentage}%.`;
            } catch (error) {
              success = false;
              message = `Error updating score: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No score display registered for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for UPDATE_SCORE_OR_PROGRESS.";
        }
        break;

      case ReactUIActionType.SET_BUTTON_PROPERTIES:
        if (request.targetElementId) {
          const updater = buttonPropertiesUpdaters[request.targetElementId];
          if (updater) {
            try {
              const properties: ButtonProperties = {};
              
              if (request.parameters["label"]) {
                properties.label = request.parameters["label"];
              }
              
              if (request.parameters["disabled"]) {
                properties.disabled = request.parameters["disabled"].toLowerCase() === 'true';
              }
              
              if (request.parameters["style_class"]) {
                properties.styleClass = request.parameters["style_class"];
              }
              
              if (request.parameters["task_data"]) {
                try {
                  properties.taskData = JSON.parse(request.parameters["task_data"]);
                } catch (e) {
                  properties.taskData = request.parameters["task_data"];
                }
              }
              
              updater(properties);
              message = `Button '${request.targetElementId}' properties updated.`;
            } catch (error) {
              success = false;
              message = `Error updating button properties: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            // Fallback for direct DOM manipulation
            const button = document.getElementById(request.targetElementId) as HTMLButtonElement;
            if (button) {
              if (request.parameters["label"]) {
                button.textContent = request.parameters["label"];
              }
              
              if (request.parameters["disabled"]) {
                button.disabled = request.parameters["disabled"].toLowerCase() === 'true';
              }
              
              if (request.parameters["style_class"]) {
                // Remove existing classes and add the new one
                const classes = request.parameters["style_class"].split(' ');
                classes.forEach(cls => button.classList.add(cls));
              }
              
              message = `Button '${request.targetElementId}' properties updated via DOM.`;
            } else {
              success = false;
              message = `Error: Button '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for SET_BUTTON_PROPERTIES.";
        }
        break;
        
      case ReactUIActionType.ENABLE_BUTTON:
        if (request.targetElementId) {
          const updater = buttonPropertiesUpdaters[request.targetElementId];
          if (updater) {
            updater({ disabled: false });
            message = `Button '${request.targetElementId}' enabled.`;
          } else {
            // Fallback for direct DOM manipulation
            const button = document.getElementById(request.targetElementId) as HTMLButtonElement;
            if (button) {
              button.disabled = false;
              message = `Button '${request.targetElementId}' enabled via DOM.`;
            } else {
              success = false;
              message = `Error: Button '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for ENABLE_BUTTON.";
        }
        break;
        
      case ReactUIActionType.DISABLE_BUTTON:
        if (request.targetElementId) {
          const updater = buttonPropertiesUpdaters[request.targetElementId];
          if (updater) {
            updater({ disabled: true });
            message = `Button '${request.targetElementId}' disabled.`;
          } else {
            // Fallback for direct DOM manipulation
            const button = document.getElementById(request.targetElementId) as HTMLButtonElement;
            if (button) {
              button.disabled = true;
              message = `Button '${request.targetElementId}' disabled via DOM.`;
            } else {
              success = false;
              message = `Error: Button '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for DISABLE_BUTTON.";
        }
        break;
        
      case ReactUIActionType.SHOW_BUTTON_OPTIONS:
        if (request.targetElementId) {
          const updater = buttonOptionsUpdaters[request.targetElementId];
          if (updater) {
            try {
              const buttonsJson = request.parameters["buttons"];
              if (buttonsJson) {
                const buttons = JSON.parse(buttonsJson);
                updater(buttons);
                message = `Button options displayed in '${request.targetElementId}'.`;
              } else {
                success = false;
                message = "Error: Missing 'buttons' parameter for SHOW_BUTTON_OPTIONS.";
              }
            } catch (error) {
              success = false;
              message = `Error showing button options: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No button options updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for SHOW_BUTTON_OPTIONS.";
        }
        break;
        
      case ReactUIActionType.CLEAR_INPUT_FIELD:
        if (request.targetElementId) {
          const clearer = inputFieldClearers[request.targetElementId];
          if (clearer) {
            clearer();
            message = `Input field '${request.targetElementId}' cleared.`;
          } else {
            // Fallback for direct DOM manipulation
            const input = document.getElementById(request.targetElementId) as HTMLInputElement | HTMLTextAreaElement;
            if (input) {
              input.value = '';
              message = `Input field '${request.targetElementId}' cleared via DOM.`;
            } else {
              success = false;
              message = `Error: Input field '${request.targetElementId}' not found.`;
            }
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for CLEAR_INPUT_FIELD.";
        }
        break;
        
      case ReactUIActionType.SET_EDITOR_READONLY_SECTIONS:
        if (request.targetElementId) {
          const updater = editorReadonlySectionsUpdaters[request.targetElementId];
          if (updater) {
            try {
              const rangesJson = request.parameters["ranges"];
              if (rangesJson) {
                const ranges = JSON.parse(rangesJson);
                updater(ranges);
                message = `Editor '${request.targetElementId}' readonly sections updated.`;
              } else {
                success = false;
                message = "Error: Missing 'ranges' parameter for SET_EDITOR_READONLY_SECTIONS.";
              }
            } catch (error) {
              success = false;
              message = `Error setting editor readonly sections: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No editor readonly sections updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for SET_EDITOR_READONLY_SECTIONS.";
        }
        break;
        
      // PLAY_AUDIO_CUE action has been removed
        
      case ReactUIActionType.SHOW_LOADING_INDICATOR:
        if (request.targetElementId) {
          const updater = loadingIndicatorUpdaters[request.targetElementId];
          if (updater) {
            try {
              // Handle various boolean parameter formats
              let isLoadingParam = request.parameters["is_loading"];
              let isLoading = true; // Default to true if no parameter is provided
              
              if (isLoadingParam !== undefined) {
                // Convert parameter to boolean properly
                if (typeof isLoadingParam === 'string') {
                  isLoading = isLoadingParam.toLowerCase() === 'true';
                } else if (typeof isLoadingParam === 'boolean') {
                  isLoading = isLoadingParam;
                } else if (typeof isLoadingParam === 'number') {
                  isLoading = isLoadingParam !== 0;
                }
              }
              
              const loadingMessage = request.parameters["message"];
              console.log('SHOW_LOADING_INDICATOR:', { targetElementId: request.targetElementId, isLoading, message: loadingMessage });
              updater(isLoading, loadingMessage);
              message = `Loading indicator '${request.targetElementId}' ${isLoading ? 'shown' : 'hidden'}.`;
            } catch (error) {
              success = false;
              message = `Error updating loading indicator: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            success = false;
            message = `Error: No loading indicator updater found for '${request.targetElementId}'.`;
          }
        } else {
          success = false;
          message = "Error: Missing targetElementId for SHOW_LOADING_INDICATOR.";
        }
        break;
        
      // Feedback page specific actions
      case ReactUIActionType.HIGHLIGHT_TEXT_RANGES:
        console.log('[ReactUIActions] Action: HIGHLIGHT_TEXT_RANGES');
        try {
          if (request.targetElementId) {
            const updater = highlightUpdaters[request.targetElementId];
            if (updater) {
              // Use payload if available
              if (request.highlightRangesPayload && Array.isArray(request.highlightRangesPayload) && request.highlightRangesPayload.length > 0) {
                const newHighlights = request.highlightRangesPayload.map((h: any) => ({
                  id: h.id || `highlight-${Date.now()}-${Math.random()}`,
                  start: h.start,
                  end: h.end,
                  type: h.type || 'agent_highlight',
                  message: h.message,
                  data: {
                    wrongVersion: h.wrongVersion,
                    correctVersion: h.correctVersion
                  }
                }));
                updater(newHighlights as Highlight[]);
                message = 'Text ranges highlighted successfully from payload.';
                success = true;
              } else {
                // Fallback to parameters.highlightData
                const highlightsString = request.parameters["highlightData"];
                if (highlightsString) {
                  try {
                    const parsedHighlights = JSON.parse(highlightsString) as any[];
                    const newHighlights = parsedHighlights.map((h: any) => ({
                      id: h.id || `highlight-${Date.now()}-${Math.random()}`,
                      start: h.start,
                      end: h.end,
                      type: h.type || 'agent_highlight',
                      message: h.message,
                      data: {
                        wrongVersion: h.wrongVersion,
                        correctVersion: h.correctVersion
                      }
                    }));
                    updater(newHighlights as Highlight[]);
                    message = 'Text ranges highlighted successfully from parameters.';
                    success = true;
                  } catch (parseError) {
                    console.error('[ReactUIActions] HIGHLIGHT_TEXT_RANGES: Failed to parse highlightData', parseError);
                    success = false;
                    message = "Error: Failed to parse highlightData from parameters.";
                  }
                } else {
                  success = false;
                  message = "Error: No highlight data found in payload or parameters for HIGHLIGHT_TEXT_RANGES.";
                }
              }
            } else {
              success = false;
              message = `Error: No highlight updater found for '${request.targetElementId}'.`;
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for HIGHLIGHT_TEXT_RANGES.";
          }
        } catch (e) {
          console.error('[ReactUIActions] HIGHLIGHT_TEXT_RANGES: Error processing highlight action:', e);
          success = false;
          message = 'Error: Could not process highlight data.';
        }
        break;
        
      case ReactUIActionType.STRIKETHROUGH_TEXT_RANGES:
        console.log('[ReactUIActions] Action: STRIKETHROUGH_TEXT_RANGES');
        try {
          if (request.targetElementId) {
            const updater = strikeThroughUpdaters[request.targetElementId];
            if (updater) {
              // Use payload if available
              if (request.strikethroughRangesPayload && Array.isArray(request.strikethroughRangesPayload) && request.strikethroughRangesPayload.length > 0) {
                const newRanges = request.strikethroughRangesPayload.map((r: any) => ({
                  id: r.id || `strikethrough-${Date.now()}-${Math.random()}`,
                  start: r.start,
                  end: r.end,
                  type: r.type || 'agent_strikethrough',
                  message: r.message
                }));
                updater(newRanges as StrikeThroughRange[]);
                message = 'Strikethrough ranges applied successfully from payload.';
                success = true;
              } else {
                // Fallback to parameters.strikethroughData
                const rangesString = request.parameters["strikethroughData"];
                if (rangesString) {
                  try {
                    const parsedRanges = JSON.parse(rangesString) as any[];
                    const newRanges = parsedRanges.map((r: any) => ({
                      id: r.id || `strikethrough-${Date.now()}-${Math.random()}`,
                      start: r.start,
                      end: r.end,
                      type: r.type || 'agent_strikethrough',
                      message: r.message
                    }));
                    updater(newRanges as StrikeThroughRange[]);
                    message = 'Strikethrough ranges applied successfully from parameters.';
                    success = true;
                  } catch (parseError) {
                    console.error('[ReactUIActions] STRIKETHROUGH_TEXT_RANGES: Failed to parse strikethroughData', parseError);
                    success = false;
                    message = "Error: Failed to parse strikethroughData from parameters.";
                  }
                } else {
                  success = false;
                  message = "Error: No strikethrough data found in payload or parameters for STRIKETHROUGH_TEXT_RANGES.";
                }
              }
            } else {
              success = false;
              message = `Error: No strikethrough updater found for '${request.targetElementId}'.`;
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for STRIKETHROUGH_TEXT_RANGES.";
          }
        } catch (e) {
          console.error('[ReactUIActions] STRIKETHROUGH_TEXT_RANGES: Error processing strikethrough action:', e);
          success = false;
          message = 'Error: Could not process strikethrough data.';
        }
        break;
        
      case ReactUIActionType.SUGGEST_TEXT_EDIT:
        console.log('[ReactUIActions] Action: SUGGEST_TEXT_EDIT');
        try {
          if (request.targetElementId) {
            const updater = textEditSuggestionUpdaters[request.targetElementId];
            if (updater) {
              // Use payload if available
              if (request.suggestTextEditPayload) {
                const payload = request.suggestTextEditPayload;
                const suggestion: TextEditSuggestion = {
                  suggestionId: payload.suggestionId || `edit-${Date.now()}-${Math.random()}`,
                  startPos: payload.startPos,
                  endPos: payload.endPos,
                  originalText: payload.originalText,
                  newText: payload.newText
                };
                updater(suggestion);
                message = 'Text edit suggestion applied successfully from payload.';
                success = true;
              } else {
                // Fallback to parameters
                const suggestionId = request.parameters["suggestionId"] || `edit-${Date.now()}-${Math.random()}`;
                const startPos = parseInt(request.parameters["startPos"] || "-1");
                const endPos = parseInt(request.parameters["endPos"] || "-1");
                const originalText = request.parameters["originalText"] || "";
                const newText = request.parameters["newText"] || "";
                
                if (startPos >= 0 && endPos >= 0) {
                  const suggestion: TextEditSuggestion = {
                    suggestionId,
                    startPos,
                    endPos,
                    originalText,
                    newText
                  };
                  updater(suggestion);
                  message = 'Text edit suggestion applied successfully from parameters.';
                  success = true;
                } else {
                  success = false;
                  message = "Error: Invalid startPos or endPos for SUGGEST_TEXT_EDIT.";
                }
              }
            } else {
              success = false;
              message = `Error: No text edit suggestion updater found for '${request.targetElementId}'.`;
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for SUGGEST_TEXT_EDIT.";
          }
        } catch (e) {
          console.error('[ReactUIActions] SUGGEST_TEXT_EDIT: Error processing text edit suggestion:', e);
          success = false;
          message = 'Error: Could not process text edit suggestion.';
        }
        break;
        
      case ReactUIActionType.SHOW_TOOLTIP_OR_COMMENT:
        console.log('[ReactUIActions] Action: SHOW_TOOLTIP_OR_COMMENT');
        try {
          if (request.targetElementId) {
            const updater = tooltipOrCommentUpdaters[request.targetElementId];
            if (updater) {
              // Use payload if available
              if (request.showTooltipOrCommentPayload) {
                const payload = request.showTooltipOrCommentPayload;
                const tooltip: TooltipOrComment = {
                  id: payload.id || `tooltip-${Date.now()}-${Math.random()}`,
                  startPos: payload.startPos,
                  endPos: payload.endPos,
                  text: payload.text,
                  tooltipType: payload.tooltipType || 'comment'
                };
                updater(tooltip);
                message = 'Tooltip or comment shown successfully from payload.';
                success = true;
              } else {
                // Fallback to parameters
                const id = request.parameters["id"] || `tooltip-${Date.now()}-${Math.random()}`;
                const startPos = parseInt(request.parameters["startPos"] || "-1");
                const endPos = parseInt(request.parameters["endPos"] || "-1");
                const text = request.parameters["text"] || "";
                const tooltipType = request.parameters["tooltipType"] || "comment";
                
                if (startPos >= 0 && endPos >= 0 && text) {
                  const tooltip: TooltipOrComment = {
                    id,
                    startPos,
                    endPos,
                    text,
                    tooltipType
                  };
                  updater(tooltip);
                  message = 'Tooltip or comment shown successfully from parameters.';
                  success = true;
                } else {
                  success = false;
                  message = "Error: Invalid startPos, endPos, or missing text for SHOW_TOOLTIP_OR_COMMENT.";
                }
              }
            } else {
              success = false;
              message = `Error: No tooltip or comment updater found for '${request.targetElementId}'.`;
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for SHOW_TOOLTIP_OR_COMMENT.";
          }
        } catch (e) {
          console.error('[ReactUIActions] SHOW_TOOLTIP_OR_COMMENT: Error processing tooltip or comment:', e);
          success = false;
          message = 'Error: Could not process tooltip or comment.';
        }
        break;
        
      case ReactUIActionType.SHOW_INLINE_SUGGESTION:
        console.log('[ReactUIActions] Action: SHOW_INLINE_SUGGESTION');
        try {
          if (request.targetElementId) {
            const updater = textEditSuggestionUpdaters[request.targetElementId];
            if (updater) {
              // Use payload if available
              if (request.showInlineSuggestionPayload) {
                const payload = request.showInlineSuggestionPayload;
                const suggestion: TextEditSuggestion = {
                  suggestionId: payload.suggestionId || `inline-${Date.now()}-${Math.random()}`,
                  startPos: payload.startPos,
                  endPos: payload.endPos,
                  originalText: "", // Inline suggestion doesn't replace text
                  newText: payload.suggestionText
                };
                updater(suggestion);
                message = 'Inline suggestion shown successfully from payload.';
                success = true;
              } else {
                // Fallback to parameters
                const suggestionId = request.parameters["suggestionId"] || `inline-${Date.now()}-${Math.random()}`;
                const startPos = parseInt(request.parameters["startPos"] || "-1");
                const endPos = parseInt(request.parameters["endPos"] || "-1");
                const suggestionText = request.parameters["suggestionText"] || "";
                
                if (startPos >= 0 && endPos >= 0 && suggestionText) {
                  const suggestion: TextEditSuggestion = {
                    suggestionId,
                    startPos,
                    endPos,
                    originalText: "", // Inline suggestion doesn't replace text
                    newText: suggestionText
                  };
                  updater(suggestion);
                  message = 'Inline suggestion shown successfully from parameters.';
                  success = true;
                } else {
                  success = false;
                  message = "Error: Invalid startPos, endPos, or missing suggestionText for SHOW_INLINE_SUGGESTION.";
                }
              }
            } else {
              success = false;
              message = `Error: No text edit suggestion updater found for '${request.targetElementId}'.`;
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for SHOW_INLINE_SUGGESTION.";
          }
        } catch (e) {
          console.error('[ReactUIActions] SHOW_INLINE_SUGGESTION: Error processing inline suggestion:', e);
          success = false;
          message = 'Error: Could not process inline suggestion.';
        }
        break;
        
      case ReactUIActionType.APPEND_TEXT_TO_EDITOR_REALTIME:
        console.log('[ReactUIActions] Action: APPEND_TEXT_TO_EDITOR_REALTIME');
        try {
          if (request.targetElementId) {
            const updater = editorAppendTextUpdaters[request.targetElementId];
            if (updater) {
              // Use payload if available
              if (request.appendTextToEditorRealtimePayload) {
                const payload = request.appendTextToEditorRealtimePayload;
                updater(payload.textChunk, payload.streamId);
                message = 'Text appended to editor successfully from payload.';
                success = true;
              } else {
                // Fallback to parameters
                const textChunk = request.parameters["textChunk"] || "";
                const streamId = request.parameters["streamId"] || undefined;
                
                if (textChunk) {
                  updater(textChunk, streamId);
                  message = 'Text appended to editor successfully from parameters.';
                  success = true;
                } else {
                  success = false;
                  message = "Error: Missing textChunk for APPEND_TEXT_TO_EDITOR_REALTIME.";
                }
              }
            } else {
              success = false;
              message = `Error: No editor append text updater found for '${request.targetElementId}'.`;
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for APPEND_TEXT_TO_EDITOR_REALTIME.";
          }
        } catch (e) {
          console.error('[ReactUIActions] APPEND_TEXT_TO_EDITOR_REALTIME: Error appending text to editor:', e);
          success = false;
          message = 'Error: Could not append text to editor.';
        }
        break;
        
      case ReactUIActionType.SET_EDITOR_CONTENT:
        console.log('[ReactUIActions] Action: SET_EDITOR_CONTENT');
        try {
          if (request.targetElementId) {
            // First try the feedback page specific updater
            const specificUpdater = editorContentSetters[request.targetElementId];
            if (specificUpdater) {
              const content = request.parameters["content"] || "";
              specificUpdater(content);
              message = `Editor '${request.targetElementId}' content set.`;
              success = true;
            } else {
              // Fall back to the general updater
              const generalUpdater = editorContentUpdaters[request.targetElementId];
              if (generalUpdater) {
                const content = request.parameters["content"] || "";
                const isHtml = request.parameters["isHtml"] === "true";
                generalUpdater(content, isHtml);
                message = `Editor '${request.targetElementId}' content set.`;
                success = true;
              } else {
                success = false;
                message = `Error: No editor content updater found for '${request.targetElementId}'.`;
              }
            }
          } else {
            success = false;
            message = "Error: Missing targetElementId for SET_EDITOR_CONTENT.";
          }
        } catch (error) {
          success = false;
          message = `Error setting editor content: ${error instanceof Error ? error.message : String(error)}`;
        }
        break;
    }
    
    // Create the response protobuf
    const responseProto = ClientUIActionResponse.create({
      requestId: request.requestId,
      success,
      message
    });
    
    // Encode the protobuf message and return it as base64
    const serializedResponse = ClientUIActionResponse.encode(responseProto).finish();
    return uint8ArrayToBase64(serializedResponse);
  } catch (error) {
    console.error('[ReactUIActions] Error handling UI action:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    
    // Create a protobuf error response
    const responseProto = ClientUIActionResponse.create({
      requestId,
      success: false,
      message: `Client error processing UI action: ${errMessage}`
    });
    
    // Encode the protobuf message and return it as base64
    const serializedResponse = ClientUIActionResponse.encode(responseProto).finish();
    return uint8ArrayToBase64(serializedResponse);
  }
};

// Usage example component to demonstrate how to use this in a page
export const ReactUIActionsExample: React.FC = () => {
  const [exampleText, setExampleText] = React.useState("Example text that can be updated by agent");
  const [isVisible, setIsVisible] = React.useState(true);
  const [editorContent, setEditorContent] = React.useState("<p>Initial editor content</p>");
  const [transcript, setTranscript] = React.useState("");
  const [remarks, setRemarks] = React.useState<any[]>([]);
  const [timerState, setTimerState] = React.useState<{isRunning: boolean, timeLeft: number, timerType: string}>({isRunning: false, timeLeft: 0, timerType: 'task'});
  const [progressState, setProgressState] = React.useState<{current: number, total: number, message?: string}>({current: 0, total: 10});
  const [scoreState, setScoreState] = React.useState<{scoreText: string, progressPercentage?: number}>({scoreText: 'Score: 0/10'});
  const [teachingContent, setTeachingContent] = React.useState<any[]>([]);
  const [notes, setNotes] = React.useState<any>(null);

  // For LiveKit RPC integration, you'd pass this to your LiveKit handler
  const handleUIAction = async (rpcInvocationData: RpcInvocationData): Promise<string> => {
    return handleReactUIAction(rpcInvocationData, {
      textStateUpdaters: {
        'exampleTextElement': setExampleText,
        'transcriptElement': setTranscript,
      },
      visibilityStateUpdaters: {
        'toggleableElement': setIsVisible,
      },
      editorContentUpdaters: {
        'richTextEditor': (content: string, isHtml: boolean) => {
          setEditorContent(content);
          // In a real implementation, you'd handle HTML vs JSON differently
        },
      },
      remarksListUpdaters: {
        'remarksPanel': setRemarks,
      },
      teachingContentUpdaters: {
        'teachingContent': setTeachingContent,
      },
      formattedNotesUpdaters: {
        'notesArea': setNotes,
      },
      logActions: true,
    });
  };

  return (
    <div>
      {/* This component shows how to connect state to the UI action handlers */}
      <div>
        <h3>Example Text Element</h3>
        <p id="exampleTextElement">{exampleText}</p>
      </div>

      <div style={{ display: isVisible ? 'block' : 'none' }}>
        <h3>Toggleable Element</h3>
        <p id="toggleableElement">This element can be hidden/shown by the agent</p>
      </div>

      {/* In a real implementation, you'd use your rich text editor component */}
      <div>
        <h3>Rich Text Editor</h3>
        <div id="richTextEditor" dangerouslySetInnerHTML={{ __html: editorContent }} />
      </div>

      {/* Other UI elements would follow similar patterns */}
    </div>
  );
};

export default ReactUIActions;