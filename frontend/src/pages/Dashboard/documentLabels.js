const documentLabels = {
  birthCertificateGroom: 'PSA Birth Certificate (Groom)',
  certificateOfNoMarriageGroom: 'CENOMAR (Groom)',
  validIdGroom: 'Valid ID (Groom)',
  psaMarriageLicenseGroom: 'PSA Marriage License (Groom)',
  barangayClearanceGroom: 'Barangay Clearance / Residency (Groom)',
  additionalRequirementGroom: 'Additional Requirement / Affidavit (Groom)',
  birthCertificateBride: 'PSA Birth Certificate (Bride)',
  certificateOfNoMarriageBride: 'CENOMAR (Bride)',
  validIdBride: 'Valid ID (Bride)',
  psaMarriageLicenseBride: 'PSA Marriage License (Bride)',
  barangayClearanceBride: 'Barangay Clearance / Residency (Bride)',
  additionalRequirementBride: 'Additional Requirement / Affidavit (Bride)',
  psaMarriageLicense: 'PSA Marriage License',
}

export function getDocumentLabel(key) {
  return documentLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()
}
