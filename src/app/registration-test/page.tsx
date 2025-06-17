"use client";

import PageContainer from '@/components/layout/PageContainer';
import { RegistrationForm } from "../../components/RegistrationForm";

export default function RegistrationTestPage() {
  return (
    <PageContainer>
      <div className="flex justify-center items-center">
        <RegistrationForm />
      </div>
    </PageContainer>
  );
}
