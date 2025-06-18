import { useState, useEffect } from 'react';
import type { Note, NotesResponsePayload } from '@/types/notes-payload';
import type { ErrorPayload } from '@/types/error-payload';

interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: string | null;
  dataFetched: boolean;
}

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataFetched, setDataFetched] = useState<boolean>(false);

  useEffect(() => {
    const fetchNotesData = async () => {
      setLoading(true);
      setError(null);
      setDataFetched(false);
      try {
        const response = await fetch("/api/notes");
        const data = await response.json();

        if (!response.ok) {
          const errorData = data as ErrorPayload;
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`
          );
        }

        const successData = data as NotesResponsePayload;
        const transformedNotes = successData.notes.map((note) => ({
          ...note,
          createdAt: new Date(note.createdAt), // Ensure createdAt is a Date object
        }));
        console.log("Fetched and Transformed Notes Data (from useNotes hook):", transformedNotes);
        setNotes(transformedNotes);
        setDataFetched(true);
      } catch (err: any) {
        setError(err.message || "Failed to fetch notes.");
        console.error("Error fetching notes (from useNotes hook):", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotesData();
  }, []); // Empty dependency array ensures this runs once on mount

  return { notes, loading, error, dataFetched };
}
