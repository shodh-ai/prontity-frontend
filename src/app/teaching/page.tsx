"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageButton } from "@/components/ui/message-button";
import { MicButton } from "@/components/ui/mic";
import { PreviousButton } from "@/components/ui/previous-button";
import { NextButton } from "@/components/ui/next-button";
import { PlayPauseButton } from "@/components/ui/playpause-button";
import loadCommand from "@/api/loadCommand";
import LessonData from "@/types/command";
import {
  WriteCommand,
  DrawShapeCommand,
  AnnotateCommand,
  DrawSVGCommand,
  WaitCommand,
} from "@/types/command";
import Vara from "vara";
import rough from "roughjs";
import Konva from "konva";
import { RpcInvocationData } from "livekit-client";
import {
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
} from "@/generated/protos/interaction";
import LiveKitSession, {
  LiveKitRpcAdapter,
} from "@/components/LiveKitSession";
import { ScreenShare } from "lucide-react"; // FIXED: Imported missing icon component

// Helper function for Base64 encoding
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export default function Page(): JSX.Element {
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);
  // Refs for DOM elements
  const mainContentRef = useRef<HTMLElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);

  const handlePerformUIAction = useCallback(
    async (rpcInvocationData: RpcInvocationData): Promise<string> => {
      const payloadString = rpcInvocationData.payload as string | undefined;
      let requestId = rpcInvocationData.requestId || "";
      console.log("[CanTestPage] B2F RPC received. Request ID:", requestId);

      try {
        if (!payloadString) throw new Error("No payload received.");

        const request = AgentToClientUIActionRequest.fromJSON(
          JSON.parse(payloadString)
        );
        let success = true;
        let message = "Action processed successfully.";

        console.log(
          `[CanTestPage] Received action: ${request.actionType}`,
          request
        );

        const response = ClientUIActionResponse.create({
          requestId,
          success,
          message,
        });
        return uint8ArrayToBase64(
          ClientUIActionResponse.encode(response).finish()
        );
      } catch (innerError) {
        console.error(
          "[CanTestPage] Error handling Agent PerformUIAction:",
          innerError
        );
        const errMessage =
          innerError instanceof Error ? innerError.message : String(innerError);
        const errResponse = ClientUIActionResponse.create({
          requestId,
          success: false,
          message: `Client error processing UI action: ${errMessage}`,
        });
        return uint8ArrayToBase64(
          ClientUIActionResponse.encode(errResponse).finish()
        );
      }
    },
    []
  );

  // State to manage the visibility of the pop-up/chat input
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  // FIXED: Added missing state and handlers for the PlayPauseButton
  const [isPaused, setIsPaused] = useState(true);

  const handlePlay = () => {
    // TODO: Implement logic to start or resume the lesson animation.
    // This requires significant refactoring of the animation loop in useEffect.
    console.log("Play button clicked");
    setIsPaused(false);
  };

  const handlePause = () => {
    // TODO: Implement logic to pause the lesson animation.
    console.log("Pause button clicked");
    setIsPaused(true);
  };

  const [lessonData, setLessonData] = useState<LessonData | null>(null);

  useEffect(() => {
    const loadLessonData = async () => {
      try {
        const data = await loadCommand();
        setLessonData(data);
      } catch (error) {
        console.error("Error loading lesson data:", error);
      }
    };
    loadLessonData();
  }, []);

  function checkCollision(
    boxA: { x: number; y: number; width: number; height: number },
    boxB: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      boxA.x < boxB.x + boxB.width &&
      boxA.x + boxA.width > boxB.x &&
      boxA.y < boxB.y + boxB.height &&
      boxA.y + boxA.height > boxB.y
    );
  }

  function findEmptySpot(
    newWidth: number,
    newHeight: number,
    elementMap: Map<
      string,
      { x: number; y: number; width: number; height: number }
    >,
    canvasDimensions: { width: number; height: number },
    padding = 10
  ): { x: number; y: number } | null {
    const canvasWidth = canvasDimensions.width;
    const canvasHeight = canvasDimensions.height;
    for (let y = padding; y < canvasHeight - newHeight - padding; y += 10) {
      for (let x = padding; x < canvasWidth - newWidth - padding; x += 10) {
        const proposedBbox = { x, y, width: newWidth, height: newHeight };
        let hasCollision = false;

        for (const existingObject of Array.from(elementMap.values())) {
          const existingBboxWithPadding = {
            x: existingObject.x - padding,
            y: existingObject.y - padding,
            width: existingObject.width + padding * 2,
            height: existingObject.height + padding * 2,
          };

          if (checkCollision(proposedBbox, existingBboxWithPadding)) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) {
          return { x, y };
        }
      }
    }

    console.warn("Could not find any empty spot for the new element.");
    return null;
  }

  async function getTextDimensions(
    text: string,
    fontSize: number
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const temp = document.createElement("div");
      temp.style.fontFamily = "Satisfy, cursive";
      // FIXED: Correctly uses template literal
      temp.style.fontSize = `${fontSize}px`;
      temp.style.position = "absolute";
      temp.style.left = "-9999px";
      temp.style.top = "-9999px";
      temp.style.whiteSpace = "nowrap";
      temp.innerHTML = text;
      document.body.appendChild(temp);
      requestAnimationFrame(() => {
        const { width, height } = temp.getBoundingClientRect();
        document.body.removeChild(temp);
        resolve({ width, height });
      });
    });
  }

  useEffect(() => {
    if (!lessonData) return;
    const canvasElement = canvasContainerRef.current;
    const mainContent = mainContentRef.current;

    if (!canvasElement || !mainContent) {
      return;
    }

    let isCancelled = false;
    let currentCanvasDimensions = { ...lessonData.canvasDimensions };

    const setupAndRunLesson = (
      width: number,
      height: number,
      scaleFactors: { x: number; y: number }
    ) => {
      if (isCancelled) return;

      const varaContainers =
        canvasElement.querySelectorAll('div[id^="vara-"]');
      varaContainers.forEach((container) => container.remove());
      stageRef.current?.destroy();

      currentCanvasDimensions = { width, height };
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      canvasElement.style.backgroundColor = "transparent";
      canvasElement.style.borderRadius = "16px";

      const stage = new Konva.Stage({
        container: canvasElement,
        width: width,
        height: height,
      });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      layer.contrast(20);
      layerRef.current = layer;
      stage.add(layer);

      const runLessonAsync = async () => {
        const elementMap = new Map();
        for (const step of lessonData.steps) {
          if (isCancelled) return;
          try {
            switch (step.command) {
              case "write":
                await handleWrite(
                  step as WriteCommand,
                  elementMap,
                  currentCanvasDimensions,
                  scaleFactors
                );
                break;
              case "drawShape":
                await handleDrawShape(
                  step as DrawShapeCommand,
                  elementMap,
                  scaleFactors
                );
                break;
              case "annotate":
                await handleAnnotate(
                  step as AnnotateCommand,
                  elementMap,
                  scaleFactors
                );
                break;
              case "drawSVG":
                await handleDrawSVG(
                  step as DrawSVGCommand,
                  elementMap,
                  currentCanvasDimensions,
                  scaleFactors
                );
                break;
              case "wait":
                await new Promise((resolve) =>
                  setTimeout(resolve, (step as WaitCommand).payload.duration)
                );
                break;
              default:
                break;
            }
          } catch (error) {
            console.error(`Error processing step:`, error);
          }
        }
      };
      runLessonAsync();
    };

    const resizeCanvas = () => {
      if (isCancelled || !lessonData) return;

      const mainStyle = window.getComputedStyle(mainContent);
      const paddingTop = parseFloat(mainStyle.paddingTop);
      const paddingBottom = parseFloat(mainStyle.paddingBottom);
      const paddingLeft = parseFloat(mainStyle.paddingLeft);
      const paddingRight = parseFloat(mainStyle.paddingRight);

      const contentWidth = mainContent.clientWidth - paddingLeft - paddingRight;
      const contentHeight =
        mainContent.clientHeight - paddingTop - paddingBottom;

      const newCanvasWidth = contentWidth * 0.95;
      const newCanvasHeight = contentHeight * 0.95;

      const scaleFactors = {
        x: newCanvasWidth / lessonData.canvasDimensions.width,
        y: newCanvasHeight / lessonData.canvasDimensions.height,
      };

      setupAndRunLesson(newCanvasWidth, newCanvasHeight, scaleFactors);
    };



    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      isCancelled = true;
      window.removeEventListener("resize", resizeCanvas);
      stageRef.current?.destroy();
    };
  }, [lessonData]);

  function createTextContainer(
    id: string,
    x: number,
    y: number
  ): HTMLElement | null {
    // FIXED: Correctly uses template literal
    const containerId = `vara-${id}`;
    const canvasElement = canvasContainerRef.current;
    if (!canvasElement) {
      console.error("Canvas element ref not available!");
      return null;
    }

    const containerElement = document.createElement("div");
    containerElement.id = containerId;
    containerElement.style.position = "absolute";
    containerElement.style.left = `${x}px`;
    containerElement.style.top = `${y}px`;
    containerElement.style.zIndex = "30";

    canvasElement.appendChild(containerElement);
    return containerElement;
  }

  async function handleWrite(
    step: WriteCommand,
    elementMap: Map<string, any>,
    currentCanvasDimensions: { width: number; height: number },
    scaleFactors: { x: number; y: number }
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        let position = step.payload.position;
        const scaledFontSize =
          (step.payload.varaOptions.fontSize || 24) *
          Math.min(scaleFactors.x, scaleFactors.y);

        if (position) {
          position = {
            x: position.x * scaleFactors.x,
            y: position.y * scaleFactors.y,
          };
        } else {
          const { width, height } = await getTextDimensions(
            step.payload.text,
            scaledFontSize
          );
          const spot = findEmptySpot(
            width,
            height,
            elementMap,
            currentCanvasDimensions
          );
          if (spot) {
            position = spot;
          } else {
            console.error(
              "Could not find an empty spot for text:",
              step.payload.text
            );
            position = { x: 10, y: 10 };
          }
        }

        const container = createTextContainer(step.id, position.x, position.y);

        if (!container) {
          reject(new Error("Could not create text container"));
          return;
        }

        const containerId = container.id;

        const vara = new Vara(
          `#${containerId}`,
          "https://raw.githubusercontent.com/akzhy/Vara/master/fonts/Satisfy/SatisfySL.json",
          [
            {
              text: step.payload.text,
              duration: step.payload.varaOptions.duration || 1000,
              color: step.payload.varaOptions.color || "black",
              fontSize: scaledFontSize,
              id: step.id,
            },
          ]
        );

        vara.ready(() => {
          setTimeout(() => {
            const canvasElement = canvasContainerRef.current;
            if (!canvasElement) return;
            const clientRect = container.getBoundingClientRect();
            const canvasRect = canvasElement.getBoundingClientRect();
            elementMap.set(step.id, {
              element: vara,
              x: clientRect.left - canvasRect.left,
              y: clientRect.top - canvasRect.top,
              width: clientRect.width,
              height: clientRect.height,
              type: "vara-text",
            });
          }, 100);
        });

        vara.animationEnd(() => resolve(vara));
      } catch (error) {
        console.error("Error in handleWrite:", error);
        reject(error);
      }
    });
  }

  async function handleDrawShape(
    step: DrawShapeCommand,
    elementMap: Map<string, any>,
    scaleFactors: { x: number; y: number }
  ) {
    if (!layerRef.current) return;
    try {
      const generator = rough.generator();
      let drawable;

      const scaledPoints = step.payload.points.map((p) => ({
        x: p.x * scaleFactors.x,
        y: p.y * scaleFactors.y,
      }));
      const scaledStrokeWidth =
        (step.payload.roughOptions.strokeWidth || 2) *
        Math.min(scaleFactors.x, scaleFactors.y);

      switch (step.payload.shapeType) {
        case "line":
          drawable = generator.line(
            scaledPoints[0].x,
            scaledPoints[0].y,
            scaledPoints[1].x,
            scaledPoints[1].y,
            { ...step.payload.roughOptions, strokeWidth: scaledStrokeWidth }
          );
          break;
        default:
          return;
      }

      const paths = generator.toPaths(drawable);
      const path = new Konva.Path({
        data: paths[0].d,
        stroke: step.payload.roughOptions.stroke || "#000",
        strokeWidth: scaledStrokeWidth,
        id: step.id,
      });

      layerRef.current.add(path);
      const { x, y, width, height } = path.getClientRect();
      elementMap.set(step.id, {
        element: path,
        x,
        y,
        width,
        height,
        type: "rough-shape",
      });
    } catch (error) {
      console.error("Error creating shape:", error);
    }
  }

  async function handleAnnotate(
    step: AnnotateCommand,
    elementMap: Map<string, any>,
    scaleFactors: { x: number; y: number }
  ) {
    if (!layerRef.current) return;
    const targetData = elementMap.get(step.payload.targetId);
    if (!targetData) return;
    try {
      const targetBox = {
        x: targetData.x,
        y: targetData.y,
        width: targetData.width,
        height: targetData.height,
      };
      const x = targetBox.x + targetBox.width / 2;
      const y = targetBox.y + targetBox.height / 2;
      const radius = Math.max(targetBox.width, targetBox.height) * 0.7;

      const scaledStrokeWidth =
        (step.payload.roughOptions.strokeWidth || 2) *
        Math.min(scaleFactors.x, scaleFactors.y);
      const generator = rough.generator();
      let drawable;

      if (step.payload.annotationType === "circle") {
        drawable = generator.circle(x, y, radius * 2, {
          ...step.payload.roughOptions,
          strokeWidth: scaledStrokeWidth,
        });
      } else {
        return;
      }

      const paths = generator.toPaths(drawable);
      const annotation = new Konva.Path({
        data: paths[0].d,
        stroke: step.payload.roughOptions.stroke || "#ff0000",
        strokeWidth: scaledStrokeWidth,
        id: step.id,
      });

      layerRef.current.add(annotation);
      const { x: rectX, y: rectY, width, height } = annotation.getClientRect();
      elementMap.set(step.id, {
        element: annotation,
        x: rectX,
        y: rectY,
        width,
        height,
        type: "annotation",
      });
    } catch (error) {
      console.error("Error creating annotation:", error);
    }
  }

  async function handleDrawSVG(
    step: DrawSVGCommand,
    elementMap: Map<string, any>,
    currentCanvasDimensions: { width: number; height: number },
    scaleFactors: { x: number; y: number }
  ): Promise<void> {
    if (!layerRef.current)
      return Promise.reject(new Error("Konva Layer not initialized"));
    return new Promise<void>((resolve, reject) => {
      Konva.Image.fromURL(
        step.payload.svgUrl,
        (imageNode: Konva.Image) => {
          try {
            let finalWidth: number;
            let finalHeight: number;
            const naturalWidth = imageNode.width();
            const naturalHeight = imageNode.height();

            const desiredWidth = step.payload.desiredSize?.width;
            const desiredHeight = step.payload.desiredSize?.height;

            if (desiredWidth && desiredHeight) {
              finalWidth = desiredWidth * scaleFactors.x;
              finalHeight = desiredHeight * scaleFactors.y;
            } else if (desiredWidth) {
              finalWidth = desiredWidth * scaleFactors.x;
              finalHeight = (naturalHeight / naturalWidth) * finalWidth;
            } else if (desiredHeight) {
              finalHeight = desiredHeight * scaleFactors.y;
              finalWidth = (naturalWidth / naturalHeight) * finalHeight;
            } else {
              finalWidth = naturalWidth * scaleFactors.x;
              finalHeight = naturalHeight * scaleFactors.y;
            }

            imageNode.width(finalWidth);
            imageNode.height(finalHeight);

            let position = step.payload.position;
            if (position) {
              position = {
                x: position.x * scaleFactors.x,
                y: position.y * scaleFactors.y,
              };
            } else {
              const spot = findEmptySpot(
                finalWidth,
                finalHeight,
                elementMap,
                currentCanvasDimensions,
                20
              );
              if (spot) {
                position = spot;
              } else {
                position = { x: 10, y: 10 };
              }
            }

            imageNode.x(position.x);
            imageNode.y(position.y);
            imageNode.id(step.id);

            layerRef.current!.add(imageNode);
            elementMap.set(step.id, {
              element: imageNode,
              x: position.x,
              y: position.y,
              width: finalWidth,
              height: finalHeight,
              type: "svg",
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        () => {
          reject(
            new Error(`Failed to load image/SVG from ${step.payload.svgUrl}`)
          );
        }
      );
    });
  }

  return (
    <div className="w-full h-screen bg-transparent overflow-hidden flex flex-col">
      <div style={{ display: "none" }}>
        <LiveKitSession
          roomName="can-test-room"
          userName="can-test-user"
          onConnected={(connectedRoom, rpcAdapter) => {
            console.log(
              "LiveKit connected in CanTestPage, room:",
              connectedRoom
            );
            liveKitRpcAdapterRef.current = rpcAdapter;
            console.log(
              "LiveKitRpcAdapter assigned in CanTestPage:",
              liveKitRpcAdapterRef.current
            );
          }}
          onPerformUIAction={handlePerformUIAction}
        />
      </div>
      {/* Main content area with padding at the bottom to avoid the fixed footer */}
      <main
        ref={mainContentRef}
        className="flex-grow relative flex justify-center items-center p-4 pb-32"
      >
        <div ref={canvasContainerRef} id="canvas">
          {/* Konva and Vara will populate this div */}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center gap-4 pb-5">
        <div className="w-full max-w-lg">
          {!isPopupVisible ? (
            <div className="flex items-center justify-center md:justify-between w-full gap-4 md:gap-0 px-4 md:px-0">
              {/* Left group of buttons */}
              <div className="flex items-center gap-4 md:-ml-40">
                <PreviousButton
                  isVisible={true}
                  onPrevious={() => console.log("Previous button clicked")}
                />
                <NextButton
                  isVisible={true}
                  onNext={() => console.log("Next button clicked")}
                />
                

                <MicButton isVisible={true} />
              </div>

              {/* Right group of buttons */}
              <div className="flex items-center gap-4 md:mr-10">
                <button
                  className="flex items-center justify-center w-12 h-12 bg-white/50 rounded-full hover:bg-white/80 transition-colors"
                  aria-label="Share Screen"
                  onClick={() => console.log("Screen Share clicked")}
                >
                  <ScreenShare className="w-6 h-6 text-gray-800" />
                </button>

                <MessageButton
                  isVisible={true}
                  onClick={() => setIsPopupVisible(true)}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full p-2 rounded-full bg-white/80 backdrop-blur-lg shadow-md border border-gray-200/80">
              <input
                type="text"
                placeholder="Ask Rox anything..."
                className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 px-4 text-black text-sm"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}