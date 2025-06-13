"use client";

import { useEffect, useState, useRef } from "react";
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

export default function Home() {
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

    let isCancelled = false;

    const stage = new Konva.Stage({
      container: "canvas",
      width: lessonData.canvasDimensions.width,
      height: lessonData.canvasDimensions.height,
    });
    stageRef.current = stage;

    const layer = new Konva.Layer();
    layerRef.current = layer;
    stage.add(layer);

    const runLessonAsync = async () => {
      const elementMap = new Map();
      for (const step of lessonData.steps) {
        if (isCancelled) return;
        try {
          switch (step.command) {
            case "write":
              await handleWrite(step as WriteCommand, elementMap);
              break;
            case "drawShape":
              await handleDrawShape(step as DrawShapeCommand, elementMap);
              break;
            case "annotate":
              await handleAnnotate(step as AnnotateCommand, elementMap);
              break;
            case "drawSVG":
              await handleDrawSVG(step as DrawSVGCommand, elementMap);
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

    return () => {
      isCancelled = true;
      const canvasElement = document.getElementById("canvas");
      if (canvasElement) {
        const varaContainers =
          canvasElement.querySelectorAll('div[id^="vara-"]');
        varaContainers.forEach((container) => container.remove());
      }
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

  async function handleWrite(step: WriteCommand, elementMap: Map<string, any>) {
    return new Promise(async (resolve, reject) => {
      try {
        let position = step.payload.position;

        if (!position) {
          const { width, height } = await getTextDimensions(
            step.payload.text,
            step.payload.varaOptions.fontSize || 24
          );
          const spot = findEmptySpot(
            width,
            height,
            elementMap,
            lessonData!.canvasDimensions
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
              fontSize: step.payload.varaOptions.fontSize || 24,
              id: step.id,
            },
          ]
        );

        vara.ready(() => {
          const { width, height } = container.getBoundingClientRect();
          elementMap.set(step.id, {
            element: vara,
            x: position.x,
            y: position.y,
            width,
            height,
          });
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
    elementMap: Map<string, any>
  ) {
    if (!layerRef.current) {
      console.error("Konva Layer not initialized!");
      return;
    }

    try {
      const generator = rough.generator();
      let drawable;

      switch (step.payload.shapeType) {
        case "line":
          drawable = generator.line(
            step.payload.points[0].x,
            step.payload.points[0].y,
            step.payload.points[1].x,
            step.payload.points[1].y,
            step.payload.roughOptions
          );
          break;
        default:
          return;
      }

      const paths = generator.toPaths(drawable);
      const path = new Konva.Path({
        data: paths[0].d,
        stroke: step.payload.roughOptions.stroke || "#000",
        strokeWidth: step.payload.roughOptions.strokeWidth || 2,
      });

      layerRef.current.add(path);
      const { x: rectX, y: rectY, width, height } = path.getClientRect();
      elementMap.set(step.id, {
        element: path,
        x: rectX,
        y: rectY,
        width,
        height,
      });
    } catch (error) {
      console.error("Error creating shape:", error);
    }
  }

  async function handleAnnotate(
    step: AnnotateCommand,
    elementMap: Map<string, any>
  ) {
    if (!layerRef.current) {
      console.error("Konva Layer not initialized!");
      return;
    }

    const targetData = elementMap.get(step.payload.targetId);
    const targetElement = targetData?.element;
    const targetVara = document.querySelector(`#vara-${step.payload.targetId}`);

    if (!targetElement && !targetVara) {
      console.error(
        `Target element with id ${step.payload.targetId} not found!`
      );
      return;
    }

    try {
      let x, y, radius;

      if (targetElement instanceof Konva.Node) {
        const box = targetElement.getClientRect();
        x = box.x + box.width / 2;
        y = box.y + box.height / 2;
        radius = Math.max(box.width, box.height) * 0.7;
      } else {
        const canvasElement = document.getElementById("canvas");
        if (!canvasElement || !targetVara) return;
        const containerBox = targetVara.getBoundingClientRect();
        const canvasBox = canvasElement.getBoundingClientRect();
        x = containerBox.left - canvasBox.left + containerBox.width / 2;
        y = containerBox.top - canvasBox.top + containerBox.height / 2;
        radius = Math.max(containerBox.width, containerBox.height) * 0.7;
      }

      const generator = rough.generator();
      let drawable;

      if (step.payload.annotationType === "circle") {
        drawable = generator.circle(
          x,
          y,
          radius * 2,
          step.payload.roughOptions
        );
      } else {
        return;
      }

      const paths = generator.toPaths(drawable);
      const annotation = new Konva.Path({
        data: paths[0].d,
        stroke: step.payload.roughOptions.stroke || "#ff0000",
        strokeWidth: step.payload.roughOptions.strokeWidth || 2,
      });

      layerRef.current.add(annotation);
      const { x: rectX, y: rectY, width, height } = annotation.getClientRect();
      elementMap.set(step.id, {
        element: annotation,
        x: rectX,
        y: rectY,
        width,
        height,
      });
    } catch (error) {
      console.error("Error creating annotation:", error);
    }
  }

  async function handleDrawSVG(
    step: DrawSVGCommand,
    elementMap: Map<string, any>
  ): Promise<void> {
    if (!layerRef.current || !lessonData) {
      console.error(
        "Konva Layer or lessonData not initialized for SVG drawing!"
      );
      return Promise.reject(
        new Error("Konva Layer or lessonData not initialized")
      );
    }

    return new Promise<void>((resolve, reject) => {
      Konva.Image.fromURL(
        step.payload.svgUrl,
        (imageNode: Konva.Image) => {
          try {
            let finalWidth: number;
            let finalHeight: number;
            const naturalWidth = imageNode.width();
            const naturalHeight = imageNode.height();

            if (naturalWidth === 0 || naturalHeight === 0) {
              console.warn(
                "Image/SVG loaded with zero dimensions:",
                step.payload.svgUrl,
                "Using fallback size."
              );
              finalWidth = step.payload.desiredSize?.width || 100;
              finalHeight = step.payload.desiredSize?.height || 100;
              if (
                step.payload.desiredSize?.width &&
                !step.payload.desiredSize?.height &&
                naturalHeight === 0
              ) {
                finalHeight = finalWidth;
              } else if (
                step.payload.desiredSize?.height &&
                !step.payload.desiredSize?.width &&
                naturalWidth === 0
              ) {
                finalWidth = finalHeight;
              }
            } else if (step.payload.desiredSize) {
              if (step.payload.desiredSize.width) {
                finalWidth = step.payload.desiredSize.width;
                finalHeight = (naturalHeight / naturalWidth) * finalWidth;
              } else if (step.payload.desiredSize.height) {
                finalHeight = step.payload.desiredSize.height;
                finalWidth = (naturalWidth / naturalHeight) * finalHeight;
              } else {
                finalWidth = naturalWidth;
                finalHeight = naturalHeight;
              }
            } else {
              finalWidth = naturalWidth;
              finalHeight = naturalHeight;
            }

            imageNode.width(finalWidth);
            imageNode.height(finalHeight);

            let position = step.payload.position;
            if (!position) {
              const spot = findEmptySpot(
                finalWidth,
                finalHeight,
                elementMap,
                lessonData.canvasDimensions,
                20
              );
              if (spot) {
                position = spot;
              } else {
                console.warn(
                  `Could not find an empty spot for SVG/image: ${
                    step.payload.description || step.id
                  }. Using fallback.`
                );
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
            console.error(
              "Error processing SVG/image node for:",
              step.payload.svgUrl,
              error
            );
            reject(error);
          }
        },
        (error) => {
          console.error(
            "Error loading image/SVG from URL:",
            step.payload.svgUrl,
            error
          );
          reject(
            new Error(`Failed to load image/SVG from ${step.payload.svgUrl}`)
          );
        }
      );
    });
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen p-4">
      <div
        id="canvas"
        className="relative"
        style={{
          width: `${lessonData?.canvasDimensions.width || 1000}px`,
          height: `${lessonData?.canvasDimensions.height || 750}px`,
        }}
      >
        <div className="absolute top-0 left-0 w-full h-full z-20"></div>
      </div>
    </div>
  );
}
