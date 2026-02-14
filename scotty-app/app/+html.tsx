import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* Primary SEO */}
        <title>Wynter — Happy Valentine's Day, Ananya</title>
        <meta
          name="description"
          content="Meet Wynter, your personal finance kitty. A Valentine's Day gift for Ananya — track spending, complete quests, and keep Wynter happy."
        />
        <meta name="author" content="Sanjay Kumar Baskaran" />
        <link rel="canonical" href="https://ananyamy.love" />

        {/* Open Graph / Social */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ananyamy.love" />
        <meta property="og:title" content="Wynter — Happy Valentine's Day, Ananya" />
        <meta
          property="og:description"
          content="Meet Wynter, your personal finance kitty. A Valentine's Day gift built just for you."
        />
        <meta property="og:site_name" content="ananyamy.love" />

        {/* Twitter / iMessage preview */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Wynter — Happy Valentine's Day, Ananya" />
        <meta
          name="twitter:description"
          content="Meet Wynter, your personal finance kitty. A Valentine's Day gift built just for you."
        />

        {/* PWA / Mobile Web */}
        <meta name="theme-color" content="#fff6f3" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Wynter" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Wynter" />

        {/* Prevent text size adjustment on orientation change */}
        <meta name="format-detection" content="telephone=no" />

        <ScrollViewStyleReset />

        {/* Mobile-viewport shell: locks to phone width on desktop browsers */}
        <style dangerouslySetInnerHTML={{ __html: shellStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const shellStyles = `
/* Base background */
body {
  background-color: #fff6f3;
  margin: 0;
  padding: 0;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* On desktop: center a phone-sized frame */
@media (min-width: 481px) {
  body {
    background-color: #1a1a2e;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    min-height: 100dvh;
  }

  #root {
    width: 390px;
    max-width: 390px;
    height: 100vh;
    height: 100dvh;
    max-height: 844px;
    overflow: hidden;
    border-radius: 40px;
    box-shadow: 0 0 80px rgba(155,89,182,0.3), 0 0 0 6px #000;
    position: relative;
    background-color: #fff6f3;
  }
}

/* Mobile: full bleed */
@media (max-width: 480px) {
  #root {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
}

/* Prevent pull-to-refresh and overscroll on mobile web */
html, body {
  overscroll-behavior: none;
  -webkit-overflow-scrolling: touch;
}

/* Hide scrollbars everywhere */
::-webkit-scrollbar {
  display: none;
}
* {
  scrollbar-width: none;
}

/* Disable text selection for app-like feel */
* {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
}

/* Allow text selection in input fields */
input, textarea {
  user-select: text;
  -webkit-user-select: text;
}
`;
