import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function LoadingView() {
    const loadingMessages = [
        "학습 프로필 분석 중...",
        "맞춤형 커리큘럼 설계 중...",
        "핵심 학습 내용 생성 중...",
        "퀴즈 및 요약 정리 중...",
        "학습 환경 구성 중..."
    ];
    const [msgIndex, setMsgIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % loadingMessages.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className="absolute w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl"
            />

            <div className="relative z-10 flex flex-col items-center gap-8">
                {/* Animated Loader */}
                <div className="relative">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-24 h-24 rounded-full border-t-4 border-l-4 border-primary border-r-transparent border-b-transparent"
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-2 rounded-full border-b-4 border-r-4 border-purple-500 border-t-transparent border-l-transparent"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                </div>

                {/* Text Animation */}
                <div className="h-8 flex items-center justify-center overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={msgIndex}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-lg font-medium text-primary/80"
                        >
                            {loadingMessages[msgIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
