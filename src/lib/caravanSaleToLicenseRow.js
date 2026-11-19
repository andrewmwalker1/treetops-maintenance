// Builds a CampManager-export-shaped row object from a Sale Tracker
// record, so the License Agreement tool's existing import logic
// (license-agreement/steps.jsx's newSaleFromRow/newPriceForSale, the
// same functions Step1Import's own CSV-row selection calls) can take it
// directly -- no change to that tool's intake logic, just a different
// source for the same shaped object it already expects from a
// CampManager CSV row. Fields the Sale Tracker doesn't capture (pitch
// band, licence start/end, unit length/width/serial, wifi
// registration) are left blank -- the office fills those in on the
// License Agreement tool's own steps, same as they would starting from
// a fresh CSV row with those columns empty.
export function buildLicenseAgreementRow(sale) {
  return {
    "Unit Customer Title": sale.title || "",
    "Unit Customer First Name": sale.forename || "",
    "Unit Customer Last Name": sale.surname || "",
    "Unit Customer Address Line 1": sale.address_line1 || "",
    "Unit Customer Address Line 2": sale.address_line2 || "",
    "Unit Customer Address Line 3": "",
    "Unit Customer Address City/Town": "",
    "Unit Customer Address Postcode": sale.postcode || "",
    "Unit Customer Address Country": "",
    "Unit Customer Telephone": sale.phone1 || "",
    "Unit Customer Mobile": sale.phone2 || "",
    "Unit Customer Email": sale.email1 || "",
    "Unit Site": sale.pitch?.pitch_number_or_name || "",
    "Unit Make": sale.caravan_make || "",
    "Unit Model": sale.caravan_model || "",
    "Unit Year": sale.caravan_year || "",
    "Unit Category": "",
    "Unit Licence Start": "",
    "Unit Licence End": "",
    "Unit Length": "",
    "Unit Width": "",
    "Unit Serial Number": "",
    "Unit Registration": "",
  };
}
