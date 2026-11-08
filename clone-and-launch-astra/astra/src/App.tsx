import { installPreviewBackend } from "./preview/backend";
import AstraStudio from "./app/page";

// The repository is a Next.js app. Install the browser preview adapter that
// serves its /api/* routes before the original page mounts.
installPreviewBackend();

export default function App() {
  return <AstraStudio />;
}
