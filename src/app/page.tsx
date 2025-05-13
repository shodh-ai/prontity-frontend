"use client";

import { redirect } from "next/navigation";

export default function Home() {
  // Auto-redirect to login page
  redirect('/loginpage');
  
  // Note: The code below won't execute due to the redirect,
  // but is kept as reference in case you want to restore the navigation page later
  return null;
}