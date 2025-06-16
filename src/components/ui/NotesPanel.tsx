import React from "react";

// Define the structure for a single note/explanation
export interface Note {
  id: number;
  task: string;
  explanation: string;
}

interface NotesPanelProps {
  isVisible: boolean;
  onClose: () => void;
  notes: Note[];
  className?: string;
}

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);


export const NotesPanel = ({ isVisible, onClose, notes, className }: NotesPanelProps): JSX.Element | null => {
  // Visibility is now controlled by conditional rendering in the parent.
  // The panel will fill the container it's placed in.
  if (!isVisible) {
    return null; // Or handle visibility as per parent's logic if it's always rendered
  }

  return (
    <aside
      className={`h-full w-full bg-gray-50 p-4 flex flex-col ${className || ''}`}
      aria-hidden={!isVisible} // This prop might be redundant if the component is not rendered when not visible
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Think Aloud Explanations</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-200"
          aria-label="Close notes panel"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Adjust height for internal scrolling to be flex-grow if header is fixed height */}
      <div className="space-y-4 overflow-y-auto flex-grow">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div key={note.id} className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-2">
                {`Example ${note.id} - Task: ${note.task}`}
              </h3>
              <p className="text-gray-600">
                {note.explanation}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 mt-10">
            <p>No notes available for this section.</p>
          </div>
        )}
      </div>
    </aside>
  );
};