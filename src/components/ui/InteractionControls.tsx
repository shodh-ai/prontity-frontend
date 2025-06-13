import React, { useState } from 'react';
import { Mic, MicOff, HandMetal } from 'lucide-react';

interface InteractionControlsProps {
  onHandRaise: () => Promise<void>;
  onPushToTalk: (isActive: boolean) => Promise<void>;
  className?: string;
}

const InteractionControls: React.FC<InteractionControlsProps> = ({
  onHandRaise,
  onPushToTalk,
  className = '',
}) => {
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleHandRaiseClick = async () => {
    try {
      setIsHandRaised(!isHandRaised);
      await onHandRaise();
    } catch (error) {
      setIsHandRaised(isHandRaised); // Revert if failed
      console.error("Error raising hand:", error);
    }
  };

  const handlePushToTalkMouseDown = async () => {
    try {
      setIsPushToTalkActive(true);
      await onPushToTalk(true);
    } catch (error) {
      setIsPushToTalkActive(false);
      console.error("Error activating push-to-talk:", error);
    }
  };

  const handlePushToTalkMouseUp = async () => {
    try {
      setIsPushToTalkActive(false);
      await onPushToTalk(false);
    } catch (error) {
      setIsPushToTalkActive(true);
      console.error("Error deactivating push-to-talk:", error);
    }
  };

  return (
    <div className={`interaction-controls ${className}`}>
      {/* Hand Raise Button */}
      <button 
        className={`custom-button ${isHandRaised ? 'active' : ''}`} 
        onClick={handleHandRaiseClick}
        style={{
          background: isHandRaised ? '#FFF9E0' : '#FFFFFF',
          border: isHandRaised ? '1px solid #F5C400' : '1px solid #566FE9'
        }}
        aria-label={isHandRaised ? "Lower hand" : "Raise hand"}
      >
        <HandMetal 
          size={24}
          color={isHandRaised ? '#F5C400' : '#566FE9'}
        />
      </button>

      {/* Push to Talk Button */}
      <button 
        className={`custom-button ${isPushToTalkActive ? 'active' : ''}`} 
        onMouseDown={handlePushToTalkMouseDown}
        onMouseUp={handlePushToTalkMouseUp}
        onMouseLeave={isPushToTalkActive ? handlePushToTalkMouseUp : undefined}
        style={{
          background: isPushToTalkActive ? '#E0FFF5' : '#FFFFFF',
          border: isPushToTalkActive ? '1px solid #00C48F' : '1px solid #566FE9',
          position: 'relative'
        }}
        aria-label="Push to talk"
      >
        {isPushToTalkActive ? 
          <Mic size={24} color="#00C48F" /> : 
          <MicOff size={24} color="#566FE9" />
        }
        
        {/* Visual indicator for active mic */}
        {isPushToTalkActive && (
          <span 
            className="pulse-indicator"
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#00C48F',
              animation: 'pulse 1.5s infinite'
            }}
          />
        )}
      </button>

      <style jsx>{`
        .interaction-controls {
          display: flex;
          gap: 8px;
        }
        
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default InteractionControls;
