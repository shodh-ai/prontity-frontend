import React from 'react';
import RoxFooterContent from "./RoxFooterContent";
interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="w-full h-screen bg-white overflow-hidden relative">
      {/* Background elements */}
      <div className="absolute w-[40vw] h-[40vw] max-w-[753px] max-h-[753px] top-[-20vh] right-[-30vw] bg-[#566fe9] rounded-full" />
      <div className="absolute w-[25vw] h-[25vw] max-w-[353px] max-h-[353px] bottom-[-25vh] left-[-10vw] bg-[#336de6] rounded-full" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]">
        <img
          className="absolute w-full max-w-[1336px] h-auto top-6 left-1/2 -translate-x-1/2 opacity-50"
          alt="Union"
          src="https://c.animaapp.com/mbsxrl26lLrLIJ/img/union.svg"
        />
      </div>
      {/* Children will now typically include a main content area and the RoxFooterContent + page-specific controls within their own structure */}
      {children}
    </div>
  );
};

export default MainLayout;

// Function to render the Rox Assistant Footer content
// This allows pages to import and place it where needed, maintaining specific alignment.
export const renderRoxAssistantFooter = () => {
  return <RoxFooterContent />;
};
