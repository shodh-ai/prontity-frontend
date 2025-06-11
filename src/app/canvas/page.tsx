"use client";

import { useEffect, useState, useRef } from "react";
import loadCommand from "@/api/loadCommand";
import LessonData from "@/types/command";
import {
  WriteCommand,
  DrawShapeCommand,
  AnnotateCommand,
  WaitCommand,
} from "@/types/command";
import Vara from "vara";
import rough from "roughjs";

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

  useEffect(() => {
    let isCancelled = false;

    const cleanupCanvas = () => {
      const canvasElement = document.getElementById("canvas");
      if (canvasElement) {
        const varaContainers =
          canvasElement.querySelectorAll('div[id^="vara-"]');
        varaContainers.forEach((container) => container.remove());
      }
      const svgElement = document.getElementById("drawing-svg");
      if (svgElement) {
        while (svgElement.firstChild) {
          svgElement.removeChild(svgElement.firstChild);
        }
      }
    };

    const runLessonAsync = async () => {
      if (!lessonData) {
        return;
      }

      const elementMap = new Map();

      for (const step of lessonData.steps) {
        if (isCancelled) {
          return;
        }
        try {
          switch (step.command) {
            case "write": {
              const writeStep = step as WriteCommand;
              await handleWrite(writeStep, elementMap);
              break;
            }
            case "drawShape": {
              const drawStep = step as DrawShapeCommand;
              await handleDrawShape(drawStep, elementMap);
              break;
            }
            case "annotate": {
              const annotateStep = step as AnnotateCommand;
              await handleAnnotate(annotateStep, elementMap);
              break;
            }
            case "wait": {
              const waitStep = step as WaitCommand;
              const duration = waitStep.payload.duration;
              await new Promise((resolve) => setTimeout(resolve, duration));
              break;
            }
            default: {
              const exhaustiveCheck: never = step;
            }
          }
        } catch (error) {
          const stepId = "id" in step ? step.id : "unknown";
          console.error(`Error processing step ${stepId}:`, error);
        }
      }
    };

    cleanupCanvas();
    runLessonAsync();

    return () => {
      isCancelled = true;
      cleanupCanvas();
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
    return new Promise((resolve, reject) => {
      try {
        const container = createTextContainer(
          step.id,
          step.payload.position.x,
          step.payload.position.y
        );

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

        vara.ready(() => {});
        vara.animationEnd(() => resolve(vara));

        elementMap.set(step.id, vara);
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
    const svgElement = document.getElementById("drawing-svg");
    if (!svgElement) {
      console.error("SVG element not found!");
      return Promise.resolve();
    }

    try {
      const rc = rough.svg(svgElement as unknown as SVGSVGElement);
      let shape;

      switch (step.payload.shapeType) {
        case "line":
          shape = rc.line(
            step.payload.points[0].x,
            step.payload.points[0].y,
            step.payload.points[1].x,
            step.payload.points[1].y,
            {
              stroke: step.payload.roughOptions.stroke || "#000",
              strokeWidth: step.payload.roughOptions.strokeWidth || 2,
              roughness: step.payload.roughOptions.roughness || 1.5,
            }
          );
          break;

        default:
          return Promise.resolve();
      }

      svgElement.appendChild(shape);
      elementMap.set(step.id, shape);

      return Promise.resolve();
    } catch (error) {
      console.error("Error creating shape:", error);
      return Promise.reject(error);
    }
  }

  async function handleAnnotate(
    step: AnnotateCommand,
    elementMap: Map<string, any>
  ) {
    const svgElement = document.getElementById("drawing-svg");
    if (!svgElement) {
      console.error("SVG element not found!");
      return Promise.resolve();
    }

    const targetId = step.payload.targetId;
    const targetElement = elementMap.get(targetId);

    if (!targetElement) {
      console.error(
        `Target element with id ${targetId} not found in elementMap!`
      );
      return Promise.resolve();
    }

    try {
      const canvasElement = document.getElementById("canvas");
      const containerSelector = `#vara-${targetId}`;
      const containerElement = document.querySelector(containerSelector);

      if (!canvasElement || !containerElement) {
        console.error(`Cannot find container for ${targetId}`);
        return Promise.resolve();
      }

      const containerBox = containerElement.getBoundingClientRect();
      const canvasBox = canvasElement.getBoundingClientRect();

      const x = containerBox.left - canvasBox.left + containerBox.width / 2;
      const y = containerBox.top - canvasBox.top + containerBox.height / 2;
      const radius = Math.max(containerBox.width, containerBox.height) * 0.7;

      const rc = rough.svg(svgElement as unknown as SVGSVGElement);
      let annotation;

      if (step.payload.annotationType === "circle") {
        annotation = rc.circle(x, y, radius * 2, {
          stroke: step.payload.roughOptions.stroke || "#ff0000",
          strokeWidth: step.payload.roughOptions.strokeWidth || 2,
          roughness: step.payload.roughOptions.roughness || 1.5,
          fill: "none",
        });

        svgElement.appendChild(annotation);
        elementMap.set(step.id, annotation);
      }
    } catch (error) {
      console.error("Error creating annotation:", error);
    }

    return Promise.resolve();
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
        <svg
          id="drawing-svg"
          className="absolute top-0 left-0 w-full h-full z-10"
          width={lessonData?.canvasDimensions.width || 1000}
          height={lessonData?.canvasDimensions.height || 750}
        ></svg>
        <div className="absolute top-0 left-0 w-full h-full z-20"></div>
      </div>
    </div>
  );
}
