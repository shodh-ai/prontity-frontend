import {
  ArrowLeftIcon,
  MicIcon,
  Square,
  Play,
  Pause,
  HeadphonesIcon,
} from "lucide-react";
import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

const progressSteps = [
  { active: true },
  { active: false },
  { active: false },
  { active: false },
  { active: false },
];

const formSteps = [
  {
    id: 1,
    title: "Hi there!",
    subtitle:
      "I'm Rox, your personal AI TOEFL tutor. To get started, what's your name?",
    placeholder: "Name",
    inputType: "text",
  },
  {
    id: 2,
    title: "Nice to meet you!",
    subtitle:
      "What's your main goal for using this tutor?  For example, are you aiming for a specific score, focusing on improving speaking, or something else?",
    placeholder: "I want to improve speaking fluency",
    inputType: "text",
  },
  {
    id: 3,
    title: "Great!",
    subtitle:
      "How do you generally feel about your current English skills when it comes to academic tasks like those on the TOEFL?",
    placeholder: "Speaking and writing still makes me nervous",
    inputType: "text",
  },
  {
    id: 4,
    title: "Perfect!",
    subtitle:
      "And how are you feeling about tackling the TOFEL exam itself right now?",
    placeholder: "A bit nervous but ready to try",
    inputType: "text",
  },
  {
    id: 5,
    title: "Almost done!",
    subtitle:
      "Okay, to give me a better sense of your speaking style, could you please tell me a little bit about [a simple engaging topic like ' a favourite memory' or 'a place you dream of visiting']? ",
    placeholder: "Voice recording",
    inputType: "voice",
  },
];

const MAX_RECORDING_TIME = 30;

const API_ENDPOINT = "http://localhost:8000/user/fill-details";
const API_ENDPOINT_LANGGRAPH = "http://localhost:8080/user/register";

export const RegistrationForm = () => {
  const router = useRouter();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    // Check for the token as soon as the component loads
    const token = localStorage.getItem("authToken");
    console.log("Token FOUND on RegistrationForm mount:", token);
  }, []); // To show loading state

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping on unmount
        }
      }
    };
  }, [audioUrl]);

  // Load saved data on component mount
  useEffect(() => {
    const savedDataString = localStorage.getItem("registrationFormData");
    if (savedDataString) {
      const savedData = JSON.parse(savedDataString);
      setFormData(savedData);

      const firstStepInfo = formSteps[0];
      const firstStepKey = firstStepInfo.placeholder
        .toLowerCase()
        .replace(/\s+/g, "_");
      if (
        currentStep === 0 &&
        savedData[firstStepKey] &&
        firstStepInfo.inputType === "text"
      ) {
        setCurrentInput(savedData[firstStepKey]);
      }
      const voiceStepIndex = formSteps.findIndex(
        (step) => step.inputType === "voice"
      );
      if (voiceStepIndex !== -1) {
        const voiceStepKey = formSteps[voiceStepIndex].placeholder
          .toLowerCase()
          .replace(/\s+/g, "_");
        if (
          savedData[voiceStepKey] &&
          typeof savedData[voiceStepKey] === "string"
        ) {
        }
      }
    }
  }, []); // Runs once on mount

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Unable to access microphone. Please check your permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
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
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
  const getProgressPercentage = () =>
    (recordingTime / MAX_RECORDING_TIME) * 100;

  const handleSubmitToBackend = async (dataToSubmit: Record<string, any>) => {
    console.log(
      "Initial dataToSubmit received by handleSubmitToBackend:",
      JSON.parse(JSON.stringify(dataToSubmit))
    );
    setIsSubmitting(true);
    try {
      const submissionPayload: Record<string, any> = {};
      const voiceStepPlaceholderKey = formSteps
        .find((step) => step.inputType === "voice")
        ?.placeholder.toLowerCase()
        .replace(/\s+/g, "_");

      console.log(
        "Building submission payload from dataToSubmit:",
        dataToSubmit
      );

      for (const key in dataToSubmit) {
        if (dataToSubmit.hasOwnProperty(key)) {
          if (key === voiceStepPlaceholderKey) {
            console.log(`Skipping voice data key: ${key}`);
            continue;
          }

          let targetKey = key;
          let value = dataToSubmit[key];

          if (key === "i_want_to_improve_speaking_fluency") {
            targetKey = "goal";
          } else if (key === "speaking_and_writing_still_makes_me_nervous") {
            targetKey = "feeling";
          } else if (key === "a_bit_nervous_but_ready_to_try") {
            targetKey = "confidence";
          }

          submissionPayload[targetKey] = value;
          console.log(`Added to submissionPayload: ${targetKey} = ${value}`);
        }
      }
      submissionPayload.analysis = "test";
      console.log(
        "Final submissionPayload before token retrieval and fetch:",
        submissionPayload
      );
      const token = localStorage.getItem("authToken");
      console.log("Retrieved token for submission:", token);

      if (!token) {
        alert("Authentication error: You are not logged in.");
        setIsSubmitting(false);
        return;
      }
      console.log("Sending JSON payload:", JSON.stringify(submissionPayload));

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(submissionPayload),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: "Failed to submit form. Server returned an error.",
        }));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Backend response:", result);

      const userId = result.user.id;
      console.log("User ID for AI backend submission:", userId);
      if (!userId) {
        alert("Could not find user ID for AI backend submission.");
      } else {
        const langgraphPayload = {
          ...submissionPayload,
          user_id: userId,
        };

        try {
          console.log(
            "Sending to LangGraph AI backend:",
            JSON.stringify(langgraphPayload)
          );
          const langgraphResponse = await fetch(API_ENDPOINT_LANGGRAPH, {
            method: "POST",
            body: JSON.stringify(langgraphPayload),
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!langgraphResponse.ok) {
            const errorData = await langgraphResponse
              .json()
              .catch(() => ({ message: "Failed to submit to AI backend." }));
            console.error("AI Backend submission failed:", errorData.message);
            alert(
              "Registration details submitted, but failed to update AI profile. Some features may be limited."
            );
          } else {
            const langgraphResult = await langgraphResponse.json();
            console.log("LangGraph AI Backend response:", langgraphResult);
            alert(
              "Registration successful! Your profile has been updated for the AI tutor."
            );
          }
        } catch (aiError) {
          console.error("Error submitting to AI backend:", aiError);
          alert(
            "Could not connect to the AI backend. Some features may be limited."
          );
        }
      }

      router.push("/dash_rox");
    } catch (error) {
      console.error("Error submitting form:", error);
      alert(
        `Submission failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    const currentStepInfo = formSteps[currentStep];
    const stepKey = currentStepInfo.placeholder
      .toLowerCase()
      .replace(/\s+/g, "_");
    let entryValue;

    if (currentStepInfo.inputType === "voice") {
      if (!audioBlob && !audioUrl) {
        console.warn("Attempting to proceed on voice step without audio.");
        return;
      }
      entryValue = audioBlob ? "recorded_audio_placeholder" : audioUrl;
    } else {
      if (!currentInput.trim()) {
        console.warn("Attempting to proceed on text step without input.");
        return;
      }
      entryValue = currentInput;
    }

    const newFormData = { ...formData, [stepKey]: entryValue };
    setFormData(newFormData);

    if (currentStep < formSteps.length - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);
      const nextStepInfo = formSteps[nextStepIndex];
      const nextStepKeyFromState = nextStepInfo.placeholder
        .toLowerCase()
        .replace(/\s+/g, "_");

      if (nextStepInfo.inputType === "text") {
        setCurrentInput(newFormData[nextStepKeyFromState] || "");
      } else if (nextStepInfo.inputType === "voice") {
        setCurrentInput("");
        const savedAudioData = newFormData[nextStepKeyFromState];
        if (savedAudioData === "recorded_audio_placeholder") {
          if (audioBlob && !audioUrl)
            setAudioUrl(URL.createObjectURL(audioBlob));
        } else if (
          typeof savedAudioData === "string" &&
          savedAudioData.startsWith("blob:")
        ) {
          setAudioUrl(savedAudioData);
          setAudioBlob(null);
          setRecordingTime(MAX_RECORDING_TIME);
        } else {
          setAudioUrl("");
          setAudioBlob(null);
          setRecordingTime(0);
        }
      } else {
        setCurrentInput("");
      }
    } else {
      console.log("Form data to be submitted from handleNext:", newFormData);
      handleSubmitToBackend(newFormData);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStepIndex = currentStep - 1;
      setCurrentStep(prevStepIndex);
      const prevStepInfo = formSteps[prevStepIndex];
      const stepKey = prevStepInfo.placeholder
        .toLowerCase()
        .replace(/\s+/g, "_");

      if (prevStepInfo.inputType === "text") {
        setCurrentInput(formData[stepKey] || "");
      } else if (prevStepInfo.inputType === "voice") {
        setCurrentInput("");
        const savedAudioData = formData[stepKey];
        if (
          typeof savedAudioData === "string" &&
          savedAudioData.startsWith("blob:")
        ) {
          setAudioUrl(savedAudioData);
          setAudioBlob(null);
          setRecordingTime(MAX_RECORDING_TIME);
        } else {
          setAudioUrl("");
          setAudioBlob(null);
          setRecordingTime(0);
        }
      } else {
        setCurrentInput("");
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNext();
  };

  const toggleSpeechToText = () => {
    if (isListening) {
      stopSpeechToText();
    } else {
      startSpeechToText();
    }
  };

  const startSpeechToText = () => {
    if (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      // @ts-ignore
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }
        setCurrentInput(transcript.trim());
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
    } else {
      alert(
        "Speech recognition is not supported in this browser. Try Chrome or Edge."
      );
    }
  };

  const stopSpeechToText = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
      }
      setIsListening(false);
    }
  };
  const currentFormStep = formSteps[currentStep];
  const updatedProgressSteps = progressSteps.map((step, index) => ({
    ...step,
    active: index <= currentStep,
  }));
  const canProceed =
    currentStep === 4 ? audioBlob !== null : currentInput.trim() !== "";

  const name = formData["name"];

  const renderInput = () => {
    if (currentFormStep.inputType === "voice") {
      return (
        <div className="w-full space-y-4">
          <div className="flex flex-col items-center space-y-6 p-6 border border-gray-200 rounded-lg bg-white/50">
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
                    {formatTime(recordingTime)} /{" "}
                    {formatTime(MAX_RECORDING_TIME)}
                  </div>
                </div>
              </div>
            )}
            {audioUrl && !isRecording && (
              // CHANGE: The send button is now inside this container
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
                {/* The "Send" button has been moved here */}
                <Button
                  className="h-12 w-12 p-3 bg-[#566FE9] hover:bg-[#4a5ed1] rounded-md flex items-center justify-center transition-colors duration-200 disabled:opacity-50"
                  aria-label="Continue"
                  onClick={handleNext}
                  disabled={!canProceed || isSubmitting}
                >
                  <img
                    src="/frame.svg"
                    alt="Continue"
                    className="w-full h-full"
                  />
                </Button>
              </div>
            )}
            <div className="text-center text-sm text-gray-600 max-w-md">
              {!audioUrl
                ? "Click the microphone to start/stop recording"
                : "Great! You can play back your recording or record a new one"}
            </div>
          </div>
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
    return (
      <div className="relative w-full">
        <Input
          className="h-12 border border-gray-300 rounded-md px-3 pr-12 text-sm flex-grow leading-[3rem] bg-white"
          placeholder={currentFormStep.placeholder}
          type={currentFormStep.inputType}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button
          type="button"
          className={`absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center ${
            isListening
              ? "bg-blue-100 text-blue-600"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
          onClick={toggleSpeechToText}
        >
          <HeadphonesIcon className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <div className="w-full flex justify-center p-4 pt-8">
        <div className="flex items-center justify-center gap-2.5 w-full max-w-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="p-1 h-auto hover:bg-gray-100 disabled:opacity-30"
          >
            <img src="/frame-1.svg" alt="Back" className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-1 w-full max-w-sm">
            {updatedProgressSteps.map((step, index) => (
              <div
                key={index}
                className={`w-full h-2.5 rounded transition-colors duration-300 ${
                  step.active ? "bg-[#566fe9]" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <div className="w-6 h-6 p-1"></div>
        </div>
      </div>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Card className="border-none shadow-none bg-transparent w-full">
            <CardContent className="p-0 space-y-3">
              <div className="font-label-extra-large font-[600] text-black text-[0.875rem] leading-[170%] tracking-normal transition-opacity duration-300">
                {currentStep === 1 && name ? (
                  <>
                    Nice to meet you,{" "}
                    <span className="text-[#566FE9]">{name}</span>!
                  </>
                ) : (
                  currentFormStep.title
                )}{" "}
                <br />
                {currentFormStep.subtitle}
              </div>
              {currentFormStep.inputType === "voice" ? (
                // CHANGE: The send button is now inside renderInput, so we don't need a wrapper here
                renderInput()
              ) : (
                <div className="flex items-center w-full space-x-2">
                  {renderInput()}
                  <Button
                    className="w-12 h-12 p-3 bg-[#566FE9] hover:bg-[#4a5ed1] rounded-md flex items-center justify-center shrink-0 disabled:opacity-50"
                    aria-label="Submit"
                    onClick={handleNext}
                    disabled={!canProceed || isSubmitting}
                  >
                    <img
                      src="/frame.svg"
                      alt="Submit"
                      className="w-full h-full"
                    />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {isSubmitting && (
            <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-20 backdrop-blur-sm">
              <p className="text-lg font-semibold p-4 bg-white rounded shadow-lg">
                Submitting...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};