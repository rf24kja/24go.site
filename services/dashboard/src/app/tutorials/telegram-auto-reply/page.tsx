import type { Metadata } from "next";
import TutorialTemplate from "../template";

export const metadata: Metadata = {
  title: "How to Set Up Telegram Auto-Reply Bot — Complete Guide (2026) | 24GO",
  description: "Step-by-step guide to setting up automatic replies in Telegram. Respond to leads instantly with AI-powered or template replies.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/tutorials/telegram-auto-reply" },
};

export default function AutoReplyTutorial() {
  return (
    <TutorialTemplate
      title="How to Set Up Telegram Auto-Reply Bot"
      description="Respond to every lead instantly — even while you sleep. This guide shows you how to set up AI-powered or template auto-replies for Telegram."
      canonical="https://www.24go.site/tutorials/telegram-auto-reply"
      prerequisites={[
        "A Telegram account (6+ months old recommended)",
        "24GO account (free trial available)",
        "At least one Telegram group where your target audience hangs out",
      ]}
      steps={[
        {
          title: "Connect your Telegram account to 24GO",
          content: "Go to Accounts → Connect Account. Enter your phone number, verify with the code sent to Telegram. 24GO uses encrypted session storage — your credentials are never exposed.",
        },
        {
          title: "Enable the DM Listener",
          content: "Go to Listeners → Start Listener. This monitors incoming messages to your connected account. When someone messages you, 24GO captures the message and lead data.",
        },
        {
          title: "Configure auto-reply rules",
          content: "Go to Settings → AI Auto-Reply. Enable auto-replies and choose your mode: AI (generates unique responses using LLM) or Template (uses your pre-written replies).",
        },
        {
          title: "Set intent thresholds",
          content: "Configure which leads get auto-replies. AI replies work best for HOT leads (high purchase intent). Template replies handle WARM leads. COLD leads get no reply.",
        },
        {
          title: "Configure work hours and rate limits",
          content: "Set your timezone and working hours (e.g., 9am-9pm Bangkok time). Set max replies per hour to avoid looking spammy. Start with 5-10 replies/hour.",
        },
        {
          title: "Test with a real message",
          content: "Send a test message to your connected account from another phone. Verify the reply comes through, check timing, and adjust templates if needed.",
        },
      ]}
      mistakes={[
        "Starting with too many replies per hour — start low (5-10) and increase gradually",
        "Using the same template for all leads — personalize by intent level",
        "Ignoring work hours — auto-replying at 3am looks suspicious",
        "Not testing before going live — always test with a real message first",
        "Using a brand new account — wait at least 1-2 months before enabling auto-replies",
      ]}
      results={[
        "Instant response time (under 30 seconds)",
        "Higher lead conversion — leads responded to within 5 minutes convert 5x more",
        "24/7 coverage — never miss a lead, even while sleeping",
        "Consistent messaging — every lead gets the same quality response",
      ]}
    />
  );
}
