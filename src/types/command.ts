export interface Position {
  x: number;
  y: number;
}

export interface VaraOptions {
  fontSize?: number;
  color?: string;
  duration?: number;
}

export interface RoughOptions {
  stroke: string;
  strokeWidth: number;
  roughness: number;
}

export interface WriteCommandPayload {
  text: string;
  position: Position;
  varaOptions: VaraOptions;
}

export interface WaitCommandPayload {
  duration: number;
}

export interface DrawShapeCommandPayload {
  shapeType: string;
  points: Position[];
  isRough: boolean;
  roughOptions: RoughOptions;
}

export interface AnnotateCommandPayload {
  targetId: string;
  annotationType: string;
  isRough: boolean;
  roughOptions: RoughOptions;
}

export interface DrawSVGCommandPayload {
  svgUrl: string;
  description?: string;
  position: Position;
  desiredSize?: { width?: number; height?: number };
}

export interface WriteCommand {
  command: "write";
  id: string;
  payload: WriteCommandPayload;
}

export interface WaitCommand {
  command: "wait";
  payload: WaitCommandPayload;
}

export interface DrawShapeCommand {
  command: "drawShape";
  id: string;
  payload: DrawShapeCommandPayload;
}

export interface AnnotateCommand {
  command: "annotate";
  id: string;
  payload: AnnotateCommandPayload;
}

export interface DrawSVGCommand {
  command: "drawSVG";
  id: string;
  payload: DrawSVGCommandPayload;
}

export type Command =
  | WriteCommand
  | WaitCommand
  | DrawShapeCommand
  | AnnotateCommand
  | DrawSVGCommand;

export default interface LessonData {
  lessonTitle: string;
  canvasDimensions: {
    width: number;
    height: number;
  };
  steps: Command[];
}
