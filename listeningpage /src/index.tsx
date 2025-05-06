import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ListenToLecture } from "./screens/ListenToLecture";

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <ListenToLecture />
  </StrictMode>,
);
