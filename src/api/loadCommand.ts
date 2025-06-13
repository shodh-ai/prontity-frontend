import LessonData from "../types/command";

export default async function loadCommand(): Promise<LessonData> {
  try {
    const response = await fetch("/data/command.json");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch command data: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    return data as LessonData;
  } catch (error) {
    console.error("Error loading command data:", error);
    throw error;
  }
}
