import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

declare module "next-auth" {
    interface User {
        username?: string
    }
    interface Session {
        user: {
            id?: string
            name?: string | null
            email?: string | null
            username?: string
        }
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        username?: string
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials)

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data

                    // Validate against user database via API route (Edge-compatible)
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"
                    const response = await fetch(`${baseUrl}/api/auth/validate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, password }),
                    })

                    const user = await response.json()

                    if (user) {
                        return {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            username: user.username,
                        }
                    }
                    return null
                }

                console.log("Invalid credentials")
                return null
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.username = user.username
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.username = token.username
            }
            return session
        },
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")
            if (isOnDashboard) {
                if (isLoggedIn) return true
                return false // Redirect unauthenticated users to login page
            } else if (isLoggedIn) {
                // Redirect logged-in users away from login/signup pages
                if (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup") {
                    return Response.redirect(new URL("/dashboard", nextUrl))
                }
            }
            return true
        },
    },
})
