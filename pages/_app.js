import React, { useEffect, useState } from "react";
import { UploaderProvider } from "../contexts/UploaderContext";
import "../styles/globals.css";

/**
 * Custom app component that wraps each page with the {@link UploaderProvider} context and ensures rendering only after client-side hydration.
 *
 * Prevents server-side rendering mismatches by delaying the rendering of the active page component until the app is mounted on the client.
 *
 * @param {object} props - The component props.
 * @param {React.ComponentType} props.Component - The active page component to render.
 * @param {object} props.pageProps - Props to pass to the active page component.
 * @returns {JSX.Element} The wrapped page component, rendered only after hydration.
 */
function MyApp({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);

  // Wait until after client-side hydration to show
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <UploaderProvider>
      {mounted && <Component {...pageProps} />}
    </UploaderProvider>
  );
}

export default MyApp;
