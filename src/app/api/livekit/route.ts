import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Get query params
  const url = new URL(req.url);
  const room = url.searchParams.get("room");
  const username = url.searchParams.get("username");

  // Validate the request
  if (!room) {
    return NextResponse.json(
      { error: "Missing 'room' query parameter" },
      { status: 400 }
    );
  }

  if (!username) {
    return NextResponse.json(
      { error: "Missing 'username' query parameter" },
      { status: 400 }
    );
  }

  // Read the API key and secret from environment variables
  // These should be set in your .env.local file
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration - missing LiveKit credentials" },
      { status: 500 }
    );
  }

  // Create a new token
  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
  });

  // Grant permissions to the user
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  // Generate the token
  const token = at.toJwt();

  // Return the token
  return NextResponse.json({ token });
}
