"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
// @ts-ignore - The package is installed but types might be missing or experimental
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

export function JarvisAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const sessionRef = useRef<any>(null);

    const connectToRealtime = async () => {
        try {
            setIsConnecting(true);

            // 1. Get ephemeral token from our server
            const tokenResponse = await fetch("/api/openai/session", {
                method: "POST",
            });

            if (!tokenResponse.ok) {
                throw new Error("Failed to get ephemeral token");
            }

            const data = await tokenResponse.json();
            const ephemeralKey = data.client_secret.value; // Note: client_secret is an object { value: "...", expires_at: ... }

            // 2. Initialize Agent and Session
            const agent = new RealtimeAgent({
                name: "Jarvis",
                instructions: "You are Jarvis, a helpful and intelligent AI assistant for the user's daily productivity. You are concise, professional, and encouraging. You have access to the user's schedule and goals context (simulated for now).",
            });

            const session = new RealtimeSession(agent);
            sessionRef.current = session;

            // 3. Connect
            await session.connect({
                apiKey: ephemeralKey,
            });

            setIsConnected(true);
            console.log("Connected to OpenAI Realtime API");

        } catch (error) {
            console.error("Failed to connect:", error);
            alert("Failed to connect to Jarvis. Please try again.");
            setIsOpen(false);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = () => {
        if (sessionRef.current) {
            // Try to disconnect if method exists, otherwise just nullify
            try {
                sessionRef.current.disconnect?.();
            } catch (e) {
                console.warn("Disconnect method not found or failed", e);
            }
            sessionRef.current = null;
        }
        setIsConnected(false);
        setIsOpen(false);
    };

    const toggleAssistant = () => {
        if (isOpen) {
            disconnect();
        } else {
            setIsOpen(true);
            connectToRealtime();
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
                                {isConnecting ? "Connecting to secure channel..." : isConnected ? "Listening..." : "Initializing..."}
                            </p>
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
