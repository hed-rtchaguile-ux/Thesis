import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ApplicantRegistration.css'

const stepLabels = ['Groom Info', 'Bride Info', 'Legal Docs', 'Appointment', 'Payment', 'Review']

const documentFields = [
  { key: 'birthCertificateGroom', label: 'Birth Certificate (Groom) *' },
  { key: 'birthCertificateBride', label: 'Birth Certificate (Bride) *' },
  { key: 'certificateOfNoMarriage', label: 'Certificate of No Marriage (CENOMAR) *' },
  { key: 'validIdGroom', label: 'Valid ID (Groom) *' },
  { key: 'validIdBride', label: 'Valid ID (Bride) *' },
  { key: 'psaMarriageLicense', label: 'PSA Marriage License (if applicable)' },
]

const initialForm = {
  groomFullName: '',
  groomDob: '',
  groomGender: '',
  groomCivilStatus: '',
  groomMobile: '',
  groomEmail: '',
  brideFullName: '',
  brideDob: '',
  brideGender: '',
  brideCivilStatus: '',
  brideMobile: '',
  brideEmail: '',
  appointmentDate: '',
  appointmentTime: '',
  appointmentLocation: '',
  paymentMethod: 'Cash',
  paymentAmount: '₱ 800.00',
}

export default function ApplicantRegistration() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [documents, setDocuments] = useState({})
  const fileInputRefs = useRef({})

  const currentTitle = step === 1 ? 'Groom Info' : step === 2 ? 'Bride Info' : step === 3 ? 'Legal Docs' : step === 4 ? 'Appointment' : step === 5 ? 'Payment' : 'Review'
  const progressLabel = `Step ${step} of 6`

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, 6))
  }

  function prevStep() {
    setStep((current) => Math.max(current - 1, 1))
  }

  function handleDocumentSelect(key, event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setDocuments((current) => ({
      ...current,
      [key]: selectedFile.name,
    }))
  }

  const renderGroomBrideForm = () => (
    <>
      <div className="form-grid two-col">
        <div className="field-group">
          <label>Full Name *</label>
          <input
            value={step === 1 ? form.groomFullName : form.brideFullName}
            onChange={(e) => updateField(step === 1 ? 'groomFullName' : 'brideFullName', e.target.value)}
            placeholder={step === 1 ? 'Juan Dela Cruz' : 'Maria Santos'}
          />
        </div>

        <div className="field-group">
          <label>Date of Birth *</label>
          <div className="input-with-icon">
            <input
              value={step === 1 ? form.groomDob : form.brideDob}
              onChange={(e) => updateField(step === 1 ? 'groomDob' : 'brideDob', e.target.value)}
              placeholder="MM/DD/YYYY"
            />
            <span className="calendar-icon">🗓</span>
          </div>
        </div>

        <div className="field-group">
          <label>Gender *</label>
          <select
            value={step === 1 ? form.groomGender : form.brideGender}
            onChange={(e) => updateField(step === 1 ? 'groomGender' : 'brideGender', e.target.value)}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="field-group">
          <label>Civil Status *</label>
          <select
            value={step === 1 ? form.groomCivilStatus : form.brideCivilStatus}
            onChange={(e) => updateField(step === 1 ? 'groomCivilStatus' : 'brideCivilStatus', e.target.value)}
          >
            <option value="">Select Civil Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Separated">Separated</option>
          </select>
        </div>
      </div>

      <div className="form-grid two-col contact-row">
        <div className="field-group">
          <label>Mobile Number *</label>
          <input
            value={step === 1 ? form.groomMobile : form.brideMobile}
            onChange={(e) => updateField(step === 1 ? 'groomMobile' : 'brideMobile', e.target.value)}
            placeholder="09XX XXX XXXX"
          />
        </div>

        <div className="field-group">
          <label>Email Address *</label>
          <input
            value={step === 1 ? form.groomEmail : form.brideEmail}
            onChange={(e) => updateField(step === 1 ? 'groomEmail' : 'brideEmail', e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>
    </>
  )

  const renderDocumentUpload = () => (
    <div className="document-upload-wrapper">
      <div className="document-grid">
        {documentFields.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className="document-upload-card"
            onClick={() => fileInputRefs.current[key]?.click()}
          >
            <input
              ref={(element) => {
                fileInputRefs.current[key] = element
              }}
              type="file"
              onChange={(event) => handleDocumentSelect(key, event)}
              className="hidden-file-input"
            />
            <span className="upload-icon">⇪</span>
            <span className="upload-label">{label}</span>
            <span className="upload-file-name">{documents[key] ? documents[key] : 'Choose File'}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderAppointmentForm = () => (
    <div className="appointment-form-layout">
      <div className="appointment-fields">
        <div className="field-group">
          <label>Preferred Date *</label>
          <div className="input-with-icon">
            <input
              value={form.appointmentDate}
              onChange={(e) => updateField('appointmentDate', e.target.value)}
              placeholder="MM/DD/YYYY"
            />
            <span className="calendar-icon">🗓</span>
          </div>
        </div>

        <div className="field-group">
          <label>Preferred Time *</label>
          <select
            value={form.appointmentTime}
            onChange={(e) => updateField('appointmentTime', e.target.value)}
          >
            <option value="">Select Time</option>
            <option value="9:00 AM">9:00 AM</option>
            <option value="10:30 AM">10:30 AM</option>
            <option value="1:00 PM">1:00 PM</option>
            <option value="3:30 PM">3:30 PM</option>
          </select>
        </div>

        <div className="field-group">
          <label>Office Location *</label>
          <select
            value={form.appointmentLocation}
            onChange={(e) => updateField('appointmentLocation', e.target.value)}
          >
            <option value="">Select Location</option>
            <option value="Main Office">Main Office</option>
            <option value="Cebu Branch">Cebu Branch</option>
            <option value="Davao Branch">Davao Branch</option>
          </select>
        </div>
      </div>

      <div className="date-picker-panel">
        <div className="date-picker-header">
          <button type="button" className="date-nav-button" aria-label="Previous month">‹</button>
          <span>May 2025</span>
          <button type="button" className="date-nav-button" aria-label="Next month">›</button>
        </div>

        <div className="date-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="date-grid">
          {Array.from({ length: 35 }, (_, index) => {
            const day = index - 2
            const isEmpty = day <= 0 || day > 30
            const isSelected = day === 15

            return (
              <span key={index} className={`date-cell ${isEmpty ? 'muted' : ''} ${isSelected ? 'selected' : ''}`}>
                {!isEmpty ? Math.abs(day) : ''}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderPaymentForm = () => (
    <div className="payment-form-layout">
      <div className="field-group">
        <label>Payment Method *</label>
        <select
          value={form.paymentMethod}
          onChange={(e) => updateField('paymentMethod', e.target.value)}
        >
          <option value="Cash">Cash</option>
          <option value="Online Payment">Online Payment</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
      </div>

      <div className="field-group">
        <label>Amount *</label>
        <input
          value={form.paymentAmount}
          onChange={(e) => updateField('paymentAmount', e.target.value)}
          placeholder="₱ 800.00"
        />
      </div>
    </div>
  )

  const renderReviewSummary = () => (
    <div className="review-summary-layout">
      <div className="review-summary-header">
        <span className="review-title">Please review your information before submitting.</span>
      </div>

      <div className="review-grid">
        <div className="review-card">
          <div className="review-head">
            <span>Groom Information</span>
            <button type="button" className="review-edit">Edit</button>
          </div>
          <div className="review-body">
            <p><strong>{form.groomFullName || 'Juan Dela Cruz'}</strong></p>
            <p>{form.groomDob || '01/11/1995'}</p>
            <p>{form.groomGender || 'Male'}</p>
            <p>{form.groomCivilStatus || 'Single'}</p>
            <p>{form.groomMobile || '0917 123 4567'}</p>
            <p>{form.groomEmail || 'juan@email.com'}</p>
          </div>
        </div>

        <div className="review-card">
          <div className="review-head">
            <span>Bride Information</span>
            <button type="button" className="review-edit">Edit</button>
          </div>
          <div className="review-body">
            <p><strong>{form.brideFullName || 'Maria Santos'}</strong></p>
            <p>{form.brideDob || '02/12/1997'}</p>
            <p>{form.brideGender || 'Female'}</p>
            <p>{form.brideCivilStatus || 'Single'}</p>
            <p>{form.brideMobile || '0912 345 6789'}</p>
            <p>{form.brideEmail || 'maria@email.com'}</p>
          </div>
        </div>

        <div className="review-card">
          <div className="review-head">
            <span>Appointment</span>
            <button type="button" className="review-edit">Edit</button>
          </div>
          <div className="review-body">
            <p>{form.appointmentDate || 'May 15, 2025'}</p>
            <p>{form.appointmentTime || '9:00 AM'}</p>
            <p>{form.appointmentLocation || 'Main Office'}</p>
          </div>
        </div>

        <div className="review-card small-card">
          <div className="review-head">
            <span>Documents</span>
            <button type="button" className="review-edit">Edit</button>
          </div>
          <div className="review-body">
            <p>All documents uploaded</p>
            <p className="link-text">View Files</p>
          </div>
        </div>

        <div className="review-card small-card">
          <div className="review-head">
            <span>Payment</span>
            <button type="button" className="review-edit">Edit</button>
          </div>
          <div className="review-body">
            <p>{form.paymentMethod || 'Cash'}</p>
            <p className="amount-text">{form.paymentAmount || '₱ 800.00'}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="registration-page">
      <main className="registration-main">
        <div className="registration-header">
          <h1>{step === 4 ? 'Marriage Registration' : currentTitle}</h1>
          <div className="user-badge">
            <span className="user-avatar">JD</span>
            <span>John Dela Cruz</span>
            <span className="chevron">▾</span>
          </div>
        </div>

        <section className="registration-card">
          <div className="stepper">
            {stepLabels.map((label, index) => {
              const itemNumber = index + 1
              const isCurrent = step === itemNumber
              const isActive = itemNumber <= step

              return (
                <div key={label} className={`step-item ${isCurrent ? 'current' : ''} ${isActive ? 'active' : ''}`}>
                  <span className="step-number">{itemNumber}</span>
                  <span className="step-label">{label}</span>
                </div>
              )
            })}
          </div>

          <div className="form-section">
            <h2>{progressLabel}</h2>
            {step === 3 ? (
              <>
                <h3>Legal Docs</h3>
                <p className="section-subtitle">Upload the required documents for verification.</p>
                {renderDocumentUpload()}
              </>
            ) : step === 4 ? (
              <>
                <h3>Appointment</h3>
                <p className="section-subtitle">Select your preferred date and time for your appointment.</p>
                {renderAppointmentForm()}
              </>
            ) : step === 5 ? (
              <>
                <h3>Payment</h3>
                <p className="section-subtitle">Select your preferred payment method.</p>
                {renderPaymentForm()}
              </>
            ) : step === 6 ? (
              <>
                <h3>Review</h3>
                {renderReviewSummary()}
              </>
            ) : (
              <>
                <h3>{step === 1 ? 'Groom Info' : 'Bride Info'}</h3>
                {renderGroomBrideForm()}
              </>
            )}
          </div>

          <div className="form-actions">
            {step > 1 && (
              <button type="button" className="secondary-button" onClick={prevStep}>
                ← Back
              </button>
            )}

            <button type="button" className="primary-button" onClick={nextStep}>
              {step === 6 ? 'Submit Application' : step === 5 ? 'Review Application' : step === 3 ? 'Next: Appointment →' : `Next: ${stepLabels[step] || 'Next'} →`}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
