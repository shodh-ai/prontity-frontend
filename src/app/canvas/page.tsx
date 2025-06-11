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

  useEffect(() => {
    if (!lessonData) return;

    let isCancelled = false;

    // Initialize Konva Stage and Layer
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
      // Cleanup Vara containers
      const canvasElement = document.getElementById("canvas");
      if (canvasElement) {
        const varaContainers =
          canvasElement.querySelectorAll('div[id^="vara-"]');
        varaContainers.forEach((container) => container.remove());
      }
      // Destroy Konva stage
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
      elementMap.set(step.id, path);
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

    const targetShape = elementMap.get(step.payload.targetId);
    const targetVara = document.querySelector(`#vara-${step.payload.targetId}`);

    if (!targetShape && !targetVara) {
      console.error(
        `Target element with id ${step.payload.targetId} not found!`
      );
      return;
    }

    try {
      let x, y, radius;

      if (targetShape) {
        // Annotating a Konva shape
        const box = targetShape.getClientRect();
        x = box.x + box.width / 2;
        y = box.y + box.height / 2;
        radius = Math.max(box.width, box.height) * 0.7;
      } else {
        // Annotating a Vara text element
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
      elementMap.set(step.id, annotation);
    } catch (error) {
      console.error("Error creating annotation:", error);
    }
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
