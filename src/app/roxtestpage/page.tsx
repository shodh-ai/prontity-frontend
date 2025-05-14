"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RoxTestPage() {
  const [transcript, setTranscript] = useState<string>("");
  const [response, setResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showStatus, setShowStatus] = useState<boolean>(false);
  const [showLearning, setShowLearning] = useState<boolean>(false);
  const [studentData, setStudentData] = useState({
    name: "John Smith",
    progress: {
      Listening: "75%",
      Speaking: "60%",
      Writing: "82%",
    },
  });

  // References to the buttons
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const learningButtonRef = useRef<HTMLButtonElement>(null);

  // Debug to verify refs are initialized
  useEffect(() => {
    console.log("DEBUG - Refs initialized:", {
      statusButtonRef: !!statusButtonRef.current,
      learningButtonRef: !!learningButtonRef.current
    });
  }, []);

  // Function to send transcript to the Rox agent
  const sendTranscript = async () => {
    if (!transcript.trim()) return;

    setIsLoading(true);
    setResponse("Waiting for agent response...");

    try {
      const response = await fetch("http://localhost:5005/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcript,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Full response from Rox agent:", data);
      setResponse(data.response);

      // Process DOM actions if any
      if (data.dom_actions && Array.isArray(data.dom_actions)) {
        console.log("Received DOM actions:", data.dom_actions);
        
        // Process each action
        data.dom_actions.forEach((action: any) => {
          console.log("Processing action:", action);
          if (action.action === "click" && action.payload && action.payload.selector) {
            const selector = action.payload.selector;
            console.log(`Processing click action on selector: ${selector}`);
            
            // Handle button clicks based on selector
            if (selector === "#statusViewButton") {
              console.log("Status button ref exists:", !!statusButtonRef.current);
              if (statusButtonRef.current) {
                console.log("Clicking status view button");
                handleStatusClick();
              } else {
                console.error("Status button reference is null");
              }
            } else if (selector === "#startLearningButton") {
              console.log("Learning button ref exists:", !!learningButtonRef.current);
              if (learningButtonRef.current) {
                console.log("Clicking start learning button");
                handleLearningClick();
              } else {
                console.error("Learning button reference is null");
              }
            } else {
              console.error(`Element not found for selector: ${selector}`);
            }
          } else {
            console.error("Action is not properly formatted:", action);
          }
        });
      } else {
        console.log("No DOM actions received in the response");
      }
    } catch (error) {
      console.error("Error calling Rox agent:", error);
      setResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Button click handlers
  const handleStatusClick = () => {
    console.log("Status View button clicked");
    setShowStatus(true);
    setShowLearning(false);
  };

  const handleLearningClick = () => {
    console.log("Start Learning button clicked");
    setShowLearning(true);
    setShowStatus(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-center mb-6">Rox Agent React Testing</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Test DOM Actions</h2>
        <p className="mb-4">
          This page simulates the roxpage frontend to test if the Rox agent can
          properly interact with React components.
        </p>
        
        <div className="flex gap-4 mb-6">
          <Button 
            id="statusViewButton"
            ref={statusButtonRef}
            onClick={handleStatusClick}
            className="bg-blue-500 hover:bg-blue-600"
          >
            View My Status
          </Button>
          
          <Button 
            id="startLearningButton"
            ref={learningButtonRef}
            onClick={handleLearningClick}
            className="bg-green-500 hover:bg-green-600"
          >
            Start Learning
          </Button>
        </div>
        
        <h3 className="font-semibold mb-2">Test Agent Response</h3>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Enter a message for the Rox agent..."
          className="w-full p-2 border rounded mb-2"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendTranscript();
            }
          }}
        />
        
        <Button 
          onClick={sendTranscript}
          disabled={isLoading}
          className="mb-4"
        >
          {isLoading ? "Sending..." : "Send to Agent"}
        </Button>
        
        <h3 className="font-semibold mb-2">Agent Response:</h3>
        <div className="bg-gray-100 p-4 rounded min-h-[100px] max-h-[300px] overflow-y-auto whitespace-pre-wrap">
          {response || "Agent response will appear here..."}
        </div>
      </div>
      
      {showStatus && (
        <div className="bg-blue-50 p-6 rounded-lg shadow-md mb-6 animate-fadeIn">
          <h3 className="text-lg font-semibold mb-3">Student Status</h3>
          <div className="mb-2">
            <strong>Name:</strong> {studentData.name}
          </div>
          <div className="mb-2">
            <strong>Listening:</strong> {studentData.progress.Listening}
          </div>
          <div className="mb-2">
            <strong>Speaking:</strong> {studentData.progress.Speaking}
          </div>
          <div className="mb-2">
            <strong>Writing:</strong> {studentData.progress.Writing}
          </div>
        </div>
      )}
      
      {showLearning && (
        <div className="bg-green-50 p-6 rounded-lg shadow-md mb-6 animate-fadeIn">
          <h3 className="text-lg font-semibold mb-3">Learning Session Started</h3>
          <p className="mb-2">
            Your learning session has begun! Focus on improving your skills.
          </p>
          <p>
            Today&apos;s recommended focus: <strong>Speaking Skills</strong>
          </p>
        </div>
      )}
    </div>
  );
}