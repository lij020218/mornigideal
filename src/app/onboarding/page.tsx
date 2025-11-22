import { OnboardingWizard } from "@/components/features/onboarding/OnboardingWizard";

export default function OnboardingPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] -z-10" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] -z-10" />

            <OnboardingWizard />
        </div>
    );
}
