import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TopicToSpeakAbout } from "./screens/TopicToSpeakAbout";

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <TopicToSpeakAbout />
  </StrictMode>,
);
