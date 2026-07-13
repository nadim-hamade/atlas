/** The one brand moment: an editorial line that reveals per word on first open. */
export function IntroHero() {
  // Split into words but keep an italic emphasis on "traced".
  const words = ["Every", "claim,", "traced", "to", "a", "real", "paper."];

  return (
    <div className="select-none">
      <h1 className="font-serif text-[clamp(2.4rem,6vw,5rem)] font-normal leading-[1.05] tracking-[-0.02em] text-ink [text-wrap:balance]">
        {words.map((word, i) => (
          <span
            key={i}
            className="intro-word"
            style={{ "--i": i } as React.CSSProperties}
          >
            {i === 2 ? <em className="italic text-ink">{word}</em> : word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </h1>
      <p
        className="intro-word mt-6 font-mono text-[0.72rem] uppercase tracking-[0.28em] text-ink-faint"
        style={{ "--i": words.length } as React.CSSProperties}
      >
        plan · retrieve · read · write · verify
      </p>
    </div>
  );
}
