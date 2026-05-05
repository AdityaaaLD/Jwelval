export default function StatusBadge({ status }) {
  const cls =
    status === 'PRINTED' ? 'badge-printed' :
    status === 'LOCKED'  ? 'badge-locked'  : 'badge-draft'
  return <span className={cls}>{status}</span>
}
