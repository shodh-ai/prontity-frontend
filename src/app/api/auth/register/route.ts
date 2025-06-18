import { NextResponse } from "next/server";
import type { RegisterRequestPayload, RegisterResponsePayload } from "@/types/register-payload";
import type { ErrorPayload } from "@/types/error-payload";

export async function POST(request: Request) {
  try {
    const user_data = (await request.json()) as RegisterRequestPayload;

    const backendUrl = process.env.BACKEND_URL;

    if (!backendUrl) {
      console.error(
        "ERROR: [API Route /api/auth/register] BACKEND_URL is not defined."
      );
      return NextResponse.json<ErrorPayload>(
        { message: "Server configuration error: Backend URL not set." },
        { status: 500 }
      );
    }

    const finalAuthUrl = new URL("auth/register", backendUrl).toString();
    const response = await fetch(finalAuthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user_data),
    });

    const contentType = response.headers.get("content-type");
    let responseData: any;
    const responseText = await response.text();

    if (contentType && contentType.includes("application/json")) {
      try {
        responseData = JSON.parse(responseText);
      } catch (e: any) {
        console.error(
          "[API Route /api/auth/register] Failed to parse backend JSON response:",
          e.message
        );
        console.error(
          "[API Route /api/auth/register] Raw backend response text:",
          responseText
        );
        return NextResponse.json<ErrorPayload>(
          { message: "Received malformed JSON response from backend.", rawResponse: responseText },
          { status: 502 }
        );
      }
    } else {
      console.warn(
        "[API Route /api/auth/register] Backend response is not JSON. Raw text:",
        responseText
      );
      if (!response.ok) {
        return NextResponse.json<ErrorPayload>(
          { message: `Backend returned non-JSON error (status: ${response.status}). See server logs for raw response.`, rawResponse: responseText },
          { status: response.status }
        );
      }
      responseData = {
        message: "Backend returned non-JSON success response.",
        content: responseText,
      };
    }

    if (!response.ok) {
      console.error(
        `[API Route /api/auth/register] Error from backend (status ${response.status}):`,
        responseData
      );
      return NextResponse.json<ErrorPayload>(
        {
          message: responseData?.message || `Backend error: ${response.status}`,
          details: responseData,
        },
        { status: response.status }
      );
    }

    return NextResponse.json<RegisterResponsePayload>(responseData, { status: 200 });
  } catch (error: any) {
    console.error("[API Route /api/auth/register] Internal error:", error);
    return NextResponse.json<ErrorPayload>(
      { message: error.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
