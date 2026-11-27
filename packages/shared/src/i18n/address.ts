export type RegionKind = 'state' | 'province' | 'county' | 'district' | 'prefecture' | 'emirate' | 'region';
export type PostalKind = 'zip' | 'postcode' | 'pin' | 'postal';

export interface AddressFormat {
  region: RegionKind;
  regionRequired: boolean;
  postal: PostalKind | null;
  postalRequired: boolean;
  postalPattern?: RegExp;
  postalExample?: string;
}

const DEFAULT: AddressFormat = { region: 'region', regionRequired: false, postal: 'postal', postalRequired: false };

/** Address rules for the markets we sell into. Unlisted countries get permissive defaults. */
export const ADDRESS_FORMATS: Record<string, AddressFormat> = {
  US: { region: 'state', regionRequired: true, postal: 'zip', postalRequired: true, postalPattern: /^\d{5}(-\d{4})?$/, postalExample: '10001' },
  CA: {
    region: 'province',
    regionRequired: true,
    postal: 'postal',
    postalRequired: true,
    postalPattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    postalExample: 'K1A 0B1',
  },
  GB: {
    region: 'county',
    regionRequired: false,
    postal: 'postcode',
    postalRequired: true,
    postalPattern: /^([A-Z]{1,2}\d[A-Z\d]?|GIR) ?\d[A-Z]{2}$/i,
    postalExample: 'SW1A 1AA',
  },
  IE: { region: 'county', regionRequired: false, postal: 'postal', postalRequired: false, postalPattern: /^[A-Z\d]{3} ?[A-Z\d]{4}$/i },
  AU: { region: 'state', regionRequired: true, postal: 'postcode', postalRequired: true, postalPattern: /^\d{4}$/, postalExample: '2000' },
  NZ: { region: 'region', regionRequired: false, postal: 'postcode', postalRequired: true, postalPattern: /^\d{4}$/ },
  IN: { region: 'state', regionRequired: true, postal: 'pin', postalRequired: true, postalPattern: /^[1-9]\d{5}$/, postalExample: '110001' },
  BD: { region: 'district', regionRequired: true, postal: 'postal', postalRequired: false, postalPattern: /^\d{4}$/, postalExample: '1212' },
  PK: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: false, postalPattern: /^\d{5}$/ },
  NP: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: false, postalPattern: /^\d{5}$/ },
  LK: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: false, postalPattern: /^\d{5}$/ },
  SG: { region: 'region', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{6}$/ },
  MY: { region: 'state', regionRequired: true, postal: 'postcode', postalRequired: true, postalPattern: /^\d{5}$/ },
  ID: { region: 'province', regionRequired: true, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/ },
  TH: { region: 'province', regionRequired: true, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/ },
  PH: { region: 'province', regionRequired: true, postal: 'zip', postalRequired: true, postalPattern: /^\d{4}$/ },
  VN: { region: 'province', regionRequired: true, postal: 'postal', postalRequired: false, postalPattern: /^\d{6}$/ },
  JP: { region: 'prefecture', regionRequired: true, postal: 'postal', postalRequired: true, postalPattern: /^\d{3}-?\d{4}$/ },
  KR: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/ },
  CN: { region: 'province', regionRequired: true, postal: 'postal', postalRequired: true, postalPattern: /^\d{6}$/ },
  HK: { region: 'region', regionRequired: false, postal: null, postalRequired: false },
  AE: { region: 'emirate', regionRequired: true, postal: null, postalRequired: false },
  SA: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: false, postalPattern: /^\d{5}(-\d{4})?$/ },
  ES: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/, postalExample: '28013' },
  PT: { region: 'region', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{4}-\d{3}$/ },
  FR: { region: 'region', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/ },
  DE: { region: 'state', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/ },
  IT: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/ },
  NL: { region: 'province', regionRequired: false, postal: 'postcode', postalRequired: true, postalPattern: /^\d{4} ?[A-Z]{2}$/i },
  BE: { region: 'province', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{4}$/ },
  CH: { region: 'region', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{4}$/ },
  AT: { region: 'state', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{4}$/ },
  SE: { region: 'county', regionRequired: false, postal: 'postal', postalRequired: true, postalPattern: /^\d{3} ?\d{2}$/ },
  BR: { region: 'state', regionRequired: true, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}-?\d{3}$/ },
  MX: { region: 'state', regionRequired: true, postal: 'postal', postalRequired: true, postalPattern: /^\d{5}$/ },
};

export function addressFormat(country?: string | null): AddressFormat {
  return (country && ADDRESS_FORMATS[country.toUpperCase()]) || DEFAULT;
}

/** Built-in labels for address parts. Other languages fall back to the admin-editable `ui.region` / `ui.postalCode`. */
const LABELS: Record<string, Record<RegionKind | PostalKind, string>> = {
  en: {
    state: 'State',
    province: 'Province',
    county: 'County',
    district: 'District',
    prefecture: 'Prefecture',
    emirate: 'Emirate',
    region: 'State / region',
    zip: 'ZIP code',
    postcode: 'Postcode',
    pin: 'PIN code',
    postal: 'Postal code',
  },
  es: {
    state: 'Estado',
    province: 'Provincia',
    county: 'Condado',
    district: 'Distrito',
    prefecture: 'Prefectura',
    emirate: 'Emirato',
    region: 'Región',
    zip: 'Código ZIP',
    postcode: 'Código postal',
    pin: 'Código PIN',
    postal: 'Código postal',
  },
};

export function addressLabel(kind: RegionKind | PostalKind, locale: string): string | undefined {
  return LABELS[locale.split('-')[0]!]?.[kind];
}
