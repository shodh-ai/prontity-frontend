import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Text, Circle, Rect, Line, Arrow, Image as KonvaImageComponent } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';

// I. Type Definitions

// Mirroring the Pydantic models from the backend for ReactUIAction parameters
export interface KonvaElementBaseProps {
  id: string; // Unique ID for this element on the canvas, passed to Konva node
  x?: number;
  y?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  draggable?: boolean; // Optional, if you want elements to be draggable by user/AI
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  // ... other common Konva props
}

export interface KonvaTextProps extends KonvaElementBaseProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  padding?: number;
  align?: string;
  verticalAlign?: string;
  width?: number; // For text wrapping
  height?: number; // For text clipping or vertical alignment
  lineHeight?: number;
  letterSpacing?: number;
  // ... other Konva.Text specific props
}

export interface KonvaCircleProps extends KonvaElementBaseProps {
  radius: number;
}

export interface KonvaRectProps extends KonvaElementBaseProps {
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface KonvaImageProps extends KonvaElementBaseProps {
  imageUrl: string; // URL of the image to load
  width?: number;
  height?: number;
}

export interface KonvaLineOrArrowProps extends KonvaElementBaseProps {
  points: number[]; // [x1, y1, x2, y2, x3, y3...]
  tension?: number; // For curved lines
  closed?: boolean; // For polygons
  // For Arrows
  pointerLength?: number;
  pointerWidth?: number;
  // For Lines (can also be used for underline)
  // stroke, strokeWidth are in KonvaElementBaseProps
}

// The description of an element to be rendered
export interface KonvaElementDescription {
  type: 'Text' | 'Circle' | 'Rect' | 'Image' | 'Arrow' | 'Line';
  id: string; // This ID is crucial and comes from the backend AI. Used as key and for finding elements.
  props: KonvaTextProps | KonvaCircleProps | KonvaRectProps | KonvaImageProps | KonvaLineOrArrowProps;
}

// Mirroring the ReactUIAction Pydantic model for parameters
export interface KonvaAddElementParams {
  element_type: KonvaElementDescription['type'];
  id: string;
  props: KonvaElementDescription['props'];
}

export interface KonvaUpdateElementPropsParams {
  element_id_to_update: string;
  new_props: Partial<KonvaElementDescription['props']>; // Allow partial updates
}

export interface KonvaRemoveElementParams {
  element_id_to_remove: string;
}

export interface KonvaEncircleElementByIdParams {
  target_konva_element_id: string;
  circle_id: string; // ID for the new circle itself
  circle_props?: Partial<KonvaCircleProps>; // e.g., stroke, strokeWidth
  padding?: number; // Custom prop for padding around target
}

export interface KonvaUnderlineSubstringInElementByIdParams {
  target_konva_element_id: string; // ID of the Konva.Text element
  substring_to_underline: string; // For future precise underlining
  line_id: string; // ID for the new line itself
  line_props?: Partial<KonvaLineOrArrowProps>; // e.g., stroke, strokeWidth
}

// Main Action Type for this component
export type ReactUIActionForKonva = 
  | { action_type: 'KONVA_CLEAR_CANVAS'; params?: never } // No params for clear
  | { action_type: 'KONVA_ADD_ELEMENT'; params: KonvaAddElementParams }
  | { action_type: 'KONVA_UPDATE_ELEMENT_PROPS'; params: KonvaUpdateElementPropsParams }
  | { action_type: 'KONVA_REMOVE_ELEMENT'; params: KonvaRemoveElementParams }
  | { action_type: 'KONVA_ENCIRCLE_ELEMENT_BY_ID'; params: KonvaEncircleElementByIdParams }
  | { action_type: 'KONVA_UNDERLINE_SUBSTRING_IN_ELEMENT_BY_ID'; params: KonvaUnderlineSubstringInElementByIdParams };

// II. Component Props
interface TeachingBlackboardKonvaProps {
  width: number;
  height: number;
  currentAction: ReactUIActionForKonva | null;
  // Optional: Callback when an action is processed, useful if parent needs to know.
  // onActionProcessed?: (actionType: ReactUIActionForKonva['action_type']) => void;
}

// III. Main Component
const TeachingBlackboardKonva: React.FC<TeachingBlackboardKonvaProps> = ({
  width,
  height,
  currentAction,
}) => {
  const [elements, setElements] = useState<KonvaElementDescription[]>([]);
  const stageRef = useRef<Konva.Stage>(null);
  // const layerRef = useRef<Konva.Layer>(null); // If direct layer operations needed

  useEffect(() => {
    if (!currentAction) return;

    const processAction = (action: ReactUIActionForKonva) => {
      switch (action.action_type) {
        case 'KONVA_CLEAR_CANVAS':
          setElements([]);
          break;

        case 'KONVA_ADD_ELEMENT': {
          const params = action.params;
          if (elements.find(el => el.id === params.id)) {
            console.warn(`Element with ID ${params.id} already exists. Updating instead or skipping.`);
            // Optionally, update if exists, or just skip
            // For now, skipping to prevent duplicates if not intended.
            return;
          }
          const newElement: KonvaElementDescription = {
            type: params.element_type,
            id: params.id,
            props: { // Ensure the Konva node itself gets the ID prop
              ...params.props,
              id: params.id,
            },
          };
          setElements(prev => [...prev, newElement]);
          break;
        }

        case 'KONVA_UPDATE_ELEMENT_PROPS': {
          const params = action.params;
          setElements(prev =>
            prev.map(el =>
              el.id === params.element_id_to_update
                ? { ...el, props: { ...el.props, ...params.new_props, id: el.id } } // Ensure ID prop is preserved
                : el
            )
          );
          break;
        }

        case 'KONVA_REMOVE_ELEMENT': {
          const params = action.params;
          setElements(prev => prev.filter(el => el.id !== params.element_id_to_remove));
          break;
        }

        case 'KONVA_ENCIRCLE_ELEMENT_BY_ID': {
          const params = action.params;
          const targetNode = stageRef.current?.findOne(`#${params.target_konva_element_id}`);
          if (!targetNode) {
            console.warn(`Encircle: Target element ${params.target_konva_element_id} not found.`);
            return;
          }
          const rect = targetNode.getClientRect({ skipTransform: false });
          const padding = params.padding ?? 10;

          const circleRadius = Math.max(rect.width, rect.height) / 2 + padding;
          const circleX = rect.x + rect.width / 2;
          const circleY = rect.y + rect.height / 2;

          const circleElement: KonvaElementDescription = {
            type: 'Circle',
            id: params.circle_id,
            props: {
              id: params.circle_id,
              x: circleX,
              y: circleY,
              radius: circleRadius,
              stroke: params.circle_props?.stroke ?? 'red',
              strokeWidth: params.circle_props?.strokeWidth ?? 2,
              fill: params.circle_props?.fill, // Usually undefined for encircling
              draggable: params.circle_props?.draggable ?? false,
              ...params.circle_props, // Overrides defaults
            },
          };
          setElements(prev => [...prev, circleElement]);
          break;
        }

        case 'KONVA_UNDERLINE_SUBSTRING_IN_ELEMENT_BY_ID': {
          const params = action.params;
          const targetNode = stageRef.current?.findOne(`#${params.target_konva_element_id}`);

          if (!targetNode || !(targetNode instanceof Konva.Text)) {
            console.warn(`Underline: Target Text element ${params.target_konva_element_id} not found or not a Text node.`);
            return;
          }
          // Note: This currently underlines the entire text node's width.
          // Precise substring underlining (using params.substring_to_underline) is an enhancement.
          const textRect = targetNode.getClientRect({ skipTransform: false });
          const lineYOffset = 2; // Small gap between text bottom and line
          const lineY = textRect.y + textRect.height + (params.line_props?.strokeWidth ?? 2) / 2 + lineYOffset;

          const lineElement: KonvaElementDescription = {
            type: 'Line',
            id: params.line_id,
            props: {
              id: params.line_id,
              points: [textRect.x, lineY, textRect.x + textRect.width, lineY],
              stroke: params.line_props?.stroke ?? 'black',
              strokeWidth: params.line_props?.strokeWidth ?? 2,
              draggable: params.line_props?.draggable ?? false,
              ...params.line_props,
            },
          };
          setElements(prev => [...prev, lineElement]);
          break;
        }
        default: {
          // This will help catch any unhandled action types if ReactUIActionForKonva is a discriminated union
          const _exhaustiveCheck: never = action;
          console.warn('Unknown or unhandled Konva action:', _exhaustiveCheck);
        }
      }
    };

    processAction(currentAction);
    // Parent component should manage the currentAction prop, e.g., by setting it to null
    // or providing a new action object to trigger this effect again when desired.

  }, [currentAction]); // Effect runs when currentAction changes

  // IV. Rendering Logic
  return (
    <Stage width={width} height={height} ref={stageRef}>
      <Layer> {/* ref={layerRef} - add if needed */}
        {elements.map((element) => {
          const { type, id, props } = element;
          // Common props are spread from element.props directly as it includes KonvaElementBaseProps
          // The 'id' from element.id is used as 'key' for React list and also passed in props for Konva node id.

          switch (type) {
            case 'Text':
              return <Text key={id} {...(props as KonvaTextProps)} />;
            case 'Circle':
              return <Circle key={id} {...(props as KonvaCircleProps)} />;
            case 'Rect':
              return <Rect key={id} {...(props as KonvaRectProps)} />;
            case 'Line':
              return <Line key={id} {...(props as KonvaLineOrArrowProps)} />;
            case 'Arrow':
              return <Arrow key={id} {...(props as KonvaLineOrArrowProps)} />;
            case 'Image': {
              const imgProps = props as KonvaImageProps;
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const [imageObject, status] = useImage(imgProps.imageUrl);
              if (status === 'loading') {
                // Optionally render a placeholder or nothing while loading
                return <Text key={`${id}-loading`} text="Loading image..." x={imgProps.x} y={imgProps.y} />;
              }
              if (status === 'failed') {
                return <Text key={`${id}-failed`} text="Image failed to load" x={imgProps.x} y={imgProps.y} fill="red" />;
              }
              return <KonvaImageComponent key={id} {...imgProps} image={imageObject} />;
            }
            default: {
              const _exhaustiveCheck: never = type;
              console.warn('Unknown element type in render:', _exhaustiveCheck);
              return null;
            }
          }
        })}
      </Layer>
    </Stage>
  );
};

export default TeachingBlackboardKonva;

// To use this component, ensure you have react-konva and use-image installed:
// npm install react-konva konva use-image
// or
// yarn add react-konva konva use-image
