import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { z } from "zod"
import { validateUser } from "@/lib/users"

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
        accessToken?: string
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        username?: string
        accessToken?: string
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
                    access_type: "offline",
                    prompt: "consent",
                }
            }
        }),
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

                    try {
                        // Direct call to validation logic, bypassing API route
                        const user = await validateUser(email, password)

                        if (user) {
                            return {
                                id: user.id,
                                name: user.name,
                                email: user.email,
                                username: user.username,
                            }
                        }
                    } catch (error) {
                        console.error("Auth error:", error)
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
        async jwt({ token, user, account }) {
            if (user) {
                token.username = user.username
            }
            if (account?.access_token) {
                token.accessToken = account.access_token
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.username = token.username
            }
            if (token.accessToken) {
                session.accessToken = token.accessToken as string
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
