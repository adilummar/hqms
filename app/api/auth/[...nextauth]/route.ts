// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"; // Adjust this import path if necessary

export const { GET, POST } = handlers;