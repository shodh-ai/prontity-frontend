# Canvas Drawing Component with AI Image Generation

A React-based canvas drawing component that allows users to create, edit, and manipulate drawings with various tools, including AI-generated images.

## Features

1. **Drawing Tools**
   - Pencil tool for freehand drawing
   - Rectangle tool for creating rectangles
   - Text tool for adding and editing text
   - Image placement via AI generation
   - Selection tool for manipulating elements
   - Pan tool for navigating the canvas

2. **State Management**
   - Zustand store integration for global state
   - Persistent storage of canvas states
   - Backend API integration with localStorage fallback

3. **AI Integration**
   - Google Gemini API integration for image generation
   - Text-to-image generation capability
   - Context-aware drawing generation for vocabulary learning

4. **Advanced Canvas Features**
   - Zoom and pan functionality
   - Element selection and transformation
   - Text editing with double-click functionality
   - Rectangle drawing with proper handling of negative dimensions
   - Interactive tools palette

## Component Structure

- `SimpleCanvas`: Main canvas component using Konva
- `CanvasWrapper`: Wrapper component that handles tool selection and canvas events
- `AIGeneratedImage`: Component for rendering AI-generated images
- `ToolBar`: Component for displaying and selecting drawing tools
- `TextInput`: Component for entering AI prompts

## API Routes

- `GET /api/user/:userId/word/:wordId/canvas`: Load canvas data for a specific user and word
- `POST /api/user/:userId/word/:wordId/canvas`: Save canvas data
- `DELETE /api/user/:userId/word/:wordId/canvas`: Delete canvas data
- `GET /api/user/:userId/canvas`: Get all canvases for a user
- `POST /api/ai/generate-drawing`: Generate an image based on a prompt using Google's Gemini API

## State Management

The canvas uses Zustand for state management. The store maintains:

- Drawing elements (lines, rectangles, text, images)
- Current tool selection
- Canvas viewport (position, zoom)
- Element selection state
- Tool options (color, stroke width)

## AI Image Generation

The component integrates with Google's Gemini API to generate images based on text prompts. The generated images are then added to the canvas as manipulable elements.

Key features:
- Text-to-image generation
- Integration with vocabulary learning context
- Non-destructive placement of generated images

## Usage

```jsx
import CanvasWrapper from '@/components/vocabulary/CanvasWrapper';

// Inside your component
return (
  <div className="canvas-container">
    <CanvasWrapper />
  </div>
);
```

To generate AI images, use the `TextInput` component:

```jsx
import TextInput from '@/components/vocabulary/TextInput';

// Inside your component
const handlePromptSubmit = async (prompt) => {
  // Handle submission
};

return (
  <TextInput
    onSubmit={handlePromptSubmit}
    placeholder="Ask AI to draw something..."
    buttonText="Generate Drawing"
  />
);
```
