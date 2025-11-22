"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authenticate } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import Link from "next/link"

export default function LoginForm() {
    const router = useRouter()
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined
    )

    // Handle post-login routing
    useEffect(() => {
        if (errorMessage === "SUCCESS") {
            // Check if user has completed onboarding
            const hasProfile = localStorage.getItem("user_profile")

            if (hasProfile) {
                router.push("/dashboard")
            } else {
                router.push("/onboarding")
            }
        }
    }, [errorMessage, router])

    return (
        <Card className="w-full max-w-sm mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Login</CardTitle>
                <CardDescription>
                    Enter your email below to login to your account.
                </CardDescription>
            </CardHeader>
            <form action={formAction}>
                <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            placeholder="m@example.com"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" name="password" required />
                    </div>
                    {errorMessage && errorMessage !== "SUCCESS" && (
                        <div className="text-sm text-red-500">
                            {errorMessage}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button className="w-full" disabled={isPending}>
                        {isPending ? "Logging in..." : "Sign in"}
                    </Button>
                    <div className="text-sm text-center text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="underline">
                            Sign up
                        </Link>
                    </div>
                </CardFooter>
            </form>
        </Card>
    )
}
