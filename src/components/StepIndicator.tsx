const STEPS = ["Identificación", "Doctor", "Horario", "Confirmación"];

/** `current` es 0-based: 0 = Identificación ... 3 = Confirmación. */
export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="steps">
      {STEPS.map((label, i) => (
        <li key={label} className={`step ${i === current ? "on" : ""} ${i < current ? "done" : ""}`}>
          {i + 1} · {label}
        </li>
      ))}
    </ol>
  );
}
