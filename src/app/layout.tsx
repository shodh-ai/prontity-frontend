import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "../styles/globals.css";
import AuthContextProvider from "@/contexts/AuthContext";
import Layout from "@/components/Layout";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShodhAI",
  description: "ShodhAI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={plusJakartaSans.className}>
        <AuthContextProvider>
          <Layout>{children}</Layout>
        </AuthContextProvider>
      </body>
    </html>
  );
}
