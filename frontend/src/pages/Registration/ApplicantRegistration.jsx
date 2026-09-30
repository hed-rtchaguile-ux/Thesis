import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'
import './ApplicantRegistration.css'

const stepLabels = ['Groom Info', 'Bride Info', 'Legal Docs', 'Appointment', 'Payment', 'Review']
const personStepLabels = ['Name', 'Birth details', 'Residence & contact', 'Marital history', 'Father details', 'Mother details', 'Person who gave advice']

const documentFields = [
  { key: 'birthCertificateGroom', label: '1. Birth Certificate (Groom) *' },
  { key: 'birthCertificateBride', label: '2. Birth Certificate (Bride) *' },
  { key: 'certificateOfNoMarriage', label: '3. Certificate of No Marriage (CENOMAR) *' },
  { key: 'validIdGroom', label: '4. Valid ID (Groom) *' },
  { key: 'validIdBride', label: '5. Valid ID (Bride) *' },
  { key: 'psaMarriageLicense', label: '6. PSA Marriage License (if applicable)' },
  { key: 'barangayClearance', label: '7. Barangay Clearance / Residency *' },
  { key: 'additionalRequirement', label: '8. Additional Requirement / Affidavit' },
]

const extraInfoFields = [
  { key: 'age', label: 'Age' },
  { key: 'placeOfBirth', label: 'Place of Birth' },
  { key: 'residence', label: 'Residence' },
  { key: 'religion', label: 'Religion' },
  { key: 'fatherName', label: "Father's Name" },
  { key: 'motherMaidenName', label: "Mother's Maiden Name" },
  { key: 'citizenship', label: 'Citizenship' },
  { key: 'previouslyMarried', label: 'Previously Married?' },
  { key: 'dateOfMarriage', label: 'Date of Marriage' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'contactNumber', label: 'Contact Number' },
  { key: 'parentConsent', label: 'Parent Consent' },
  { key: 'declaration', label: 'Declaration' },
]

const initialForm = {
  groomFirstName: '',
  groomMiddleName: '',
  groomLastName: '',
  groomSuffix: '',
  groomDobDay: '',
  groomDobMonth: '',
  groomDobYear: '',
  groomAge: '',
  groomBirthPlaceCity: '',
  groomBirthPlaceProvince: '',
  groomBirthPlaceCountry: '',
  groomGender: '',
  groomCitizenship: '',
  groomResidenceHouseNo: '',
  groomResidenceStreet: '',
  groomResidenceBarangay: '',
  groomResidenceCity: '',
  groomResidenceProvince: '',
  groomResidenceCountry: '',
  groomReligion: '',
  groomCivilStatus: '',
  groomFullName: '',
  groomDob: '',
  groomMobile: '',
  groomEmail: '',
  groomPlaceOfBirth: '',
  groomResidence: '',
  groomFatherName: '',
  groomMotherMaidenName: '',
  groomFatherFirstName: '',
  groomFatherMiddleName: '',
  groomFatherLastName: '',
  groomFatherCitizenship: '',
  groomFatherResidenceHouseNo: '',
  groomFatherResidenceStreet: '',
  groomFatherResidenceBarangay: '',
  groomFatherResidenceCity: '',
  groomFatherResidenceProvince: '',
  groomFatherResidenceCountry: '',
  groomMotherMaidenFirstName: '',
  groomMotherMaidenMiddleName: '',
  groomMotherMaidenLastName: '',
  groomMotherMaidenCitizenship: '',
  groomMotherResidenceHouseNo: '',
  groomMotherResidenceStreet: '',
  groomMotherResidenceBarangay: '',
  groomMotherResidenceCity: '',
  groomMotherResidenceProvince: '',
  groomMotherResidenceCountry: '',
  groomAdvisorRelationship: '',
  groomAdvisorCitizenship: '',
  groomAdvisorResidenceHouseNo: '',
  groomAdvisorResidenceStreet: '',
  groomAdvisorResidenceBarangay: '',
  groomAdvisorResidenceCity: '',
  groomAdvisorResidenceProvince: '',
  groomAdvisorResidenceCountry: '',
  groomPreviouslyMarried: '',
  groomDissolutionMethod: '',
  groomDissolutionCity: '',
  groomDissolutionProvince: '',
  groomDissolutionCountry: '',
  groomDissolutionDay: '',
  groomDissolutionMonth: '',
  groomDissolutionYear: '',
  groomDegreeRelationship: '',
  groomDateOfMarriage: '',
  groomOccupation: '',
  groomContactNumber: '',
  groomParentConsent: '',
  groomDeclaration: '',
  brideFirstName: '',
  brideMiddleName: '',
  brideLastName: '',
  brideSuffix: '',
  brideDobDay: '',
  brideDobMonth: '',
  brideDobYear: '',
  brideAge: '',
  brideBirthPlaceCity: '',
  brideBirthPlaceProvince: '',
  brideBirthPlaceCountry: '',
  brideGender: '',
  brideCitizenship: '',
  brideResidenceHouseNo: '',
  brideResidenceStreet: '',
  brideResidenceBarangay: '',
  brideResidenceCity: '',
  brideResidenceProvince: '',
  brideResidenceCountry: '',
  brideReligion: '',
  brideCivilStatus: '',
  brideFullName: '',
  brideDob: '',
  brideMobile: '',
  brideEmail: '',
  bridePlaceOfBirth: '',
  brideResidence: '',
  brideFatherName: '',
  brideMotherMaidenName: '',
  brideFatherFirstName: '',
  brideFatherMiddleName: '',
  brideFatherLastName: '',
  brideFatherCitizenship: '',
  brideFatherResidenceHouseNo: '',
  brideFatherResidenceStreet: '',
  brideFatherResidenceBarangay: '',
  brideFatherResidenceCity: '',
  brideFatherResidenceProvince: '',
  brideFatherResidenceCountry: '',
  brideMotherMaidenFirstName: '',
  brideMotherMaidenMiddleName: '',
  brideMotherMaidenLastName: '',
  brideMotherMaidenCitizenship: '',
  brideMotherResidenceHouseNo: '',
  brideMotherResidenceStreet: '',
  brideMotherResidenceBarangay: '',
  brideMotherResidenceCity: '',
  brideMotherResidenceProvince: '',
  brideMotherResidenceCountry: '',
  brideAdvisorRelationship: '',
  brideAdvisorCitizenship: '',
  brideAdvisorResidenceHouseNo: '',
  brideAdvisorResidenceStreet: '',
  brideAdvisorResidenceBarangay: '',
  brideAdvisorResidenceCity: '',
  brideAdvisorResidenceProvince: '',
  brideAdvisorResidenceCountry: '',
  bridePreviouslyMarried: '',
  brideDissolutionMethod: '',
  brideDissolutionCity: '',
  brideDissolutionProvince: '',
  brideDissolutionCountry: '',
  brideDissolutionDay: '',
  brideDissolutionMonth: '',
  brideDissolutionYear: '',
  brideDegreeRelationship: '',
  brideDateOfMarriage: '',
  brideOccupation: '',
  brideContactNumber: '',
  brideParentConsent: '',
  brideDeclaration: '',
  appointmentDate: '',
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

function getLocalDateInputValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
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
  const [personStep, setPersonStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [documents, setDocuments] = useState({})
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileInputRefs = useRef({})

  const currentTitle = step === 1 ? 'Groom Info' : step === 2 ? 'Bride Info' : step === 3 ? 'Legal Docs' : step === 4 ? 'Appointment' : step === 5 ? 'Payment' : 'Review'
  const progressLabel = step <= 2 ? `Step ${personStep} of ${personStepLabels.length}` : `Step ${step} of 6`
  const person = step === 1 ? 'groom' : 'bride'

  function updateField(field, value) {
    const previouslyMarriedField = /^(groom|bride)PreviouslyMarried$/.exec(field)
    setForm((current) => {
      const nextForm = { ...current, [field]: value }
      if (previouslyMarriedField && value === 'No') {
        const dissolutionFields = ['DissolutionMethod', 'DissolutionPlace', 'DissolutionDate', 'DissolutionCity', 'DissolutionProvince', 'DissolutionCountry', 'DissolutionDay', 'DissolutionMonth', 'DissolutionYear']
        dissolutionFields.forEach((suffix) => {
          nextForm[`${previouslyMarriedField[1]}${suffix}`] = ''
        })
      }
      return nextForm
    })
    const dateErrorField = /^(groom|bride)Dob(?:Day|Month|Year)$/.exec(field)?.[1]
    setValidationErrors((current) => ({
      ...current,
      [field]: '',
      ...(dateErrorField ? { [`${dateErrorField}Dob`]: '' } : {}),
    }))
  }

  function getFullNameFromParts(prefix, firstValue, lastValue) {
    return [firstValue, lastValue].filter(Boolean).join(' ').trim()
  }

  function getAgeFromDob(prefix) {
    const day = Number(form[`${prefix}DobDay`] || 0)
    const month = Number(form[`${prefix}DobMonth`] || 0)
    const year = Number(form[`${prefix}DobYear`] || 0)

    if (!day || !month || !year) return null

    const birthDate = new Date(year, month - 1, day)
    if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (birthDate >= today) return null

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1
    }

    return age
  }

  function nextStep() {
    if (step <= 2) {
      const errors = validatePersonStep(person, personStep)
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors)
        return
      }

      if (personStep < personStepLabels.length) {
        setPersonStep((current) => current + 1)
        return
      }

      setStep((current) => current + 1)
      setPersonStep(1)
      return
    }

    const errors = validateStep(step)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setStep((current) => Math.min(current + 1, 6))
  }

  function prevStep() {
    if (step <= 2) {
      if (personStep > 1) {
        setPersonStep((current) => current - 1)
      } else if (step === 2) {
        setStep(1)
        setPersonStep(personStepLabels.length)
      }
      return
    }

    setStep((current) => current - 1)
    setPersonStep(step === 3 ? personStepLabels.length : 1)
  }

  function validatePersonStep(prefix, currentPersonStep) {
    const errors = {}

    if (currentPersonStep === 1) {
      const nameParts = ['FirstName', 'MiddleName', 'LastName']
      nameParts.forEach((part) => {
        const field = `${prefix}${part}`
        const value = (form[field] || '').trim()
        if (part !== 'MiddleName' && !value) errors[field] = `${part.replace('Name', ' name')} is required.`
        else if (value && !namePattern.test(value)) errors[field] = 'Use letters, spaces, apostrophes, or hyphens only.'
      })
    }

    if (currentPersonStep === 2) {
      if (getAgeFromDob(prefix) === null) errors[`${prefix}Dob`] = 'Enter a valid past date.'
      if (!form[`${prefix}Gender`]) errors[`${prefix}Gender`] = 'Select a gender.'
    }

    if (currentPersonStep === 3) {
      const mobile = (form[`${prefix}Mobile`] || '').replace(/\D/g, '')
      const email = (form[`${prefix}Email`] || '').trim()

      if (!form[`${prefix}CivilStatus`]) errors[`${prefix}CivilStatus`] = 'Select a civil status.'
      if (!/^09\d{9}$/.test(mobile)) errors[`${prefix}Mobile`] = 'Enter an 11-digit mobile number starting with 09.'
      if (!emailPattern.test(email)) errors[`${prefix}Email`] = 'Enter a valid email address.'
    }

    if (currentPersonStep === 4 && !form[`${prefix}PreviouslyMarried`]) {
      errors[`${prefix}PreviouslyMarried`] = 'Select Yes or No to continue.'
    }

    if (currentPersonStep === 7) {
      const age = getAgeFromDob(prefix)
      if (age !== null && age >= 18 && age <= 23) {
        [
          `${prefix}AdvisorRelationship`,
          `${prefix}AdvisorCitizenship`,
          `${prefix}AdvisorResidenceHouseNo`,
          `${prefix}AdvisorResidenceStreet`,
          `${prefix}AdvisorResidenceBarangay`,
          `${prefix}AdvisorResidenceCity`,
          `${prefix}AdvisorResidenceProvince`,
          `${prefix}AdvisorResidenceCountry`,
        ].forEach((field) => {
          if (!form[field] || !String(form[field]).trim()) errors[field] = 'Required for applicants age 18 to 23.'
        })
      }
    }

    return errors
  }

  function validateStep(currentStep) {
    const errors = {}
    const prefix = currentStep === 1 ? 'groom' : 'bride'

    if (currentStep === 1 || currentStep === 2) {
      const firstName = (form[`${prefix}FirstName`] || '').trim()
      const lastName = (form[`${prefix}LastName`] || '').trim()
      const name = getFullNameFromParts(prefix, firstName, lastName)
      const mobile = (form[`${prefix}Mobile`] || '').replace(/\D/g, '')
      const email = (form[`${prefix}Email`] || '').trim()
      const age = getAgeFromDob(prefix)
      const dobDay = form[`${prefix}DobDay`]
      const dobMonth = form[`${prefix}DobMonth`]
      const dobYear = form[`${prefix}DobYear`]

      if (!name) errors[`${prefix}FullName`] = 'Full name is required.'
      else if (!namePattern.test(name)) errors[`${prefix}FullName`] = 'Use letters, spaces, apostrophes, or hyphens only.'

      if (!dobDay || !dobMonth || !dobYear) {
        errors[`${prefix}Dob`] = 'Enter a valid past date.'
      } else {
        const birthDate = new Date(Number(dobYear), Number(dobMonth) - 1, Number(dobDay))
        const tooYoung = birthDate > new Date()
        if (Number.isNaN(birthDate.getTime()) || tooYoung) {
          errors[`${prefix}Dob`] = 'Enter a valid past date.'
        }
      }

      if (!form[`${prefix}Gender`]) errors[`${prefix}Gender`] = 'Select a gender.'
      if (!form[`${prefix}CivilStatus`]) errors[`${prefix}CivilStatus`] = 'Select a civil status.'
      if (!/^09\d{9}$/.test(mobile)) errors[`${prefix}Mobile`] = 'Enter an 11-digit mobile number starting with 09.'
      if (!emailPattern.test(email)) errors[`${prefix}Email`] = 'Enter a valid email address.'

      if (age !== null && age >= 18 && age <= 23) {
        const adviserFields = [
          `${prefix}AdvisorRelationship`,
          `${prefix}AdvisorCitizenship`,
          `${prefix}AdvisorResidenceHouseNo`,
          `${prefix}AdvisorResidenceStreet`,
          `${prefix}AdvisorResidenceBarangay`,
          `${prefix}AdvisorResidenceCity`,
          `${prefix}AdvisorResidenceProvince`,
          `${prefix}AdvisorResidenceCountry`,
        ]

        adviserFields.forEach((field) => {
          if (!form[field] || !String(form[field]).trim()) {
            errors[field] = 'Required for applicants age 18 to 23.'
          }
        })
      }
    }

    if (currentStep === 3) {
      documentFields.filter(({ label }) => label.endsWith('*')).forEach(({ key }) => {
        if (!documents[key]) errors[key] = 'This document is required.'
      })
    }

    if (currentStep === 4) {
      const appointmentDate = form.appointmentDate
      const parsedAppointmentDate = new Date(`${appointmentDate}T00:00:00`)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
        || Number.isNaN(parsedAppointmentDate.getTime())
        || parsedAppointmentDate < today) {
        errors.appointmentDate = 'Choose a valid date that is not in the past.'
      }
      if (!/^\d{2}:\d{2}$/.test(form.appointmentTime)) {
        errors.appointmentTime = 'Choose an appointment time.'
      }
    }

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

    const submittedForm = {
      ...form,
      preferredAppointmentDate: form.appointmentDate,
      preferredAppointmentTime: form.appointmentTime,
      appointmentDate: 'To be assigned by office',
      appointmentTime: '',
      groomFullName: [form.groomFirstName, form.groomMiddleName, form.groomLastName, form.groomSuffix].filter(Boolean).join(' ').trim(),
      groomDob: [form.groomDobMonth, form.groomDobDay, form.groomDobYear].filter(Boolean).join('/'),
      groomAge: getAgeFromDob('groom') ?? '',
      brideFullName: [form.brideFirstName, form.brideMiddleName, form.brideLastName, form.brideSuffix].filter(Boolean).join(' ').trim(),
      brideDob: [form.brideDobMonth, form.brideDobDay, form.brideDobYear].filter(Boolean).join('/'),
      brideAge: getAgeFromDob('bride') ?? '',
    }

    try {
      const response = await apiFetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...submittedForm,
          applicationData: submittedForm,
          applicantEmail: user.email,
          documents: Object.fromEntries(Object.entries(documents).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : value.dataUrl,
          ])),
        }),
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

    const reader = new FileReader()
    reader.onload = () => {
      setDocuments((current) => ({
        ...current,
        [key]: {
          name: selectedFile.name,
          type: selectedFile.type,
          dataUrl: reader.result,
        },
      }))
      setValidationErrors((current) => ({ ...current, [key]: '' }))
    }
    reader.readAsDataURL(selectedFile)
  }

  function autoFillDocuments() {
    const documentValues = {
      birthCertificateGroom: 'birth_certificate_groom.pdf',
      birthCertificateBride: 'birth_certificate_bride.pdf',
      certificateOfNoMarriage: 'cenomar.pdf',
      validIdGroom: 'valid_id_groom.pdf',
      validIdBride: 'valid_id_bride.pdf',
      psaMarriageLicense: 'psa_marriage_license.pdf',
      barangayClearance: 'barangay_clearance.pdf',
      additionalRequirement: 'additional_requirement.pdf',
    }

    setDocuments((current) => ({
      ...current,
      ...documentValues,
    }))

    setValidationErrors((current) => {
      const nextErrors = { ...current }
      documentFields.forEach(({ key }) => {
        delete nextErrors[key]
      })
      return nextErrors
    })
  }

  function autoFillPersonData(targetPrefix, sourcePrefix) {
    const isBride = targetPrefix === 'bride'
    const fallbackValues = {
      FirstName: isBride ? 'Maria' : 'Juan',
      MiddleName: isBride ? 'Santos' : 'Reyes',
      LastName: isBride ? 'Dela Cruz' : 'Cruz',
      Suffix: '',
      DobDay: isBride ? '24' : '15',
      DobMonth: isBride ? '06' : '04',
      DobYear: isBride ? '1997' : '1994',
      Gender: isBride ? 'Female' : 'Male',
      BirthPlaceCity: isBride ? 'Cebu City' : 'Quezon City',
      BirthPlaceProvince: isBride ? 'Cebu' : 'Metro Manila',
      BirthPlaceCountry: 'Philippines',
      Citizenship: 'Filipino',
      ResidenceHouseNo: isBride ? '15' : '120',
      ResidenceStreet: isBride ? 'Lapu-Lapu Street' : 'Mabini Street',
      ResidenceBarangay: isBride ? 'Barangay Guadalupe' : 'Barangay San Antonio',
      ResidenceCity: isBride ? 'Cebu City' : 'Pasig City',
      ResidenceProvince: isBride ? 'Cebu' : 'Metro Manila',
      ResidenceCountry: 'Philippines',
      Religion: 'Roman Catholic',
      CivilStatus: 'Single',
      Mobile: isBride ? '09187654321' : '09171234567',
      Email: isBride ? 'maria.santos@email.com' : 'juan.cruz@email.com',
      FatherFirstName: isBride ? 'Mateo' : 'Carlos',
      FatherMiddleName: isBride ? 'Delos Reyes' : 'Manalo',
      FatherLastName: isBride ? 'Santos' : 'Cruz',
      FatherCitizenship: 'Filipino',
      FatherResidenceHouseNo: isBride ? '18' : '123',
      FatherResidenceStreet: isBride ? 'Bahayang Street' : 'Mabini Street',
      FatherResidenceBarangay: isBride ? 'Barangay Mambaling' : 'Barangay San Antonio',
      FatherResidenceCity: isBride ? 'Cebu City' : 'Pasig City',
      FatherResidenceProvince: isBride ? 'Cebu' : 'Metro Manila',
      FatherResidenceCountry: 'Philippines',
      MotherMaidenFirstName: isBride ? 'Rosalinda' : 'Carmela',
      MotherMaidenMiddleName: isBride ? 'Villanueva' : 'Dela Rosa',
      MotherMaidenLastName: isBride ? 'Santos' : 'Cruz',
      MotherMaidenCitizenship: 'Filipino',
      MotherResidenceHouseNo: isBride ? '18' : '123',
      MotherResidenceStreet: isBride ? 'Bahayang Street' : 'Mabini Street',
      MotherResidenceBarangay: isBride ? 'Barangay Mambaling' : 'Barangay San Antonio',
      MotherResidenceCity: isBride ? 'Cebu City' : 'Pasig City',
      MotherResidenceProvince: isBride ? 'Cebu' : 'Metro Manila',
      MotherResidenceCountry: 'Philippines',
      AdvisorRelationship: 'Godfather',
      AdvisorCitizenship: 'Filipino',
      AdvisorResidenceHouseNo: '9',
      AdvisorResidenceStreet: 'P. Burgos Street',
      AdvisorResidenceBarangay: 'Barangay Santo Niño',
      AdvisorResidenceCity: isBride ? 'Cebu City' : 'Pasig City',
      AdvisorResidenceProvince: isBride ? 'Cebu' : 'Metro Manila',
      AdvisorResidenceCountry: 'Philippines',
    }

    setForm((current) => {
      const nextForm = { ...current }

      Object.keys(initialForm).forEach((key) => {
        if (!key.startsWith(sourcePrefix)) return

        const remainingKey = key.slice(sourcePrefix.length)
        const targetKey = `${targetPrefix}${remainingKey}`

        if (Object.prototype.hasOwnProperty.call(nextForm, targetKey)) {
          const sourceValue = current[key]
          if (sourceValue !== undefined && sourceValue !== null && String(sourceValue).trim() !== '') {
            nextForm[targetKey] = sourceValue
          }
        }
      })

      Object.keys(fallbackValues).forEach((fieldName) => {
        const targetKey = `${targetPrefix}${fieldName}`
        if (Object.prototype.hasOwnProperty.call(nextForm, targetKey)) {
          const currentValue = nextForm[targetKey]
          if (!currentValue || String(currentValue).trim() === '') {
            nextForm[targetKey] = fallbackValues[fieldName]
          }
        }
      })

      const firstName = (nextForm[`${targetPrefix}FirstName`] || '').trim()
      const lastName = (nextForm[`${targetPrefix}LastName`] || '').trim()
      const dobDay = nextForm[`${targetPrefix}DobDay`] || ''
      const dobMonth = nextForm[`${targetPrefix}DobMonth`] || ''
      const dobYear = nextForm[`${targetPrefix}DobYear`] || ''
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

      nextForm[`${targetPrefix}FullName`] = fullName
      nextForm[`${targetPrefix}Dob`] = [dobDay, dobMonth, dobYear].filter(Boolean).join('/')

      if (dobDay && dobMonth && dobYear) {
        const birthDate = new Date(Number(dobYear), Number(dobMonth) - 1, Number(dobDay))
        const today = new Date()
        let age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age -= 1
        }

        nextForm[`${targetPrefix}Age`] = age
      }

      return nextForm
    })
  }

  const renderExtraInformation = () => {
    const previousField = `${person}PreviouslyMarried`
    const isPreviouslyMarried = (form[previousField] || '').toLowerCase() === 'yes'

    return (
      <>
        <div className="extended-form-grid">
          {extraInfoFields.map(({ key, label }) => (
            <div key={`${person}-${key}`} className="field-group">
              <label>{label}</label>
              {key === 'previouslyMarried' ? (
                <select
                  value={form[`${person}${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? ''}
                  onChange={(e) => updateField(`${person}${key.charAt(0).toUpperCase()}${key.slice(1)}`, e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                <input
                  value={form[`${person}${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? ''}
                  onChange={(e) => updateField(`${person}${key.charAt(0).toUpperCase()}${key.slice(1)}`, e.target.value)}
                  placeholder={label}
                />
              )}
            </div>
          ))}
        </div>

        {isPreviouslyMarried && (
          <div className="dissolution-table-wrap">
            <div className="dissolution-table-header">If previously married: how was it dissolved?</div>
            <div className="dissolution-table">
              <div className="field-group">
                <label>How was it dissolved?</label>
                <select
                  value={form[`${person}DissolutionMethod`] ?? ''}
                  onChange={(e) => updateField(`${person}DissolutionMethod`, e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Death of spouse">Death of spouse</option>
                  <option value="Annulment">Annulment</option>
                  <option value="Divorce">Divorce</option>
                  <option value="Legal separation">Legal separation</option>
                </select>
              </div>

              <div className="field-group">
                <label>Place where dissolved</label>
                <input
                  value={form[`${person}DissolutionPlace`] ?? ''}
                  onChange={(e) => updateField(`${person}DissolutionPlace`, e.target.value)}
                  placeholder="Place"
                />
              </div>

              <div className="field-group">
                <label>When dissolved</label>
                <input
                  value={form[`${person}DissolutionDate`] ?? ''}
                  onChange={(e) => updateField(`${person}DissolutionDate`, formatDateInput(e.target.value))}
                  placeholder="MM/DD/YYYY"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  const renderGroomBrideForm = () => {
    const firstField = `${person}FirstName`
    const middleField = `${person}MiddleName`
    const lastField = `${person}LastName`
    const suffixField = `${person}Suffix`
    const dobDayField = `${person}DobDay`
    const dobMonthField = `${person}DobMonth`
    const dobYearField = `${person}DobYear`
    const birthCityField = `${person}BirthPlaceCity`
    const birthProvinceField = `${person}BirthPlaceProvince`
    const birthCountryField = `${person}BirthPlaceCountry`
    const genderField = `${person}Gender`
    const citizenshipField = `${person}Citizenship`
    const houseNoField = `${person}ResidenceHouseNo`
    const streetField = `${person}ResidenceStreet`
    const barangayField = `${person}ResidenceBarangay`
    const residenceCityField = `${person}ResidenceCity`
    const residenceProvinceField = `${person}ResidenceProvince`
    const residenceCountryField = `${person}ResidenceCountry`
    const religionField = `${person}Religion`
    const civilStatusField = `${person}CivilStatus`
    const mobileField = `${person}Mobile`
    const emailField = `${person}Email`

    return (
      <>
        <div className="two-box-layout">
          <div className="formal-box">
            <div className="auto-fill-row">
              <div className="formal-box-title">1. {personStepLabels[personStep - 1]}</div>
              <button
                type="button"
                className="auto-fill-button"
                onClick={() => autoFillPersonData(person, person === 'groom' ? 'bride' : 'groom')}
              >
                Auto Fill
              </button>
            </div>

            {personStep === 1 && <>
            <div className="form-grid three-col">
              <div className="field-group">
                <label>First Name *</label>
                <input
                  value={form[firstField]}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^A-Za-z '-]/g, '')
                    updateField(firstField, value)
                    updateField(`${person}FullName`, getFullNameFromParts(person, value, form[lastField]))
                  }}
                  placeholder="First Name"
                />
                <FieldError message={validationErrors[firstField]} />
              </div>

              <div className="field-group">
                <label>Middle Name</label>
                <input
                  value={form[middleField]}
                  onChange={(e) => updateField(middleField, e.target.value.replace(/[^A-Za-z '-]/g, ''))}
                  placeholder="Middle Name"
                />
                <FieldError message={validationErrors[middleField]} />
              </div>

              <div className="field-group">
                <label>Last Name *</label>
                <input
                  value={form[lastField]}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^A-Za-z '-]/g, '')
                    updateField(lastField, value)
                    updateField(`${person}FullName`, getFullNameFromParts(person, form[firstField], value))
                  }}
                  placeholder="Last Name"
                />
                <FieldError message={validationErrors[lastField]} />
              </div>
            </div>

            <div className="form-grid two-col compact-row">
              <div className="field-group">
                <label>Suffix</label>
                <select
                  value={form[suffixField]}
                  onChange={(e) => updateField(suffixField, e.target.value)}
                >
                  <option value="">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="III">III</option>
                </select>
              </div>

            </div>
            </>}

            {personStep === 2 && <>
            <div className="form-grid two-col compact-row">
              <div className="field-group">
                <label>Age</label>
                <input value={getAgeFromDob(person) ?? ''} placeholder="Calculated from birthday" readOnly />
              </div>
            </div>

            <div className="form-grid four-col">
              <div className="field-group">
                <label>Day</label>
                <input
                  value={form[dobDayField]}
                  onChange={(e) => updateField(dobDayField, e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="DD"
                  inputMode="numeric"
                />
              </div>

              <div className="field-group">
                <label>Month</label>
                <input
                  value={form[dobMonthField]}
                  onChange={(e) => updateField(dobMonthField, e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="MM"
                  inputMode="numeric"
                />
              </div>

              <div className="field-group">
                <label>Year</label>
                <input
                  value={form[dobYearField]}
                  onChange={(e) => updateField(dobYearField, e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="YYYY"
                  inputMode="numeric"
                />
              </div>

              <div className="field-group">
                <label>Gender</label>
                <select value={form[genderField]} onChange={(e) => updateField(genderField, e.target.value)}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <FieldError message={validationErrors[genderField]} />
              </div>
            </div>
            <FieldError message={validationErrors[`${person}Dob`]} />

            <div className="form-grid three-col">
              <div className="field-group">
                <label>Place of Birth (City/Municipality)</label>
                <input value={form[birthCityField]} onChange={(e) => updateField(birthCityField, e.target.value)} placeholder="City/Municipality" />
              </div>

              <div className="field-group">
                <label>Province</label>
                <input value={form[birthProvinceField]} onChange={(e) => updateField(birthProvinceField, e.target.value)} placeholder="Province" />
              </div>

              <div className="field-group">
                <label>Country</label>
                <input value={form[birthCountryField]} onChange={(e) => updateField(birthCountryField, e.target.value)} placeholder="Country" />
              </div>
            </div>
            </>}

            {personStep === 3 && <>
            <div className="form-grid two-col">
              <div className="field-group">
                <label>Citizenship</label>
                <input value={form[citizenshipField]} onChange={(e) => updateField(citizenshipField, e.target.value)} placeholder="Citizenship" />
              </div>

              <div className="field-group">
                <label>Civil Status</label>
                <select value={form[civilStatusField]} onChange={(e) => updateField(civilStatusField, e.target.value)}>
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                </select>
                <FieldError message={validationErrors[civilStatusField]} />
              </div>
            </div>

            <div className="field-group single-line-field">
              <label>Religion / Religious Sect</label>
              <input value={form[religionField]} onChange={(e) => updateField(religionField, e.target.value)} placeholder="Religion / Religious Sect" />
            </div>

            <div className="form-grid two-col">
              <div className="field-group">
                <label>Residence (House No.)</label>
                <input value={form[houseNoField]} onChange={(e) => updateField(houseNoField, e.target.value)} placeholder="House No." />
              </div>

              <div className="field-group">
                <label>Street</label>
                <input value={form[streetField]} onChange={(e) => updateField(streetField, e.target.value)} placeholder="Street" />
              </div>
            </div>

            <div className="form-grid three-col">
              <div className="field-group">
                <label>Barangay</label>
                <input value={form[barangayField]} onChange={(e) => updateField(barangayField, e.target.value)} placeholder="Barangay" />
              </div>

              <div className="field-group">
                <label>City/Municipality</label>
                <input value={form[residenceCityField]} onChange={(e) => updateField(residenceCityField, e.target.value)} placeholder="City/Municipality" />
              </div>

              <div className="field-group">
                <label>Province</label>
                <input value={form[residenceProvinceField]} onChange={(e) => updateField(residenceProvinceField, e.target.value)} placeholder="Province" />
              </div>
            </div>

            <div className="form-grid two-col">
              <div className="field-group">
                <label>Country</label>
                <input value={form[residenceCountryField]} onChange={(e) => updateField(residenceCountryField, e.target.value)} placeholder="Country" />
              </div>

              <div className="field-group">
                <label>Mobile Number *</label>
                <input
                  value={form[mobileField]}
                  onChange={(e) => updateField(mobileField, e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09XX XXX XXXX"
                  inputMode="numeric"
                  maxLength={11}
                />
                <FieldError message={validationErrors[mobileField]} />
              </div>
            </div>

            <div className="field-group single-line-field">
              <label>Email Address *</label>
              <input
                value={form[emailField]}
                onChange={(e) => updateField(emailField, e.target.value)}
                placeholder="you@example.com"
                type="email"
              />
              <FieldError message={validationErrors[emailField]} />
            </div>
            </>}
          </div>

          {personStep === 4 && <>
          <div className="formal-box">
            <div className="formal-box-title">Previously Married?</div>
            <div className="field-group">
              <label>Were you previously married? *</label>
              <select
                value={form[`${person}PreviouslyMarried`] ?? ''}
                onChange={(event) => updateField(`${person}PreviouslyMarried`, event.target.value)}
                aria-invalid={Boolean(validationErrors[`${person}PreviouslyMarried`])}
              >
                <option value="">Select Yes or No</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <FieldError message={validationErrors[`${person}PreviouslyMarried`]} />
            </div>

            {form[`${person}PreviouslyMarried`] === 'Yes' && (
              <>
                <div className="field-group single-line-field" style={{ marginTop: '16px' }}>
                  <label>How was the marriage dissolved?</label>
                  <input
                    value={form[`${person}DissolutionMethod`] ?? ''}
                    onChange={(event) => updateField(`${person}DissolutionMethod`, event.target.value)}
                    placeholder="Type your answer"
                  />
                </div>

                <div className="form-grid three-col" style={{ marginTop: '12px' }}>
                  <div className="field-group">
                    <label>City/Municipality</label>
                    <input value={form[`${person}DissolutionCity`] ?? ''} onChange={(event) => updateField(`${person}DissolutionCity`, event.target.value)} placeholder="City/Municipality" />
                  </div>
                  <div className="field-group">
                    <label>Province</label>
                    <input value={form[`${person}DissolutionProvince`] ?? ''} onChange={(event) => updateField(`${person}DissolutionProvince`, event.target.value)} placeholder="Province" />
                  </div>
                  <div className="field-group">
                    <label>Country</label>
                    <input value={form[`${person}DissolutionCountry`] ?? ''} onChange={(event) => updateField(`${person}DissolutionCountry`, event.target.value)} placeholder="Country" />
                  </div>
                </div>

                <div className="form-grid three-col" style={{ marginTop: '12px' }}>
                  <div className="field-group">
                    <label>Day</label>
                    <input value={form[`${person}DissolutionDay`] ?? ''} onChange={(event) => updateField(`${person}DissolutionDay`, event.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="DD" inputMode="numeric" />
                  </div>
                  <div className="field-group">
                    <label>Month</label>
                    <input value={form[`${person}DissolutionMonth`] ?? ''} onChange={(event) => updateField(`${person}DissolutionMonth`, event.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="MM" inputMode="numeric" />
                  </div>
                  <div className="field-group">
                    <label>Year</label>
                    <input value={form[`${person}DissolutionYear`] ?? ''} onChange={(event) => updateField(`${person}DissolutionYear`, event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" inputMode="numeric" />
                  </div>
                </div>
              </>
            )}
          </div>
          </>}

          {personStep === 5 && <>
            <div className="formal-box">
              <div className="field-group single-line-field">
                <label>Name of Father (First, Middle, Last Name)</label>
                <div className="form-grid three-col">
                  <input
                    value={form[`${person}FatherFirstName`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherFirstName`, e.target.value)}
                    placeholder="First Name"
                  />
                  <input
                    value={form[`${person}FatherMiddleName`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherMiddleName`, e.target.value)}
                    placeholder="Middle Name"
                  />
                  <input
                    value={form[`${person}FatherLastName`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherLastName`, e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label>Citizenship</label>
                <input
                  value={form[`${person}FatherCitizenship`] ?? ''}
                  onChange={(e) => updateField(`${person}FatherCitizenship`, e.target.value)}
                  placeholder="Citizenship"
                />
              </div>

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label>Residence (House No., Street, Barangay, City/Municipality, Province, Country)</label>
                <div className="form-grid two-col" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}FatherResidenceHouseNo`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherResidenceHouseNo`, e.target.value)}
                    placeholder="House No."
                  />
                  <input
                    value={form[`${person}FatherResidenceStreet`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherResidenceStreet`, e.target.value)}
                    placeholder="Street"
                  />
                </div>
                <div className="form-grid three-col" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}FatherResidenceBarangay`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherResidenceBarangay`, e.target.value)}
                    placeholder="Barangay"
                  />
                  <input
                    value={form[`${person}FatherResidenceCity`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherResidenceCity`, e.target.value)}
                    placeholder="City/Municipality"
                  />
                  <input
                    value={form[`${person}FatherResidenceProvince`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherResidenceProvince`, e.target.value)}
                    placeholder="Province"
                  />
                </div>
                <div className="form-grid" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}FatherResidenceCountry`] ?? ''}
                    onChange={(e) => updateField(`${person}FatherResidenceCountry`, e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>
          </>}

          {personStep === 6 && <>
            <div className="formal-box">
              <div className="formal-box-title">Mother's Maiden Name and Information</div>
              <div className="field-group single-line-field" style={{ marginTop: '18px' }}>
                <label>Maiden Name of Mother (First, Middle, Last Name)</label>
                <div className="form-grid three-col">
                  <input
                    value={form[`${person}MotherMaidenFirstName`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherMaidenFirstName`, e.target.value)}
                    placeholder="First Name"
                  />
                  <input
                    value={form[`${person}MotherMaidenMiddleName`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherMaidenMiddleName`, e.target.value)}
                    placeholder="Middle Name"
                  />
                  <input
                    value={form[`${person}MotherMaidenLastName`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherMaidenLastName`, e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label>Citizenship</label>
                <input
                  value={form[`${person}MotherMaidenCitizenship`] ?? ''}
                  onChange={(e) => updateField(`${person}MotherMaidenCitizenship`, e.target.value)}
                  placeholder="Citizenship"
                />
              </div>

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label>Residence (House No., Street, Barangay, City/Municipality, Province, Country)</label>
                <div className="form-grid two-col" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}MotherResidenceHouseNo`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherResidenceHouseNo`, e.target.value)}
                    placeholder="House No."
                  />
                  <input
                    value={form[`${person}MotherResidenceStreet`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherResidenceStreet`, e.target.value)}
                    placeholder="Street"
                  />
                </div>
                <div className="form-grid three-col" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}MotherResidenceBarangay`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherResidenceBarangay`, e.target.value)}
                    placeholder="Barangay"
                  />
                  <input
                    value={form[`${person}MotherResidenceCity`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherResidenceCity`, e.target.value)}
                    placeholder="City/Municipality"
                  />
                  <input
                    value={form[`${person}MotherResidenceProvince`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherResidenceProvince`, e.target.value)}
                    placeholder="Province"
                  />
                </div>
                <div className="form-grid" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}MotherResidenceCountry`] ?? ''}
                    onChange={(e) => updateField(`${person}MotherResidenceCountry`, e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>
          </>}

          {personStep === 7 && <>
            <div className="formal-box">
              <div className="formal-box-title">4. Person Who Gave Advice</div>

              <div className="field-group single-line-field">
                <label>Relationship</label>
                <input
                  value={form[`${person}AdvisorRelationship`] ?? ''}
                  onChange={(e) => updateField(`${person}AdvisorRelationship`, e.target.value)}
                  placeholder="Relationship"
                />
              </div>

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label>Citizenship</label>
                <input
                  value={form[`${person}AdvisorCitizenship`] ?? ''}
                  onChange={(e) => updateField(`${person}AdvisorCitizenship`, e.target.value)}
                  placeholder="Citizenship"
                />
              </div>

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label>Residence (House No., Street, Barangay, City/Municipality, Province, Country)</label>
                <div className="form-grid two-col" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}AdvisorResidenceHouseNo`] ?? ''}
                    onChange={(e) => updateField(`${person}AdvisorResidenceHouseNo`, e.target.value)}
                    placeholder="House No."
                  />
                  <input
                    value={form[`${person}AdvisorResidenceStreet`] ?? ''}
                    onChange={(e) => updateField(`${person}AdvisorResidenceStreet`, e.target.value)}
                    placeholder="Street"
                  />
                </div>
                <div className="form-grid three-col" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}AdvisorResidenceBarangay`] ?? ''}
                    onChange={(e) => updateField(`${person}AdvisorResidenceBarangay`, e.target.value)}
                    placeholder="Barangay"
                  />
                  <input
                    value={form[`${person}AdvisorResidenceCity`] ?? ''}
                    onChange={(e) => updateField(`${person}AdvisorResidenceCity`, e.target.value)}
                    placeholder="City/Municipality"
                  />
                  <input
                    value={form[`${person}AdvisorResidenceProvince`] ?? ''}
                    onChange={(e) => updateField(`${person}AdvisorResidenceProvince`, e.target.value)}
                    placeholder="Province"
                  />
                </div>
                <div className="form-grid" style={{ marginTop: '8px' }}>
                  <input
                    value={form[`${person}AdvisorResidenceCountry`] ?? ''}
                    onChange={(e) => updateField(`${person}AdvisorResidenceCountry`, e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>
            </>}
          </div>
      </>
    )
  }

  const renderDocumentUpload = () => (
    <div className="document-upload-wrapper">
      <div className="auto-fill-row document-auto-fill-row">
        <div className="formal-box-title">Legal Documents</div>
        <button type="button" className="auto-fill-button" onClick={autoFillDocuments}>
          Auto Fill
        </button>
      </div>

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
            <span className="upload-file-name">{documents[key] ? (typeof documents[key] === 'string' ? documents[key] : documents[key].name) : 'Choose File'}</span>
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
          <label htmlFor="appointment-date">Suggested Appointment Date *</label>
          <input
            id="appointment-date"
            type="date"
            min={getLocalDateInputValue()}
            value={form.appointmentDate}
            onChange={(event) => updateField('appointmentDate', event.target.value)}
            aria-invalid={Boolean(validationErrors.appointmentDate)}
            required
          />
          <FieldError message={validationErrors.appointmentDate} />
        </div>

        <div className="field-group">
          <label htmlFor="appointment-time">Suggested Appointment Time *</label>
          <input
            id="appointment-time"
            type="time"
            value={form.appointmentTime}
            onChange={(event) => updateField('appointmentTime', event.target.value)}
            aria-invalid={Boolean(validationErrors.appointmentTime)}
            required
          />
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
        <label>Payment Method</label>
        <div className="payment-method-note">Pay over the counter (cash only)</div>
        <FieldError message={validationErrors.paymentMethod} />
      </div>

      <div className="field-group">
        <label>Amount</label>
        <input
          value={form.paymentAmount}
          readOnly
          aria-invalid={Boolean(validationErrors.paymentAmount)}
        />
        <FieldError message={validationErrors.paymentAmount} />
      </div>
    </div>
  )

  const renderReviewSummary = () => {
    const renderOfficialField = (value, fallback = '—') => value || fallback

    const renderPersonForm = (person) => {
      const prefix = person
      const firstName = renderOfficialField(form[`${prefix}FirstName`])
      const middleName = renderOfficialField(form[`${prefix}MiddleName`])
      const lastName = renderOfficialField(form[`${prefix}LastName`])
      const fullName = [firstName, middleName, lastName].filter((value) => value !== '—').join(' ')
      const preferredName = fullName || '—'
      const placeOfBirth = [form[`${prefix}BirthPlaceCity`], form[`${prefix}BirthPlaceProvince`], form[`${prefix}BirthPlaceCountry`]].filter(Boolean).join(', ') || '—'
      const residence = [form[`${prefix}ResidenceHouseNo`], form[`${prefix}ResidenceStreet`], form[`${prefix}ResidenceBarangay`], form[`${prefix}ResidenceCity`], form[`${prefix}ResidenceProvince`], form[`${prefix}ResidenceCountry`]].filter(Boolean).join(', ') || '—'
      const fatherName = [form[`${prefix}FatherFirstName`], form[`${prefix}FatherMiddleName`], form[`${prefix}FatherLastName`]].filter(Boolean).join(' ') || '—'
      const motherName = [form[`${prefix}MotherMaidenFirstName`], form[`${prefix}MotherMaidenMiddleName`], form[`${prefix}MotherMaidenLastName`]].filter(Boolean).join(' ') || '—'
      const advisorInfo = [form[`${prefix}AdvisorRelationship`], form[`${prefix}AdvisorCitizenship`], form[`${prefix}AdvisorResidenceCity`]].filter(Boolean).join(' / ') || '—'

      return (
        <div className="official-form-body">
          <div className="official-form-name-row">
            <div className="official-form-cell wide-cell">
              <span>Full Name</span>
              <strong>{preferredName}</strong>
            </div>
            <div className="official-form-cell small-cell">
              <span>Age</span>
              <strong>{renderOfficialField(form[`${prefix}Age`] || getAgeFromDob(prefix))}</strong>
            </div>
          </div>

          <div className="official-form-three-col">
            <div className="official-form-cell">
              <span>First Name</span>
              <strong>{firstName}</strong>
            </div>
            <div className="official-form-cell">
              <span>Middle Name</span>
              <strong>{middleName}</strong>
            </div>
            <div className="official-form-cell">
              <span>Last Name</span>
              <strong>{lastName}</strong>
            </div>
          </div>

          <div className="official-form-four-col">
            <div className="official-form-cell">
              <span>Date of Birth</span>
              <strong>{renderOfficialField(form[`${prefix}Dob`])}</strong>
            </div>
            <div className="official-form-cell">
              <span>Gender</span>
              <strong>{renderOfficialField(form[`${prefix}Gender`])}</strong>
            </div>
            <div className="official-form-cell">
              <span>Citizenship</span>
              <strong>{renderOfficialField(form[`${prefix}Citizenship`])}</strong>
            </div>
            <div className="official-form-cell">
              <span>Civil Status</span>
              <strong>{renderOfficialField(form[`${prefix}CivilStatus`])}</strong>
            </div>
          </div>

          <div className="official-form-three-col">
            <div className="official-form-cell">
              <span>Birth Place</span>
              <strong>{placeOfBirth}</strong>
            </div>
            <div className="official-form-cell">
              <span>Religion</span>
              <strong>{renderOfficialField(form[`${prefix}Religion`])}</strong>
            </div>
            <div className="official-form-cell">
              <span>Residence</span>
              <strong>{residence}</strong>
            </div>
          </div>

          <div className="official-form-two-col">
            <div className="official-form-cell">
              <span>Mobile</span>
              <strong>{renderOfficialField(form[`${prefix}Mobile`])}</strong>
            </div>
            <div className="official-form-cell">
              <span>Email</span>
              <strong>{renderOfficialField(form[`${prefix}Email`])}</strong>
            </div>
          </div>

          <div className="official-form-two-col">
            <div className="official-form-cell">
              <span>Father</span>
              <strong>{fatherName}</strong>
            </div>
            <div className="official-form-cell">
              <span>Mother</span>
              <strong>{motherName}</strong>
            </div>
          </div>

          <div className="official-form-two-col">
            <div className="official-form-cell">
              <span>Advisor</span>
              <strong>{advisorInfo}</strong>
            </div>
            <div className="official-form-cell">
              <span>Previously Married</span>
              <strong>{renderOfficialField(form[`${prefix}PreviouslyMarried`])}</strong>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="official-print-form">
        <h2 className="official-review-title">Application Review</h2>

        <div className="official-double-col">
          <div className="official-person-panel">
            <div className="official-panel-title">GROOM</div>
            {renderPersonForm('groom')}
          </div>

          <div className="official-person-panel">
            <div className="official-panel-title">BRIDE</div>
            {renderPersonForm('bride')}
          </div>
        </div>

        <div className="official-bottom-boxes">
          <div className="official-bottom-row">
            <span>Preferred Date</span>
            <strong>{form.appointmentDate || '—'}</strong>
          </div>
          <div className="official-bottom-row">
            <span>Preferred Time</span>
            <strong>{form.appointmentTime || '—'}</strong>
          </div>
          <div className="official-bottom-row">
            <span>Payment</span>
            <strong>Pay over the counter (cash only) / {form.paymentAmount || '₱ 800.00'}</strong>
          </div>
        </div>

        <div className="official-documents-box">
          <div className="official-panel-title small">REQUIRED DOCUMENTS</div>
          <div className="official-doc-list">
            {documentFields.map(({ key, label }) => (
              <div key={key} className="official-doc-item">
                <span>{label}</span>
                <strong>{documents[key] || 'Not uploaded'}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

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
                <p className="section-subtitle">Enter your suggested appointment date and time. The office will confirm the schedule at Villaverde.</p>
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
                <h3>{step === 1 ? 'Groom' : 'Bride'} - {personStepLabels[personStep - 1]}</h3>
                {renderGroomBrideForm()}
              </>
            )}
          </div>

          <div className="form-actions">
            {(step > 1 || personStep > 1) && (
              <button type="button" className="secondary-button" onClick={prevStep}>
                ← Back
              </button>
            )}

            <button type="button" className="primary-button" onClick={step === 6 ? submitApplication : nextStep} disabled={isSubmitting}>
              {isSubmitting
                ? 'Submitting...'
                : step === 6
                  ? 'Submit Application'
                  : step === 5
                    ? 'Review Application'
                    : step <= 2
                      ? personStep < personStepLabels.length
                        ? `Next: ${personStepLabels[personStep]} →`
                        : `Next: ${stepLabels[step]} →`
                      : step === 3
                        ? 'Next: Appointment →'
                        : `Next: ${stepLabels[step]} →`}
            </button>
          </div>
          {submitError && <p className="form-error" role="alert">{submitError}</p>}
        </section>
      </main>
    </div>
  )
}
