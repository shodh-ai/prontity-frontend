export interface Note {
  id: string;
  userId: string;
  heading: string;
  content: string;
  createdAt: Date;
}

export interface NotesResponsePayload {
  message: string;
  notes: Note[];
}
