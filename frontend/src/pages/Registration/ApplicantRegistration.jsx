import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllMunicipalities, getAllProvinces, getBarangaysByMunicipality, getMunicipalitiesByProvince } from '@aivangogh/ph-address'
import { apiFetch, useAuth } from '../auth'
import './ApplicantRegistration.css'

const stepLabels = ['Groom Info', 'Bride Info', 'Appointment', 'Payment', 'Review']
const personStepLabels = ['Name', 'Birth details', 'Residence & contact', 'Marital history', 'Father details', 'Mother details', 'Person who gave advice', 'Documents']
const appointmentTimeOptions = [
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
]

function formatAppointmentTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value

  const hour = Number(match[1])
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${match[2]} ${period}`
}

const documentFields = {
  groom: [
    { key: 'birthCertificateGroom', label: 'PSA Birth Certificate (Groom) *' },
    { key: 'certificateOfNoMarriageGroom', label: 'CENOMAR (Groom) *' },
    { key: 'validIdGroom', label: 'Valid ID (Groom) *' },
    { key: 'psaMarriageLicenseGroom', label: 'PSA Marriage License (Groom, if applicable)' },
    { key: 'barangayClearanceGroom', label: 'Barangay Clearance / Residency (Groom) *' },
    { key: 'additionalRequirementGroom', label: 'Additional Requirement / Affidavit (Groom)' },
  ],
  bride: [
    { key: 'birthCertificateBride', label: 'PSA Birth Certificate (Bride) *' },
    { key: 'certificateOfNoMarriageBride', label: 'CENOMAR (Bride) *' },
    { key: 'validIdBride', label: 'Valid ID (Bride) *' },
    { key: 'psaMarriageLicenseBride', label: 'PSA Marriage License (Bride, if applicable)' },
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

  if (age !== null && age >= 18 && age <= 24) {
    fields.push({
      key: `parentalConsent${applicantLabel}`,
      label: `Parental Consent (Photo) (${applicantLabel}) *`,
      accept: 'image/*',
    })
  }

  return [...documentFields[applicant], ...fields]
}

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
  groomGender: 'Female',
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
  brideGender: 'Male',
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
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [personStep, setPersonStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [customDropdownFields, setCustomDropdownFields] = useState({})
  const [documents, setDocuments] = useState({})
  const [countryMetadata, setCountryMetadata] = useState(null)
  const [countryMetadataStatus, setCountryMetadataStatus] = useState('idle')
  const [cityData, setCityData] = useState({})
  const [cityDataStatus, setCityDataStatus] = useState({})
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const fileInputRefs = useRef({})
  const countryMetadataPromiseRef = useRef(null)
  const cityDataModuleRef = useRef(null)
  const cityDataPromiseRef = useRef({})

  const currentTitle = stepLabels[step - 1]
  const isPersonInformationStep = step === 1 || step === 2
  const progressLabel = isPersonInformationStep ? `Step ${personStep} of ${personStepLabels.length}` : `Step ${step} of ${stepLabels.length}`
  const person = step === 1 ? 'groom' : 'bride'
  const groomDocumentFields = getApplicantDocumentFields(form, 'groom')
  const brideDocumentFields = getApplicantDocumentFields(form, 'bride')
  const personDocumentFields = person === 'groom' ? groomDocumentFields : brideDocumentFields
  const allDocumentFields = [...groomDocumentFields, ...brideDocumentFields]

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
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
      const nextForm = { ...current, [field]: value }
      dependentLocationFields.forEach((dependentField) => {
        nextForm[dependentField] = ''
      })

      if (previouslyMarriedField && value === 'No') {
        const dissolutionFields = ['DissolutionMethod', 'DissolutionPlace', 'DissolutionDate', 'DissolutionCity', 'DissolutionProvince', 'DissolutionCountry', 'DissolutionDay', 'DissolutionMonth', 'DissolutionYear']
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
  }

  function renderDropdownField(field, label, optionKey, className = '', style) {
    const value = form[field] ?? ''
    const worldCountries = countryMetadata
      ? countryMetadata.getCountries().map(({ name, shortName }) => ({ name, isoCode: shortName })).sort((a, b) => a.name.localeCompare(b.name))
      : []
    const countryNames = worldCountries.map(({ name }) => name)
    const citizenshipOptions = [...new Set([...formDropdownOptions.citizenship, ...countryNames])].sort()
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
      && !((optionKey === 'country' || optionKey === 'citizenship') && !countryMetadata)
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
            if ((optionKey === 'country' || optionKey === 'citizenship') && !countryMetadata) {
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
                : (optionKey === 'country' || optionKey === 'citizenship') && countryMetadataStatus === 'loading'
                  ? 'Loading options...'
                : `Select ${fieldLabel.toLowerCase()}`}
          </option>
          {((optionKey === 'country' || optionKey === 'citizenship') && !countryMetadata && value)
            && <option value={value}>{value}</option>}
          {optionKey === 'city' && !countryCityDataLoaded && value && <option value={value}>{value}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {optionKey === 'province' && option === philippinesNcrValue ? 'Metro Manila (NCR)' : option}
            </option>
          ))}
          <option value="__other">Other</option>
        </select>
        {(optionKey === 'country' || optionKey === 'citizenship') && countryMetadataStatus === 'error' && (
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
  }

  function nextStep() {
    if (isPersonInformationStep) {
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
      setPersonStep((current) => current - 1)
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
        const requiredAdvisorFields = [
          `${prefix}AdvisorRelationship`,
          `${prefix}AdvisorCitizenship`,
          `${prefix}AdvisorResidenceHouseNo`,
          `${prefix}AdvisorResidenceStreet`,
          `${prefix}AdvisorResidenceCity`,
          `${prefix}AdvisorResidenceProvince`,
          `${prefix}AdvisorResidenceCountry`,
        ]
        if (form[`${prefix}AdvisorResidenceCountry`] === 'Philippines') {
          requiredAdvisorFields.push(`${prefix}AdvisorResidenceBarangay`)
        }
        requiredAdvisorFields.forEach((field) => {
          if (!form[field] || !String(form[field]).trim()) errors[field] = 'Required for applicants age 18 to 23.'
        })
      }
    }

    if (currentPersonStep === 8) {
      personDocumentFields.filter(({ label }) => label.endsWith('*')).forEach(({ key }) => {
        if (!documents[key]) errors[key] = 'This document is required.'
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
          documents: Object.fromEntries(allDocumentFields.filter(({ key }) => documents[key]).map(({ key }) => [
            key,
            typeof documents[key] === 'string' ? documents[key] : documents[key].dataUrl,
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
    const documentValues = Object.fromEntries(personDocumentFields.map(({ key }) => [key, `${key}.pdf`]))

    setDocuments((current) => ({
      ...current,
      ...documentValues,
    }))

    setValidationErrors((current) => {
      const nextErrors = { ...current }
      personDocumentFields.forEach(({ key }) => {
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
      Gender: isBride ? 'Male' : 'Female',
      Citizenship: 'Filipino',
      ResidenceHouseNo: isBride ? '15' : '120',
      ResidenceStreet: isBride ? 'Lapu-Lapu Street' : 'Mabini Street',
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
      MotherMaidenFirstName: isBride ? 'Rosalinda' : 'Carmela',
      MotherMaidenMiddleName: isBride ? 'Villanueva' : 'Dela Rosa',
      MotherMaidenLastName: isBride ? 'Santos' : 'Cruz',
      MotherMaidenCitizenship: 'Filipino',
      MotherResidenceHouseNo: isBride ? '18' : '123',
      MotherResidenceStreet: isBride ? 'Bahayang Street' : 'Mabini Street',
      AdvisorRelationship: 'Godfather',
      AdvisorCitizenship: 'Filipino',
      AdvisorResidenceHouseNo: '9',
      AdvisorResidenceStreet: 'P. Burgos Street',
    }

    setForm((current) => {
      const nextForm = { ...current }

      Object.keys(initialForm).forEach((key) => {
        if (!key.startsWith(sourcePrefix)) return

        const remainingKey = key.slice(sourcePrefix.length)
        if (remainingKey === 'Gender') return
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
      nextForm[`${targetPrefix}Gender`] = isBride ? 'Male' : 'Female'

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
                  <option value="Married">Married</option>
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
                  </select>
                </div>

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
                    onChange={(event) => updateDissolutionDate(person, event.target.value)}
                  />
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
              <div className="formal-box-title">Person Who Gave Advice</div>

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
                  Upload this applicant’s documents. Applicants age 18 to 24 must also attach a photo of their parental consent.
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
      <div className="auto-fill-row document-auto-fill-row">
        <div className="formal-box-title">{title}</div>
        <button type="button" className="auto-fill-button" onClick={autoFillDocuments}>
          Auto Fill
        </button>
      </div>

      <div className="document-grid">
        {fields.map(({ key, label, accept = 'image/*,.pdf' }) => (
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
              accept={accept}
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
          <select
            id="appointment-time"
            value={form.appointmentTime}
            onChange={(event) => updateField('appointmentTime', event.target.value)}
            aria-invalid={Boolean(validationErrors.appointmentTime)}
            required
          >
            <option value="">Select a time</option>
            {appointmentTimeOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
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
            {renderReviewField('Advisor', advisorInfo)}
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
            {renderReviewField('Payment method', 'Pay over the counter (cash only)')}
            {renderReviewField('Amount', form.paymentAmount)}
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
          <div className="form-section">
            <h2>{progressLabel}</h2>
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

            <button type="button" className="primary-button" onClick={step === 5 ? submitApplication : nextStep} disabled={isSubmitting}>
              {isSubmitting
                ? 'Submitting...'
                : step === 5
                  ? 'Submit Application'
                  : step === 4
                    ? 'Review Application'
                    : isPersonInformationStep
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
