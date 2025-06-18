"use client";

import { RegistrationForm } from "../../components/RegistrationForm";
import MainLayout from '@/components/layout/layout';
import RoxFooterContent from "@/components/layout/RoxFooterContent";

export default function RegistrationTestPage() {
  return (
    <MainLayout>
      <div className="flex justify-center items-center">
        <RegistrationForm />
      </div>
      <RoxFooterContent />
    </MainLayout>
  );
}
