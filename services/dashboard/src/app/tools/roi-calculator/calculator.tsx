"use client";

import { useState, useMemo } from "react";
import { Calculator, Users, MessageSquare, TrendingUp, Clock, DollarSign } from "lucide-react";

export default function RoiCalculator() {
  const [accounts, setAccounts] = useState(50);
  const [groups, setGroups] = useState(100);
  const [messagesPerDay, setMessagesPerDay] = useState(20);
  const [conversionRate, setConversionRate] = useState(3);

  const results = useMemo(() => {
    const totalMessages = accounts * messagesPerDay * 30;
    const leads = Math.round(totalMessages * (conversionRate / 100));
    const manualCostPerLead = 2;
    const manualCost = leads * manualCostPerLead;
    const ourCost = accounts <= 10 ? 75 : accounts <= 50 ? 199 : 499;
    const savings = Math.max(0, manualCost - ourCost);
    const roi = ourCost > 0 ? Math.round((savings / ourCost) * 100) : 0;
    const hoursSaved = Math.round((totalMessages * 2) / 60); // 2 min per manual message

    return { totalMessages, leads, manualCost, ourCost, savings, roi, hoursSaved };
  }, [accounts, groups, messagesPerDay, conversionRate]);

  const statCards = [
    { icon: Users, label: "Leads per month", value: results.leads.toLocaleString(), color: "text-emerald-400" },
    { icon: MessageSquare, label: "Messages sent", value: results.totalMessages.toLocaleString(), color: "text-blue-400" },
    { icon: DollarSign, label: "Monthly savings", value: `$${results.savings.toLocaleString()}`, color: "text-yellow-400" },
    { icon: Clock, label: "Hours saved", value: `${results.hoursSaved.toLocaleString()}h`, color: "text-purple-400" },
    { icon: TrendingUp, label: "ROI", value: `${results.roi}%`, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            Your Numbers
          </h2>

          <SliderInput
            label="Telegram accounts"
            value={accounts}
            onChange={setAccounts}
            min={1}
            max={200}
            suffix=" accounts"
          />
          <SliderInput
            label="Target groups"
            value={groups}
            onChange={setGroups}
            min={1}
            max={500}
            suffix=" groups"
          />
          <SliderInput
            label="Messages per account per day"
            value={messagesPerDay}
            onChange={setMessagesPerDay}
            min={5}
            max={50}
            suffix=" msgs/day"
          />
          <SliderInput
            label="Expected conversion rate"
            value={conversionRate}
            onChange={setConversionRate}
            min={1}
            max={20}
            suffix="%"
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Your Estimated Results</h2>
          <div className="grid grid-cols-2 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
                <div className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </div>
                <div className="text-sm text-zinc-500">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-sm text-zinc-500 mb-1">Recommended plan</div>
            <div className="text-lg font-bold text-emerald-400">
              {accounts <= 10
                ? "Starter — $25/mo"
                : accounts <= 50
                  ? "Pro — $75/mo"
                  : "Enterprise — $300/mo"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-sm text-zinc-400">{label}</label>
        <span className="text-sm font-medium text-zinc-200">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
      <div className="flex justify-between text-xs text-zinc-600 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
