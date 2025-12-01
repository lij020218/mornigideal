"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TrueFalseQuestion {
    question: string;
    answer: boolean;
    explanation: string;
    page: number;
}

interface MultipleChoiceQuestion {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
    page: number;
}

interface EssayQuestion {
    question: string;
    modelAnswer: string;
    keyPoints: string[];
    page: number;
}

interface Quiz {
    trueFalse: TrueFalseQuestion[];
    multipleChoice: MultipleChoiceQuestion[];
    essay: EssayQuestion[];
}

interface QuizViewProps {
    quiz: Quiz;
    onSubmit: (answers: any) => void;
}

export function QuizView({ quiz, onSubmit }: QuizViewProps) {
    const [currentSection, setCurrentSection] = useState<'tf' | 'mc' | 'essay'>('tf');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // User answers
    const [tfAnswers, setTfAnswers] = useState<(boolean | null)[]>(Array(5).fill(null));
    const [mcAnswers, setMcAnswers] = useState<(number | null)[]>(Array(5).fill(null));
    const [essayAnswers, setEssayAnswers] = useState<string[]>(Array(5).fill(''));

    const getCurrentQuestion = () => {
        if (currentSection === 'tf') return quiz.trueFalse[currentQuestionIndex];
        if (currentSection === 'mc') return quiz.multipleChoice[currentQuestionIndex];
        return quiz.essay[currentQuestionIndex];
    };

    const getTotalQuestions = () => {
        if (currentSection === 'tf') return quiz.trueFalse.length;
        if (currentSection === 'mc') return quiz.multipleChoice.length;
        return quiz.essay.length;
    };

    const getCurrentAnswer = () => {
        if (currentSection === 'tf') return tfAnswers[currentQuestionIndex];
        if (currentSection === 'mc') return mcAnswers[currentQuestionIndex];
        return essayAnswers[currentQuestionIndex];
    };

    const nextQuestion = () => {
        const total = getTotalQuestions();
        if (currentQuestionIndex < total - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // Move to next section
            if (currentSection === 'tf') {
                setCurrentSection('mc');
                setCurrentQuestionIndex(0);
            } else if (currentSection === 'mc') {
                setCurrentSection('essay');
                setCurrentQuestionIndex(0);
            }
        }
    };

    const previousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else {
            // Move to previous section
            if (currentSection === 'mc') {
                setCurrentSection('tf');
                setCurrentQuestionIndex(quiz.trueFalse.length - 1);
            } else if (currentSection === 'essay') {
                setCurrentSection('mc');
                setCurrentQuestionIndex(quiz.multipleChoice.length - 1);
            }
        }
    };

    const handleTFAnswer = (answer: boolean) => {
        const newAnswers = [...tfAnswers];
        newAnswers[currentQuestionIndex] = answer;
        setTfAnswers(newAnswers);
    };

    const handleMCAnswer = (optionIndex: number) => {
        const newAnswers = [...mcAnswers];
        newAnswers[currentQuestionIndex] = optionIndex;
        setMcAnswers(newAnswers);
    };

    const handleEssayAnswer = (text: string) => {
        const newAnswers = [...essayAnswers];
        newAnswers[currentQuestionIndex] = text;
        setEssayAnswers(newAnswers);
    };

    const handleSubmit = () => {
        onSubmit({
            trueFalse: tfAnswers,
            multipleChoice: mcAnswers,
            essay: essayAnswers,
        });
    };

    const isLastQuestion = currentSection === 'essay' && currentQuestionIndex === quiz.essay.length - 1;
    const allAnswered = tfAnswers.every(a => a !== null) &&
                        mcAnswers.every(a => a !== null) &&
                        essayAnswers.every(a => a.trim() !== '');

    const currentQ = getCurrentQuestion();
    const totalAnswered = [...tfAnswers.filter(a => a !== null), ...mcAnswers.filter(a => a !== null), ...essayAnswers.filter(a => a.trim() !== '')].length;

    return (
        <div className="space-y-6 animate-slide-up">
            {/* Progress Bar */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">
                        진행률: {totalAnswered}/15 문제 완료
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {currentSection === 'tf' ? '참/거짓' : currentSection === 'mc' ? '객관식' : '주관식'} {currentQuestionIndex + 1}/{getTotalQuestions()}
                    </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(totalAnswered / 15) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            </div>

            {/* Question Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`${currentSection}-${currentQuestionIndex}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="border border-white/10 rounded-xl p-6 bg-white/5 backdrop-blur-sm"
                >
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                                {currentSection === 'tf' ? 'T/F' : currentSection === 'mc' ? '객관식' : '주관식'}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                                슬라이드 {currentQ?.page || 'N/A'}
                            </span>
                        </div>
                        <span className="text-sm font-bold text-white">
                            문제 {(currentSection === 'tf' ? 0 : currentSection === 'mc' ? 5 : 10) + currentQuestionIndex + 1}
                        </span>
                    </div>

                    {/* Question Text */}
                    <h3 className="text-lg font-semibold mb-6 leading-relaxed text-white">
                        {currentQ?.question}
                    </h3>

                    {/* Answer Options */}
                    {currentSection === 'tf' && (
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={() => handleTFAnswer(true)}
                                variant={tfAnswers[currentQuestionIndex] === true ? "default" : "outline"}
                                className={`h-16 text-base ${
                                    tfAnswers[currentQuestionIndex] === true
                                        ? 'bg-green-500 hover:bg-green-600 border-green-400'
                                        : 'border-white/20 hover:border-green-400 hover:bg-green-500/10'
                                }`}
                            >
                                <Check className="w-5 h-5 mr-2" />
                                참 (True)
                            </Button>
                            <Button
                                onClick={() => handleTFAnswer(false)}
                                variant={tfAnswers[currentQuestionIndex] === false ? "default" : "outline"}
                                className={`h-16 text-base ${
                                    tfAnswers[currentQuestionIndex] === false
                                        ? 'bg-red-500 hover:bg-red-600 border-red-400'
                                        : 'border-white/20 hover:border-red-400 hover:bg-red-500/10'
                                }`}
                            >
                                <X className="w-5 h-5 mr-2" />
                                거짓 (False)
                            </Button>
                        </div>
                    )}

                    {currentSection === 'mc' && (
                        <div className="space-y-3">
                            {(currentQ as MultipleChoiceQuestion).options.map((option, idx) => (
                                <Button
                                    key={idx}
                                    onClick={() => handleMCAnswer(idx)}
                                    variant={mcAnswers[currentQuestionIndex] === idx ? "default" : "outline"}
                                    className={`w-full h-auto py-4 px-5 text-left justify-start whitespace-normal ${
                                        mcAnswers[currentQuestionIndex] === idx
                                            ? 'bg-primary border-primary'
                                            : 'border-white/20 hover:border-primary hover:bg-primary/10'
                                    }`}
                                >
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 mr-3 shrink-0 font-bold text-xs">
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm leading-relaxed">{option}</span>
                                </Button>
                            ))}
                        </div>
                    )}

                    {currentSection === 'essay' && (
                        <div>
                            <textarea
                                value={essayAnswers[currentQuestionIndex]}
                                onChange={(e) => handleEssayAnswer(e.target.value)}
                                placeholder="답변을 2-4 문장으로 작성하세요..."
                                className="w-full h-40 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none resize-none"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                {essayAnswers[currentQuestionIndex].length} 자
                            </p>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <Button
                    onClick={previousQuestion}
                    disabled={currentSection === 'tf' && currentQuestionIndex === 0}
                    variant="outline"
                    className="border-white/20"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    이전
                </Button>

                {isLastQuestion ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={!allAnswered}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        제출하기
                    </Button>
                ) : (
                    <Button
                        onClick={nextQuestion}
                        variant="outline"
                        className="border-white/20"
                    >
                        다음
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                )}
            </div>

            {/* Answer Status Grid */}
            <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-muted-foreground mb-3">문제별 답변 상태</p>
                <div className="grid grid-cols-15 gap-2">
                    {[...Array(15)].map((_, idx) => {
                        let isAnswered = false;
                        if (idx < 5) isAnswered = tfAnswers[idx] !== null;
                        else if (idx < 10) isAnswered = mcAnswers[idx - 5] !== null;
                        else isAnswered = essayAnswers[idx - 10].trim() !== '';

                        return (
                            <div
                                key={idx}
                                className={`w-full aspect-square rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
                                    isAnswered
                                        ? 'bg-primary text-white'
                                        : 'bg-white/10 text-gray-500'
                                }`}
                            >
                                {idx + 1}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
