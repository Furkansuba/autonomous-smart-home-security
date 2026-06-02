function Badge({ baseClass, variant, children }) {
  return (
    <span className={`${baseClass} ${baseClass}--${variant}`}>
      {children}
    </span>
  )
}

export default Badge
