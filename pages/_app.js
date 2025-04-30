import React, { useEffect, useState } from "react";
import { UploaderProvider } from "../contexts/UploaderContext";
import "../styles/globals.css";

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
