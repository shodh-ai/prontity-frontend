import React, { useState, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Type for doubt response
interface DoubtResponse {
  status?: string;
  message: string;
  is_doubt?: boolean;
  ui_action?: {
    action_type_str: string;
    parameters?: {
      url?: string;
      message?: string;
      [key: string]: any;
    };
  };
}

// Context for doubt handling
interface DoubtHandlerContextType {
  doubtResponse: DoubtResponse | null;
  showDoubtFeedback: boolean;
  handleDoubtResponse: (response: DoubtResponse) => void;
  dismissDoubtFeedback: () => void;
}

const DoubtHandlerContext = createContext<DoubtHandlerContextType | undefined>(undefined);

// Hook to use the doubt handler
export const useDoubtHandler = () => {
  const context = useContext(DoubtHandlerContext);
  if (context === undefined) {
    throw new Error('useDoubtHandler must be used within a DoubtHandlerProvider');
  }
  return context;
};

interface DoubtHandlerProviderProps {
  children: ReactNode;
}

export const DoubtHandlerProvider: React.FC<DoubtHandlerProviderProps> = ({ children }) => {
  const router = useRouter();
  const [doubtResponse, setDoubtResponse] = useState<DoubtResponse | null>(null);
  const [showDoubtFeedback, setShowDoubtFeedback] = useState(false);

  const handleDoubtResponse = (response: DoubtResponse) => {
    setDoubtResponse(response);
    setShowDoubtFeedback(true);
    
    console.log('Received doubt response:', response);
    
    // Auto-redirect if configured (uncomment to enable)
    /*
    if (response.ui_action?.action_type_str === 'REDIRECT_TO_PAGE' && 
        response.ui_action.parameters?.url) {
      router.push(response.ui_action.parameters.url);
      setShowDoubtFeedback(false);
    }
    */
  };

  const dismissDoubtFeedback = () => {
    setShowDoubtFeedback(false);
  };

  const value = {
    doubtResponse,
    showDoubtFeedback,
    handleDoubtResponse,
    dismissDoubtFeedback
  };

  return (
    <DoubtHandlerContext.Provider value={value}>
      {children}
      
      {/* Doubt feedback UI */}
      {showDoubtFeedback && doubtResponse && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white p-6 rounded-xl shadow-2xl max-w-md">
          <div className="text-lg font-semibold mb-2">
            {doubtResponse.is_doubt ? "I found something helpful!" : "Response"}
          </div>
          <p className="mb-4">{doubtResponse.message}</p>
          
          {doubtResponse.ui_action?.action_type_str === 'REDIRECT_TO_PAGE' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-blue-600">{doubtResponse.ui_action.parameters?.message}</p>
              <button 
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                onClick={() => {
                  // Navigate to the teaching page
                  if (doubtResponse.ui_action?.parameters?.url) {
                    router.push(doubtResponse.ui_action.parameters.url);
                  }
                  dismissDoubtFeedback();
                }}
              >
                View Resource
              </button>
            </div>
          )}
          
          <button 
            className="mt-4 text-gray-500 hover:text-gray-700"
            onClick={dismissDoubtFeedback}
          >
            Dismiss
          </button>
        </div>
      )}
    </DoubtHandlerContext.Provider>
  );
};

export default DoubtHandlerProvider;
