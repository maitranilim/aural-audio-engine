import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemedToaster } from "@/components/themed-toaster";
import { SmoothScroll } from "@/components/smooth-scroll";
import { THEME_BOOT } from "@/lib/theme";
import appCss from "../styles.css?url";

const APP_NAME = "Aural";
const APP_URL = "https://aural-audio-engine.vercel.app/";
const APP_DESCRIPTION =
  "Map any song to a clear genre, subgenre, and microgenre lineage—then save, compare, and share what you discover.";
const SOCIAL_IMAGE = `${APP_URL}og.jpg`;
const STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: APP_NAME,
  url: APP_URL,
  description: APP_DESCRIPTION,
  applicationCategory: "MusicApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Three-level song genre classification",
    "Saved mappings",
    "Side-by-side track comparison",
    "Shareable taxonomy links",
  ],
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aural · Find a song's sonic lineage" },
      {
        name: "description",
        content: APP_DESCRIPTION,
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "theme-color", content: "#07080c" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:title", content: "Aural · Find a song's sonic lineage" },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:url", content: APP_URL },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:alt", content: "Aural sonic taxonomy interface" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Aural · Find a song's sonic lineage" },
      { name: "twitter:description", content: APP_DESCRIPTION },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      { name: "twitter:image:alt", content: "Aural sonic taxonomy interface" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "canonical", href: APP_URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&family=Syne:wght@500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }}
        />
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <ThemeProvider>
          <SmoothScroll>
            <Outlet />
            <ThemedToaster />
          </SmoothScroll>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  ),
});
