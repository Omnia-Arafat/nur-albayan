import "./globals.css";

// Locale, direction, title and the theme stylesheet are loaded from the database
// once the [locale] routes land (plan phase 1). Nothing is hardcoded here.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
