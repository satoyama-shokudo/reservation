import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "さとやま食堂 管理サイト",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
