export function getParentalRequirement(age) {
  if (age >= 18 && age <= 21) return 'consent'
  if (age >= 22 && age <= 24) return 'advice'
  return null
}
