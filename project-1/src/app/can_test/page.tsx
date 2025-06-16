"use client";
import React, { useState, useEffect, useRef } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

export default function Page(): JSX.Element {
  // State to manage the visibility of the pop-up/chat input
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  // Data for control buttons
  const controlButtons = [
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame.svg",
      alt: "Settings",
    },
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame-2.svg",
      alt: "Camera",
    },
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/mic-on.svg",
      type: "background",
      alt: "Mic",
    },
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame.svg", // Re-using settings icon as an example
      alt: "New Button",
    },
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame-1.svg",
      alt: "Message", // This button triggers the chat input
    },
  ];

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

  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);

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

    const canvasElement = document.getElementById("canvas");
    const unionContainer = document.getElementById(
      "union-container"
    ) as HTMLImageElement;

    if (!canvasElement || !unionContainer) {
      console.error("Required elements (canvas, union-container) not found.");
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

      if (canvasElement) {
        const varaContainers = canvasElement.querySelectorAll('div[id^="vara-"]');
        varaContainers.forEach((container) => container.remove());
      }
      stageRef.current?.destroy();

      currentCanvasDimensions = { width, height };
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      canvasElement.style.backgroundColor = "transparent";

      const stage = new Konva.Stage({
        container: "canvas",
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
      const unionRect = unionContainer.getBoundingClientRect();

      let newCanvasWidth, newCanvasHeight;

      if (unionRect.width > 0 && unionRect.height > 0) {
        newCanvasWidth = unionRect.width * 0.95;
        newCanvasHeight = unionRect.height * 0.85;
      } else {
        newCanvasWidth = lessonData.canvasDimensions.width;
        newCanvasHeight = lessonData.canvasDimensions.height;
      }

      const scaleFactors = {
        x: newCanvasWidth / lessonData.canvasDimensions.width,
        y: newCanvasHeight / lessonData.canvasDimensions.height,
      };

      setupAndRunLesson(newCanvasWidth, newCanvasHeight, scaleFactors);
    };

    if (unionContainer.complete) {
      resizeCanvas();
    } else {
      unionContainer.onload = resizeCanvas;
    }

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
    const containerId = `vara-${id}`;
    const canvasElement = document.getElementById("canvas");

    if (!canvasElement) {
      console.error("Canvas element not found!");
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
            const clientRect = container.getBoundingClientRect();
            const canvasRect = document.getElementById("canvas")!.getBoundingClientRect();
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
      const scaledStrokeWidth = (step.payload.roughOptions.strokeWidth || 2) * Math.min(scaleFactors.x, scaleFactors.y);


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
      elementMap.set(step.id, { element: path, x, y, width, height, type: "rough-shape" });
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
      const targetBox = { x: targetData.x, y: targetData.y, width: targetData.width, height: targetData.height };
      const x = targetBox.x + targetBox.width / 2;
      const y = targetBox.y + targetBox.height / 2;
      const radius = Math.max(targetBox.width, targetBox.height) * 0.7;
      
      const scaledStrokeWidth = (step.payload.roughOptions.strokeWidth || 2) * Math.min(scaleFactors.x, scaleFactors.y);
      const generator = rough.generator();
      let drawable;

      if (step.payload.annotationType === "circle") {
        drawable = generator.circle(x, y, radius * 2, { ...step.payload.roughOptions, strokeWidth: scaledStrokeWidth });
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
      elementMap.set(step.id, { element: annotation, x: rectX, y: rectY, width, height, type: "annotation" });
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
    if (!layerRef.current) return Promise.reject(new Error("Konva Layer not initialized"));

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
              position = { x: position.x * scaleFactors.x, y: position.y * scaleFactors.y };
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
        (error) => {
          reject(new Error(`Failed to load image/SVG from ${step.payload.svgUrl}`));
        }
      );
    });
  }

  return (
    <div className="w-full h-screen bg-white overflow-hidden relative">
      <div className="absolute w-[40vw] h-[40vw] max-w-[753px] max-h-[753px] top-[-20vh] right-[-30vw] bg-[#566fe9] rounded-full" />
      <div className="absolute w-[25vw] h-[25vw] max-w-[353px] max-h-[353px] bottom-[-25vh] left-[-10vw] bg-[#336de6] rounded-full" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]">
        <div className="absolute w-full h-full flex justify-center items-center">
          <div className="relative w-full max-w-[1336px] h-auto flex justify-center items-center p-4">
            <img
              id="union-container"
              className="w-full h-auto opacity-50"
              alt="Union"
              src="https://c.animaapp.com/mbsxrl26lLrLIJ/img/union.svg"
            />
            <div
              id="canvas"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%]"
              style={{ background: 'rgba(255, 255, 255, 0.7)' }}
            >
              {/* Konva and Vara will populate this div */}
            </div>
          </div>
        </div>
      </div>

      <main className="relative z-10 h-full flex flex-col pl-8 pr-12 py-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-2 h-6 w-6 p-0 z-20"
        >
          <XIcon className="h-6 w-6" />
        </Button>

        <div className="flex items-center justify-between pt-6 pl-9">
          <div className="flex-1"></div>
          <div className="flex-1" />
        </div>

        <div className="flex-grow flex items-center justify-center py-8 gap-4">
          {/* This space is now empty as content is within the union backdrop */}
        </div>

        <div className="flex flex-col items-center gap-1 pb-6 mt-4">
          <div className="inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-[#566fe91a] rounded-[50px] backdrop-blur-sm">
            <p className="font-paragraph-extra-large font-[number:var(--paragraph-extra-large-font-weight)] text-black text-[length:var(--paragraph-extra-large-font-size)] text-center tracking-[var(--paragraph-extra-large-letter-spacing)] leading-[var(--paragraph-extra-large-line-height)] ">
              Hello. I am Rox, your AI Assistant!
            </p>
          </div>
          <div className="w-[90px] h-[90px] z-20">
            <div className="relative w-full h-full">
              <div className="absolute w-[70%] h-[70%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#566fe9] rounded-full blur-[50px]" />
              {/* MODIFICATION HERE: Changed top-0 to top-2 to shift the image down. */}
              <img
                className="absolute w-full h-full top-2 left-2 object-contain"
                alt="Rox AI Assistant"
                src="/screenshot-2025-06-09-at-2-47-05-pm-2.png"
              />
            </div>
          </div>
          <div className="w-full max-w-lg">
            {!isPopupVisible ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4 -ml-20">
                  {controlButtons.slice(0, 4).map((button, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="icon"
                      className="w-14 h-14 p-4 bg-[#566fe91a] rounded-[36px] border-none hover:bg-[#566fe930] transition-colors"
                    >
                      {button.type === "background" ? (
                        <div
                          className="w-6 h-6 bg-cover"
                          style={{ backgroundImage: `url(${button.icon})` }}
                        />
                      ) : (
                        <img
                          className="w-6 h-6"
                          alt={button.alt}
                          src={button.icon}
                        />
                      )}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-14 h-14 p-4 bg-[#566fe91a] rounded-[36px] border-none hover:bg-[#566fe930] transition-colors mr-10"
                  onClick={() => setIsPopupVisible(true)}
                >
                  <img
                    className="w-6 h-6"
                    alt={controlButtons[4].alt}
                    src={controlButtons[4].icon}
                  />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full p-2 rounded-full bg-white/80 backdrop-blur-lg shadow-md border border-gray-200/80">
                <input
                  type="text"
                  placeholder="Ask Rox anything..."
                  className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 px-4 text-black text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  className="flex-shrink-0 bg-[#566fe9] hover:bg-[#4a5fcf] rounded-full w-9 h-9"
                  onClick={() => {
                    console.log("Message Sent!");
                    setIsPopupVisible(false);
                  }}
                >
                  <img className="w-5 h-5" alt="Send" src="/send.svg" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}