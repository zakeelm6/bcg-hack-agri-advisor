// Stat: one number with its label and an optional unit, tabular and left-to-right in every language.
export function Stat({ value, unit, label, size = "md", className = "" }: { value: React.ReactNode; unit?: string; label: React.ReactNode; size?: "md" | "lg"; className?: string }) {
  return (
    <div className={className}>
      <div className={`font-display num leading-none ${size === "lg" ? "text-4xl" : "text-3xl"}`}>{value}{unit && <span className="ms-1 text-lg font-sans font-semibold text-text-2">{unit}</span>}</div>
      <div className="mt-1 text-sm text-text-2">{label}</div>
    </div>
  );
}
