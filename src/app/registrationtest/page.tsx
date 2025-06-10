// "use client";

// import { StrictMode } from "react";
// import { createRoot } from "react-dom/client";
// import { Q } from "./screens/Q";

// createRoot(document.getElementById("app") as HTMLElement).render(
//   <StrictMode>
//     <Q />
//   </StrictMode>,
// );
// // src/app/registrationtest/page.tsx
"use client"; // if Q uses any browser APIs or state

import { RegistrationForm } from "../../components/RegistrationForm";

export default function RegistrationTestPage() {
  return <RegistrationForm />;
}
