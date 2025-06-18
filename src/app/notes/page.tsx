"use client";

import { useMemo } from "react";
import type { Note } from "@/types/notes-payload";
import NotesCard from "@/components/NotesCard";
import { useNotes } from "@/hooks/useNotes";

export default function NotesPage() {
  const { notes, loading, error, dataFetched } = useNotes();

  const groupedNotes = useMemo(() => {
    if (!notes || notes.length === 0) {
      return {};
    }
    return notes.reduce((acc, note) => {
      const dateKey = note.createdAt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(note);
      return acc;
    }, {} as Record<string, Note[]>);
  }, [notes]);

  if (loading) {
    return (
      <div className="min-h-full w-full flex flex-col gap-4 p-4 items-center justify-center">
        Loading notes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full w-full flex flex-col gap-4 p-4 items-center justify-center">
        Error fetching notes: {error}
      </div>
    );
  }

  if (dataFetched) {
    return (
      <div className="min-h-full w-full flex flex-col gap-4 px-6 pt-6 pb-12 items-center justify-start">
        <h1 className="text-xl font-semibold text-black text-left w-full">
          Notes
        </h1>
        {Object.keys(groupedNotes).length === 0 && <p>No notes to display.</p>}
        {Object.entries(groupedNotes)
          .sort(
            ([dateA], [dateB]) =>
              new Date(dateB).getTime() - new Date(dateA).getTime()
          )
          .map(([dateString, notesOnDate]) => (
            <div key={dateString} className="w-full">
              <div className="text-black/60 mb-2">{dateString}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-start items-start w-full">
                {notesOnDate
                  .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                  .map((note) => (
                    <NotesCard key={note.id} note={note} />
                  ))}
              </div>
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="min-h-full w-full flex flex-col gap-4 p-4 items-center justify-center">
      <p>Preparing to fetch notes...</p>
    </div>
  );
}
