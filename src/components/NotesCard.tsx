import type { Note } from "@/types/notes-payload";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function NotesCard({ note }: { note: Note }) {
  return (
    <div className="p-[0.1rem] bg-gradient-to-br from-[#ebeefb] to-[#929fea] rounded-lg h-full w-full">
      <div className="flex flex-col gap-2 bg-white rounded-lg p-4 h-full w-full">
        <h1 className="text-lg font-semibold text-[#566FE9]">{note.heading}</h1>
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {note.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
