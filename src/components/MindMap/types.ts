// Mind Map Data Structures
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

// Mind Map Component Props
export interface MindMapProps {
  data: MindMapData | null;
  topic?: string;
  isLoading?: boolean;
  error?: string;
  onGenerateMindMap?: (topic: string) => Promise<void>;
  showControls?: boolean;
}

// Mind Map Visualization Props
export interface MindMapVisualizationProps {
  data: MindMapData;
}

// Mind Map Generator Props
export interface MindMapGeneratorProps {
  topic: string;
  setTopic: (topic: string) => void;
  isLoading: boolean;
  error: string;
  onGenerateMindMap: () => void;
}
