import { randomBytes } from "node:crypto";
import { firebaseAdmin } from "@/lib/firebase/admin";
import { newSession, Session, SessionAction, SessionError, updateSession } from "@/lib/sessions";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return Response.json({ error: "Sign in first" }, { status: 401 });
    const { auth, db } = firebaseAdmin();
    let uid: string;
    try { uid = (await auth.verifyIdToken(token)).uid; }
    catch { return Response.json({ error: "Sign-in expired. Reconnect and try again." }, { status: 401 }); }
    const text = await request.text();
    if (text.length > 2048) throw new SessionError("Request too large", 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { throw new SessionError("Invalid request"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new SessionError("Invalid request");
    const name = typeof body.name === "string" ? body.name.trim().replace(/[\u0000-\u001f]/g, "").slice(0, 18) : "";
    if (body.action === "create") {
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = randomBytes(4).toString("hex").toUpperCase();
        const result = await db.ref(`sessions/${code}`).transaction(current => current === null
          ? newSession(uid, name || "Player 1", Date.now()) : undefined);
        if (result.committed) return Response.json({ code }, { headers: { "Cache-Control": "no-store" } });
      }
      throw new SessionError("Could not create session. Try again.", 503);
    }
    const actions: SessionAction[] = ["join", "start", "claim", "finish"];
    if (!actions.includes(body.action as SessionAction)) throw new SessionError("Invalid action");
    const code = typeof body.code === "string" ? body.code.toUpperCase() : "";
    if (!/^[A-F0-9]{8}$/.test(code)) throw new SessionError("Enter an 8-character session code");
    const reference = db.ref(`sessions/${code}`);
    const result = await reference.transaction((room: Session | null) => {
      // A cold SDK cache can yield null even when the room exists remotely.
      // Returning null lets Firebase compare the cached hash with the server
      // and rerun this callback with the current room. Undefined aborts early.
      if (!room) return null;
      return updateSession(room, uid, body.action as SessionAction, Date.now(), {
        name, index: typeof body.index === "number" ? body.index : undefined,
      });
    });
    if (!result.committed) throw new SessionError("Session changed. Try again.", 409);
    if (!result.snapshot.exists()) throw new SessionError("Session not found", 404);
    return Response.json({ code, serverNow: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SessionError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Session operation failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Session service unavailable. Check Firebase setup and try again." }, { status: 503 });
  }
}
