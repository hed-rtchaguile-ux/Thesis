import '../Registration/ApplicantRegistration.css'

const documentFields = [
  ['birthCertificateGroom', 'Birth Certificate (Groom)'],
  ['birthCertificateBride', 'Birth Certificate (Bride)'],
  ['certificateOfNoMarriage', 'Certificate of No Marriage (CENOMAR)'],
  ['validIdGroom', 'Valid ID (Groom)'],
  ['validIdBride', 'Valid ID (Bride)'],
  ['psaMarriageLicense', 'PSA Marriage License (if applicable)'],
  ['barangayClearance', 'Barangay Clearance / Residency'],
  ['additionalRequirement', 'Additional Requirement / Affidavit'],
]

const value = (fieldValue) => fieldValue || '—'
const join = (values, separator = ', ') => values.filter(Boolean).join(separator)

function PersonForm({ application, person }) {
  const firstName = value(application[`${person}FirstName`])
  const middleName = value(application[`${person}MiddleName`])
  const lastName = value(application[`${person}LastName`])
  const fullName = join([application[`${person}FirstName`], application[`${person}MiddleName`], application[`${person}LastName`]], ' ') || application[`${person}FullName`] || '—'
  const birthPlace = join([application[`${person}BirthPlaceCity`], application[`${person}BirthPlaceProvince`], application[`${person}BirthPlaceCountry`]]) || '—'
  const residence = join([application[`${person}ResidenceHouseNo`], application[`${person}ResidenceStreet`], application[`${person}ResidenceBarangay`], application[`${person}ResidenceCity`], application[`${person}ResidenceProvince`], application[`${person}ResidenceCountry`]]) || '—'
  const father = join([application[`${person}FatherFirstName`], application[`${person}FatherMiddleName`], application[`${person}FatherLastName`]], ' ') || value(application[`${person}FatherName`])
  const mother = join([application[`${person}MotherMaidenFirstName`], application[`${person}MotherMaidenMiddleName`], application[`${person}MotherMaidenLastName`]], ' ') || value(application[`${person}MotherMaidenName`])
  const advisor = join([application[`${person}AdvisorRelationship`], application[`${person}AdvisorCitizenship`], application[`${person}AdvisorResidenceCity`]], ' / ') || '—'

  const cell = (label, content, className = '') => <div className={`official-form-cell ${className}`}><span>{label}</span><strong>{content}</strong></div>

  return <div className="official-form-body">
    <div className="official-form-name-row">{cell('Full Name', fullName, 'wide-cell')}{cell('Age', value(application[`${person}Age`]), 'small-cell')}</div>
    <div className="official-form-three-col">{cell('First Name', firstName)}{cell('Middle Name', middleName)}{cell('Last Name', lastName)}</div>
    <div className="official-form-four-col">{cell('Date of Birth', value(application[`${person}Dob`]))}{cell('Gender', value(application[`${person}Gender`]))}{cell('Citizenship', value(application[`${person}Citizenship`]))}{cell('Civil Status', value(application[`${person}CivilStatus`]))}</div>
    <div className="official-form-three-col">{cell('Birth Place', birthPlace)}{cell('Religion', value(application[`${person}Religion`]))}{cell('Residence', residence)}</div>
    <div className="official-form-two-col">{cell('Mobile', value(application[`${person}Mobile`]))}{cell('Email', value(application[`${person}Email`]))}</div>
    <div className="official-form-two-col">{cell('Father', father)}{cell('Mother', mother)}</div>
    <div className="official-form-two-col">{cell('Advisor', advisor)}{cell('Previously Married', value(application[`${person}PreviouslyMarried`]))}</div>
  </div>
}

export default function OfficialApplicationForm({ application }) {
  const formApplication = { ...(application.applicationData || {}), ...application }
  const documents = application.documents || {}

  return <div className="official-print-form">
    <div className="official-header-line"><div className="official-header-meta">Municipality: <span>—</span></div><div className="official-header-meta right">Office of the Civil Registrar General</div></div>
    <div className="official-title-row"><span>Application for Marriage License</span></div>
    <div className="official-info-bar"><div className="official-info-box"><span>Province</span><strong>—</strong></div><div className="official-info-box"><span>City/Municipality</span><strong>—</strong></div><div className="official-info-box"><span>Registry No.</span><strong>—</strong></div></div>
    <div className="official-double-col"><div className="official-person-panel"><div className="official-panel-title">Groom</div><PersonForm application={formApplication} person="groom" /></div><div className="official-person-panel"><div className="official-panel-title">Bride</div><PersonForm application={formApplication} person="bride" /></div></div>
    <div className="official-bottom-boxes"><div className="official-bottom-row"><span>Appointment</span><strong>{value(formApplication.appointmentDate)}</strong></div><div className="official-bottom-row"><span>Time</span><strong>{value(formApplication.appointmentTime)}</strong></div><div className="official-bottom-row"><span>Payment</span><strong>{value(formApplication.paymentMethod)} / {value(formApplication.paymentAmount)}</strong></div></div>
    <div className="official-documents-box"><div className="official-panel-title small">Required Documents</div><div className="official-doc-list">{documentFields.map(([key, label]) => <div key={key} className="official-doc-item"><span>{label}</span><strong>{documents[key] ? 'Submitted' : 'Not uploaded'}</strong></div>)}</div></div>
  </div>
}
