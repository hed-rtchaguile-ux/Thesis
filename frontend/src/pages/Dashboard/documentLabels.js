const documentLabels = {
  birthCertificateGroom: 'PSA Birth Certificate (Groom)',
  certificateOfNoMarriageGroom: 'CENOMAR (Groom)',
  validIdGroom: 'Valid ID (Groom)',
  barangayClearanceGroom: 'Barangay Clearance / Residency (Groom)',
  additionalRequirementGroom: 'Additional Requirement / Affidavit (Groom)',
  birthCertificateBride: 'PSA Birth Certificate (Bride)',
  certificateOfNoMarriageBride: 'CENOMAR (Bride)',
  validIdBride: 'Valid ID (Bride)',
  barangayClearanceBride: 'Barangay Clearance / Residency (Bride)',
  additionalRequirementBride: 'Additional Requirement / Affidavit (Bride)',
}

export function getDocumentLabel(key) {
  return documentLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()
}

export function isHiddenMarriageLicenseDocument(key) {
  return key === 'psaMarriageLicense'
    || key === 'psaMarriageLicenseGroom'
    || key === 'psaMarriageLicenseBride'
}
