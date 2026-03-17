"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { OnboardingSteps } from "./onboarding-steps";

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("sp-onboarding-dismissed") === "1") setDismissed(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("sp-onboarding-dismissed", "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Welcome to StatusPulse</CardTitle>
        <p className="text-sm text-muted-foreground">
          Get started by adding vendors to monitor. It takes less than a minute.
        </p>
      </CardHeader>
      <CardContent>
        <OnboardingSteps step={step} onNext={() => setStep((s) => s + 1)} onDismiss={dismiss} />
      </CardContent>
    </Card>
  );
}
