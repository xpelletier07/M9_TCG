// Bannière plein écran au changement de tour
function TurnBanner({ banner }) {
  if (!banner) return null
  return (
    <div key={banner.id} className={`arena-banner ${banner.mine ? 'is-mine' : 'is-theirs'}`} role="status">
      <span>{banner.text}</span>
    </div>
  )
}

export default TurnBanner
