import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 30% 40%, rgba(16,185,129,0.15) 0%, transparent 50%), " +
              "radial-gradient(circle at 70% 60%, rgba(59,130,246,0.1) 0%, transparent 50%)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              background: "#10b981",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "sans-serif",
            }}
          >
            24
          </div>
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "white",
              fontFamily: "sans-serif",
              letterSpacing: -1,
            }}
          >
            24GO
          </span>
        </div>
        <p
          style={{
            fontSize: 26,
            color: "#a1a1aa",
            fontFamily: "sans-serif",
            marginTop: 20,
            zIndex: 1,
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          AI-Powered Lead Generation from Telegram & VK
        </p>
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 40,
            zIndex: 1,
          }}
        >
          {["AI Classification", "Auto Warm-up", "Smart Campaigns"].map((f) => (
            <div
              key={f}
              style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 8,
                padding: "8px 16px",
                color: "#10b981",
                fontSize: 16,
                fontFamily: "sans-serif",
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
