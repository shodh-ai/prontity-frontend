"use client";

import { redirect } from "next/navigation";

export default function Home() {
  // In a client component, we should redirect to the login page first
  // This ensures that authentication is checked before showing any content
  redirect('/loginpage');
  
  // This code will never execute due to the redirect
  return null;
}