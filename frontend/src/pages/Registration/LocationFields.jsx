import { useEffect, useState } from 'react'

const PSGC_API = 'https://psgc.gitlab.io/api'
const locationRequests = new Map()
const commonCountries = ['Philippines', 'United States', 'Canada', 'Australia', 'United Kingdom']

function loadLocationList(path) {
  if (!locationRequests.has(path)) {
    const request = fetch(`${PSGC_API}${path}`)
      .then((response) => {
        if (!response.ok) throw new Error('Location list unavailable')
        return response.json()
      })
      .catch((error) => {
        locationRequests.delete(path)
        throw error
      })
    locationRequests.set(path, request)
  }
  return locationRequests.get(path)
}

function isPhilippines(country) {
  return /^(philippines|ph)$/i.test(String(country || '').trim())
}

function sortedLocations(locations) {
  return [...locations].sort((left, right) => left.name.localeCompare(right.name))
}

export default function LocationFields({ form, fields, onChange, includeBarangay = false }) {
  const { country, province, city, barangay } = fields
  const provinceCodeField = `${province}Code`
  const cityCodeField = `${city}Code`
  const philippinesSelected = isPhilippines(form[country])
  const provinceCode = form[provinceCodeField] || ''
  const cityCode = form[cityCodeField] || ''
  const [provinces, setProvinces] = useState([])
  const [cityData, setCityData] = useState({ provinceCode: '', items: [] })
  const [barangayData, setBarangayData] = useState({ cityCode: '', items: [] })
  const [locationError, setLocationError] = useState('')
  const matchedProvince = provinces.find((item) => item.name === form[province])
  const selectedProvinceCode = provinceCode || matchedProvince?.code || ''
  const cities = cityData.provinceCode === selectedProvinceCode ? cityData.items : []
  const barangays = barangayData.cityCode === cityCode ? barangayData.items : []

  useEffect(() => {
    if (!philippinesSelected) return
    let isCurrent = true
    loadLocationList('/provinces.json')
      .then((items) => {
        if (isCurrent) setProvinces(sortedLocations([...items, { code: '130000000', name: 'NCR' }]))
      })
      .catch(() => {
        if (isCurrent) setLocationError('Philippine locations are unavailable. Enter the address manually.')
      })
    return () => { isCurrent = false }
  }, [philippinesSelected])

  useEffect(() => {
    if (!philippinesSelected || !selectedProvinceCode) return
    let isCurrent = true
    const cityPath = selectedProvinceCode === '130000000'
      ? '/regions/130000000/cities-municipalities.json'
      : `/provinces/${selectedProvinceCode}/cities-municipalities.json`
    loadLocationList(cityPath)
      .then((items) => {
        if (isCurrent) setCityData({ provinceCode: selectedProvinceCode, items: sortedLocations(items) })
      })
      .catch(() => {
        if (isCurrent) setLocationError('Philippine locations are unavailable. Enter the address manually.')
      })
    return () => { isCurrent = false }
  }, [philippinesSelected, selectedProvinceCode])

  useEffect(() => {
    if (!philippinesSelected || !cityCode || !includeBarangay) return
    let isCurrent = true
    loadLocationList(`/cities-municipalities/${cityCode}/barangays.json`)
      .then((items) => {
        if (isCurrent) setBarangayData({ cityCode, items: sortedLocations(items) })
      })
      .catch(() => {
        if (isCurrent) setLocationError('Philippine locations are unavailable. Enter the address manually.')
      })
    return () => { isCurrent = false }
  }, [philippinesSelected, cityCode, includeBarangay])

  function clearLocation() {
    [province, city, barangay, provinceCodeField, cityCodeField].forEach((field) => {
      if (field) onChange(field, '')
    })
  }

  function handleCountryChange(value) {
    setLocationError('')
    const countryValue = /^ph$/i.test(value.trim()) ? 'Philippines' : value
    if (countryValue !== form[country]) clearLocation()
    onChange(country, countryValue)
  }

  function handleProvinceChange(code) {
    setLocationError('')
    const selected = provinces.find((item) => item.code === code)
    ;[province, city, barangay, provinceCodeField, cityCodeField].forEach((field) => onChange(field, ''))
    onChange(province, selected?.name || '')
    onChange(provinceCodeField, code)
  }

  function handleCityChange(code) {
    setLocationError('')
    const selected = cities.find((item) => item.code === code)
    ;[city, barangay, cityCodeField].forEach((field) => onChange(field, ''))
    onChange(city, selected?.name || '')
    onChange(cityCodeField, code)
  }

  const provinceOptions = provinces.some((item) => item.name === form[province])
    ? provinces
    : form[province] ? [{ code: '', name: form[province] }, ...provinces] : provinces
  const cityOptions = cities.some((item) => item.name === form[city])
    ? cities
    : form[city] ? [{ code: '', name: form[city] }, ...cities] : cities

  return (
    <div className="location-fields form-grid three-col">
      <div className="field-group">
        <label htmlFor={country}>Country</label>
        <input
          id={country}
          list={`${country}-options`}
          value={form[country] || ''}
          onChange={(event) => handleCountryChange(event.target.value)}
          placeholder="Country"
          autoComplete="country-name"
        />
        <datalist id={`${country}-options`}>
          {commonCountries.map((name) => <option value={name} key={name} />)}
        </datalist>
      </div>

      {philippinesSelected ? (
        locationError ? (
          <>
            <div className="field-group"><label htmlFor={province}>Province</label><input id={province} value={form[province] || ''} onChange={(event) => onChange(province, event.target.value)} /></div>
            <div className="field-group"><label htmlFor={city}>City/Municipality</label><input id={city} value={form[city] || ''} onChange={(event) => onChange(city, event.target.value)} /></div>
          </>
        ) : (
          <>
            <div className="field-group">
              <label htmlFor={province}>Province</label>
              <select id={province} value={selectedProvinceCode} onChange={(event) => handleProvinceChange(event.target.value)}>
                <option value="">Select province</option>
                {provinceOptions.map((item) => <option key={item.code || item.name} value={item.code}>{item.name}</option>)}
              </select>
            </div>
            {selectedProvinceCode && <div className="field-group">
              <label htmlFor={city}>City/Municipality</label>
              <select id={city} value={cityCode} onChange={(event) => handleCityChange(event.target.value)}>
                <option value="">Select city/municipality</option>
                {cityOptions.map((item) => <option key={item.code || item.name} value={item.code}>{item.name}</option>)}
              </select>
            </div>}
          </>
        )
      ) : (
        <>
          <div className="field-group"><label htmlFor={province}>Province/State</label><input id={province} value={form[province] || ''} onChange={(event) => onChange(province, event.target.value)} placeholder="Province or state" /></div>
          <div className="field-group"><label htmlFor={city}>City/Municipality</label><input id={city} value={form[city] || ''} onChange={(event) => onChange(city, event.target.value)} placeholder="City or municipality" /></div>
        </>
      )}

      {includeBarangay && <div className="field-group">
        <label htmlFor={barangay}>Barangay</label>
        {philippinesSelected && cityCode && !locationError ? (
          <select id={barangay} value={form[barangay] || ''} onChange={(event) => onChange(barangay, event.target.value)}>
            <option value="">Select barangay</option>
            {barangays.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
          </select>
        ) : (
          <input id={barangay} value={form[barangay] || ''} onChange={(event) => onChange(barangay, event.target.value)} placeholder="Barangay" />
        )}
      </div>}
      {locationError && <p className="location-api-error" role="status">{locationError}</p>}
    </div>
  )
}