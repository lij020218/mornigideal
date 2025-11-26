"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, BookOpen, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MaterialUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MaterialUploadDialog({ isOpen, onClose }: MaterialUploadDialogProps) {
    const router = useRouter();
    const [type, setType] = useState<"exam" | "work">("work");
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", type);

            const response = await fetch("/api/analyze-material", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                router.push(`/analysis/${data.id}`);
            }
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6"
                >
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-white">자료 분석</h2>
                        <Button
                            onClick={onClose}
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground hover:text-white hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                자료 유형
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setType("exam")}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
                                        type === "exam"
                                            ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20"
                                    )}
                                >
                                    <BookOpen className={cn("w-6 h-6", type === "exam" ? "text-blue-400" : "text-muted-foreground")} />
                                    <div className="text-sm font-medium">시험용</div>
                                </button>
                                <button
                                    onClick={() => setType("work")}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
                                        type === "work"
                                            ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20"
                                    )}
                                >
                                    <Briefcase className={cn("w-6 h-6", type === "work" ? "text-purple-400" : "text-muted-foreground")} />
                                    <div className="text-sm font-medium">업무용</div>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                파일 첨부
                            </label>
                            <div className="border border-dashed border-white/20 rounded-xl p-8 text-center hover:border-white/40 transition-colors bg-white/5">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    accept=".txt,.pdf,.doc,.docx"
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="cursor-pointer flex flex-col items-center gap-3"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                        <Upload className="w-6 h-6 text-gray-400" />
                                    </div>
                                    {file ? (
                                        <div className="text-sm text-white font-medium flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" />
                                            {file.name}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="text-sm text-gray-300 font-medium">
                                                파일을 선택하거나 드래그하세요
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                TXT, PDF, DOC, DOCX (최대 10MB)
                                            </div>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={!file || uploading}
                        className="w-full py-6 text-base font-semibold bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
                    >
                        {uploading ? "분석 중..." : "분석 시작"}
                    </Button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
