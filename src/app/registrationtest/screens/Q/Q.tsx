import { ArrowLeftIcon, ArrowRightIcon, MicIcon, Square, Play, Pause } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

// Define progress steps data
const progressSteps = [
  { active: true },
  { active: false },
  { active: false },
  { active: false },
  { active: false },
];

// Define form steps
const formSteps = [
  {
    id: 1,
    title: "Hi there!",
    subtitle: "I'm Rox, your personal AI TOEFL tutor. To get started, what's your name?",
    placeholder: "Name",
    inputType: "text"
  },
  {
    id: 2,
    title: "Nice to meet you!",
    subtitle: "What's your main goal for using this tutor?  For example, are you aiming for a specific score, focusing on improving speaking, or something else?",
    placeholder: "I want to improve speaking fluency",
    inputType: "text"
  },  
  {
    id: 3,
    title: "Great!",
    subtitle: "How do you generally feel about your current English skills when it comes to academic tasks like those on the TOEFL?",
    placeholder: "Speaking and writing still makes me nervous",
    inputType: "text"
  },
  {
    id: 4,
    title: "Perfect!",
    subtitle: "And how are you feeling about tackling the TOFEL exam itself right now?",
    placeholder: "A bit nervous but ready to try",
    inputType: "text"
  },
  {
    id: 5,
    title: "Almost done!",
    subtitle: "Okay, to give me a better sense of your speaking style, could you please tell me a little bit about [a simple engaging topic like ' a favourite memory' or 'a place you dream of visiting']? ",
    placeholder: "Voice recording",
    inputType: "voice"
  }
];

const MAX_RECORDING_TIME = 30; // 30 seconds

export const Q = (): JSX.Element => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [currentInput, setCurrentInput] = useState("");
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop recording when reaching 30 seconds
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return (recordingTime / MAX_RECORDING_TIME) * 100;
  };

  const handleNext = () => {
    if (currentStep === 4) {
      // For voice recording step, check if we have an audio recording
      if (audioBlob) {
        const stepKey = formSteps[currentStep].placeholder.toLowerCase().replace(/\s+/g, '_');
        setFormData(prev => ({ ...prev, [stepKey]: 'recorded' }));
        
        if (currentStep < formSteps.length - 1) {
          setCurrentStep(prev => prev + 1);
          setCurrentInput("");
        }
      }
    } else if (currentInput.trim()) {
      // Save current input to form data
      const stepKey = formSteps[currentStep].placeholder.toLowerCase().replace(/\s+/g, '_');
      setFormData(prev => ({ ...prev, [stepKey]: currentInput }));
      
      // Move to next step
      if (currentStep < formSteps.length - 1) {
        setCurrentStep(prev => prev + 1);
        setCurrentInput("");
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      // Restore previous input
      const stepKey = formSteps[currentStep - 1].placeholder.toLowerCase().replace(/\s+/g, '_');
      setCurrentInput(formData[stepKey] || "");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  const currentFormStep = formSteps[currentStep];
  const updatedProgressSteps = progressSteps.map((step, index) => ({
    ...step,
    active: index <= currentStep
  }));

  const renderInput = () => {
    if (currentFormStep.inputType === "voice") {
      return (
        <div className="w-full space-y-4">
          <div className="flex flex-col items-center space-y-6 p-6 border border-[#566fe933] rounded-lg bg-white/50">
            {/* Recording controls */}
            <div className="flex items-center space-x-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="h-16 w-16 rounded-full bg-[#566fe9] hover:bg-[#4a5ed1] flex items-center justify-center"
                  disabled={isRecording}
                >
                  <MicIcon className="w-8 h-8 text-white" />
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center animate-pulse"
                >
                  <Square className="w-8 h-8 text-white fill-white" />
                </Button>
              )}
            </div>

            {/* Progress bar and timer */}
            {isRecording && (
              <div className="w-full max-w-xs space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-[#566fe9] h-2 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-red-500 font-semibold">Recording...</div>
                  <div className="text-sm text-gray-600">
                    {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                  </div>
                </div>
              </div>
            )}

            {/* Playback controls */}
            {audioUrl && !isRecording && (
              <div className="flex items-center space-x-4">
                <Button
                  onClick={isPlaying ? pauseRecording : playRecording}
                  className="h-12 w-12 rounded-full bg-[#566fe9] hover:bg-[#4a5ed1] flex items-center justify-center"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" />
                  )}
                </Button>
                <span className="text-sm text-gray-600">
                  Recording saved • {formatTime(recordingTime)}
                </span>
              </div>
            )}

            {/* Instructions */}
            <div className="text-center text-sm text-gray-600 max-w-md">
              {!audioUrl ? (
                <>
                  Click the microphone to start/stop recording
                  <br />
                  {/* <span className="text-xs text-gray-500">Maximum 30 seconds</span> */}
                </>
              ) : (
                "Great! You can play back your recording or record a new one"
              )}
            </div>
          </div>

          {/* Hidden audio element for playback */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}
        </div>
      );
    }

    // All other steps use basic text input
    return (
      <Input
        className="h-12 border border-[#566fe933] rounded-md pl-4"
        placeholder={currentFormStep.placeholder}
        type={currentFormStep.inputType}
        value={currentInput}
        onChange={(e) => setCurrentInput(e.target.value)}
        onKeyPress={handleKeyPress}
      />
    );
  };

  const canProceed = currentStep === 4 ? audioBlob !== null : currentInput.trim() !== "";

  return (
    <main className="bg-white flex flex-row justify-center w-full min-h-screen">
      <div className="bg-white overflow-hidden w-full max-w-[1440px] h-[820px] relative">
        {/* Background elements */}
        <div className="absolute w-[753px] h-[753px] top-[-859px] right-[-572px] bg-[#566fe9] rounded-full" />
        <div className="absolute w-[353px] h-[353px] bottom-[-464px] left-[-36px] bg-[#336de6] rounded-full" />

        {/* Backdrop blur container */}
        <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px]">
          <img
            className="absolute w-[1392px] h-[746px] top-[24px] left-[24px]"
            alt="Background shape"
            src="/union.svg"
          />
        </div>

        {/* Progress indicator - moved to top */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="p-1 h-auto hover:bg-transparent disabled:opacity-30"
          >
            <ArrowLeftIcon className="w-6 h-6 text-[#566fe9]" />
          </Button>
          <div className="flex items-center gap-1">
            {updatedProgressSteps.map((step, index) => (
              <div
                key={index}
                className={`w-[90px] h-2.5 rounded transition-colors duration-300 ${
                  step.active ? "bg-[#566fe9]" : "bg-[#566fe926]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Avatar/logo */}
        <div className="absolute w-[90px] h-[90px] bottom-[75px] left-1/2 -translate-x-1/2">
          <div className="relative h-[90px]">
            <div className="absolute w-[63px] h-[63px] top-3.5 left-3.5 bg-[#566fe9] rounded-[31.5px] blur-[50px]" />
            <img
              className="absolute w-[90px] h-[90px] top-0 left-0"
              alt="Rox avatar"
              src="/screenshot-2025-06-09-at-2-47-05-pm-2.png"
            />
          </div>
        </div>

        {/* Content area */}
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
          {/* Chat message and input */}
          <Card className="border-none shadow-none bg-transparent max-w-[500px]">
            <CardContent className="p-0 space-y-3">
              <div className="font-label-extra-large font-[600] text-black text-[14px] leading-[170%] tracking-[0px] transition-opacity duration-300">
                {currentFormStep.title} <br />
                {currentFormStep.subtitle}
              </div>

              {currentFormStep.inputType === "voice" ? (
                <div className="space-y-4">
                  {renderInput()}
                  <div className="flex justify-end">
                    <Button
                      className="h-12 w-12 p-0 bg-[#566fe9] hover:bg-[#4a5ed1] rounded-md flex items-center justify-center transition-colors duration-200 disabled:opacity-50"
                      aria-label="Continue"
                      onClick={handleNext}
                      disabled={!canProceed}
                    >
                      <ArrowRightIcon className="w-4 h-4 text-white" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {renderInput()}
                  <Button
                    className="h-12 w-12 p-0 bg-[#566fe9] hover:bg-[#4a5ed1] rounded-md flex items-center justify-center transition-colors duration-200 disabled:opacity-50"
                    aria-label="Submit"
                    onClick={handleNext}
                    disabled={!canProceed}
                  >
                    <ArrowRightIcon className="w-4 h-4 text-white" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};