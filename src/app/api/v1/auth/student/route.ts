import { cookies } from "next/headers";
import { z } from "zod";

import { getDb } from "@/db/client";
import { body, privateJson, problem } from "@/lib/api";
import { checkStudentPin, STUDENT_COOKIE, studentSignInReady, studentToken } from "@/modules/auth/student-session";

/** A class student signs in with the class code, their username and PIN (no email). */
export async function POST(req: Request) {
  if (!studentSignInReady()) return problem(503, "Student sign-in is not set up yet");
  const b = await body(
    req,
    z.object({
      joinCode: z.string().trim().min(4).max(12),
      username: z.string().trim().min(1).max(40),
      pin: z.string().regex(/^\d{4,6}$/),
    }),
  );
  if (b.error) return b.error;
  const r = await checkStudentPin(await getDb(), b.data);
  if (!r.ok) return problem(r.reason === "locked" ? 429 : 401, "Sign-in failed", { reason: r.reason });
  const token = studentToken(r.studentId);
  (await cookies()).set(STUDENT_COOKIE, token.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: token.maxAge,
  });
  return privateJson({ ok: true });
}
