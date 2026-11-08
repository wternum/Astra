import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/globals.css";
import "./app/refinement.css";
import "./brand.css";
import "./semantic.css";
import "./knowledge.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
