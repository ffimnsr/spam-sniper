interface ThreatMeterProps {
  status?: string;
  reportCount?: number;
  uniqueReporterCount?: number;
  recentUniqueReporterCount?: number;
  found?: boolean;
}

export function ThreatMeter({
  status,
  reportCount = 0,
  uniqueReporterCount = 0,
  recentUniqueReporterCount,
  found = false,
}: ThreatMeterProps) {
  let level = 0;
  let levelName = "CLEAN // SECURE";
  let color = "text-emerald-400";
  let barActiveColor = "bg-emerald-400 shadow-[0_0_10px_#00ff88]";
  let description = "No hostile spam signals logged for this number.";

  if (!found) {
    level = 0;
    levelName = "CLEAN RECORD";
    color = "text-emerald-400";
    barActiveColor = "bg-emerald-400 shadow-[0_0_10px_#00ff88]";
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
    color = "text-pink-400";
    barActiveColor = "bg-pink-400 shadow-[0_0_12px_#ff2a6d]";
    description =
      "High-confidence verified spam target confirmed by multiple independent reporters.";
  } else if (status === "suspected") {
    level = 2;
    levelName = "LEVEL 2 // ELEVATED THREAT";
    color = "text-amber-400";
    barActiveColor = "bg-amber-400 shadow-[0_0_12px_#ffe600]";
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
    barActiveColor = "bg-purple-400 shadow-[0_0_10px_#a45cff]";
    description = "Removal contest window active. Target under review.";
  } else if (status === "disputed") {
    level = 2;
    levelName = "CONTESTED THREAT";
    color = "text-yellow-400";
    barActiveColor = "bg-yellow-400 shadow-[0_0_10px_#ffe600]";
    description =
      "Contested by a reporter. Locked awaiting administrative decision.";
  }

  return (
    <div className="cyber-inset p-4 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-2.5 font-mono">
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
              className={`h-2 transition-all duration-300 ${
                isActive ? barActiveColor : "bg-slate-800/80"
              }`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>Signal Volume: {reportCount}</span>
        <span>Unique Nodes: {uniqueReporterCount}</span>
        {recentUniqueReporterCount !== undefined && (
          <span>Recent Nodes: {recentUniqueReporterCount}</span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {description}
      </p>
    </div>
  );
}
