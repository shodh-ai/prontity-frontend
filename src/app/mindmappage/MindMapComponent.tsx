"use client";

import React, { useEffect, useState, useRef } from "react";
import { Stage, Layer, Circle, Text, Line, Group, Rect } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import axios from "axios";

// Interfaces for Mind Map data and components
export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
}

export interface MindMapData {
  topic: string;
  nodes: MindMapNode[];
  debug?: any;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Props for the mind map visualization
interface MindMapVisualizationProps {
  data: MindMapData;
  width?: number;
  height?: number;
}

// Props for the full mind map component with UI controls
export interface MindMapComponentProps {
  initialTopic?: string;
  width?: number;
  height?: number;
  className?: string;
  showDebugInfo?: boolean;
  onMindMapGenerated?: (data: MindMapData) => void;
  apiEndpoint?: string;
}

// Define a color scheme
const COLORS = {
  root: {
    fill: "#4F46E5", // Indigo
    stroke: "#4338CA",
    text: "#FFFFFF",
  },
  primary: [
    { fill: "#10B981", stroke: "#059669", text: "#FFFFFF" }, // Emerald
    { fill: "#3B82F6", stroke: "#2563EB", text: "#FFFFFF" }, // Blue
    { fill: "#EC4899", stroke: "#DB2777", text: "#FFFFFF" }, // Pink
    { fill: "#F59E0B", stroke: "#D97706", text: "#FFFFFF" }, // Amber
    { fill: "#8B5CF6", stroke: "#7C3AED", text: "#FFFFFF" }, // Violet
  ],
  secondary: {
    fill: "#F3F4F6", // Light gray
    stroke: "#D1D5DB", // Darker gray
    text: "#1F2937", // Almost black
  }
};

// MindMap Visualization Component - just renders the mind map visualization
const MindMapVisualization: React.FC<MindMapVisualizationProps> = ({ data, width = 900, height = 600 }) => {
  const [stageSize, setStageSize] = useState({ width, height });
  const [scale, setScale] = useState(1);
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  // Calculate positions for all nodes with a more organized layout
  useEffect(() => {
    if (!data || !data.nodes) return;

    const calculatePositions = () => {
      const centerX = stageSize.width / 2;
      const centerY = stageSize.height / 2;
      const newPositions: NodePosition[] = [];
      
      // Add root node (topic)
      newPositions.push({
        id: "root",
        x: centerX,
        y: centerY,
        width: 180,
        height: 60,
      });

      // Calculate positions for first-level nodes in a circular layout
      const firstLevelNodes = data.nodes;
      const angleStep = (2 * Math.PI) / firstLevelNodes.length;
      const radius = 250; // Increased radius for better spacing

      firstLevelNodes.forEach((node: MindMapNode, index: number) => {
        // Calculate angle with a small offset to start from the top
        const angle = index * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        newPositions.push({
          id: node.id,
          x,
          y,
          width: 150,
          height: 45,
        });

        // Calculate positions for second-level nodes in a mini-circular pattern
        if (node.children && node.children.length > 0) {
          const childrenCount = node.children.length;
          const fanAngle = Math.min(Math.PI / 2, Math.PI / 2 * (childrenCount / 4));
          const childRadius = 150;
          
          // Calculate the base angle pointing away from center
          const baseAngle = angle;
          const startAngle = baseAngle - fanAngle / 2;
          const angleIncrement = childrenCount > 1 ? fanAngle / (childrenCount - 1) : 0;

          node.children.forEach((child: MindMapNode, childIndex: number) => {
            let childAngle;
            if (childrenCount === 1) {
              childAngle = baseAngle;
            } else {
              childAngle = startAngle + angleIncrement * childIndex;
            }
            
            const childX = x + childRadius * Math.cos(childAngle);
            const childY = y + childRadius * Math.sin(childAngle);

            newPositions.push({
              id: child.id,
              x: childX,
              y: childY,
              width: 130,
              height: 40,
            });
          });
        }
      });

      setPositions(newPositions);
    };

    calculatePositions();
  }, [data, stageSize]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = Math.max(600, containerRef.current.offsetHeight);
        setStageSize({ width, height });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle zoom functionality
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    
    const pointerPosition = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointerPosition.x - stage.x()) / oldScale,
      y: (pointerPosition.y - stage.y()) / oldScale,
    };
    
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    stage.scale({ x: newScale, y: newScale });
    
    const newPos = {
      x: pointerPosition.x - mousePointTo.x * newScale,
      y: pointerPosition.y - mousePointTo.y * newScale,
    };
    
    stage.position(newPos);
    stage.batchDraw();
    
    setScale(newScale);
  };

  // Find a specific node from the mind map data
  const findNode = (id: string): MindMapNode | null => {
    if (id === "root") {
      return { id: "root", text: data.topic };
    }
    
    for (const node of data.nodes) {
      if (node.id === id) {
        return node;
      }
      
      if (node.children) {
        for (const child of node.children) {
          if (child.id === id) {
            return child;
          }
        }
      }
    }
    
    return null;
  };

  // Find parent-child connections
  const findConnections = () => {
    const connections = [];
    
    // Connect root to first-level nodes
    const rootPos = positions.find(p => p.id === "root");
    if (rootPos) {
      data.nodes.forEach(node => {
        const nodePos = positions.find(p => p.id === node.id);
        if (nodePos) {
          connections.push({
            from: { x: rootPos.x, y: rootPos.y },
            to: { x: nodePos.x, y: nodePos.y },
            fromId: "root",
            toId: node.id,
          });
        }
      });
    }

    // Connect first-level nodes to their children
    data.nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        const parentPos = positions.find(p => p.id === node.id);
        
        if (parentPos) {
          node.children.forEach(child => {
            const childPos = positions.find(p => p.id === child.id);
            
            if (childPos) {
              connections.push({
                from: { x: parentPos.x, y: parentPos.y },
                to: { x: childPos.x, y: childPos.y },
                fromId: node.id,
                toId: child.id,
              });
            }
          });
        }
      }
    });
    
    return connections;
  };

  // If the data isn't loaded yet, show a placeholder
  if (!data || !data.nodes || positions.length === 0) {
    return <div className="h-full flex items-center justify-center">Loading mind map...</div>;
  }

  const connections = findConnections();

  return (
    <div ref={containerRef} className="h-full w-full">
      <Stage 
        width={stageSize.width} 
        height={stageSize.height}
        draggable
        onWheel={handleWheel}
        ref={stageRef}
      >
        <Layer>
          {/* Draw connections between nodes */}
          {connections.map((conn, i) => {
            // Determine if this connection involves a hovered or selected node
            const isHighlighted = hoveredNode === conn.fromId || 
                              hoveredNode === conn.toId || 
                              selectedNode === conn.fromId || 
                              selectedNode === conn.toId;
            
            // Get node type information
            const isFromRoot = conn.fromId === "root";
            const isToChild = conn.toId.includes("child");
            
            // Determine connection color based on node relationship
            let connectionColor;
            if (isFromRoot) {
              // Get primary color for the main category
              const nodeIndex = parseInt(conn.toId.split('_')[1], 10) % COLORS.primary.length;
              connectionColor = COLORS.primary[nodeIndex >= 0 ? nodeIndex : 0].stroke;
            } else if (isToChild) {
              // Use the parent node's color but with transparency
              const nodeIndex = parseInt(conn.fromId.split('_')[1], 10) % COLORS.primary.length;
              connectionColor = COLORS.primary[nodeIndex >= 0 ? nodeIndex : 0].stroke;
            } else {
              connectionColor = "#aaa";
            }
            
            // Calculate control points for a curved line
            const midX = (conn.from.x + conn.to.x) / 2;
            const midY = (conn.from.y + conn.to.y) / 2;
            
            // Create a slight curve for the connection
            // More pronounced curve for connections to child nodes
            const curveOffset = isToChild ? 30 : 15;
            
            // Calculate the perpendicular offset direction
            const dx = conn.to.x - conn.from.x;
            const dy = conn.to.y - conn.from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const normX = dx / len;
            const normY = dy / len;
            
            // Calculate control point (perpendicular to the line)
            const cpX = midX + curveOffset * -normY;
            const cpY = midY + curveOffset * normX;

            return (
              <Line
                key={`line-${conn.fromId}-${conn.toId}`}
                points={[
                  conn.from.x,
                  conn.from.y,
                  cpX,
                  cpY,
                  conn.to.x,
                  conn.to.y
                ]}
                stroke={connectionColor}
                strokeWidth={isHighlighted ? 3 : 1.5}
                opacity={isHighlighted ? 0.9 : 0.7}
                tension={0.3}
                lineCap="round"
                lineJoin="round"
                shadowColor={isHighlighted ? "#999" : undefined}
                shadowBlur={isHighlighted ? 4 : 0}
                shadowOpacity={0.3}
              />
            );
          })}

          {/* Draw nodes and labels */}
          {positions.map((pos) => {
            const node = findNode(pos.id);
            if (!node) return null;
            
            const isRoot = pos.id === "root";
            const isChild = pos.id.includes("child");
            
            // Select color for the node
            let colorScheme;
            if (isRoot) {
              colorScheme = COLORS.root;
            } else if (!isChild) {
              // Use color from primary colors array based on node index
              const nodeIndex = parseInt(pos.id.split('_')[1], 10) % COLORS.primary.length;
              colorScheme = COLORS.primary[nodeIndex >= 0 ? nodeIndex : 0];
            } else {
              colorScheme = COLORS.secondary;
            }
            
            // Calculate dimensions with improved text handling
            const nodeWidth = isRoot ? 200 : isChild ? 160 : 180;
            const nodeHeight = isRoot ? 80 : isChild ? 60 : 70;
            const textWidth = isRoot ? 180 : isChild ? 140 : 160;
            const fontSize = isRoot ? 16 : isChild ? 13 : 14;
            const xOffset = textWidth / -2;
            const yOffset = -fontSize;
            
            // Determine if this node is hovered or selected
            const isHovered = hoveredNode === pos.id;
            const isSelected = selectedNode === pos.id;
            
            // Apply visual effects for hover and selection
            const shadowBlur = isHovered ? 15 : isSelected ? 20 : 10;
            const shadowColor = isSelected ? "#FCD34D" : "black";
            const strokeWidth = isSelected ? 3 : isHovered ? 2.5 : 2;
            const scale = isHovered ? 1.05 : isSelected ? 1.1 : 1;
            
            return (
              <Group 
                key={pos.id} 
                x={pos.x} 
                y={pos.y}
                scaleX={scale}
                scaleY={scale}
                onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                  // Change cursor and set hovered state
                  const container = e.target.getStage()?.container();
                  if (container) {
                    container.style.cursor = 'pointer';
                  }
                  setHoveredNode(pos.id);
                }}
                onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                  // Reset cursor
                  const container = e.target.getStage()?.container();
                  if (container) {
                    container.style.cursor = 'default';
                  }
                  setHoveredNode(null);
                }}
                onClick={() => {
                  // Toggle selection
                  setSelectedNode(selectedNode === pos.id ? null : pos.id);
                }}
              >
                {/* Node background with rounded rectangle for better visual */}
                <Rect
                  width={nodeWidth}
                  height={nodeHeight}
                  x={-nodeWidth / 2}
                  y={-nodeHeight / 2}
                  fill={colorScheme.fill}
                  stroke={colorScheme.stroke}
                  strokeWidth={strokeWidth}
                  cornerRadius={15}
                  shadowColor={shadowColor}
                  shadowBlur={shadowBlur}
                  shadowOpacity={0.3}
                  shadowOffset={{ x: 3, y: 3 }}
                />
                
                <Text
                  text={node.text}
                  fill={colorScheme.text}
                  fontSize={fontSize}
                  fontFamily="'Roboto', 'Helvetica', sans-serif"
                  fontStyle="bold"
                  width={textWidth}
                  align="center"
                  verticalAlign="middle"
                  x={xOffset}
                  y={yOffset}
                  padding={5}
                  ellipsis={true}
                  wrap="word"
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};

// Complete MindMap Component with UI controls
export const MindMapComponent: React.FC<MindMapComponentProps> = ({ 
  initialTopic = '',
  width = 900,
  height = 600,
  className = '',
  showDebugInfo = false,
  onMindMapGenerated,
  apiEndpoint = '/api/generate-mindmap'
}) => {
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [topic, setTopic] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Debug state to track request/response details
  interface DebugInfo {
    apiRequest: { topic: string } | null;
    apiResponse: any;
    apiError: {
      message?: string;
      response?: any;
      status?: number;
    } | null;
    responseStatus: 'idle' | 'pending' | 'success' | 'error' | null;
  }
  
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    apiRequest: null,
    apiResponse: null,
    apiError: null,
    responseStatus: 'idle',
  });
  
  // Toggle to show/hide debug panel (hidden by default)
  const [showDebug, setShowDebug] = useState(showDebugInfo);
  
  const generateMindMap = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic");
      return;
    }

    setIsLoading(true);
    setError("");
    
    // Reset debug info
    setDebugInfo({
      apiRequest: { topic },
      apiResponse: null,
      apiError: null,
      responseStatus: "pending",
    });
    
    try {
      console.log("Making API request to " + apiEndpoint + " with topic:", topic);
      
      // Start API request
      const response = await axios.post(apiEndpoint, { topic });
      
      console.log("API response received:", response.data);
      
      // Update debug info with response
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        apiResponse: response.data,
        responseStatus: "success",
      }));
      
      setMindMapData(response.data);
      
      // Call the callback if provided
      if (onMindMapGenerated) {
        onMindMapGenerated(response.data);
      }
    } catch (err: any) {
      console.error("Error generating mind map:", err);
      
      // Update debug info with error details
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        apiError: {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        },
        responseStatus: "error",
      }));
      
      setError(`Failed to generate mind map: ${err.response?.data?.error || err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className={`mind-map-container ${className}`}>
      <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Generate Your Mind Map</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic (e.g., Climate Change, Digital Technology)"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading && topic.trim()) {
                  generateMindMap();
                }
              }}
            />
            {topic && (
              <button 
                onClick={() => setTopic('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={generateMindMap}
            disabled={isLoading || !topic.trim()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg flex items-center justify-center min-w-[180px]"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>Generate Mind Map</>
            )}
          </button>
        </div>
        
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}
      </div>
      
      {/* Debug Panel Toggle - only if showDebugInfo is enabled */}
      {showDebugInfo && (
        <div className="mb-4">
          <button 
            className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
        </div>
      )}

      {/* Debug Panel */}
      {showDebug && (
        <div className="mb-4 border rounded-lg p-4 bg-gray-50 overflow-auto max-h-[300px] text-xs font-mono">
          <h3 className="font-bold mb-2">Debug Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold">Request Status:</h4>
              <div className={`p-1 rounded ${debugInfo.responseStatus === 'success' ? 'bg-green-100' : debugInfo.responseStatus === 'error' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                {debugInfo.responseStatus || 'None'}
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Request Payload:</h4>
              <pre className="p-1 bg-gray-100 rounded overflow-auto max-h-[100px]">
                {JSON.stringify(debugInfo.apiRequest, null, 2)}
              </pre>
            </div>
          </div>
          
          {debugInfo.apiError && (
            <div className="mt-2">
              <h4 className="font-semibold text-red-600">Error:</h4>
              <pre className="p-1 bg-red-50 rounded overflow-auto max-h-[100px]">
                {JSON.stringify(debugInfo.apiError, null, 2)}
              </pre>
            </div>
          )}
          
          {debugInfo.apiResponse && (
            <div className="mt-2">
              <h4 className="font-semibold text-green-600">Response Data:</h4>
              <pre className="p-1 bg-green-50 rounded overflow-auto max-h-[150px]">
                {JSON.stringify(debugInfo.apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="min-h-[600px] border rounded-lg p-4 bg-white shadow-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium text-gray-800">{mindMapData ? mindMapData.topic : 'Mind Map Visualization'}</h3>
          {mindMapData && (
            <div className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
              {mindMapData.nodes?.length || 0} main categories
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : mindMapData ? (
          <MindMapVisualization data={mindMapData} width={width} height={height} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Enter a topic and click &quot;Generate Mind Map&quot; to create a visualization
          </div>
        )}
      </div>
    </div>
  );
};

// Export the standalone visualization component too
export { MindMapVisualization };

// Default export is the full component
export default MindMapComponent;
