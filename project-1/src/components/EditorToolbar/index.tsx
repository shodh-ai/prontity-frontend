import React from 'react';
import { Editor } from '@tiptap/react';

// Define prop types
interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
  editor, 
  className = '' 
}) => {
  // If there's no editor, don't render anything
  if (!editor) {
    return null;
  }

  return (
    <div className={`editor-toolbar flex items-center space-x-2 ${className}`}>
      {/* Text formatting options */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-2 border rounded ${
          editor.isActive('bold') ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Bold"
      >
        <span className="font-bold">B</span>
      </button>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-2 border rounded ${
          editor.isActive('italic') ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Italic"
      >
        <span className="italic">I</span>
      </button>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={`p-2 border rounded ${
          editor.isActive('highlight') ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Highlight"
      >
        <span className="bg-yellow-200 px-1">H</span>
      </button>
      
      {/* Add a divider */}
      <div className="h-6 border-l border-gray-300 mx-1"></div>
      
      {/* Paragraph formatting options */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`p-2 border rounded ${
          editor.isActive('paragraph') ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Paragraph"
      >
        <span>P</span>
      </button>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-2 border rounded ${
          editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Heading 2"
      >
        <span>H2</span>
      </button>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`p-2 border rounded ${
          editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Heading 3"
      >
        <span>H3</span>
      </button>
      
      {/* Add a divider */}
      <div className="h-6 border-l border-gray-300 mx-1"></div>
      
      {/* List formatting options */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 border rounded ${
          editor.isActive('bulletList') ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Bullet List"
      >
        <span>•</span>
      </button>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 border rounded ${
          editor.isActive('orderedList') ? 'bg-gray-200' : 'bg-white'
        }`}
        title="Numbered List"
      >
        <span>1.</span>
      </button>
      
      {/* Add a divider */}
      <div className="h-6 border-l border-gray-300 mx-1"></div>
      
      {/* Undo/Redo buttons */}
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`p-2 border rounded ${
          !editor.can().undo() ? 'bg-gray-100 text-gray-400' : 'bg-white'
        }`}
        title="Undo"
      >
        <span>↩</span>
      </button>
      
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`p-2 border rounded ${
          !editor.can().redo() ? 'bg-gray-100 text-gray-400' : 'bg-white'
        }`}
        title="Redo"
      >
        <span>↪</span>
      </button>
    </div>
  );
};

export default EditorToolbar;
