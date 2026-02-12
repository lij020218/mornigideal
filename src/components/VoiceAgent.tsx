"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { MODELS } from "@/lib/models";

export default function VoiceAgent() {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);

    const start = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/openai/session", { method: "POST" });
            if (!res.ok) {
                throw new Error("Failed to fetch client_secret");
            }
            const { client_secret } = await res.json();
            if (!client_secret) throw new Error("No client_secret received");

            const pc = new RTCPeerConnection();
            pcRef.current = pc;

            // AI 오디오 재생
            const aiAudio = document.createElement("audio");
            aiAudio.autoplay = true;
            pc.ontrack = (event) => {
                aiAudio.srcObject = event.streams[0];
            };

            // 마이크 트랙 추가
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getTracks().forEach((t) => pc.addTrack(t, mic));

            // Offer 생성 및 로컬 설정
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Offer를 OpenAI WebRTC 엔드포인트로 전송
            const answerSdp = await fetch(
                `https://api.openai.com/v1/realtime?model=${MODELS.GPT_REALTIME}&client_secret=${client_secret}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/sdp" },
                    body: offer.sdp,
                }
            ).then((r) => r.text());

            await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
            setConnected(true);
        } catch (err) {
            console.error("VoiceAgent start error:", err);
            toast.error("음성 연결에 실패했습니다.");
            stop();
        } finally {
            setLoading(false);
        }
    };

    const stop = () => {
        pcRef.current?.getSenders().forEach((s) => s.track?.stop());
        pcRef.current?.close();
        pcRef.current = null;
        setConnected(false);
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-gray-900 text-white rounded-lg">
            <h2 className="text-xl font-bold">AIDEAL Voice Assistant</h2>
            {!connected ? (
                <button
                    onClick={start}
                    disabled={loading}
                    className="px-6 py-3 bg-green-500 text-black rounded-lg font-semibold disabled:opacity-50"
                >
                    {loading ? "연결 중..." : "🎤 대화 시작"}
                </button>
            ) : (
                <button
                    onClick={stop}
                    className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold"
                >
                    🛑 종료
                </button>
            )}
        </div>
    );
}
