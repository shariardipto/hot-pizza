import type { CollectionKey, Field, SingletonKey } from './fields';
import { seoFields } from './fields';

export interface ContentTypeDef {
  key: string;
  label: string;
  kind: 'singleton' | 'collection';
  description?: string;
  /** Public path (collections: with `:slug`). Used for revalidation + "view on site" links. */
  path?: string;
  fields: Field[];
}

const t = (key: string, label: string, group?: string, extra: Partial<Field> = {}): Field =>
  ({ key, label, type: 'text', group, ...extra }) as Field;
const ta = (key: string, label: string, group?: string, extra: Partial<Field> = {}): Field =>
  ({ key, label, type: 'textarea', group, ...extra }) as Field;
const img = (key: string, label: string, group?: string, extra: Partial<Field> = {}): Field =>
  ({ key, label, type: 'image', group, ...extra }) as Field;
const bool = (key: string, label: string, group?: string, extra: Partial<Field> = {}): Field =>
  ({ key, label, type: 'boolean', group, ...extra }) as Field;
const color = (key: string, label: string, group?: string, extra: Partial<Field> = {}): Field =>
  ({ key, label, type: 'color', group, ...extra }) as Field;

/* ───────────────────────────── Singletons ───────────────────────────── */

const home: ContentTypeDef = {
  key: 'home',
  label: 'Home page',
  kind: 'singleton',
  path: '/',
  fields: [
    img('heroImage', 'Hero image', 'Hero'),
    ta('heroTitleLarge', 'Hero title (large)', 'Hero', { help: 'Use line breaks to control wrapping.' }),
    ta('heroTitleSmallLeft', 'Hero caption (left)', 'Hero'),
    ta('heroTitleSmallRight', 'Hero caption (right)', 'Hero'),
    t('introTitle', 'Intro title', 'Intro'),
    ta('introParagraph', 'Intro paragraph', 'Intro'),
    img('imageLeft', 'Card image (left)', 'Cards'),
    img('imageCenter', 'Card image (center)', 'Cards'),
    img('imageRight', 'Card image (right)', 'Cards'),
    ta('descriptionTitleLarge', 'Description title (large)', 'Description'),
    ta('descriptionTitleSmallLeft', 'Description caption (left)', 'Description'),
    ta('descriptionTitleSmallRight', 'Description caption (right)', 'Description'),
    ta('descriptionParagraph', 'Description paragraph', 'Description'),
    ta('bigSectionTitleUp', 'Sticky section — title above seal', 'Sticky section'),
    ta('bigSectionTitleBottom', 'Sticky section — title below seal', 'Sticky section'),
    img('bigSectionImage', 'Sticky section — background image', 'Sticky section'),
    bool('showLocations', 'Show “Our locations” button', 'Banners'),
    ta('awardTitle', 'Award title', 'Award'),
    img('awardImage', 'Award image', 'Award', { localized: true }),
    ta('awardDescription', 'Award description', 'Award'),
    ...seoFields,
  ],
};

const about: ContentTypeDef = {
  key: 'about',
  label: 'Our story (about page)',
  kind: 'singleton',
  path: '/about',
  fields: [
    img('heroImage', 'Hero image', 'Hero'),
    ta('heroTitleSmallLeft', 'Hero caption (left)', 'Hero'),
    ta('heroTitleLarge', 'Hero title (large)', 'Hero'),
    ta('heroTitleSmallRight', 'Hero caption (right)', 'Hero'),
    {
      key: 'chapters',
      label: 'Chapters',
      type: 'blocks',
      group: 'Chapters',
      blocks: {
        chapter: {
          label: 'Text chapter',
          fields: [
            ta('titleSmallLeft', 'Caption (left)'),
            ta('title', 'Title'),
            ta('titleSmallRight', 'Caption (right)'),
            ta('description', 'Description'),
            color('color', 'Background color'),
            bool('optimizeLegibility', 'Light text (for dark backgrounds)'),
            bool('secondary', 'Secondary layout'),
          ],
        },
        image: { label: 'Full-width image', fields: [img('image', 'Image')] },
      },
    },
    ta('productsChapterTitleSmallLeft', 'Caption (left)', 'Products chapter'),
    ta('productsChapterTitle', 'Title', 'Products chapter'),
    ta('productsChapterTitleSmallRight', 'Caption (right)', 'Products chapter'),
    ta('productsChapterDescription', 'Description', 'Products chapter'),
    ...seoFields,
  ],
};

const productsPage: ContentTypeDef = {
  key: 'productsPage',
  label: 'Products page',
  kind: 'singleton',
  path: '/products',
  fields: [
    img('image', 'Hero image', 'Hero'),
    ta('titleLarge', 'Title (large)', 'Hero'),
    ta('titleSmallLeft', 'Caption (left)', 'Hero'),
    ta('titleSmallRight', 'Caption (right)', 'Hero'),
    ta('smallDescription', 'Small description', 'Hero'),
    ...seoFields,
  ],
};

const contact: ContentTypeDef = {
  key: 'contact',
  label: 'Contact page',
  kind: 'singleton',
  path: '/contact',
  fields: [
    img('image', 'Image'),
    t('contactTitle', 'Contact title', 'Contact'),
    ta('contactDescription', 'Contact description', 'Contact'),
    ta('followTitle', 'Follow title', 'Follow'),
    ta('followDescription', 'Follow description', 'Follow'),
    ...seoFields,
  ],
};

const locationsPage: ContentTypeDef = {
  key: 'locationsPage',
  label: 'Locations page',
  kind: 'singleton',
  description: 'The branches listed on this page (address, phone, opening hours) come from Locations.',
  path: '/locations',
  fields: [img('image', 'Hero image'), ta('titleLarge', 'Title (large)'), ...seoFields],
};

const social = (key: string, label: string): Field => ({
  key,
  label,
  type: 'list',
  group: 'Social & contact',
  max: 3,
  itemLabel: 'label',
  fields: [
    t('label', 'Label'),
    t('value', 'Displayed value', undefined, { localized: false }),
    { key: 'link', label: 'Link', type: 'url', localized: false },
  ],
});

/** Global strings, footer and social links. */
const globals: ContentTypeDef = {
  key: 'globals',
  label: 'Global texts & footer',
  kind: 'singleton',
  fields: [
    t('productWordTop', 'Products — big word (top)', 'Product labels', { help: 'Shown above and below each product in big letters, e.g. “WOOD-FIRED” / “PIZZA”.' }),
    t('productWordBottom', 'Products — big word (bottom)', 'Product labels'),
    t('productPrefix', 'Products — word before the flavor name', 'Product labels', { help: 'e.g. “THE” → “THE MARGHERITA”. Can be empty.' }),
    t('discover', 'Products — “Discover”', 'Product labels'),
    t('weight', 'Spec — size label', 'Product labels'),
    t('units', 'Spec — pieces label', 'Product labels'),
    ta('badge', 'Badge text', 'Product labels'),
    t('relatedProductsTitle', 'Related products — title', 'Related products'),
    t('locationsLabel', '“Our locations” button', 'Banners'),
    t('sealTextTop', 'Seal — text (top of the circle)', 'Seal'),
    t('sealTextBottom', 'Seal — text (bottom of the circle)', 'Seal'),
    t('footerSmallTextTop', 'Footer — top caption', 'Footer'),
    ta('footerTextMain', 'Footer — main text', 'Footer'),
    t('footerSmallTextRight', 'Footer — caption (right)', 'Footer'),
    {
      key: 'rightsLink',
      label: 'Footer — data-rights request link',
      type: 'url',
      localized: false,
      group: 'Footer',
      help: 'Where the “Rights” footer link points (GDPR request form, e-mail link…). Leave empty to hide it.',
    },
    social('email', 'E-mail'),
    social('instagram', 'Instagram'),
    social('youtube', 'YouTube'),
    social('facebook', 'Facebook'),
  ],
};

/** Interface strings that were hard-coded in the original components + strings for ordering & reservations. */
const ui: ContentTypeDef = {
  key: 'ui',
  label: 'Interface texts',
  kind: 'singleton',
  description: 'Menu, footer links, cart, checkout, reservations and system messages.',
  fields: [
    t('navHome', 'Menu — Home', 'Navigation'),
    t('navProducts', 'Menu — Products', 'Navigation'),
    t('navAbout', 'Menu — Our story', 'Navigation'),
    t('navContact', 'Menu — Contact', 'Navigation'),
    t('navReservations', 'Menu — Reservations', 'Navigation'),
    t('menuLabel', 'Menu button', 'Navigation'),
    t('menuClose', 'Close button', 'Navigation'),
    t('loading', 'Loading text', 'Navigation'),
    t('footerHistory', 'Footer — Our story', 'Footer links'),
    t('footerLegalNotice', 'Footer — Legal notice', 'Footer links'),
    t('footerCookies', 'Footer — Cookie policy', 'Footer links'),
    t('footerPrivacy', 'Footer — Privacy policy', 'Footer links'),
    t('footerRights', 'Footer — Rights', 'Footer links'),
    t('footerCopyright', 'Footer — copyright ({year} = current year)', 'Footer links'),
    t('emailLabel', 'Contact — e-mail label', 'Contact'),
    ta('notFoundTitle', '404 — title', 'System'),
    t('notFoundCta', '404 — back home', 'System'),
    t('showcaseLine1', 'Showcase (phones) — line 1', 'Showcase'),
    t('showcaseLine2', 'Showcase (phones) — line 2', 'Showcase'),
    // Ordering
    t('addToOrder', 'Add to order', 'Ordering'),
    t('added', 'Added', 'Ordering'),
    t('outOfStock', 'Out of stock', 'Ordering'),
    t('unavailableInRegion', 'Not available in your region', 'Ordering'),
    t('cart', 'Cart', 'Ordering'),
    ta('cartEmpty', 'Cart empty message', 'Ordering'),
    t('continueShopping', 'Continue shopping', 'Ordering'),
    t('checkout', 'Checkout', 'Ordering'),
    t('subtotal', 'Subtotal', 'Ordering'),
    t('shipping', 'Shipping', 'Ordering'),
    t('freeShipping', 'Free', 'Ordering'),
    t('freeShippingFrom', 'Free delivery threshold ({amount} = amount)', 'Ordering'),
    t('minOrder', 'Minimum order ({amount} = amount)', 'Ordering'),
    t('codMax', 'Cash on delivery limit ({amount} = amount)', 'Ordering'),
    t('paymentUnavailable', 'No payment method available', 'Ordering'),
    t('tax', 'Tax', 'Ordering'),
    t('taxIncluded', 'Tax included', 'Ordering'),
    t('codFee', 'Cash on delivery fee', 'Ordering'),
    t('total', 'Total', 'Ordering'),
    t('quantity', 'Quantity', 'Ordering'),
    t('remove', 'Remove', 'Ordering'),
    t('deliverTo', 'Deliver to (country)', 'Checkout'),
    t('contactDetails', 'Contact details', 'Checkout'),
    t('fullName', 'Full name', 'Checkout'),
    t('phone', 'Phone number', 'Checkout'),
    t('email', 'E-mail', 'Checkout'),
    t('emailOptional', 'E-mail (optional)', 'Checkout'),
    t('fulfillment', 'Delivery method', 'Checkout'),
    t('delivery', 'Home delivery', 'Checkout'),
    t('pickup', 'Pick up', 'Checkout'),
    t('address', 'Delivery address', 'Checkout'),
    t('addressLine1', 'Address line 1', 'Checkout'),
    t('addressLine2', 'Address line 2 (optional)', 'Checkout'),
    t('city', 'City', 'Checkout'),
    t('postalCode', 'Postal code', 'Checkout'),
    t('region', 'State / region', 'Checkout'),
    t('pickupLocation', 'Pick-up location', 'Checkout'),
    t('notes', 'Notes for the order (optional)', 'Checkout'),
    t('payment', 'Payment', 'Checkout'),
    t('payCod', 'Cash on delivery', 'Checkout'),
    ta('payCodHint', 'Cash on delivery hint', 'Checkout'),
    t('payOnline', 'Pay online', 'Checkout'),
    t('placeOrder', 'Place order', 'Checkout'),
    t('payNow', 'Pay now', 'Checkout'),
    ta('acceptTerms', 'Accept terms text', 'Checkout'),
    t('processing', 'Processing…', 'Checkout'),
    t('orderThanks', 'Order confirmation title', 'Order status'),
    ta('orderThanksText', 'Order confirmation text', 'Order status'),
    t('orderNumber', 'Order number', 'Order status'),
    t('orderNumberPlaceholder', 'Order number — example shown in the empty field', 'Order status'),
    t('orderStatus', 'Status', 'Order status'),
    t('paymentStatus', 'Payment status', 'Order status'),
    t('trackOrder', 'Track your order', 'Order status'),
    // Reservations
    ta('reservationTitle', 'Reservations — page title', 'Reservations'),
    ta('reservationIntro', 'Reservations — intro', 'Reservations'),
    t('reservationLocation', 'Location', 'Reservations'),
    t('reservationDate', 'Date', 'Reservations'),
    t('reservationTime', 'Time', 'Reservations'),
    t('reservationGuests', 'Guests', 'Reservations'),
    t('reservationPhoneCountry', 'Phone country code', 'Reservations'),
    t('reservationNotes', 'Notes field', 'Reservations'),
    t('reservationNoSlots', 'No availability', 'Reservations'),
    t('reservationSubmit', 'Book a table', 'Reservations'),
    t('reservationThanks', 'Confirmation title', 'Reservations'),
    ta('reservationThanksText', 'Confirmation text', 'Reservations'),
    t('reservationCancel', 'Cancel reservation', 'Reservations'),
    t('reservationCancelled', 'Cancelled message', 'Reservations'),
    // Errors
    t('errorRequired', 'Error — required', 'Errors'),
    t('errorPhone', 'Error — invalid phone', 'Errors'),
    t('errorEmail', 'Error — invalid e-mail', 'Errors'),
    t('errorPostal', 'Error — invalid postal code', 'Errors'),
    t('errorGeneric', 'Error — generic', 'Errors'),
    t('errorCaptcha', 'Error — bot check failed', 'Errors'),
    t('errorCodLimit', 'Error — too many open cash-on-delivery orders', 'Errors'),
    t('errorReservationLimit', 'Error — too many upcoming reservations', 'Errors'),
    t('errorBlocked', 'Error — customer blocked (keep it neutral)', 'Errors'),
  ],
};

/* ───────────────────────────── Collections ───────────────────────────── */

const legal: ContentTypeDef = {
  key: 'legal',
  label: 'Legal pages',
  kind: 'collection',
  path: '/legal/:slug',
  fields: [t('title', 'Title'), t('subtitle', 'Subtitle'), { key: 'content', label: 'Content', type: 'richtext' }, ...seoFields],
};

const productType: ContentTypeDef = {
  key: 'productType',
  label: 'Menu categories',
  kind: 'collection',
  description: 'Classic, Signature, Veggie… Each product belongs to one category.',
  fields: [
    t('name', 'Name'),
    ta('titleSmallLeft', 'Caption (left)'),
    ta('titleSmallRight', 'Caption (right)'),
    ta('description', 'Description'),
    img('image', 'Image'),
  ],
};

const flavor: ContentTypeDef = {
  key: 'flavor',
  label: 'Flavors',
  kind: 'collection',
  description: 'The recipes (Margherita, Pepperoni…). Each flavor sets the colors used on its product pages.',
  fields: [
    t('name', 'Name'),
    color('color', 'Product color'),
    color('pageColor', 'Page background color'),
    bool('optimizeLegibility', 'Light text (for dark colors)'),
  ],
};

const product: ContentTypeDef = {
  key: 'product',
  label: 'Products',
  kind: 'collection',
  path: '/products/:slug',
  fields: [
    { key: 'type', label: 'Menu category', type: 'reference', to: 'productType', required: true, group: 'Classification' },
    { key: 'flavor', label: 'Flavor', type: 'reference', to: 'flavor', required: true, group: 'Classification' },
    img('image', 'Product image (cut-out on a transparent background)', 'Media'),
    {
      key: 'gallery',
      label: 'Gallery',
      type: 'list',
      group: 'Media',
      fields: [img('image', 'Image')],
    },
    t('introTitle', 'Intro title', 'Intro'),
    ta('introDescription', 'Intro description', 'Intro'),
    ta('title', 'Title', 'Details'),
    ta('smallTitleLeft', 'Caption (left)', 'Details'),
    ta('smallTitleRight', 'Caption (right)', 'Details'),
    ta('description', 'Description', 'Details'),
    t('units', 'Pieces (e.g. 8 slices)', 'Details', { localized: false }),
    t('weight', 'Size (e.g. 30 cm)', 'Details', { localized: false }),
    bool('readyToEat', 'Show the badge', 'Details'),
    t('titleSmallLeftTradition', 'Left — caption', 'Tradition'),
    t('yearLeftTradition', 'Left — year', 'Tradition', { localized: false }),
    ta('descriptionLeftTradition', 'Left — description', 'Tradition'),
    img('imageTradition', 'Image', 'Tradition'),
    t('titleSmallRightTradition', 'Right — caption', 'Tradition'),
    t('yearRightTradition', 'Right — year', 'Tradition', { localized: false }),
    ta('descriptionRightTradition', 'Right — description', 'Tradition'),
    ...seoFields,
  ],
};

export const singletonTypes: Record<SingletonKey, ContentTypeDef> = {
  home,
  about,
  productsPage,
  contact,
  locationsPage,
  globals,
  ui,
};

export const collectionTypes: Record<CollectionKey, ContentTypeDef> = {
  legal,
  productType,
  flavor,
  product,
};

export const contentTypes: Record<string, ContentTypeDef> = { ...singletonTypes, ...collectionTypes };

export function getContentType(key: string): ContentTypeDef | undefined {
  return contentTypes[key];
}
