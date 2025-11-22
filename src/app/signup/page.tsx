"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

export default function SignupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "회원가입 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }

            // Auto login after signup
            const result = await signIn("credentials", {
                email: formData.email,
                password: formData.password,
                redirect: false,
            });

            if (result?.error) {
                setError("회원가입은 완료되었으나 로그인에 실패했습니다. 다시 로그인해주세요.");
                setTimeout(() => router.push("/login"), 2000);
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch (err) {
            setError("회원가입 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.id]: e.target.value
        }));
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md glass-card">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
                    <CardDescription>
                        A.ideal과 함께 성장을 시작하세요
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">이름</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="홍길동"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">사용자명</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="username123"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">이메일</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="example@email.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">비밀번호</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="6자 이상"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                                disabled={loading}
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    회원가입 중...
                                </>
                            ) : (
                                "회원가입"
                            )}
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        <span className="text-muted-foreground">
                            이미 계정이 있으신가요?{" "}
                        </span>
                        <Link href="/login" className="text-primary hover:underline">
                            로그인
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
