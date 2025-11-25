"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// PCM16 helpers
function floatTo16BitPCM(float32Array: Float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buffer);
}

function base64FromPCM(uint8: Uint8Array) {
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
}

export function JarvisAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [assistantText, setAssistantText] = useState("");
    const [userText, setUserText] = useState("");

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioBuffersRef = useRef<Float32Array[]>([]);

    useEffect(() => {
        return () => {
            stopRecording();
            closeWs();
        };
    }, []);

    const closeWs = () => {
        wsRef.current?.close();
        wsRef.current = null;
        setIsConnected(false);
    };

    const connectWs = async () => {
        try {
            setIsConnecting(true);
            const tokenRes = await fetch("/api/openai/session", { method: "POST" });
            if (!tokenRes.ok) throw new Error("Failed to get client secret");
            const { client_secret } = await tokenRes.json();
            const secret = client_secret?.value;
            if (!secret) throw new Error("No client secret value");

            const ws = new WebSocket(
                `wss://api.openai.com/v1/realtime?model=gpt-realtime-2025-08-28&client_secret=${encodeURIComponent(
                    secret
                )}`,
                ["oai-realtime"]
            );
            wsRef.current = ws;

            ws.onopen = () => {
                // Authenticate
                ws.send(
                    JSON.stringify({
                        type: "session.update",
                        session: {
                            input_audio_format: "pcm16",
                            output_audio_format: "pcm16",
                            turn_detection: { type: "server_vad" },
                            input_audio_transcription: { model: "gpt-4o-audio-preview" },
                            instructions:
                                "You are Jarvis. Reply in concise Korean unless addressed in English. Be helpful for schedules, briefings, and daily tasks.",
                        },
                    })
                );
                setIsConnected(true);
                setAssistantText("");
                setUserText("");
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === "response.output_text.delta") {
                        setAssistantText((prev) => prev + (msg.delta || ""));
                    }
                    if (msg.type === "response.input_text") {
                        setUserText(msg.text || "");
                    }
                    if (msg.type === "response.output_audio.delta" && msg.delta) {
                        const audio = Uint8Array.from(atob(msg.delta), (c) => c.charCodeAt(0));
                        const float = new Float32Array(audio.length / 2);
                        const view = new DataView(audio.buffer);
                        for (let i = 0; i < float.length; i++) {
                            float[i] = view.getInt16(i * 2, true) / 0x8000;
                        }
                        audioBuffersRef.current.push(float);
                    }
                    if (msg.type === "response.completed") {
                        playBufferedAudio();
                    }
                } catch (err) {
                    console.warn("Failed to parse message", err);
                }
            };

            ws.onerror = (err) => {
                console.error("WS error", err);
                setIsConnected(false);
            };

            ws.onclose = () => {
                setIsConnected(false);
            };
        } catch (error) {
            console.error(error);
            alert("Realtime 연결에 실패했습니다.");
            closeWs();
        } finally {
            setIsConnecting(false);
        }
    };

    const playBufferedAudio = () => {
        if (!audioBuffersRef.current.length) return;
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        const combinedLength = audioBuffersRef.current.reduce((acc, arr) => acc + arr.length, 0);
        const combined = new Float32Array(combinedLength);
        let offset = 0;
        audioBuffersRef.current.forEach((arr) => {
            combined.set(arr, offset);
            offset += arr.length;
        });
        audioBuffersRef.current = [];

        const buffer = ctx.createBuffer(1, combined.length, ctx.sampleRate);
        buffer.copyToChannel(combined, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
    };

    const startRecording = async () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            alert("실시간 연결이 준비되지 않았습니다. 다시 시도해주세요.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            audioContextRef.current = audioContextRef.current || new AudioContext({ sampleRate: 16000 });
            const source = audioContextRef.current.createMediaStreamSource(stream);
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
                const floatData = e.inputBuffer.getChannelData(0);
                const pcm = floatTo16BitPCM(floatData);
                const b64 = base64FromPCM(pcm);
                wsRef.current?.send(
                    JSON.stringify({
                        type: "input_audio_buffer.append",
                        audio: b64,
                    })
                );
            };
            source.connect(processor);
            processor.connect(audioContextRef.current.destination);
            processorRef.current = processor;
            setIsRecording(true);
        } catch (err) {
            console.error("Mic error", err);
            alert("마이크 권한을 확인해주세요.");
        }
    };

    const stopRecording = () => {
        if (processorRef.current && audioContextRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
            wsRef.current.send(JSON.stringify({ type: "response.create" }));
        }
        setIsRecording(false);
    };

    const toggleAssistant = () => {
        if (isOpen) {
            stopRecording();
            closeWs();
            setIsOpen(false);
        } else {
            setIsOpen(true);
            connectWs();
        }
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
                                onClick={toggleAssistant}
                                className="text-muted-foreground hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center py-4 gap-2">
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
                                    ? "Connecting..."
                                    : isRecording
                                        ? "Recording... 버튼을 눌러 멈춰주세요."
                                        : isConnected
                                            ? "Tap mic to talk"
                                            : "Initializing..."}
                            </p>

                            <div className="w-full space-y-2 text-xs text-muted-foreground break-words">
                                {userText && (
                                    <p>
                                        <span className="font-semibold text-white">사용자:</span> {userText}
                                    </p>
                                )}
                                {assistantText && (
                                    <p>
                                        <span className="font-semibold text-white">Jarvis:</span> {assistantText}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    variant={isRecording ? "destructive" : "secondary"}
                                    size="sm"
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={!isConnected || isConnecting}
                                    className="flex items-center gap-2"
                                >
                                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    {isRecording ? "멈추기" : "말하기"}
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
