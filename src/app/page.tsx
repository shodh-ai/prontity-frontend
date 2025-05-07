"use client";

import { redirect } from "next/navigation";

export default function Home() {
  // Auto-redirect to writingpage_tiptap, bypassing login
  redirect('/writingpage_tiptap');
  
  // Note: The code below won't execute due to the redirect,
  // but is kept as reference in case you want to restore the navigation page later
  return null;
}