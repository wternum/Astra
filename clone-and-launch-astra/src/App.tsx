import { installPreviewBackend } from "./preview/backend";
import AstraStudio from "./app/page";
import ConfirmHost from "./components/ConfirmHost";
// Loaded last so the layout / modal polish overrides the component stylesheets.
import "./ui-polish.css";

// The repository is a Next.js app. Install the browser preview adapter that
// serves its /api/* routes before the original page mounts.
installPreviewBackend();

export default function App() {
  return <>
    <AstraStudio />
    <ConfirmHost />
  </>;
}
