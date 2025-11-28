"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2, BookOpen, Sparkles } from "lucide-react";

interface MaterialUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MaterialUploadDialog({ open, onOpenChange }: MaterialUploadDialogProps) {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [type, setType] = useState<"exam" | "work">("exam");
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validTypes = [
                "text/plain",
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ];
            if (validTypes.includes(selectedFile.type)) {
                setFile(selectedFile);
            } else {
                alert("지원하지 않는 파일 형식입니다. TXT, PDF, DOC, DOCX 파일만 업로드 가능합니다.");
            }
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            alert("파일을 선택해주세요.");
            return;
        }

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
                console.log("[Upload] Analysis complete:", data);

                if (!data.id) {
                    console.error("[Upload] No ID returned from API");
                    alert("분석은 완료되었으나 저장에 실패했습니다.");
                    return;
                }

                onOpenChange(false);
                console.log("[Upload] Navigating to:", `/analysis/${data.id}`);
                router.push(`/analysis/${data.id}`);
            } else {
                const error = await response.json();
                console.error("[Upload] API error:", error);
                alert(`분석 실패: ${error.error || error.details || "알 수 없는 오류"}`);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("자료 업로드 중 오류가 발생했습니다.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md border-none bg-black/90 backdrop-blur-xl text-white shadow-2xl p-0 overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

                <DialogHeader className="p-6 pb-2 relative z-10">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-white/10">
                            <FileText className="w-5 h-5 text-blue-400" />
                        </span>
                        자료 분석
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        AI가 자료를 분석하여 핵심 내용과 인사이트를 도출합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 p-6 pt-2 relative z-10">
                    {/* File Upload */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium text-gray-300">파일 선택</Label>
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative border border-white/10 bg-white/5 rounded-xl p-8 text-center hover:bg-white/10 transition-all duration-300 cursor-pointer group-hover:border-white/20">
                                <input
                                    type="file"
                                    accept=".txt,.pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer w-full h-full block">
                                    {file ? (
                                        <div className="flex flex-col items-center gap-3 animate-fade-in">
                                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{file.name}</p>
                                                <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={(e) => {
                                                e.preventDefault();
                                                setFile(null);
                                            }}>
                                                삭제
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <Upload className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                                    클릭하여 파일 업로드
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    PDF, TXT, DOC, DOCX (최대 10MB)
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Type Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium text-gray-300">자료 유형</Label>
                        <RadioGroup value={type} onValueChange={(value) => setType(value as "exam" | "work")} className="grid grid-cols-2 gap-3">
                            <div className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-300 ${type === 'exam' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                <RadioGroupItem value="exam" id="exam" className="sr-only" />
                                <Label htmlFor="exam" className="cursor-pointer block">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen className={`w-4 h-4 ${type === 'exam' ? 'text-blue-400' : 'text-gray-400'}`} />
                                        <span className={`font-semibold ${type === 'exam' ? 'text-blue-100' : 'text-gray-300'}`}>시험 자료</span>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        시험 대비를 위한<br />핵심 포인트 추출
                                    </p>
                                </Label>
                            </div>
                            <div className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-300 ${type === 'work' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                <RadioGroupItem value="work" id="work" className="sr-only" />
                                <Label htmlFor="work" className="cursor-pointer block">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className={`w-4 h-4 ${type === 'work' ? 'text-purple-400' : 'text-gray-400'}`} />
                                        <span className={`font-semibold ${type === 'work' ? 'text-purple-100' : 'text-gray-300'}`}>업무 자료</span>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        업무 효율을 위한<br />인사이트 도출
                                    </p>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={uploading}
                            className="flex-1 hover:bg-white/10 text-gray-400 hover:text-white"
                        >
                            취소
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!file || uploading}
                            className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-none shadow-lg shadow-blue-500/20 text-white"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    분석 중...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    분석 시작
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
