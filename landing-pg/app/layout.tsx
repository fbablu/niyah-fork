import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niyah - Put Your Money Where Your Mind Is",
  description:
    "Focus sessions with real money on the line. Stake your own cash, lock your distracting apps, and earn it back by finishing. Quit early and you forfeit it. Skin in the game for your focus.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-light-32x32.png", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
