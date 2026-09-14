import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
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
  appointmentDate: 'To be assigned by office',
  appointmentTime: '',
  appointmentLocation: 'Villaverde',
  paymentMethod: 'Cash',
  paymentAmount: '₱ 800.00',
}

const namePattern = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidDate(value) {
  const normalizedValue = value.replace(/-/g, '/')
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalizedValue)
  if (!match) return false

  const [, month, day, year] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
    && date < new Date()
}

function formatDateInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function FieldError({ message }) {
  return message ? <span className="field-error" role="alert">{message}</span> : null
}

export default function ApplicantRegistration() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [documents, setDocuments] = useState({})
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileInputRefs = useRef({})

  const currentTitle = step === 1 ? 'Groom Info' : step === 2 ? 'Bride Info' : step === 3 ? 'Legal Docs' : step === 4 ? 'Appointment' : step === 5 ? 'Payment' : 'Review'
  const progressLabel = `Step ${step} of 6`
  const person = step === 1 ? 'groom' : 'bride'

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setValidationErrors((current) => ({ ...current, [field]: '' }))
  }

  function nextStep() {
    const errors = validateStep(step)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setStep((current) => Math.min(current + 1, 6))
  }

  function prevStep() {
    setStep((current) => Math.max(current - 1, 1))
  }

  function validateStep(currentStep) {
    const errors = {}
    const prefix = currentStep === 1 ? 'groom' : 'bride'

    if (currentStep === 1 || currentStep === 2) {
      const name = form[`${prefix}FullName`].trim()
      const mobile = form[`${prefix}Mobile`].replace(/\D/g, '')
      const email = form[`${prefix}Email`].trim()

      if (!name) errors[`${prefix}FullName`] = 'Full name is required.'
      else if (!namePattern.test(name)) errors[`${prefix}FullName`] = 'Use letters, spaces, apostrophes, or hyphens only.'
      if (!isValidDate(form[`${prefix}Dob`])) errors[`${prefix}Dob`] = 'Enter a valid past date as MM/DD/YYYY.'
      if (!form[`${prefix}Gender`]) errors[`${prefix}Gender`] = 'Select a gender.'
      if (!form[`${prefix}CivilStatus`]) errors[`${prefix}CivilStatus`] = 'Select a civil status.'
      if (!/^09\d{9}$/.test(mobile)) errors[`${prefix}Mobile`] = 'Enter an 11-digit mobile number starting with 09.'
      if (!emailPattern.test(email)) errors[`${prefix}Email`] = 'Enter a valid email address.'
    }

    if (currentStep === 3) {
      documentFields.filter(({ label }) => label.endsWith('*')).forEach(({ key }) => {
        if (!documents[key]) errors[key] = 'This document is required.'
      })
    }

    if (currentStep === 4 && !form.appointmentTime) errors.appointmentTime = 'Select an appointment time.'
    if (currentStep === 5) {
      if (!form.paymentMethod) errors.paymentMethod = 'Select a payment method.'
      if (!/^\d+(?:\.\d{1,2})?$/.test(form.paymentAmount.replace(/[^\d.]/g, ''))) {
        errors.paymentAmount = 'Enter a valid amount using numbers only.'
      }
    }

    return errors
  }

  async function submitApplication() {
    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, applicantEmail: user.email, documents }),
      })

      if (!response.ok) throw new Error('Unable to submit application.')
      navigate('/applicant/dashboard')
    } catch (error) {
      setSubmitError(error.message)
      setIsSubmitting(false)
    }
  }

  function handleDocumentSelect(key, event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setDocuments((current) => ({
      ...current,
      [key]: selectedFile.name,
    }))
    setValidationErrors((current) => ({ ...current, [key]: '' }))
  }

  const renderGroomBrideForm = () => {
    const nameField = `${person}FullName`
    const dobField = `${person}Dob`
    const genderField = `${person}Gender`
    const civilStatusField = `${person}CivilStatus`
    const mobileField = `${person}Mobile`
    const emailField = `${person}Email`

    return (
      <>
      <div className="form-grid two-col">
        <div className="field-group">
          <label>Full Name *</label>
          <input
            value={form[nameField]}
            onChange={(e) => updateField(nameField, e.target.value.replace(/[^A-Za-z '-]/g, ''))}
            placeholder={person === 'groom' ? 'Juan Dela Cruz' : 'Maria Santos'}
            aria-invalid={Boolean(validationErrors[nameField])}
          />
          <FieldError message={validationErrors[nameField]} />
        </div>

        <div className="field-group">
          <label>Date of Birth *</label>
          <div className="input-with-icon">
            <input
              value={form[dobField]}
              onChange={(e) => updateField(dobField, formatDateInput(e.target.value))}
              placeholder="MM/DD/YYYY"
              inputMode="numeric"
              maxLength={10}
              aria-invalid={Boolean(validationErrors[dobField])}
            />
            <span className="calendar-icon">🗓</span>
          </div>
          <FieldError message={validationErrors[dobField]} />
        </div>

        <div className="field-group">
          <label>Gender *</label>
          <select
            value={form[genderField]}
            onChange={(e) => updateField(genderField, e.target.value)}
            aria-invalid={Boolean(validationErrors[genderField])}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <FieldError message={validationErrors[genderField]} />
        </div>

        <div className="field-group">
          <label>Civil Status *</label>
          <select
            value={form[civilStatusField]}
            onChange={(e) => updateField(civilStatusField, e.target.value)}
            aria-invalid={Boolean(validationErrors[civilStatusField])}
          >
            <option value="">Select Civil Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Separated">Separated</option>
          </select>
          <FieldError message={validationErrors[civilStatusField]} />
        </div>
      </div>

      <div className="form-grid two-col contact-row">
        <div className="field-group">
          <label>Mobile Number *</label>
          <input
            value={form[mobileField]}
            onChange={(e) => updateField(mobileField, e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="09XX XXX XXXX"
            inputMode="numeric"
            maxLength={11}
            aria-invalid={Boolean(validationErrors[mobileField])}
          />
          <FieldError message={validationErrors[mobileField]} />
        </div>

        <div className="field-group">
          <label>Email Address *</label>
          <input
            value={form[emailField]}
            onChange={(e) => updateField(emailField, e.target.value)}
            placeholder="you@example.com"
            type="email"
            aria-invalid={Boolean(validationErrors[emailField])}
          />
          <FieldError message={validationErrors[emailField]} />
        </div>
      </div>
      </>
    )
  }

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
            <FieldError message={validationErrors[key]} />
          </button>
        ))}
      </div>
    </div>
  )

  const renderAppointmentForm = () => (
    <div className="appointment-form-layout">
      <div className="appointment-fields">
        <div className="field-group">
          <label>Appointment Date</label>
          <input value={form.appointmentDate} readOnly />
        </div>

        <div className="field-group">
          <label>Preferred Time *</label>
          <select
            value={form.appointmentTime}
            onChange={(e) => updateField('appointmentTime', e.target.value)}
            aria-invalid={Boolean(validationErrors.appointmentTime)}
          >
            <option value="">Select Time</option>
            <option value="9:00 AM">9:00 AM</option>
            <option value="10:30 AM">10:30 AM</option>
            <option value="1:00 PM">1:00 PM</option>
            <option value="3:30 PM">3:30 PM</option>
          </select>
          <FieldError message={validationErrors.appointmentTime} />
        </div>

        <div className="field-group">
          <label>Office Location</label>
          <input value={form.appointmentLocation} readOnly />
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
          aria-invalid={Boolean(validationErrors.paymentMethod)}
        >
          <option value="Cash">Cash</option>
          <option value="Online Payment">Online Payment</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
        <FieldError message={validationErrors.paymentMethod} />
      </div>

      <div className="field-group">
        <label>Amount *</label>
        <input
          value={form.paymentAmount}
          onChange={(e) => updateField('paymentAmount', e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="₱ 800.00"
          inputMode="decimal"
          aria-invalid={Boolean(validationErrors.paymentAmount)}
        />
        <FieldError message={validationErrors.paymentAmount} />
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
            <span className="user-avatar">{initials}</span>
            <span>{displayName}</span>
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
                <p className="section-subtitle">Choose a time; the office will assign your appointment date at Villaverde.</p>
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

            <button type="button" className="primary-button" onClick={step === 6 ? submitApplication : nextStep} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : step === 6 ? 'Submit Application' : step === 5 ? 'Review Application' : step === 3 ? 'Next: Appointment →' : `Next: ${stepLabels[step] || 'Next'} →`}
            </button>
          </div>
          {submitError && <p className="form-error" role="alert">{submitError}</p>}
        </section>
      </main>
    </div>
  )
}
