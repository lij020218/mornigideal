"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Loader2, Sparkles, Volume2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JarvisAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(true); // We use our own voice API, no realtime socket needed
    const [isConnecting, setIsConnecting] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [reply, setReply] = useState("");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const disconnect = () => {
        if (isRecording) {
            stopRecording();
        }
        setIsOpen(false);
    };

    const toggleAssistant = () => {
        if (isOpen) {
            // stop recording if active
            if (isRecording) {
                stopRecording();
            }
            setIsOpen(false);
        } else {
            setIsOpen(true);
            setIsConnected(true);
        }
    };

    // Mic recording -> send to voice API
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                await sendAudio(blob);
                stream.getTracks().forEach((t) => t.stop());
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Mic access error:", error);
            alert("마이크 접근에 실패했어요. 권한을 확인해주세요.");
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const sendAudio = async (blob: Blob) => {
        setIsProcessing(true);
        setTranscript("");
        setReply("");
        try {
            const formData = new FormData();
            formData.append("audio", blob, "voice.webm");

            const res = await fetch("/api/openai/voice", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                throw new Error("Voice API error");
            }

            const data = await res.json();
            setTranscript(data.transcript || "");
            setReply(data.reply || "");

            if (data.audio) {
                const audioBlob = b64ToBlob(data.audio, data.audioContentType || "audio/mpeg");
                const url = URL.createObjectURL(audioBlob);
                if (!audioRef.current) {
                    audioRef.current = new Audio();
                }
                audioRef.current.src = url;
                audioRef.current.play().catch(() => {
                    console.warn("Autoplay blocked; user interaction required.");
                });
            }
        } catch (error) {
            console.error("Failed to process audio:", error);
            alert("음성 처리에 실패했어요. 다시 시도해 주세요.");
        } finally {
            setIsProcessing(false);
        }
    };

    const b64ToBlob = (b64Data: string, contentType = "audio/mpeg") => {
        const byteCharacters = atob(b64Data);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: contentType });
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl w-80"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
                                <h3 className="font-semibold text-white">Jarvis Assistant</h3>
                            </div>
                            <button
                                onClick={disconnect}
                                className="text-muted-foreground hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center py-8 gap-4">
                            <div className="relative">
                                <div className={`absolute inset-0 bg-blue-500/20 blur-xl rounded-full transition-all duration-500 ${isConnected ? "scale-150 opacity-100" : "scale-100 opacity-0"}`} />
                                <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${isConnected ? "border-blue-400 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.3)]" : "border-white/10 bg-white/5"}`}>
                                    {isConnecting ? (
                                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                    ) : (
                                        <Mic className={`w-8 h-8 ${isConnected ? "text-blue-400" : "text-muted-foreground"}`} />
                                    )}
                                </div>
                            </div>

                            <p className="text-sm text-center text-muted-foreground">
                                {isConnecting
                                    ? "Connecting to secure channel..."
                                    : isConnected
                                        ? isRecording
                                            ? "Recording... 말씀이 끝나면 버튼을 다시 눌러주세요."
                                            : isProcessing
                                                ? "응답 생성 중..."
                                                : "Tap mic to talk"
                                        : "음성 서비스를 사용할 수 없습니다"}
                            </p>

                            <div className="w-full space-y-2">
                                <div className="text-xs text-muted-foreground break-words">
                                    {transcript && (
                                        <p className="mb-1">
                                            <span className="font-semibold text-white">사용자:</span> {transcript}
                                        </p>
                                    )}
                                    {reply && (
                                        <p>
                                            <span className="font-semibold text-white">Jarvis:</span> {reply}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    variant={isRecording ? "destructive" : "secondary"}
                                    size="sm"
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isProcessing || isConnecting}
                                    className="flex items-center gap-2"
                                >
                                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    {isRecording ? "녹음 중지" : "말하기"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (audioRef.current) {
                                            audioRef.current.pause();
                                            audioRef.current.currentTime = 0;
                                        }
                                        if (reply && audioRef.current?.src) {
                                            audioRef.current.play().catch(() => {
                                                console.warn("Replay blocked");
                                            });
                                        }
                                    }}
                                    disabled={!reply}
                                    className="flex items-center gap-2"
                                >
                                    <Volume2 className="w-4 h-4" />
                                    다시 듣기
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleAssistant}
                        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${isOpen ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-br from-blue-600 to-purple-600 hover:shadow-blue-500/25"}`}
                    >
                        {isOpen ? (
                            <X className="w-6 h-6 text-white" />
                        ) : (
                    <Sparkles className="w-6 h-6 text-white" />
                )}
            </motion.button>
        </div>
    );
}
