import { XIcon } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

export const WritingPrompt = (): JSX.Element => {
  const navigate = useNavigate();

  const handleStartWriting = () => {
    navigate("/writing");
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute w-[753px] h-[753px] top-0 right-0 bg-[#566fe9] rounded-[376.5px] -z-10" />
      <div className="absolute w-[353px] h-[353px] bottom-0 left-0 bg-[#336de6] rounded-[176.5px] -z-10" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] -z-10" />

      {/* Main content card */}
      <Card className="w-[1280px] h-[740px] bg-white rounded-xl border-none m-4 relative">
        <CardContent className="p-6">
          {/* Close button */}
          <button className="absolute top-4 right-4">
            <XIcon className="h-6 w-6" />
          </button>

          {/* Progress section */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base">
              Writing Practice Session
            </h1>
            <div className="w-[610px]">
              <Progress value={28} className="bg-[#c7ccf8] opacity-20" />
            </div>
          </div>

          {/* Main content */}
          <div className="max-w-3xl mx-auto mt-16 space-y-12">
            <div className="space-y-6">
              <h2 className="text-4xl font-semibold text-center">
                Write an essay about the impact of technology on modern education
              </h2>
              <p className="text-lg text-center text-gray-600">
                Consider both positive and negative effects, and discuss how educational institutions can adapt to technological changes.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Key points to consider:</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-600">
                <li>The role of online learning platforms</li>
                <li>Impact on student engagement and participation</li>
                <li>Changes in teaching methodologies</li>
                <li>Digital literacy and its importance</li>
                <li>Challenges and opportunities in implementing technology</li>
              </ul>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                className="px-8 py-2 border-[#566fe9] text-[#566fe9]"
                onClick={() => navigate("/writing")}
              >
                Skip
              </Button>
              <Button
                className="px-8 py-2 bg-[#566fe9] text-white hover:bg-[#4559ba]"
                onClick={handleStartWriting}
              >
                Start Writing
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};