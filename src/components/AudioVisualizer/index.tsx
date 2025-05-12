'use client';

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
  className?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  stream, 
  isRecording,
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    
    // Clean up function to stop visualization and disconnect audio nodes
    const cleanup = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      if (audioContext) {
        audioContext.close().catch(console.error);
      }
    };
    
    // Set up audio visualization when stream is available and recording is active
    if (stream && isRecording && canvasRef.current) {
      // Create audio context
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create analyzer node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Create buffer for frequency data
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      
      // Connect stream to analyzer
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Set up canvas
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      
      if (canvasCtx) {
        const draw = () => {
          // Request next animation frame
          animationRef.current = requestAnimationFrame(draw);
          
          // Get current frequency data
          analyser.getByteFrequencyData(dataArray);
          
          // Clear canvas
          canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Set up bar width based on canvas size and buffer length
          const barWidth = (canvas.width / bufferLength) * 2.5;
          let barHeight;
          let x = 0;
          
          // Draw bars for each frequency
          for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            
            // Use a gradient color based on frequency intensity
            const hue = (i / bufferLength) * 360;
            canvasCtx.fillStyle = `hsl(${hue}, 80%, 50%)`;
            
            // Draw the bar
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
          }
        };
        
        // Start visualization
        draw();
      }
    }
    
    // Clean up on component unmount or when recording stops
    return cleanup;
  }, [stream, isRecording]);
  
  return (
    <div className={`audio-visualizer ${className}`}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-16 bg-gray-900 rounded"
        width={300}
        height={64}
      />
      {!isRecording && (
        <div className="text-xs text-center mt-1 text-gray-500">
          Audio visualization will appear during recording
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
