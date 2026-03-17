"use client";

import { Check, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { AddAlertDialog } from "./add-alert-dialog";
import { CatalogDialog } from "./catalog-dialog";

interface Props {
  step: number;
  onNext: () => void;
  onDismiss: () => void;
}

const steps = [
  { title: "Add vendors to monitor", description: "Browse the catalog and add your SaaS vendors" },
  { title: "Set up alerts", description: "Get notified via Slack, Teams, or webhook" },
  { title: "You're all set!", description: "Your dashboard will update automatically" },
];

export function OnboardingSteps({ step, onNext, onDismiss }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className={`flex-1 border p-3 ${i === step ? "border-primary bg-accent" : i < step ? "border-primary/30" : "border-border"}`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {i < step ? (
                <Check className="h-4 w-4 text-status-operational" />
              ) : (
                <span className="text-muted-foreground">{i + 1}</span>
              )}
              {s.title}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {step === 0 && (
          <>
            <CatalogDialog />
            <Button variant="ghost" size="sm" onClick={onNext}>
              Skip <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        )}
        {step === 1 && (
          <>
            <AddAlertDialog />
            <Button variant="ghost" size="sm" onClick={onNext}>
              Skip <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        )}
        {step === 2 && (
          <Button size="sm" onClick={onDismiss}>
            Go to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
