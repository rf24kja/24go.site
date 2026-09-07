"use client";

import { useState } from "react";
import { Shield, CheckCircle, AlertTriangle, XCircle, ChevronRight } from "lucide-react";

const questions = [
  {
    q: "How old is your Telegram account?",
    options: [
      { label: "Less than 1 month", score: 0 },
      { label: "1-6 months", score: 1 },
      { label: "6+ months", score: 3 },
    ],
  },
  {
    q: "How many Telegram groups are you in?",
    options: [
      { label: "Less than 10", score: 1 },
      { label: "10-50", score: 3 },
      { label: "50+", score: 2 },
    ],
  },
  {
    q: "How many messages do you send per day?",
    options: [
      { label: "Less than 10", score: 3 },
      { label: "10-50", score: 2 },
      { label: "50+", score: 0 },
    ],
  },
  {
    q: "Do you use a proxy with this account?",
    options: [
      { label: "Yes, dedicated proxy", score: 3 },
      { label: "Yes, shared proxy", score: 1 },
      { label: "No proxy", score: 0 },
    ],
  },
  {
    q: "Is two-factor authentication (2FA) enabled?",
    options: [
      { label: "Yes", score: 3 },
      { label: "No", score: 0 },
    ],
  },
  {
    q: "How many contacts do you have?",
    options: [
      { label: "Less than 50", score: 1 },
      { label: "50-200", score: 3 },
      { label: "200+", score: 2 },
    ],
  },
  {
    q: "Do you use the same device/IP for this account?",
    options: [
      { label: "Yes, always", score: 3 },
      { label: "Sometimes switch", score: 1 },
      { label: "Frequently change", score: 0 },
    ],
  },
  {
    q: "Has this account been restricted or banned before?",
    options: [
      { label: "Never", score: 3 },
      { label: "Once, months ago", score: 1 },
      { label: "Recently or multiple times", score: 0 },
    ],
  },
];

const getRecommendations = (answers: number[]) => {
  const recs: string[] = [];
  if (answers[0] === 0) recs.push("Wait 1-2 months before mass outreach. New accounts are flagged more easily.");
  if (answers[1] === 1) recs.push("Join 10-20 relevant groups first. This builds account history and credibility.");
  if (answers[2] === 0) recs.push("Reduce daily messages to under 50. High volume triggers spam detection.");
  if (answers[3] === 0) recs.push("Use a dedicated proxy. Sharing IPs with other accounts increases ban risk.");
  if (answers[4] === 0) recs.push("Enable 2FA immediately. It's required for API access and shows account legitimacy.");
  if (answers[6] === 0) recs.push("Avoid frequently changing devices. Consistent device usage reduces ban risk.");
  if (answers[7] !== 0) recs.push("Monitor this account closely. Previously restricted accounts need slower warmup.");
  return recs;
};

export default function AccountChecker() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const totalScore = answers.reduce((a, b) => a + b, 0);
  const maxScore = questions.length * 3;
  const percentage = Math.round((totalScore / maxScore) * 100);

  const handleAnswer = (score: number) => {
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      setFinished(true);
    }
  };

  const getRating = () => {
    if (percentage >= 80) return { label: "Excellent", color: "text-emerald-400", icon: CheckCircle, desc: "Your account is well-prepared for automated outreach." };
    if (percentage >= 60) return { label: "Good", color: "text-blue-400", icon: CheckCircle, desc: "Your account is ready with minor improvements." };
    if (percentage >= 40) return { label: "Fair", color: "text-yellow-400", icon: AlertTriangle, desc: "Your account needs some work before mass outreach." };
    return { label: "At Risk", color: "text-rose-400", icon: XCircle, desc: "Your account is not ready. Follow the recommendations below." };
  };

  if (finished) {
    const rating = getRating();
    const recs = getRecommendations(answers);

    return (
      <div className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <rating.icon className={`w-16 h-16 mx-auto mb-4 ${rating.color}`} />
          <div className={`text-3xl font-bold mb-2 ${rating.color}`}>{rating.label}</div>
          <div className="text-zinc-400 mb-4">{rating.desc}</div>
          <div className="flex items-center justify-center gap-3">
            <div className="text-sm text-zinc-500">Score:</div>
            <div className="text-lg font-bold text-zinc-200">{totalScore}/{maxScore}</div>
            <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${percentage >= 60 ? "bg-emerald-500" : percentage >= 40 ? "bg-yellow-500" : "bg-rose-500"}`} style={{ width: `${percentage}%` }} />
            </div>
            <div className="text-sm text-zinc-500">{percentage}%</div>
          </div>
        </div>

        {recs.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-bold mb-3">Recommendations</h3>
            <ul className="space-y-2">
              {recs.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <ChevronRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => { setCurrent(0); setAnswers([]); setFinished(false); }}
          className="w-full py-3 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition"
        >
          Check Another Account
        </button>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>Question {current + 1} of {questions.length}</span>
        <span>{Math.round(((current) / questions.length) * 100)}% complete</span>
      </div>
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(current / questions.length) * 100}%` }} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">{q.q}</h3>
        <div className="space-y-3">
          {q.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleAnswer(opt.score)}
              className="w-full text-left px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 hover:border-emerald-500 hover:bg-zinc-700 transition"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
