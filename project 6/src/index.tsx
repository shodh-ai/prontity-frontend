import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { UserWritingThe } from "./screens/UserWritingThe";
import { WritingPrompt } from "./screens/WritingPrompt";

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<WritingPrompt />} />
        <Route path="/writing" element={<UserWritingThe />} />
      </Routes>
    </Router>
  </StrictMode>
);