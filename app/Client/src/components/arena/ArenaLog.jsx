// Journal de combat : actions récentes, la plus récente en haut
function ArenaLog({ entries }) {
  return (
    <aside className="arena-log" aria-label="Journal de combat">
      <h2 className="arena-log-title">Journal</h2>
      <ol className="arena-log-list" aria-live="polite">
        {entries.length === 0 && <li className="arena-log-empty">La partie commence…</li>}
        {entries.map((entry) => (
          <li key={entry.id} className={`arena-log-entry arena-log-entry--${entry.kind} ${entry.mine ? 'is-mine' : ''}`}>
            {entry.text}
          </li>
        ))}
      </ol>
    </aside>
  )
}

export default ArenaLog
