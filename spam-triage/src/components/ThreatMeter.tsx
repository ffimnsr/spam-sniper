interface ThreatMeterProps {
  status?: string;
  reportCount?: number;
  uniqueReporterCount?: number;
  found?: boolean;
}

export function ThreatMeter({
  status,
  reportCount = 0,
  uniqueReporterCount = 0,
  found = false,
}: ThreatMeterProps) {
  let level = 0;
  let levelName = "CLEAN // SECURE";
  let color = "text-[#00ff9d]";
  let barActiveColor = "bg-[#00ff9d] shadow-[0_0_10px_#00ff9d]";
  let description = "No hostile spam signals logged for this number.";

  if (!found) {
    level = 0;
    levelName = "CLEAN RECORD";
    color = "text-[#00ff9d]";
    barActiveColor = "bg-[#00ff9d] shadow-[0_0_10px_#00ff9d]";
    description = "No prior spam signatures detected in database.";
  } else if (status === "removed") {
    level = 0;
    levelName = "NEUTRALIZED / PURGED";
    color = "text-slate-400";
    barActiveColor = "bg-slate-400";
    description = "Record has been approved for removal and de-listed.";
  } else if (status === "verified_spam") {
    level = 3;
    levelName = "LEVEL 3 // CRITICAL THREAT";
    color = "text-[#ff0055]";
    barActiveColor = "bg-[#ff0055] shadow-[0_0_12px_#ff0055]";
    description =
      "High-confidence verified spam target confirmed by multiple independent reporters.";
  } else if (status === "suspected") {
    level = 2;
    levelName = "LEVEL 2 // ELEVATED THREAT";
    color = "text-amber-400";
    barActiveColor = "bg-amber-400 shadow-[0_0_12px_#f59e0b]";
    description =
      "Multiple spam incidents registered. High probability of malicious campaign.";
  } else if (status === "pending") {
    level = 1;
    levelName = "LEVEL 1 // EARLY SIGNAL";
    color = "text-cyan-400";
    barActiveColor = "bg-cyan-400 shadow-[0_0_10px_#00f0ff]";
    description =
      "Unconfirmed reports filed. Target queued for cross-reporter verification.";
  } else if (status === "under_removal_review") {
    level = 1;
    levelName = "DISPUTE IN PROGRESS";
    color = "text-purple-400";
    barActiveColor = "bg-purple-400 shadow-[0_0_10px_#a855f7]";
    description = "Removal contest window active. Target under review.";
  } else if (status === "disputed") {
    level = 2;
    levelName = "CONTESTED THREAT";
    color = "text-yellow-400";
    barActiveColor = "bg-yellow-400 shadow-[0_0_10px_#eab308]";
    description =
      "Contested by multiple parties. Locked awaiting administrative decision.";
  }

  return (
    <div className="rounded-sm border border-cyan-500/20 bg-[#070d1a] p-4 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 pb-2.5">
        <span className="text-xs uppercase tracking-widest text-slate-400">
          Target Threat Assessment
        </span>
        <span className={`text-xs font-bold tracking-widest ${color}`}>
          {levelName}
        </span>
      </div>

      {/* Segmented LED Threat Bars */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((step) => {
          const isActive = found && level >= step;
          return (
            <div
              key={step}
              className={`h-2 rounded-xs transition-all duration-300 ${
                isActive ? barActiveColor : "bg-slate-800/80"
              }`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>Signal Volume: {reportCount}</span>
        <span>Unique Nodes: {uniqueReporterCount}</span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {description}
      </p>
    </div>
  );
}
