export default function Loading() {
  return (
    <section
      className="journal-workbench journal-loading"
      aria-busy="true"
      aria-label="正在载入学习记录"
    >
      <span className="journal-eyebrow">
        <span className="atelier-beacon" data-tone="vermilion" aria-hidden="true" />
        FIELD JOURNAL // 私人学习记录
      </span>
      <h1>学习与复盘</h1>
      <p role="status">正在载入你的记录…</p>
      <div />
      <div />
      <div />
    </section>
  )
}
