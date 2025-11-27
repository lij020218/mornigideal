"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2 } from "lucide-react";

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
                onOpenChange(false);
                router.push(`/analysis/${data.id}`);
            } else {
                const error = await response.json();
                alert(`분석 실패: ${error.error || "알 수 없는 오류"}`);
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>자료 분석</DialogTitle>
                    <DialogDescription>
                        분석할 자료를 업로드하고 유형을 선택해주세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label>파일 선택</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                            <input
                                type="file"
                                accept=".txt,.pdf,.doc,.docx"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                {file ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        <span className="text-sm font-medium">{file.name}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className="w-8 h-8 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                            클릭하여 파일 선택
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            TXT, PDF, DOC, DOCX
                                        </span>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Type Selection */}
                    <div className="space-y-3">
                        <Label>자료 유형</Label>
                        <RadioGroup value={type} onValueChange={(value) => setType(value as "exam" | "work")}>
                            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                                <RadioGroupItem value="exam" id="exam" />
                                <Label htmlFor="exam" className="flex-1 cursor-pointer">
                                    <div>
                                        <div className="font-medium">시험 자료</div>
                                        <div className="text-xs text-muted-foreground">
                                            시험 대비를 위한 학습 자료
                                        </div>
                                    </div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                                <RadioGroupItem value="work" id="work" />
                                <Label htmlFor="work" className="flex-1 cursor-pointer">
                                    <div>
                                        <div className="font-medium">업무 자료</div>
                                        <div className="text-xs text-muted-foreground">
                                            업무 처리를 위한 실무 자료
                                        </div>
                                    </div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={uploading}
                        className="flex-1"
                    >
                        취소
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!file || uploading}
                        className="flex-1 gap-2"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                분석 중...
                            </>
                        ) : (
                            "분석 시작"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
