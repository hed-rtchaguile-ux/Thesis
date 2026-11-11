import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllMunicipalities, getAllProvinces, getBarangaysByMunicipality, getMunicipalitiesByProvince } from '@aivangogh/ph-address'
import { apiFetch, useAuth } from '../auth'
import { appointmentTimeOptions, formatAppointmentTime } from '../../appointmentTimeSlots'
import './ApplicantRegistration.css'

const stepLabels = ['Groom Info', 'Bride Info', 'Appointment', 'Payment', 'Review']
const personStepLabels = ['Name', 'Birth details', 'Residence & contact', 'Marital history', 'Father details', 'Mother details', 'Person who gave advice', 'Documents']
const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_DOCUMENT_BYTES = 10 * 1024 * 1024
const MAX_COMPRESSED_IMAGE_BYTES = 2 * 1024 * 1024
const FIXED_PAYMENT_METHOD = 'Over the counter (Cash)'
const FIXED_PAYMENT_AMOUNT = '₱ 250.00'
const REGISTRATION_DRAFT_TTL = 24 * 60 * 60 * 1000
let registrationDraftDatabasePromise
function getDataUrlSize(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Unable to read this file.'))
    reader.readAsDataURL(file)
  })
}

async function compressDocumentImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to process this photo.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    let compressedBlob
    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      compressedBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!compressedBlob) throw new Error('Unable to compress this photo.')
      if (compressedBlob.size <= MAX_COMPRESSED_IMAGE_BYTES) break
    }

    if (compressedBlob.size >= file.size) return file
    const fileName = file.name.replace(/\.[^.]+$/, '') || 'application-photo'
    return new File([compressedBlob], `${fileName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close()
  }
}

const documentFields = {
  groom: [
    { key: 'birthCertificateGroom', label: 'PSA Birth Certificate (Groom) *' },
    { key: 'certificateOfNoMarriageGroom', label: 'CENOMAR (Groom) *' },
    { key: 'validIdGroom', label: 'Valid ID (Groom) *' },
    { key: 'barangayClearanceGroom', label: 'Barangay Clearance / Residency (Groom) *' },
    { key: 'additionalRequirementGroom', label: 'Additional Requirement / Affidavit (Groom)' },
  ],
  bride: [
    { key: 'birthCertificateBride', label: 'PSA Birth Certificate (Bride) *' },
    { key: 'certificateOfNoMarriageBride', label: 'CENOMAR (Bride) *' },
    { key: 'validIdBride', label: 'Valid ID (Bride) *' },
    { key: 'barangayClearanceBride', label: 'Barangay Clearance / Residency (Bride) *' },
    { key: 'additionalRequirementBride', label: 'Additional Requirement / Affidavit (Bride)' },
  ],
}

const formDropdownOptions = {
  citizenship: [
    'Filipino',
    'American',
    'Australian',
    'British',
    'Canadian',
    'Chinese',
    'French',
    'German',
    'Indian',
    'Indonesian',
    'Italian',
    'Japanese',
    'Korean',
    'Malaysian',
    'Singaporean',
    'Spanish',
    'Thai',
    'Vietnamese',
  ],
}

const countryMetadataImport = () => import('countrycitystatejson/countries')
const cityDataImport = () => import('countrycitystatejson/client')
const philippinesNcrValue = 'Metro Manila'
const philippinesProvinceOptions = [
  ...getAllProvinces().map(({ name }) => name),
  philippinesNcrValue,
]

function getLocationFields(field) {
  const locationPart = ['Country', 'Province', 'City', 'Barangay'].find((part) => field.endsWith(part))
  if (!locationPart) return null

  const locationBase = field.slice(0, -locationPart.length)
  return {
    country: `${locationBase}Country`,
    province: `${locationBase}Province`,
    city: `${locationBase}City`,
    barangay: `${locationBase}Barangay`,
  }
}

function validateLocationFields(errors, form, locationBase, required = false) {
  const fields = [
    { field: `${locationBase}Country`, message: 'Select a country.' },
    { field: `${locationBase}Province`, message: 'Select a province or state.' },
    { field: `${locationBase}City`, message: 'Select a city or municipality.' },
  ]
  const hasLocationValue = fields.some(({ field }) => String(form[field] || '').trim())

  if (!required && !hasLocationValue) return

  fields.forEach(({ field, message }) => {
    if (!String(form[field] || '').trim()) errors[field] = message
  })
}

function getApplicantDocumentFields(form, applicant) {
  const applicantLabel = applicant === 'groom' ? 'Groom' : 'Bride'
  const fields = []
  const dissolutionMethod = (form[`${applicant}DissolutionMethod`] || '').toLowerCase()
  const civilStatus = (form[`${applicant}CivilStatus`] || '').toLowerCase()
  const citizenship = (form[`${applicant}Citizenship`] || '').trim().toLowerCase()
  const residenceCountry = (form[`${applicant}ResidenceCountry`] || '').trim().toLowerCase()
  const requiresCourtDecree = ['divorce', 'annulment'].includes(dissolutionMethod)
    || ['divorced', 'annulled'].includes(civilStatus)
  const requiresDeathCertificate = civilStatus === 'widowed' || dissolutionMethod === 'death of spouse'
  const requiresLegalCapacity = (citizenship !== '' && citizenship !== 'filipino')
    || (residenceCountry !== '' && residenceCountry !== 'philippines')
  const day = Number(form[`${applicant}DobDay`] || 0)
  const month = Number(form[`${applicant}DobMonth`] || 0)
  const year = Number(form[`${applicant}DobYear`] || 0)
  const birthDate = new Date(year, month - 1, day)
  const today = new Date()
  const isValidBirthDate = day > 0
    && month > 0
    && year > 0
    && birthDate.getFullYear() === year
    && birthDate.getMonth() === month - 1
    && birthDate.getDate() === day
    && birthDate < today
  let age = isValidBirthDate ? today.getFullYear() - birthDate.getFullYear() : null
  if (age !== null && (today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()))) age -= 1

  if (requiresCourtDecree) {
    fields.push({
      key: `divorceDecree${applicantLabel}`,
      label: `Court Order / Judicial Decree of Nullity of Marriage (${applicantLabel}) *`,
    })
  }

  if (requiresDeathCertificate) {
    fields.push({
      key: `deathCertificate${applicantLabel}`,
      label: `Death Certificate of Deceased Spouse (${applicantLabel}) *`,
    })
  }

  if (requiresLegalCapacity) {
    fields.push({
      key: `legalCapacity${applicantLabel}`,
      label: `Certificate of Legal Capacity to Contract Marriage (${applicantLabel}) *`,
    })
  }

  if (age !== null && age >= 18 && age <= 23) {
    fields.push({
      key: `parentalConsent${applicantLabel}`,
      label: `Parental Consent (Photo) (${applicantLabel}) *`,
      accept: 'image/*',
    })
  }

  if (age !== null && age >= 24 && age <= 27) {
    fields.push({
      key: `parentalAdvice${applicantLabel}`,
      label: `Parental Advice (${applicantLabel}) *`,
    })
  }

  return [...documentFields[applicant], ...fields]
}

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
  groomGender: 'Male',
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
  groomAdvisorName: '',
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
  groomDissolutionMethodOther: '',
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
  brideGender: 'Female',
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
  brideAdvisorName: '',
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
  brideDissolutionMethodOther: '',
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
  paymentMethod: FIXED_PAYMENT_METHOD,
  paymentAmount: FIXED_PAYMENT_AMOUNT,
}

const namePattern = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getLocalDateInputValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function isValidPastOrPresentDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)
    || year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const parsedDate = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsedDate.getTime())
    && parsedDate.toISOString().slice(0, 10) === value
    && value <= getLocalDateInputValue()
}

function getSampleApplicantFields(prefix, details) {
  const birthDate = `${details.birthMonth}/${details.birthDay}/${details.birthYear}`
  const fullName = `${details.firstName} ${details.middleName} ${details.lastName}`
  const residence = `123 Sample Street, Agtangao, Bangued, Abra, Philippines`
  const relativeResidence = (relative) => ({
    [`${prefix}${relative}ResidenceHouseNo`]: '123',
    [`${prefix}${relative}ResidenceStreet`]: 'Sample Street',
    [`${prefix}${relative}ResidenceBarangay`]: 'Agtangao',
    [`${prefix}${relative}ResidenceCity`]: 'Bangued',
    [`${prefix}${relative}ResidenceProvince`]: 'Abra',
    [`${prefix}${relative}ResidenceCountry`]: 'Philippines',
  })

  return {
    [`${prefix}FirstName`]: details.firstName,
    [`${prefix}MiddleName`]: details.middleName,
    [`${prefix}LastName`]: details.lastName,
    [`${prefix}Suffix`]: '',
    [`${prefix}DobDay`]: details.birthDay,
    [`${prefix}DobMonth`]: details.birthMonth,
    [`${prefix}DobYear`]: details.birthYear,
    [`${prefix}Age`]: '25',
    [`${prefix}BirthPlaceCity`]: 'Bangued',
    [`${prefix}BirthPlaceProvince`]: 'Abra',
    [`${prefix}BirthPlaceCountry`]: 'Philippines',
    [`${prefix}Citizenship`]: 'Filipino',
    [`${prefix}ResidenceHouseNo`]: '123',
    [`${prefix}ResidenceStreet`]: 'Sample Street',
    [`${prefix}ResidenceBarangay`]: 'Agtangao',
    [`${prefix}ResidenceCity`]: 'Bangued',
    [`${prefix}ResidenceProvince`]: 'Abra',
    [`${prefix}ResidenceCountry`]: 'Philippines',
    [`${prefix}Religion`]: 'Christian',
    [`${prefix}CivilStatus`]: 'Single',
    [`${prefix}FullName`]: fullName,
    [`${prefix}Dob`]: birthDate,
    [`${prefix}Mobile`]: details.mobile,
    [`${prefix}Email`]: details.email,
    [`${prefix}PlaceOfBirth`]: 'Bangued, Abra, Philippines',
    [`${prefix}Residence`]: residence,
    [`${prefix}FatherName`]: 'Sample Father',
    [`${prefix}MotherMaidenName`]: 'Sample Mother',
    [`${prefix}FatherFirstName`]: 'Sample',
    [`${prefix}FatherMiddleName`]: 'Parent',
    [`${prefix}FatherLastName`]: 'Father',
    [`${prefix}FatherCitizenship`]: 'Filipino',
    ...relativeResidence('Father'),
    [`${prefix}MotherMaidenFirstName`]: 'Sample',
    [`${prefix}MotherMaidenMiddleName`]: 'Parent',
    [`${prefix}MotherMaidenLastName`]: 'Mother',
    [`${prefix}MotherMaidenCitizenship`]: 'Filipino',
    ...relativeResidence('Mother'),
    [`${prefix}AdvisorName`]: 'Sample Advisor',
    [`${prefix}AdvisorRelationship`]: 'Parent',
    [`${prefix}AdvisorCitizenship`]: 'Filipino',
    ...relativeResidence('Advisor'),
    [`${prefix}PreviouslyMarried`]: 'No',
    [`${prefix}DissolutionMethod`]: '',
    [`${prefix}DissolutionMethodOther`]: '',
    [`${prefix}DissolutionPlace`]: '',
    [`${prefix}DissolutionDate`]: '',
    [`${prefix}DissolutionCity`]: '',
    [`${prefix}DissolutionProvince`]: '',
    [`${prefix}DissolutionCountry`]: '',
    [`${prefix}DissolutionDay`]: '',
    [`${prefix}DissolutionMonth`]: '',
    [`${prefix}DissolutionYear`]: '',
    [`${prefix}DegreeRelationship`]: 'Not related',
    [`${prefix}DateOfMarriage`]: '',
    [`${prefix}Occupation`]: 'Sample occupation',
    [`${prefix}ContactNumber`]: details.mobile,
    [`${prefix}ParentConsent`]: 'Sample parental advice',
    [`${prefix}Declaration`]: 'Sample information for testing only.',
  }
}

function FieldError({ message }) {
  return message ? <span className="field-error" role="alert">{message}</span> : null
}

function openRegistrationDraftDatabase() {
  if (!registrationDraftDatabasePromise) {
    registrationDraftDatabasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open('wedrings-registration-drafts', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('drafts', { keyPath: 'userEmail' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('Unable to open local draft storage.'))
    })
  }
  return registrationDraftDatabasePromise
}

async function getRegistrationDraft(userEmail) {
  const database = await openRegistrationDraftDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readonly')
    const request = transaction.objectStore('drafts').get(userEmail)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to restore the saved application form.'))
    transaction.onabort = () => reject(transaction.error || new Error('Unable to restore the saved application form.'))
  })
}

async function saveRegistrationDraft(draft) {
  const database = await openRegistrationDraftDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite')
    transaction.objectStore('drafts').put(draft)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error || new Error('Unable to save the application draft.'))
    transaction.onabort = () => reject(transaction.error || new Error('Unable to save the application draft.'))
  })
}

async function deleteRegistrationDraft(userEmail) {
  const database = await openRegistrationDraftDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite')
    transaction.objectStore('drafts').delete(userEmail)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error || new Error('Unable to clear the saved application form.'))
    transaction.onabort = () => reject(transaction.error || new Error('Unable to clear the saved application form.'))
  })
}

export default function ApplicantRegistration() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [personStep, setPersonStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [applicationEligibility, setApplicationEligibility] = useState('checking')
  const [customDropdownFields, setCustomDropdownFields] = useState({})
  const [documents, setDocuments] = useState({})
  const [processingDocuments, setProcessingDocuments] = useState({})
  const isProcessingDocument = Object.values(processingDocuments).some(Boolean)
  const [countryMetadata, setCountryMetadata] = useState(null)
  const [countryMetadataStatus, setCountryMetadataStatus] = useState('idle')
  const [cityData, setCityData] = useState({})
  const [cityDataStatus, setCityDataStatus] = useState({})
  const [validationErrors, setValidationErrors] = useState({})
  const [appointmentSlots, setAppointmentSlots] = useState([])
  const [appointmentSlotsStatus, setAppointmentSlotsStatus] = useState('idle')
  const [appointmentSlotsRefresh, setAppointmentSlotsRefresh] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileInputRefs = useRef({})
  const countryMetadataPromiseRef = useRef(null)
  const cityDataModuleRef = useRef(null)
  const cityDataPromiseRef = useRef({})

  const currentTitle = stepLabels[step - 1]
  const isPersonInformationStep = step === 1 || step === 2
  const person = step === 1 ? 'groom' : 'bride'
  const personAge = getAgeFromDob(person)
  const skipsAdvisorStep = personAge !== null && (personAge < 18 || personAge >= 28)
  const advisorStepTitle = personAge !== null && personAge >= 18 && personAge <= 23
    ? 'Person Who Gave Parental Consent'
    : personAge !== null && personAge >= 24 && personAge <= 27
      ? 'Person Who Gave Parental Advice'
      : 'Person Who Gave Consent or Advice'
  const displayedPersonStep = skipsAdvisorStep && personStep > 7 ? personStep - 1 : personStep
  const personStepCount = skipsAdvisorStep ? personStepLabels.length - 1 : personStepLabels.length
  const progressLabel = isPersonInformationStep ? `Step ${displayedPersonStep} of ${personStepCount}` : `Step ${step} of ${stepLabels.length}`
  const nextPersonStep = personStep === 6 && skipsAdvisorStep ? 8 : personStep + 1
  const currentPersonStepLabel = personStep === 7 ? advisorStepTitle : personStepLabels[personStep - 1]
  const nextPersonStepLabel = nextPersonStep === 7 ? advisorStepTitle : personStepLabels[nextPersonStep - 1]
  const groomDocumentFields = getApplicantDocumentFields(form, 'groom')
  const brideDocumentFields = getApplicantDocumentFields(form, 'bride')
  const personDocumentFields = person === 'groom' ? groomDocumentFields : brideDocumentFields
  const allDocumentFields = [...groomDocumentFields, ...brideDocumentFields]
  const draftUserEmail = String(user?.email || '').trim().toLowerCase()

  useEffect(() => {
    let active = true
    if (!draftUserEmail) {
      setDraftLoaded(true)
      return () => {
        active = false
      }
    }

    getRegistrationDraft(draftUserEmail)
      .then(async (draft) => {
        if (!draft) return
        if (Date.now() - draft.savedAt > REGISTRATION_DRAFT_TTL) {
          await deleteRegistrationDraft(draftUserEmail)
          return
        }
        if (!active) return

        setForm({ ...initialForm, ...draft.form })
        setStep(Number.isInteger(draft.step) && draft.step >= 1 && draft.step <= 5 ? draft.step : 1)
        setPersonStep(Number.isInteger(draft.personStep) && draft.personStep >= 1 && draft.personStep <= 8 ? draft.personStep : 1)
        setDocuments(draft.documents || {})
        setCustomDropdownFields(draft.customDropdownFields || {})
      })
      .catch((error) => {
        console.error('Unable to restore the saved application form:', error)
        if (active) setDraftError('Unable to restore the saved form on this device.')
      })
      .finally(() => {
        if (active) setDraftLoaded(true)
      })

    return () => {
      active = false
    }
  }, [draftUserEmail])

  useEffect(() => {
    if (!draftLoaded || !draftUserEmail || applicationEligibility !== 'available') return undefined

    const timeout = window.setTimeout(() => {
      saveRegistrationDraft({
        userEmail: draftUserEmail,
        savedAt: Date.now(),
        step,
        personStep,
        form,
        documents,
        customDropdownFields,
      }).then(() => setDraftError('')).catch((error) => {
        console.error('Unable to save the application draft:', error)
        setDraftError('This form could not be saved on this device. Keep this page open until your application is submitted.')
      })
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [applicationEligibility, customDropdownFields, documents, draftLoaded, draftUserEmail, form, personStep, step])

  useEffect(() => {
    let active = true
    apiFetch('/api/applications')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to verify whether this account can apply.')
        return response.json()
      })
      .then((records) => {
        if (active) setApplicationEligibility(records.length > 0 ? 'blocked' : 'available')
      })
      .catch(() => {
        if (active) setApplicationEligibility('error')
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const appointmentDate = form.appointmentDate
    if (!draftLoaded || !appointmentDate) {
      setAppointmentSlots([])
      setAppointmentSlotsStatus('idle')
      return () => {
        active = false
      }
    }

    setAppointmentSlots([])
    setAppointmentSlotsStatus('loading')
    apiFetch(`/api/appointment-slots?date=${encodeURIComponent(appointmentDate)}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load appointment availability.')
        if (!Array.isArray(result.slots)) throw new Error('The appointment availability response was invalid.')
        return result.slots
      })
      .then((slots) => {
        if (!active) return
        setAppointmentSlots(slots)
        setAppointmentSlotsStatus('ready')
        setValidationErrors((current) => ({ ...current, appointmentTime: '' }))
        setForm((currentForm) => {
          if (currentForm.appointmentDate !== appointmentDate || !currentForm.appointmentTime) return currentForm
          const selectedSlot = slots.find((slot) => slot.value === currentForm.appointmentTime)
          return selectedSlot?.available ? currentForm : { ...currentForm, appointmentTime: '' }
        })
      })
      .catch((error) => {
        if (!active) return
        setAppointmentSlotsStatus('error')
        setValidationErrors((current) => ({ ...current, appointmentTime: error.message }))
      })

    return () => {
      active = false
    }
  }, [appointmentSlotsRefresh, draftLoaded, form.appointmentDate])

  async function checkApplicationEligibility() {
    setApplicationEligibility('checking')
    try {
      const response = await apiFetch('/api/applications')
      if (!response.ok) throw new Error('Unable to verify whether this account can apply.')
      const records = await response.json()
      setApplicationEligibility(records.length > 0 ? 'blocked' : 'available')
    } catch {
      setApplicationEligibility('error')
    }
  }

  function handleLogout() {
    if (draftUserEmail) {
      deleteRegistrationDraft(draftUserEmail).catch((error) => {
        console.error('Unable to clear the saved application form:', error)
      })
    }
    logout()
    navigate('/login', { replace: true })
  }

  async function autofillRegistration() {
    if (!window.confirm('Replace the current form entries with sample information and sample documents? Do not submit this test application.')) {
      return
    }

    await loadCountryMetadata()
    const sampleForm = {
      ...initialForm,
      ...getSampleApplicantFields('groom', {
        firstName: 'Alex',
        middleName: 'Sample',
        lastName: 'Applicant',
        birthMonth: '01',
        birthDay: '15',
        birthYear: '2001',
        mobile: '09123456789',
        email: 'groom@example.com',
      }),
      ...getSampleApplicantFields('bride', {
        firstName: 'Jamie',
        middleName: 'Sample',
        lastName: 'Applicant',
        birthMonth: '02',
        birthDay: '20',
        birthYear: '2001',
        mobile: '09987654321',
        email: 'bride@example.com',
      }),
      appointmentDate: (() => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const localDate = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        return localDate.toISOString().slice(0, 10)
      })(),
      appointmentTime: '09:00',
      appointmentLocation: 'Villaverde',
      paymentMethod: FIXED_PAYMENT_METHOD,
      paymentAmount: FIXED_PAYMENT_AMOUNT,
    }
    const sampleImage = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#f3f5fa"/><rect x="24" y="24" width="592" height="372" rx="16" fill="white" stroke="#53689f" stroke-width="4"/><text x="320" y="190" text-anchor="middle" font-family="Arial" font-size="32" fill="#53689f">SAMPLE ONLY</text><text x="320" y="238" text-anchor="middle" font-family="Arial" font-size="20" fill="#53689f">NOT A REAL DOCUMENT</text></svg>')}`
    const sampleDocuments = [
      ...getApplicantDocumentFields(sampleForm, 'groom'),
      ...getApplicantDocumentFields(sampleForm, 'bride'),
    ]

    setForm(sampleForm)
    setDocuments(Object.fromEntries(sampleDocuments.map(({ key }) => [
      key,
      { name: `SAMPLE-${key}.svg`, type: 'image/svg+xml', dataUrl: sampleImage },
    ])))
    setCustomDropdownFields({})
    setValidationErrors({})
    setSubmitError('')
    setStep(1)
    setPersonStep(1)
    Object.values(fileInputRefs.current).forEach((input) => {
      if (input) input.value = ''
    })
  }

  async function loadCountryMetadata() {
    if (countryMetadata) return

    if (!countryMetadataPromiseRef.current) {
      setCountryMetadataStatus('loading')
      countryMetadataPromiseRef.current = countryMetadataImport()
    }

    try {
      const loadedMetadata = await countryMetadataPromiseRef.current
      setCountryMetadata(loadedMetadata)
      setCountryMetadataStatus('ready')
    } catch (error) {
      countryMetadataPromiseRef.current = null
      setCountryMetadataStatus('error')
      console.error('Unable to load country and region data.', error)
    }
  }

  async function loadCityData(countryCode) {
    if (cityData[countryCode]) return
    if (cityDataPromiseRef.current[countryCode]) return cityDataPromiseRef.current[countryCode]

    setCityDataStatus((currentStatus) => ({ ...currentStatus, [countryCode]: 'loading' }))
    cityDataPromiseRef.current[countryCode] = (async () => {
      try {
        if (!cityDataModuleRef.current) cityDataModuleRef.current = cityDataImport()
        const cityModule = await cityDataModuleRef.current
        const countryData = await cityModule.preloadCountry(countryCode)
        if (!countryData) throw new Error(`No city data is available for country ${countryCode}.`)

        setCityData((currentData) => ({ ...currentData, [countryCode]: countryData }))
        setCityDataStatus((currentStatus) => ({ ...currentStatus, [countryCode]: 'ready' }))
      } catch (error) {
        delete cityDataPromiseRef.current[countryCode]
        setCityDataStatus((currentStatus) => ({ ...currentStatus, [countryCode]: 'error' }))
        console.error(`Unable to load city data for ${countryCode}.`, error)
      }
    })()

    return cityDataPromiseRef.current[countryCode]
  }

  function updateField(field, value) {
    const previouslyMarriedField = /^(groom|bride)PreviouslyMarried$/.exec(field)
    const locationFields = getLocationFields(field)
    const locationPart = ['Country', 'Province', 'City', 'Barangay'].find((part) => field.endsWith(part))
    const dependentLocationFields = locationFields
      ? locationPart === 'Country'
        ? [locationFields.province, locationFields.city, locationFields.barangay]
        : locationPart === 'Province'
          ? [locationFields.city, locationFields.barangay]
          : locationPart === 'City'
            ? [locationFields.barangay]
            : []
      : []

    setForm((current) => {
      const nextForm = {
        ...current,
        [field]: value,
        ...(field === 'appointmentDate' && current.appointmentDate !== value ? { appointmentTime: '' } : {}),
        ...(/^(groom|bride)DissolutionMethod$/.test(field) && value !== 'Other'
          ? { [`${field.slice(0, -'DissolutionMethod'.length)}DissolutionMethodOther`]: '' }
          : {}),
      }
      dependentLocationFields.forEach((dependentField) => {
        nextForm[dependentField] = ''
      })

      if (previouslyMarriedField && value === 'No') {
        const dissolutionFields = ['DissolutionMethod', 'DissolutionMethodOther', 'DissolutionPlace', 'DissolutionDate', 'DissolutionCity', 'DissolutionProvince', 'DissolutionCountry', 'DissolutionDay', 'DissolutionMonth', 'DissolutionYear']
        dissolutionFields.forEach((suffix) => {
          nextForm[`${previouslyMarriedField[1]}${suffix}`] = ''
        })
      }
      return nextForm
    })
    if (dependentLocationFields.length > 0) {
      setCustomDropdownFields((currentFields) => {
        const nextFields = { ...currentFields }
        dependentLocationFields.forEach((dependentField) => {
          delete nextFields[dependentField]
        })
        return nextFields
      })
    }
    const dateErrorField = /^(groom|bride)Dob(?:Day|Month|Year)$/.exec(field)?.[1]
    setValidationErrors((current) => ({
      ...current,
      [field]: '',
      ...(dateErrorField ? { [`${dateErrorField}Dob`]: '' } : {}),
    }))
    if (field === 'appointmentTime') setSubmitError('')
  }

  function renderDropdownField(field, label, optionKey, className = '', style) {
    const value = form[field] ?? ''
    const worldCountries = countryMetadata
      ? countryMetadata.getCountries().map(({ name, shortName }) => ({ name, isoCode: shortName })).sort((a, b) => a.name.localeCompare(b.name))
      : []
    const countryNames = worldCountries.map(({ name }) => name)
    const citizenshipOptions = formDropdownOptions.citizenship
    const locationFields = getLocationFields(field)
    const selectedCountry = locationFields
      ? worldCountries.find(({ name }) => name === form[locationFields.country])
      : null
    const states = selectedCountry
      ? countryMetadata.getStatesByShort(selectedCountry.isoCode) || []
      : []
    const regions = selectedCountry?.isoCode === 'PH'
      ? philippinesProvinceOptions
      : selectedCountry?.isoCode === 'US'
      ? states.filter((stateName) => !/^[A-Z]{2}$/.test(stateName))
      : states
    const selectedProvince = locationFields
      ? regions.find((regionName) => regionName === form[locationFields.province])
      : null
    const selectedProvinceCode = selectedCountry?.isoCode === 'PH'
      ? selectedProvince === philippinesNcrValue
        ? '1300000000'
        : getAllProvinces().find(({ name }) => name === selectedProvince)?.psgcCode
      : null
    const selectedMunicipality = selectedCountry?.isoCode === 'PH'
      ? getAllMunicipalities().find(({ name, provinceCode }) => (
        name === form[locationFields.city] && provinceCode === selectedProvinceCode
      ))
      : null
    const countryCityDataLoaded = selectedCountry?.isoCode === 'PH'
      ? true
      : Boolean(cityData[selectedCountry?.isoCode])
    let options

    if (optionKey === 'country') options = countryNames
    else if (optionKey === 'citizenship') options = citizenshipOptions
    else if (optionKey === 'province') options = regions
    else if (optionKey === 'city') {
      const countryRegions = cityData[selectedCountry?.isoCode]?.states || {}
      const cities = selectedCountry?.isoCode === 'PH'
        ? selectedProvince === philippinesNcrValue
          ? getAllMunicipalities().filter(({ provinceCode }) => provinceCode === '1300000000')
          : getMunicipalitiesByProvince(
            getAllProvinces().find(({ name }) => name === selectedProvince)?.psgcCode || '',
          )
        : selectedProvince
          ? countryRegions[selectedProvince] || []
          : regions.length === 0
            ? Object.values(countryRegions).flat()
            : []
      options = [...new Set(cities.map((city) => typeof city === 'string' ? city : city.name).filter(Boolean))]
    } else if (optionKey === 'barangay' && selectedCountry?.isoCode === 'PH') {
      options = selectedMunicipality
        ? getBarangaysByMunicipality(selectedMunicipality.psgcCode).map(({ name }) => name)
        : []
    } else options = formDropdownOptions[optionKey]

    const isBarangayUnavailable = optionKey === 'barangay'
      && form[locationFields?.country] !== 'Philippines'
    if (isBarangayUnavailable) return null

    const isCustomValue = value !== ''
      && !(optionKey === 'city' && !countryCityDataLoaded)
      && !(optionKey === 'country' && !countryMetadata)
      && !options.includes(value)
    const isCustom = customDropdownFields[field] || isCustomValue
    const selectedValue = isCustom ? '__other' : value
    const fieldLabel = optionKey === 'province'
      ? selectedCountry?.isoCode === 'US' ? 'State' : 'Province / Region'
      : label
    const cityRequiresRegion = optionKey === 'city'
      && selectedCountry
      && (selectedCountry.isoCode === 'PH' || regions.length > 0)
      && !selectedProvince
      && !customDropdownFields[locationFields?.province]
    const customCountry = locationFields && customDropdownFields[locationFields.country]
    const isDisabled = (optionKey === 'province' && !selectedCountry && !customCountry)
      || (optionKey === 'city' && (
        (!selectedCountry && !customCountry)
        || (customCountry && !customDropdownFields[locationFields.province])
        || cityRequiresRegion
      ))
      || (optionKey === 'barangay' && selectedCountry?.isoCode === 'PH' && !form[locationFields.city])
    const selectedCountryCityStatus = selectedCountry ? cityDataStatus[selectedCountry.isoCode] : ''

    return (
      <div className={`field-group ${className}`.trim()} style={style}>
        <label htmlFor={field}>{fieldLabel}</label>
        <select
          id={field}
          value={selectedValue}
          disabled={isDisabled}
          aria-invalid={Boolean(validationErrors[field])}
          onChange={(event) => {
            const selectingOther = event.target.value === '__other'
            setCustomDropdownFields((currentFields) => ({ ...currentFields, [field]: selectingOther }))
            updateField(field, selectingOther ? '' : event.target.value)
            if (optionKey === 'country' && event.target.value !== '__other') {
              const country = worldCountries.find(({ name }) => name === event.target.value)
              if (country && country.isoCode !== 'PH') void loadCityData(country.isoCode)
            }
          }}
          onFocus={() => {
            if (optionKey === 'country' && !countryMetadata) {
              void loadCountryMetadata()
            }
            if (optionKey === 'city' && selectedCountry && selectedCountry.isoCode !== 'PH') {
              void loadCityData(selectedCountry.isoCode)
            }
          }}
        >
          <option value="">
            {isDisabled
              ? 'Select the previous location first'
              : optionKey === 'city' && selectedCountryCityStatus === 'loading'
                ? 'Loading city list...'
                : optionKey === 'country' && countryMetadataStatus === 'loading'
                  ? 'Loading options...'
                : `Select ${fieldLabel.toLowerCase()}`}
          </option>
          {(optionKey === 'country' && !countryMetadata && value)
            && <option value={value}>{value}</option>}
          {optionKey === 'city' && !countryCityDataLoaded && value && <option value={value}>{value}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {optionKey === 'province' && option === philippinesNcrValue ? 'Metro Manila (NCR)' : option}
            </option>
          ))}
          <option value="__other">Other</option>
        </select>
        {optionKey === 'country' && countryMetadataStatus === 'error' && (
          <span className="field-error" role="alert">
            Country list unavailable. <button type="button" onClick={() => void loadCountryMetadata()}>Retry</button>
          </span>
        )}
        {optionKey === 'city' && selectedCountry?.isoCode !== 'PH' && selectedCountryCityStatus === 'error' && (
          <span className="field-error" role="alert">
            City list unavailable. <button type="button" onClick={() => void loadCityData(selectedCountry.isoCode)}>Retry</button>
          </span>
        )}
        <FieldError message={validationErrors[field]} />
        {isCustom && (
          <input
            value={value}
            onChange={(event) => updateField(field, event.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
            aria-label={`Other ${label.toLowerCase()}`}
            aria-invalid={Boolean(validationErrors[field])}
          />
        )}
      </div>
    )
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

  function getDateOfBirthInputValue(prefix) {
    const day = String(form[`${prefix}DobDay`] || '').padStart(2, '0')
    const month = String(form[`${prefix}DobMonth`] || '').padStart(2, '0')
    const year = String(form[`${prefix}DobYear`] || '')
    return day && month && year ? `${year}-${month}-${day}` : ''
  }

  function getDissolutionDateInputValue(prefix) {
    const day = String(form[`${prefix}DissolutionDay`] || '').padStart(2, '0')
    const month = String(form[`${prefix}DissolutionMonth`] || '').padStart(2, '0')
    const year = String(form[`${prefix}DissolutionYear`] || '')
    return day && month && year ? `${year}-${month}-${day}` : ''
  }

  function updateDateOfBirth(prefix, value) {
    const [year = '', month = '', day = ''] = value.split('-')
    setForm((currentForm) => ({
      ...currentForm,
      [`${prefix}DobDay`]: day,
      [`${prefix}DobMonth`]: month,
      [`${prefix}DobYear`]: year,
      [`${prefix}Dob`]: value ? `${month}/${day}/${year}` : '',
    }))
    setValidationErrors((currentErrors) => ({ ...currentErrors, [`${prefix}Dob`]: '' }))
  }

  function updateDissolutionDate(prefix, value) {
    const [year = '', month = '', day = ''] = value.split('-')
    setForm((currentForm) => ({
      ...currentForm,
      [`${prefix}DissolutionDay`]: day,
      [`${prefix}DissolutionMonth`]: month,
      [`${prefix}DissolutionYear`]: year,
    }))
    setValidationErrors((currentErrors) => ({ ...currentErrors, [`${prefix}DissolutionDate`]: '' }))
  }

  function nextStep() {
    if (isPersonInformationStep) {
      const errors = validatePersonStep(person, personStep)
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors)
        return
      }

      if (personStep < personStepLabels.length) {
        setPersonStep(nextPersonStep)
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

    setStep((current) => Math.min(current + 1, 5))
  }

  function prevStep() {
    if (step === 1) {
      if (personStep > 1) {
        setPersonStep((current) => current - 1)
      }
      return
    }

    if (isPersonInformationStep && personStep === 1) {
      setStep((current) => current - 1)
      setPersonStep(personStepLabels.length)
      return
    }

    if (step === 3) {
      setStep(2)
      setPersonStep(personStepLabels.length)
      return
    }

    if (isPersonInformationStep && personStep > 1) {
      setPersonStep((current) => skipsAdvisorStep && current === 8 ? 6 : current - 1)
      return
    }

    setStep((current) => current - 1)
    setPersonStep(1)
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
      validateLocationFields(errors, form, `${prefix}BirthPlace`, true)
    }

    if (currentPersonStep === 3) {
      const mobile = (form[`${prefix}Mobile`] || '').replace(/\D/g, '')
      const email = (form[`${prefix}Email`] || '').trim()

      if (!form[`${prefix}CivilStatus`]) errors[`${prefix}CivilStatus`] = 'Select a civil status.'
      if (!/^09\d{9}$/.test(mobile)) errors[`${prefix}Mobile`] = 'Enter an 11-digit mobile number starting with 09.'
      if (email.toLowerCase() !== 'n/a' && !emailPattern.test(email)) {
        errors[`${prefix}Email`] = 'Enter a valid email address or N/A if unavailable.'
      }
      validateLocationFields(errors, form, `${prefix}Residence`, true)
    }

    if (currentPersonStep === 4 && form[`${prefix}PreviouslyMarried`] === 'Yes') {
      if (form[`${prefix}DissolutionMethod`] === 'Other'
        && !String(form[`${prefix}DissolutionMethodOther`] || '').trim()) {
        errors[`${prefix}DissolutionMethodOther`] = 'Describe how the marriage was dissolved.'
      }
      validateLocationFields(errors, form, `${prefix}Dissolution`, true)
      const dissolutionDate = getDissolutionDateInputValue(prefix)
      if (!isValidPastOrPresentDate(dissolutionDate)) {
        errors[`${prefix}DissolutionDate`] = 'Enter a valid date that is not in the future.'
      }
    }

    if (currentPersonStep === 4 && !form[`${prefix}PreviouslyMarried`]) {
      errors[`${prefix}PreviouslyMarried`] = 'Select Yes or No to continue.'
    }

    if (currentPersonStep === 5 || currentPersonStep === 6) {
      const relative = currentPersonStep === 5 ? 'Father' : 'Mother'
      validateLocationFields(errors, form, `${prefix}${relative}Residence`)
    }

    if (currentPersonStep === 7) {
      const age = getAgeFromDob(prefix)
      const requiresAdvisorInfo = age !== null && age >= 18 && age <= 27
      validateLocationFields(errors, form, `${prefix}AdvisorResidence`, requiresAdvisorInfo)

      if (requiresAdvisorInfo) {
        const requiredAdvisorFields = [
          `${prefix}AdvisorName`,
          `${prefix}AdvisorRelationship`,
          `${prefix}AdvisorCitizenship`,
          `${prefix}AdvisorResidenceHouseNo`,
          `${prefix}AdvisorResidenceStreet`,
        ]
        if (form[`${prefix}AdvisorResidenceCountry`] === 'Philippines') {
          requiredAdvisorFields.push(`${prefix}AdvisorResidenceBarangay`)
        }
        requiredAdvisorFields.forEach((field) => {
          if (!form[field] || !String(form[field]).trim()) errors[field] = 'Required for applicants age 18 to 27.'
        })
      }
    }

    if (currentPersonStep === 8) {
      personDocumentFields.filter(({ label }) => label.endsWith('*')).forEach(({ key }) => {
        if (!documents[key]) errors[key] = 'This document is required.'
      })
      personDocumentFields.forEach(({ key }) => {
        if (processingDocuments[key]) errors[key] = 'Wait for the file to finish processing.'
      })
    }

    return errors
  }

  function validateStep(currentStep) {
    const errors = {}

    if (currentStep === 3) {
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
      } else if (appointmentSlotsStatus !== 'ready'
        || !appointmentSlots.some((slot) => slot.value === form.appointmentTime && slot.available)) {
        errors.appointmentTime = appointmentSlotsStatus === 'error'
          ? 'Unable to verify appointment availability. Please try again.'
          : 'Choose an available appointment time.'
      }
    }

    if (currentStep === 4) {
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

    if (draftUserEmail) {
      try {
        await saveRegistrationDraft({
          userEmail: draftUserEmail,
          savedAt: Date.now(),
          step,
          personStep,
          form,
          documents,
          customDropdownFields,
        })
      } catch (error) {
        console.error('Unable to save the application before submission:', error)
      }
    }

    const submittedForm = {
      ...form,
      paymentMethod: FIXED_PAYMENT_METHOD,
      paymentAmount: FIXED_PAYMENT_AMOUNT,
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
          documents: Object.fromEntries(allDocumentFields.filter(({ key }) => documents[key]).map(({ key }) => [
            key,
            typeof documents[key] === 'string' ? documents[key] : documents[key].dataUrl,
          ])),
        }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        if (response.status === 409) setAppointmentSlotsRefresh((current) => current + 1)
        const message = result?.message || (response.status === 413
          ? 'The application documents are too large to submit. Reduce the file sizes and try again.'
          : 'Unable to submit application.')
        throw new Error(message)
      }
      if (draftUserEmail) {
        deleteRegistrationDraft(draftUserEmail).catch((error) => {
          console.error('Unable to clear the submitted application draft:', error)
        })
      }
      navigate('/applicant/dashboard')
    } catch (error) {
      setSubmitError(error instanceof TypeError
        ? 'Unable to reach the server. Check your connection and try again.'
        : error.message)
      setIsSubmitting(false)
    }
  }

  async function handleDocumentSelect(key, event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    event.target.value = ''
    if (selectedFile.size > MAX_DOCUMENT_FILE_BYTES) {
      setValidationErrors((current) => ({ ...current, [key]: 'Each file must be 5 MB or smaller.' }))
      return
    }

    setProcessingDocuments((current) => ({ ...current, [key]: true }))
    setValidationErrors((current) => ({ ...current, [key]: '' }))
    try {
      const processedFile = await compressDocumentImage(selectedFile)
      const dataUrl = await readFileAsDataUrl(processedFile)
      const currentTotalBytes = Object.entries(documents)
        .filter(([documentKey]) => documentKey !== key)
        .reduce((total, [, document]) => {
          const existingDataUrl = typeof document === 'string' ? document : document.dataUrl
          return total + (existingDataUrl ? getDataUrlSize(existingDataUrl) : 0)
        }, 0)

      if (currentTotalBytes + processedFile.size > MAX_TOTAL_DOCUMENT_BYTES) {
        throw new Error('All application documents together must be 8 MB or smaller.')
      }

      setDocuments((current) => ({
        ...current,
        [key]: {
          name: processedFile.name,
          type: processedFile.type,
          dataUrl,
        },
      }))
      setValidationErrors((current) => ({ ...current, [key]: '' }))
    } catch (error) {
      setValidationErrors((current) => ({
        ...current,
        [key]: error.message || 'Unable to process this file.',
      }))
    } finally {
      setProcessingDocuments((current) => ({ ...current, [key]: false }))
    }
  }

  const renderGroomBrideForm = () => {
    const firstField = `${person}FirstName`
    const middleField = `${person}MiddleName`
    const lastField = `${person}LastName`
    const suffixField = `${person}Suffix`
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
    const renderLabeledRelativeField = (fieldSuffix, label) => {
      const field = `${person}${fieldSuffix}`
      const dropdownOptionKey = {
        Citizenship: 'citizenship',
        Country: 'country',
        Province: 'province',
        'City/Municipality': 'city',
        Barangay: 'barangay',
      }[label]

      return (
        <div key={fieldSuffix}>
          {dropdownOptionKey
            ? renderDropdownField(field, label, dropdownOptionKey)
            : <div className="field-group"><label htmlFor={field}>{label}</label><input id={field} value={form[field] ?? ''} onChange={(event) => updateField(field, event.target.value)} placeholder={label} /><FieldError message={validationErrors[field]} /></div>}
        </div>
      )
    }

    return (
      <>
        <div className="two-box-layout">
          <div className="formal-box">
            <div className="registration-section-title-row">
              <div className="formal-box-title">1. {personStepLabels[personStep - 1]}</div>
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
              <div className="field-group">
                <label>Date of Birth *</label>
                <input
                  type="date"
                  value={getDateOfBirthInputValue(person)}
                  onChange={(event) => updateDateOfBirth(person, event.target.value)}
                  max={getLocalDateInputValue()}
                  aria-invalid={Boolean(validationErrors[`${person}Dob`])}
                  required
                />
                <FieldError message={validationErrors[`${person}Dob`]} />
              </div>
            </div>

            <div className="form-grid two-col">
              <div className="field-group">
                <label>Gender</label>
                <input value={form[genderField]} readOnly aria-readonly="true" />
                <FieldError message={validationErrors[genderField]} />
              </div>
            </div>
            <FieldError message={validationErrors[`${person}Dob`]} />

            <div className="form-grid three-col">
              {renderDropdownField(birthCountryField, 'Country', 'country')}
              {renderDropdownField(birthProvinceField, 'Province', 'province')}
              {renderDropdownField(birthCityField, 'City/Municipality', 'city')}
            </div>
            </>}

            {personStep === 3 && <>
            <div className="form-grid two-col">
              {renderDropdownField(citizenshipField, 'Citizenship', 'citizenship')}

              <div className="field-group">
                <label>Civil Status</label>
                <select value={form[civilStatusField]} onChange={(e) => updateField(civilStatusField, e.target.value)}>
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Divorced">Divorced</option>
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

            <div className="form-grid three-col">
              {renderDropdownField(residenceCountryField, 'Country', 'country')}
              {renderDropdownField(residenceProvinceField, 'Province', 'province')}
              {renderDropdownField(residenceCityField, 'City/Municipality', 'city')}

              <div className="field-group">
                <label>House Number</label>
                <input value={form[houseNoField]} onChange={(e) => updateField(houseNoField, e.target.value)} placeholder="House No." />
              </div>

              {renderDropdownField(barangayField, 'Barangay', 'barangay')}

              <div className="field-group">
                <label>Street</label>
                <input value={form[streetField]} onChange={(e) => updateField(streetField, e.target.value)} placeholder="Street" />
              </div>
            </div>

            <div className="form-grid two-col">
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
              <label>Email Address (enter N/A if unavailable) *</label>
              <input
                value={form[emailField]}
                onChange={(e) => updateField(emailField, e.target.value)}
                placeholder="you@example.com or N/A"
                type="text"
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
              <div className="yes-no-toggle" role="radiogroup" aria-label="Were you previously married?" aria-invalid={Boolean(validationErrors[`${person}PreviouslyMarried`])}>
                {['Yes', 'No'].map((answer) => (
                  <label key={answer} className={`yes-no-option ${form[`${person}PreviouslyMarried`] === answer ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`${person}PreviouslyMarried`}
                      value={answer}
                      checked={form[`${person}PreviouslyMarried`] === answer}
                      onChange={() => updateField(`${person}PreviouslyMarried`, answer)}
                    />
                    <span>{answer}</span>
                  </label>
                ))}
              </div>
              <FieldError message={validationErrors[`${person}PreviouslyMarried`]} />
            </div>

            {form[`${person}PreviouslyMarried`] === 'Yes' && (
              <>
                <div className="field-group single-line-field" style={{ marginTop: '16px' }}>
                  <label>How was the marriage dissolved?</label>
                  <select
                    value={form[`${person}DissolutionMethod`] ?? ''}
                    onChange={(event) => updateField(`${person}DissolutionMethod`, event.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="Death of spouse">Death of spouse</option>
                    <option value="Divorce">Divorce</option>
                    <option value="Annulment">Annulment</option>
                    <option value="Legal separation">Legal separation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {form[`${person}DissolutionMethod`] === 'Other' && (
                  <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                    <label htmlFor={`${person}-dissolution-method-other`}>Please specify</label>
                    <input
                      id={`${person}-dissolution-method-other`}
                      value={form[`${person}DissolutionMethodOther`] ?? ''}
                      onChange={(event) => updateField(`${person}DissolutionMethodOther`, event.target.value)}
                      placeholder="Describe how it was dissolved"
                      maxLength={200}
                      required
                      aria-invalid={Boolean(validationErrors[`${person}DissolutionMethodOther`])}
                    />
                    <FieldError message={validationErrors[`${person}DissolutionMethodOther`]} />
                  </div>
                )}

                <div className="form-grid three-col" style={{ marginTop: '12px' }}>
                  {renderDropdownField(`${person}DissolutionCountry`, 'Country', 'country')}
                  {renderDropdownField(`${person}DissolutionProvince`, 'Province', 'province')}
                  {renderDropdownField(`${person}DissolutionCity`, 'City/Municipality', 'city')}
                </div>

                <div className="field-group" style={{ marginTop: '12px' }}>
                  <label htmlFor={`${person}-dissolution-date`}>Date the marriage was dissolved</label>
                  <input
                    id={`${person}-dissolution-date`}
                    type="date"
                    value={getDissolutionDateInputValue(person)}
                    max={getLocalDateInputValue()}
                    required
                    onChange={(event) => updateDissolutionDate(person, event.target.value)}
                  />
                  <FieldError message={validationErrors[`${person}DissolutionDate`]} />
                </div>
              </>
            )}
          </div>
          </>}

          {personStep === 5 && <>
            <div className="formal-box">
              <div className="field-group single-line-field">
                <label className="family-section-label">Name of Father</label>
                <div className="form-grid three-col">
                  {renderLabeledRelativeField('FatherFirstName', 'First Name')}
                  {renderLabeledRelativeField('FatherMiddleName', 'Middle Name')}
                  {renderLabeledRelativeField('FatherLastName', 'Last Name')}
                </div>
              </div>

              {renderDropdownField(`${person}FatherCitizenship`, 'Citizenship', 'citizenship', 'single-line-field', { marginTop: '12px' })}

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label className="family-section-label">Residence</label>
                <div className="form-grid two-col" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('FatherResidenceCountry', 'Country')}
                  {renderLabeledRelativeField('FatherResidenceProvince', 'Province')}
                </div>
                <div className="form-grid three-col" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('FatherResidenceCity', 'City/Municipality')}
                  {renderLabeledRelativeField('FatherResidenceHouseNo', 'House No.')}
                  {renderLabeledRelativeField('FatherResidenceBarangay', 'Barangay')}
                </div>
                <div className="form-grid" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('FatherResidenceStreet', 'Street')}
                </div>
              </div>
            </div>
          </>}

          {personStep === 6 && <>
            <div className="formal-box">
              <div className="formal-box-title">Mother's Maiden Name and Information</div>
              <div className="field-group single-line-field" style={{ marginTop: '18px' }}>
                <label className="family-section-label">Maiden Name of Mother</label>
                <div className="form-grid three-col">
                  {renderLabeledRelativeField('MotherMaidenFirstName', 'First Name')}
                  {renderLabeledRelativeField('MotherMaidenMiddleName', 'Middle Name')}
                  {renderLabeledRelativeField('MotherMaidenLastName', 'Last Name')}
                </div>
              </div>

              {renderDropdownField(`${person}MotherMaidenCitizenship`, 'Citizenship', 'citizenship', 'single-line-field', { marginTop: '12px' })}

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label className="family-section-label">Residence</label>
                <div className="form-grid two-col" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('MotherResidenceCountry', 'Country')}
                  {renderLabeledRelativeField('MotherResidenceProvince', 'Province')}
                </div>
                <div className="form-grid three-col" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('MotherResidenceCity', 'City/Municipality')}
                  {renderLabeledRelativeField('MotherResidenceHouseNo', 'House No.')}
                  {renderLabeledRelativeField('MotherResidenceBarangay', 'Barangay')}
                </div>
                <div className="form-grid" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('MotherResidenceStreet', 'Street')}
                </div>
              </div>
            </div>
          </>}

          {personStep === 7 && <>
            <div className="formal-box">
              <div className="formal-box-title">{advisorStepTitle}</div>

              <div className="field-group single-line-field">
                <label>Name</label>
                <input
                  value={form[`${person}AdvisorName`] ?? ''}
                  onChange={(e) => updateField(`${person}AdvisorName`, e.target.value)}
                  placeholder="Full name of parent"
                />
                <FieldError message={validationErrors[`${person}AdvisorName`]} />
              </div>

              <div className="field-group single-line-field">
                <label>Relationship</label>
                <input
                  value={form[`${person}AdvisorRelationship`] ?? ''}
                  onChange={(e) => updateField(`${person}AdvisorRelationship`, e.target.value)}
                  placeholder="Relationship"
                />
                <FieldError message={validationErrors[`${person}AdvisorRelationship`]} />
              </div>

              {renderDropdownField(`${person}AdvisorCitizenship`, 'Citizenship', 'citizenship', 'single-line-field', { marginTop: '12px' })}

              <div className="field-group single-line-field" style={{ marginTop: '12px' }}>
                <label className="family-section-label">Residence</label>
                <div className="form-grid two-col" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('AdvisorResidenceCountry', 'Country')}
                  {renderLabeledRelativeField('AdvisorResidenceProvince', 'Province')}
                </div>
                <div className="form-grid three-col" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('AdvisorResidenceCity', 'City/Municipality')}
                  {renderLabeledRelativeField('AdvisorResidenceHouseNo', 'House No.')}
                  {renderLabeledRelativeField('AdvisorResidenceBarangay', 'Barangay')}
                </div>
                <div className="form-grid" style={{ marginTop: '8px' }}>
                  {renderLabeledRelativeField('AdvisorResidenceStreet', 'Street')}
                </div>
              </div>
            </div>
            </>}

            {personStep === 8 && (
              <>
                <p className="section-subtitle">
                  Upload this applicant’s documents. Applicants age 18 to 23 must attach a photo of parental consent. Applicants age 24 to 27 must attach parental advice. Applicants age 28 and older do not need parent-related documents.
                </p>
                {renderDocumentUpload(personDocumentFields, `${person === 'groom' ? 'Groom' : 'Bride'} Documents`)}
              </>
            )}
          </div>
      </>
    )
  }

  const renderDocumentUpload = (fields, title) => (
    <div className="document-upload-wrapper">
      <div className="registration-section-title-row">
        <div className="formal-box-title">{title}</div>
      </div>
      <p className="section-subtitle">
        Each photo or PDF can be up to 5 MB. Photos are compressed automatically. All uploaded files together must be 10 MB or smaller.
      </p>

      <div className="document-grid">
        {fields.map(({ key, label, accept = 'image/*,.pdf' }) => (
          <button
            key={key}
            type="button"
            className="document-upload-card"
            disabled={isProcessingDocument}
            onClick={() => fileInputRefs.current[key]?.click()}
          >
            <input
              ref={(element) => {
                fileInputRefs.current[key] = element
              }}
              type="file"
              accept={accept}
              disabled={isProcessingDocument}
              onChange={(event) => handleDocumentSelect(key, event)}
              className="hidden-file-input"
            />
            <span className="upload-icon">⇪</span>
            <span className="upload-label">{label}</span>
            <span className="upload-file-name">
              {processingDocuments[key]
                ? 'Processing photo...'
                : documents[key]
                  ? typeof documents[key] === 'string' ? documents[key] : documents[key].name
                  : 'Choose File'}
            </span>
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
          <select
            id="appointment-time"
            value={form.appointmentTime}
            onChange={(event) => updateField('appointmentTime', event.target.value)}
            disabled={appointmentSlotsStatus !== 'ready'}
            aria-invalid={Boolean(validationErrors.appointmentTime)}
            required
          >
            <option value="">
              {appointmentSlotsStatus === 'loading'
                ? 'Checking availability...'
                : appointmentSlotsStatus === 'error'
                  ? 'Availability unavailable'
                  : form.appointmentDate
                    ? 'Select a time'
                    : 'Choose a date first'}
            </option>
            {appointmentTimeOptions.map(({ value, label }) => {
              const isAvailable = appointmentSlots.some((slot) => slot.value === value && slot.available)
              return (
                <option key={value} value={value} disabled={!isAvailable}>
                  {isAvailable ? label : `${label} — Unavailable`}
                </option>
              )
            })}
          </select>
          {appointmentSlotsStatus === 'ready' && appointmentSlots.every((slot) => !slot.available) && (
            <p className="field-error" role="status">No appointment times are available on this date.</p>
          )}
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
        <div className="payment-method-note">{FIXED_PAYMENT_METHOD}</div>
        <FieldError message={validationErrors.paymentMethod} />
      </div>

      <div className="field-group">
        <label>Amount</label>
        <input
          value={FIXED_PAYMENT_AMOUNT}
          readOnly
          aria-invalid={Boolean(validationErrors.paymentAmount)}
        />
        <FieldError message={validationErrors.paymentAmount} />
      </div>
    </div>
  )

  const renderReviewSummary = () => {
    const displayValue = (value) => value || 'Not provided'
    const renderReviewField = (label, value) => (
      <div className="review-field" key={label}>
        <span>{label}</span>
        <strong>{displayValue(value)}</strong>
      </div>
    )

    const renderPersonSummary = (person, title) => {
      const fullName = [
        form[`${person}FirstName`],
        form[`${person}MiddleName`],
        form[`${person}LastName`],
        form[`${person}Suffix`],
      ].filter(Boolean).join(' ')
      const placeOfBirth = [
        form[`${person}BirthPlaceCity`],
        form[`${person}BirthPlaceProvince`],
        form[`${person}BirthPlaceCountry`],
      ].filter(Boolean).join(', ')
      const residence = [
        form[`${person}ResidenceHouseNo`],
        form[`${person}ResidenceStreet`],
        form[`${person}ResidenceBarangay`],
        form[`${person}ResidenceCity`],
        form[`${person}ResidenceProvince`],
        form[`${person}ResidenceCountry`],
      ].filter(Boolean).join(', ')
      const fatherName = [
        form[`${person}FatherFirstName`],
        form[`${person}FatherMiddleName`],
        form[`${person}FatherLastName`],
      ].filter(Boolean).join(' ')
      const motherName = [
        form[`${person}MotherMaidenFirstName`],
        form[`${person}MotherMaidenMiddleName`],
        form[`${person}MotherMaidenLastName`],
      ].filter(Boolean).join(' ')
      const advisorInfo = [
        form[`${person}AdvisorName`],
        form[`${person}AdvisorRelationship`],
        form[`${person}AdvisorCitizenship`],
        form[`${person}AdvisorResidenceCity`],
      ].filter(Boolean).join(' / ')

      return (
        <section className="review-section review-person" key={person}>
          <h4>{title}</h4>
          <div className="review-details-grid">
            {renderReviewField('Full name', fullName)}
            {renderReviewField('Age', form[`${person}Age`] || getAgeFromDob(person))}
            {renderReviewField('Date of birth', form[`${person}Dob`])}
            {renderReviewField('Gender', form[`${person}Gender`])}
            {renderReviewField('Citizenship', form[`${person}Citizenship`])}
            {renderReviewField('Civil status', form[`${person}CivilStatus`])}
            {renderReviewField('Place of birth', placeOfBirth)}
            {renderReviewField('Religion', form[`${person}Religion`])}
            {renderReviewField('Residence', residence)}
            {renderReviewField('Mobile', form[`${person}Mobile`])}
            {renderReviewField('Email', form[`${person}Email`])}
            {renderReviewField('Father', fatherName)}
            {renderReviewField('Mother', motherName)}
            {renderReviewField('Person who gave consent/advice', advisorInfo)}
            {renderReviewField('Previously married', form[`${person}PreviouslyMarried`])}
          </div>
        </section>
      )
    }

    return (
      <div className="review-summary">
        <div className="review-summary-header">
          <h2>Review your application</h2>
          <p>Check the information and uploaded documents before submitting.</p>
        </div>

        <div className="review-people-grid">
          {renderPersonSummary('groom', 'Groom')}
          {renderPersonSummary('bride', 'Bride')}
        </div>

        <section className="review-section">
          <h4>Appointment and payment</h4>
          <div className="review-details-grid">
            {renderReviewField('Preferred date', form.appointmentDate)}
            {renderReviewField('Preferred time', form.appointmentTime ? formatAppointmentTime(form.appointmentTime) : '')}
            {renderReviewField('Office location', form.appointmentLocation)}
            {renderReviewField('Payment method', FIXED_PAYMENT_METHOD)}
            {renderReviewField('Amount', FIXED_PAYMENT_AMOUNT)}
          </div>
        </section>

        <section className="review-section">
          <h4>Required documents</h4>
          <div className="review-document-list">
            {allDocumentFields.map(({ key, label }) => (
              <div className="review-document" key={key}>
                <span>{label}</span>
                <strong>{documents[key]
                  ? typeof documents[key] === 'string' ? documents[key] : documents[key].name
                  : 'Not uploaded'}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="registration-page">
      <main className="registration-main">
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

        <div className="registration-header">
          <h1>{step === 3 ? 'Marriage Registration' : currentTitle}</h1>
          <div className="registration-account-menu">
            <button
              type="button"
              className="registration-account-trigger"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((isOpen) => !isOpen)}
            >
              <span className="user-avatar">{initials}</span>
              <span>{displayName}</span>
              <span className="chevron" aria-hidden="true">▾</span>
            </button>
            {accountMenuOpen && (
              <div className="registration-account-dropdown" role="menu" aria-label="Account actions">
                <button type="button" role="menuitem" onClick={() => {
                  setAccountMenuOpen(false)
                  navigate('/applicant/profile')
                }}>Profile</button>
                <button type="button" role="menuitem" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>

        <section className="registration-card">
          {!draftLoaded || applicationEligibility === 'checking' ? (
            <p role="status">{!draftLoaded ? 'Restoring your saved application form...' : 'Checking whether this account can start an application...'}</p>
          ) : applicationEligibility === 'error' ? (
            <div className="application-eligibility-message">
              <p role="alert">We couldn't verify whether this account already has an application. Please try again.</p>
              <button type="button" className="primary-button" onClick={() => void checkApplicationEligibility()}>Try again</button>
            </div>
          ) : applicationEligibility === 'blocked' ? (
            <div className="application-eligibility-message">
              <h2>This account already has an application</h2>
              <p>Request deletion from your applicant dashboard. You can apply again after an admin approves the request.</p>
              <button type="button" className="secondary-button" onClick={() => navigate('/applicant/dashboard')}>Go to my applications</button>
            </div>
          ) : (
          <>
          {draftError && <p className="form-error" role="alert">{draftError}</p>}
          <div className="form-section">
            <div className="registration-form-heading">
              <h2>{progressLabel}</h2>
              {import.meta.env.DEV && (
                <button type="button" className="registration-autofill-button" onClick={() => void autofillRegistration()}>
                  Fill sample data
                </button>
              )}
            </div>
            {step === 3 ? (
              <>
                <h3>Appointment</h3>
                <p className="section-subtitle">Enter your suggested appointment date and time. The office will confirm the schedule at Villaverde.</p>
                {renderAppointmentForm()}
              </>
            ) : step === 4 ? (
              <>
                <h3>Payment</h3>
                <p className="section-subtitle">Select your preferred payment method.</p>
                {renderPaymentForm()}
              </>
            ) : step === 5 ? (
              <>
                <h3>Review</h3>
                {renderReviewSummary()}
              </>
            ) : (
              <>
                <h3>{step === 1 ? 'Groom' : 'Bride'} - {currentPersonStepLabel}</h3>
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

            <button type="button" className="primary-button" onClick={step === 5 ? submitApplication : nextStep} disabled={isSubmitting}>
              {isSubmitting
                ? 'Submitting...'
                : step === 5
                  ? 'Submit Application'
                  : step === 4
                    ? 'Review Application'
                    : isPersonInformationStep
                      ? personStep < personStepLabels.length
                        ? `Next: ${nextPersonStepLabel} →`
                        : `Next: ${stepLabels[step]} →`
                      : step === 3
                        ? 'Next: Appointment →'
                        : `Next: ${stepLabels[step]} →`}
            </button>
          </div>
          {submitError && <p className="form-error" role="alert">{submitError}</p>}
          </>
          )}
        </section>
      </main>
    </div>
  )
}
