export default function DocumentPreview({ label, value }) {
  if (typeof value !== 'string' || !value) {
    return <p className="document-preview-unavailable">Preview unavailable</p>
  }

  if (value.startsWith('data:image/')) {
    return (
      <a className="document-preview-image-link" href={value} target="_blank" rel="noreferrer" aria-label={`Open ${label} image`}>
        <img className="document-preview-image" src={value} alt={label} loading="lazy" />
      </a>
    )
  }

  if (value.startsWith('data:application/pdf')) {
    return (
      <div className="document-preview-pdf">
        <object data={value} type="application/pdf" aria-label={label}>
          <a href={value} download={`${label}.pdf`}>Open PDF document</a>
        </object>
      </div>
    )
  }

  if (value.startsWith('data:')) {
    return <p className="document-preview-unavailable">This document format cannot be previewed.</p>
  }

  return <p className="document-preview-filename">{value}</p>
}
