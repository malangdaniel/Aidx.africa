// Static list of Nigerian states (36 + FCT) with major cities / LGAs for the
// pharmacy location dropdowns. "Other" lets pharmacies outside the list proceed.
export const NIGERIA_LOCATIONS: Record<string, string[]> = {
  Abia: ['Aba North', 'Aba South', 'Umuahia North', 'Umuahia South', 'Ohafia', 'Arochukwu'],
  Adamawa: ['Yola North', 'Yola South', 'Mubi North', 'Mubi South', 'Jimeta', 'Numan'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Abak', 'Ikot Abasi'],
  Anambra: ['Awka South', 'Onitsha North', 'Onitsha South', 'Nnewi North', 'Ihiala', 'Aguata'],
  Bauchi: ['Bauchi', 'Azare', 'Misau', 'Jama\'are', 'Katagum', 'Gamawa'],
  Bayelsa: ['Yenagoa', 'Brass', 'Ogbia', 'Sagbama', 'Southern Ijaw', 'Nembe'],
  Benue: ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala', 'Vandeikya', 'Oju'],
  Borno: ['Maiduguri', 'Biu', 'Bama', 'Dikwa', 'Konduga', 'Gwoza'],
  'Cross River': ['Calabar Municipal', 'Calabar South', 'Ikom', 'Ogoja', 'Obudu', 'Akamkpa'],
  Delta: ['Warri South', 'Asaba', 'Sapele', 'Ughelli North', 'Effurun', 'Agbor'],
  Ebonyi: ['Abakaliki', 'Afikpo North', 'Ezza North', 'Ishielu', 'Ohaukwu', 'Onicha'],
  Edo: ['Oredo (Benin City)', 'Egor', 'Ikpoba Okha', 'Esan Central (Irrua)', 'Etsako West (Auchi)', 'Uhunmwonde'],
  Ekiti: ['Ado Ekiti', 'Ikere', 'Oye', 'Ikole', 'Ijero', 'Efon'],
  Enugu: ['Enugu North', 'Enugu South', 'Enugu East', 'Nsukka', 'Udi', 'Oji River'],
  FCT: ['Abuja Municipal (AMAC)', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali', 'Abaji'],
  Gombe: ['Gombe', 'Kumo', 'Bajoga', 'Dukku', 'Kaltungo', 'Billiri'],
  Imo: ['Owerri Municipal', 'Owerri North', 'Owerri West', 'Orlu', 'Okigwe', 'Mbaise'],
  Jigawa: ['Dutse', 'Hadejia', 'Gumel', 'Kazaure', 'Ringim', 'Birnin Kudu'],
  Kaduna: ['Kaduna North', 'Kaduna South', 'Zaria', 'Kafanchan', 'Sabon Gari', 'Kagoro'],
  Kano: ['Kano Municipal', 'Nassarawa', 'Fagge', 'Dala', 'Gwale', 'Tarauni'],
  Katsina: ['Katsina', 'Daura', 'Funtua', 'Malumfashi', 'Dutsin-Ma', 'Kankia'],
  Kebbi: ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru', 'Jega', 'Koko'],
  Kogi: ['Lokoja', 'Okene', 'Kabba', 'Idah', 'Ankpa', 'Dekina'],
  Kwara: ['Ilorin West', 'Ilorin East', 'Ilorin South', 'Offa', 'Omu-Aran', 'Lafiagi'],
  Lagos: ['Ikeja', 'Lagos Island', 'Eti-Osa (Lekki/VI)', 'Surulere', 'Alimosho', 'Ikorodu', 'Badagry', 'Mushin', 'Oshodi-Isolo', 'Kosofe', 'Agege', 'Apapa', 'Ajeromi-Ifelodun', 'Amuwo-Odofin'],
  Nasarawa: ['Lafia', 'Karu', 'Keffi', 'Akwanga', 'Nasarawa', 'Wamba'],
  Niger: ['Minna', 'Suleja', 'Bida', 'Kontagora', 'Lapai', 'Mokwa'],
  Ogun: ['Abeokuta South', 'Abeokuta North', 'Ijebu Ode', 'Sagamu', 'Ota (Ado-Odo)', 'Ifo'],
  Ondo: ['Akure South', 'Ondo West', 'Owo', 'Ikare', 'Okitipupa', 'Ore'],
  Osun: ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo', 'Ikire'],
  Oyo: ['Ibadan North', 'Ibadan South-West', 'Ogbomosho', 'Oyo', 'Iseyin', 'Saki'],
  Plateau: ['Jos North', 'Jos South', 'Bukuru', 'Pankshin', 'Shendam', 'Barkin Ladi'],
  Rivers: ['Port Harcourt', 'Obio-Akpor', 'Eleme', 'Bonny', 'Okrika', 'Ikwerre'],
  Sokoto: ['Sokoto North', 'Sokoto South', 'Wurno', 'Tambuwal', 'Gwadabawa', 'Illela'],
  Taraba: ['Jalingo', 'Wukari', 'Bali', 'Takum', 'Gembu', 'Zing'],
  Yobe: ['Damaturu', 'Potiskum', 'Gashua', 'Nguru', 'Geidam', 'Gujba'],
  Zamfara: ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka', 'Maru', 'Tsafe'],
};

export const NIGERIA_STATES = Object.keys(NIGERIA_LOCATIONS).sort((a, b) =>
  a === 'FCT' ? -1 : b === 'FCT' ? 1 : a.localeCompare(b),
);

export const citiesForState = (state: string): string[] =>
  state && NIGERIA_LOCATIONS[state] ? [...NIGERIA_LOCATIONS[state], 'Other'] : [];
