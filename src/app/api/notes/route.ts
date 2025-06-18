import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import type { NotesResponsePayload } from "@/types/notes-payload";
import type { ErrorPayload } from "@/types/error-payload";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "notes.json");

    const fileContent = await fs.readFile(filePath, "utf-8");

    const notesData = JSON.parse(fileContent) as NotesResponsePayload;

    return NextResponse.json<NotesResponsePayload>(notesData, { status: 200 });
  } catch (error: any) {
    console.error("[API Route /api/notes] Error fetching notes:", error);

    if (error.code === "ENOENT") {
      return NextResponse.json<ErrorPayload>(
        { message: "Notes data file not found." },
        { status: 404 }
      );
    }

    return NextResponse.json<ErrorPayload>(
      { message: "Failed to fetch notes data.", details: error.message },
      { status: 500 }
    );
  }
}
