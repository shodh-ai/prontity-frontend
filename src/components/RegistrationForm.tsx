import { ArrowLeftIcon, MicIcon, Square, Play, Pause } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

const progressSteps = [
  { active: true }, { active: false }, { active: false }, { active: false }, { active: false },
];

const formSteps = [
  { id: 1, title: "Hi there!", subtitle: "I'm Rox, your personal AI TOEFL tutor. To get started, what's your name?", placeholder: "Name", inputType: "text" },
  { id: 2, title: "Nice to meet you!", subtitle: "What's your main goal for using this tutor?  For example, are you aiming for a specific score, focusing on improving speaking, or something else?", placeholder: "I want to improve speaking fluency", inputType: "text" },
  { id: 3, title: "Great!", subtitle: "How do you generally feel about your current English skills when it comes to academic tasks like those on the TOEFL?", placeholder: "Speaking and writing still makes me nervous", inputType: "text" },
  { id: 4, title: "Perfect!", subtitle: "And how are you feeling about tackling the TOFEL exam itself right now?", placeholder: "A bit nervous but ready to try", inputType: "text" },
  { id: 5, title: "Almost done!", subtitle: "Okay, to give me a better sense of your speaking style, could you please tell me a little bit about [a simple engaging topic like ' a favourite memory' or 'a place you dream of visiting']? ", placeholder: "Voice recording", inputType: "voice" }
];

const MAX_RECORDING_TIME = 30;

export const RegistrationForm = (): JSX.Element => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [currentInput, setCurrentInput] = useState("");
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
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
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
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const playRecording = () => { if (audioUrl && audioRef.current) { audioRef.current.play(); setIsPlaying(true); } };
  const pauseRecording = () => { if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); } };
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  const getProgressPercentage = () => (recordingTime / MAX_RECORDING_TIME) * 100;

  const handleNext = () => {
    if (currentStep === 4) {
      if (audioBlob) {
        const stepKey = formSteps[currentStep].placeholder.toLowerCase().replace(/\s+/g, '_');
        setFormData(prev => ({ ...prev, [stepKey]: 'recorded' }));
        if (currentStep < formSteps.length - 1) { setCurrentStep(prev => prev + 1); setCurrentInput(""); }
      }
    } else if (currentInput.trim()) {
      const stepKey = formSteps[currentStep].placeholder.toLowerCase().replace(/\s+/g, '_');
      setFormData(prev => ({ ...prev, [stepKey]: currentInput }));
      if (currentStep < formSteps.length - 1) { setCurrentStep(prev => prev + 1); setCurrentInput(""); }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      const stepKey = formSteps[currentStep - 1].placeholder.toLowerCase().replace(/\s+/g, '_');
      setCurrentInput(formData[stepKey] || "");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleNext(); };
  const currentFormStep = formSteps[currentStep];
  const updatedProgressSteps = progressSteps.map((step, index) => ({ ...step, active: index <= currentStep }));
  const canProceed = currentStep === 4 ? audioBlob !== null : currentInput.trim() !== "";

  const renderInput = () => {
    if (currentFormStep.inputType === "voice") {
      return (
        <div className="w-full space-y-4">
          <div className="flex flex-col items-center space-y-6 p-6 border border-[#566fe933] rounded-lg bg-white/50">
            <div className="flex items-center space-x-4">
              {!isRecording ? (
                <Button onClick={startRecording} className="h-16 w-16 rounded-full bg-[#566fe9] hover:bg-[#4a5ed1] flex items-center justify-center" disabled={isRecording}>
                  <MicIcon className="w-8 h-8 text-white" />
                </Button>
              ) : (
                <Button onClick={stopRecording} className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center animate-pulse">
                  <Square className="w-8 h-8 text-white fill-white" />
                </Button>
              )}
            </div>
            {isRecording && (
              <div className="w-full max-w-xs space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-[#566fe9] h-2 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${getProgressPercentage()}%` }} />
                </div>
                <div className="text-center">
                  <div className="text-red-500 font-semibold">Recording...</div>
                  <div className="text-sm text-gray-600">{formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}</div>
                </div>
              </div>
            )}
            {audioUrl && !isRecording && (
              <div className="flex items-center space-x-4">
                <Button onClick={isPlaying ? pauseRecording : playRecording} className="h-12 w-12 rounded-full bg-[#566fe9] hover:bg-[#4a5ed1] flex items-center justify-center">
                  {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                </Button>
                <span className="text-sm text-gray-600">Recording saved • {formatTime(recordingTime)}</span>
              </div>
            )}
            <div className="text-center text-sm text-gray-600 max-w-md">
              {!audioUrl ? "Click the microphone to start/stop recording" : "Great! You can play back your recording or record a new one"}
            </div>
          </div>
          {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}
        </div>
      );
    }
    return (
      <Input
        className="h-12 border border-gray-300 rounded-md px-3 text-sm flex-grow leading-[3rem]"
        placeholder={currentFormStep.placeholder}
        type={currentFormStep.inputType}
        value={currentInput}
        onChange={(e) => setCurrentInput(e.target.value)}
        onKeyPress={handleKeyPress}
      />
    );
  };

  return (
    <main className="bg-white flex flex-row justify-center w-full min-h-screen">
      <div className="bg-white overflow-hidden w-full max-w-[90rem] h-[51.25rem] relative">
        <div className="absolute w-[47.0625rem] h-[47.0625rem] top-[-53.6875rem] right-[-35.75rem] bg-[#566fe9] rounded-full" />
        <div className="absolute w-[22.0625rem] h-[22.0625rem] bottom-[-29rem] left-[-2.25rem] bg-[#336de6] rounded-full" />
        <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[12.5rem]">
          <img className="absolute w-[87rem] h-[46.625rem] top-[1.5rem] left-[1.5rem]" alt="Background shape" src="/union.svg" />
        </div>
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-10">
          <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={currentStep === 0} className="p-1 h-auto hover:bg-transparent disabled:opacity-30">
            <ArrowLeftIcon className="w-6 h-6 text-[#566fe9]" />
          </Button>
          <div className="flex items-center gap-1">
            {updatedProgressSteps.map((step, index) => (
              <div key={index} className={`w-[5.625rem] h-2.5 rounded transition-colors duration-300 ${step.active ? "bg-[#566fe9]" : "bg-[#566fe926]"}`} />
            ))}
          </div>
        </div>
        <div className="absolute w-[5.625rem] h-[5.625rem] bottom-[4.6875rem] left-1/2 -translate-x-1/2">
          <div className="relative h-[5.625rem]">
            <div className="absolute w-[3.9375rem] h-[3.9375rem] top-3.5 left-3.5 bg-[#566fe9] rounded-[1.96875rem] blur-[3.125rem]" />
            <img className="absolute w-[5.625rem] h-[5.625rem] top-0 left-0" alt="Rox avatar" src="/screenshot-2025-06-09-at-2-47-05-pm-2.png" />
          </div>
        </div>
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
          <Card className="border-none shadow-none bg-transparent w-full max-w-[31.25rem]">
            <CardContent className="p-0 space-y-3">
              <div className="font-label-extra-large font-[600] text-black text-[0.875rem] leading-[170%] tracking-normal transition-opacity duration-300">
                {currentFormStep.title} <br />
                {currentFormStep.subtitle}
              </div>
              {currentFormStep.inputType === "voice" ? (
                <div className="space-y-4">
                  {renderInput()}
                  <div className="flex justify-end">
                    <Button className="h-12 w-12 p-0 bg-[#566fe9] hover:bg-[#4a5ed1] rounded-md flex items-center justify-center transition-colors duration-200 disabled:opacity-50" aria-label="Continue" onClick={handleNext} disabled={!canProceed}>
                      <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="40" height="40" rx="4" fill="#566FE9"/>
                        <path d="M22.2075 9.79251C22.0818 9.66685 21.9248 9.57697 21.7528 9.53215C21.5807 9.48733 21.3998 9.48918 21.2288 9.53751H21.2194L9.22313 13.1775C9.02838 13.2336 8.85528 13.3476 8.72677 13.5044C8.59826 13.6611 8.52041 13.8532 8.50353 14.0551C8.48666 14.2571 8.53155 14.4594 8.63227 14.6353C8.73299 14.8112 8.88477 14.9523 9.06751 15.04L14.375 17.625L16.9563 22.9294C17.0365 23.1007 17.1642 23.2455 17.3241 23.3466C17.484 23.4477 17.6696 23.501 17.8588 23.5C17.8875 23.5 17.9163 23.4988 17.945 23.4963C18.1468 23.4799 18.3388 23.4022 18.4952 23.2737C18.6516 23.1451 18.765 22.9717 18.82 22.7769L22.4575 10.7806C22.4575 10.7775 22.4575 10.7744 22.4575 10.7713C22.5065 10.6006 22.5091 10.42 22.4652 10.248C22.4212 10.076 22.3323 9.91878 22.2075 9.79251ZM17.8644 22.4906L17.8613 22.4994V22.495L15.3575 17.3513L18.3575 14.3513C18.4473 14.2567 18.4966 14.1309 18.495 14.0005C18.4933 13.8701 18.4408 13.7455 18.3486 13.6533C18.2564 13.5611 18.1318 13.5086 18.0014 13.5069C17.871 13.5052 17.7452 13.5546 17.6506 13.6444L14.6506 16.6444L9.50501 14.1406H9.50063H9.50938L21.5 10.5L17.8644 22.4906Z" fill="white"/>
                      </svg>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center w-full space-x-2">
                  {renderInput()}
                  <Button
                    className="p-0 w-12 h-12 bg-[#566FE9] hover:bg-[#4a5ed1] rounded-md flex items-center justify-center shrink-0 disabled:opacity-50"
                    aria-label="Submit"
                    onClick={handleNext}
                    disabled={!canProceed}
                  >
                    <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="40" height="40" rx="4" fill="#566FE9"/>
                        <path d="M22.2075 9.79251C22.0818 9.66685 21.9248 9.57697 21.7528 9.53215C21.5807 9.48733 21.3998 9.48918 21.2288 9.53751H21.2194L9.22313 13.1775C9.02838 13.2336 8.85528 13.3476 8.72677 13.5044C8.59826 13.6611 8.52041 13.8532 8.50353 14.0551C8.48666 14.2571 8.53155 14.4594 8.63227 14.6353C8.73299 14.8112 8.88477 14.9523 9.06751 15.04L14.375 17.625L16.9563 22.9294C17.0365 23.1007 17.1642 23.2455 17.3241 23.3466C17.484 23.4477 17.6696 23.501 17.8588 23.5C17.8875 23.5 17.9163 23.4988 17.945 23.4963C18.1468 23.4799 18.3388 23.4022 18.4952 23.2737C18.6516 23.1451 18.765 22.9717 18.82 22.7769L22.4575 10.7806C22.4575 10.7775 22.4575 10.7744 22.4575 10.7713C22.5065 10.6006 22.5091 10.42 22.4652 10.248C22.4212 10.076 22.3323 9.91878 22.2075 9.79251ZM17.8644 22.4906L17.8613 22.4994V22.495L15.3575 17.3513L18.3575 14.3513C18.4473 14.2567 18.4966 14.1309 18.495 14.0005C18.4933 13.8701 18.4408 13.7455 18.3486 13.6533C18.2564 13.5611 18.1318 13.5086 18.0014 13.5069C17.871 13.5052 17.7452 13.5546 17.6506 13.6444L14.6506 16.6444L9.50501 14.1406H9.50063H9.50938L21.5 10.5L17.8644 22.4906Z" fill="white"/>
                    </svg>
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
