function DataTable({ wrapClassName, tableClassName, columns, children }) {
  return (
    <div className={wrapClassName}>
      <table className={tableClassName}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
