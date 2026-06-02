export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle-btn"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? '☀' : '☽'}
    </button>
  )
}
