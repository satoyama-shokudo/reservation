import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "さとやま食堂 ご予約",
  description: "兵庫県丹波 さとやま食堂のご予約サイト",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
