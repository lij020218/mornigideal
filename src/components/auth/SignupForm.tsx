"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SignupForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const name = formData.get("name") as string
        const username = formData.get("username") as string
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, username, email, password }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "회원가입에 실패했습니다.")
            }

            // 회원가입 성공 후 로그인 페이지로 이동
            router.push("/login?registered=true")
        } catch (err) {
            setError(err instanceof Error ? err.message : "오류가 발생했습니다.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-sm mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">회원가입</CardTitle>
                <CardDescription>
                    계정을 만들어 성장 여정을 시작하세요.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="grid gap-4">
                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                            {error}
                        </div>
                    )}
                    <div className="grid gap-2">
                        <Label htmlFor="name">이름</Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="홍길동"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="username">사용자명 (서비스에서 불릴 이름)</Label>
                        <Input
                            id="username"
                            name="username"
                            placeholder="gildong"
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            영문, 숫자, 밑줄(_)만 사용 가능합니다.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">이메일</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="example@email.com"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">비밀번호</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            minLength={6}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            최소 6자 이상 입력해주세요.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button className="w-full" type="submit" disabled={isLoading}>
                        {isLoading ? "가입 중..." : "계정 만들기"}
                    </Button>
                    <div className="text-sm text-center text-muted-foreground">
                        이미 계정이 있으신가요?{" "}
                        <Link href="/login" className="underline">
                            로그인
                        </Link>
                    </div>
                </CardFooter>
            </form>
        </Card>
    )
}
