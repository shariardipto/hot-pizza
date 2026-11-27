/**
 * Demo legal pages. Generic templates — the parts in [square brackets] must be completed with the operator's real
 * details, and the texts reviewed by a lawyer for the countries you sell in.
 */
const p = (s: string) => `<p>${s}</p>`;
const h = (s: string) => `<h3><strong>${s}</strong></h3>`;
const updated = p('<strong>Last updated: [date]</strong>');

export const LEGAL: { slug: string; title: string; subtitle: string | null; metaTitle: string; content: string }[] = [
  {
    slug: 'legal-notice',
    title: 'LEGAL \nNOTICE',
    subtitle: null,
    metaTitle: 'Legal notice — PIZZA',
    content: [
      h('1. Website owner'),
      p('This website is operated by [Company legal name] (“PIZZA”), [company registration number], with registered office at [address]. E-mail: [contact e-mail]. Phone: [phone number].'),
      h('2. Purpose'),
      p('The website presents our pizzerias, menu and story, and lets visitors order pizza for delivery or pick-up and book a table.'),
      h('3. Conditions of use'),
      p('By using this website you agree to use it lawfully and not to damage, overload or interfere with it. Prices, opening hours and availability may change without notice; the price shown at checkout is the price you pay.'),
      h('4. Intellectual property'),
      p('The texts, design and code of this website belong to [Company legal name] or are used under licence. Demo photographs come from Pexels (pexels.com/license) and the Oswald typeface is licensed under the SIL Open Font License.'),
      h('5. Liability'),
      p('We take care to keep the information on this website accurate, but we cannot guarantee that it is always complete or up to date, nor that the website will be available without interruption.'),
      h('6. Applicable law'),
      p('These conditions are governed by the laws of [country]. Any dispute will be submitted to the courts of [city], unless consumer law provides otherwise.'),
      updated,
    ].join(''),
  },
  {
    slug: 'privacy-policy',
    title: 'PRIVACY \nPOLICY',
    subtitle: null,
    metaTitle: 'Privacy policy — PIZZA',
    content: [
      p('We respect your privacy. This policy explains which personal data we process when you visit this website, order pizza or book a table, and the rights you have (GDPR and similar laws).'),
      h('1. Data controller'),
      p('[Company legal name], [address]. E-mail: [privacy contact e-mail].'),
      h('2. Data we process and why'),
      p('<strong>Orders:</strong> name, phone number, e-mail address (optional for cash on delivery), delivery address, the items ordered and any notes — to prepare and deliver your order and to contact you about it.'),
      p('<strong>Table bookings:</strong> name, phone number, e-mail address (optional), date, time, party size and notes — to manage your reservation.'),
      p('<strong>Fraud prevention:</strong> the IP address and browser details of the order or booking, kept for a limited time to prevent fake orders.'),
      p('Payments are processed by the payment provider you choose (for example Stripe or PayPal). We never see or store your card details.'),
      h('3. Legal basis'),
      p('We process this data to perform the contract you request (your order or booking) and, for fraud prevention, on the basis of our legitimate interest in protecting the service.'),
      h('4. How long we keep it'),
      p('IP addresses and browser details are deleted after [90] days. Your name, phone, e-mail and address are removed from finished orders and past bookings after [24] months; order totals and items are kept as accounting records as required by law.'),
      h('5. Who receives it'),
      p('Only the providers needed to fulfil your order: the payment provider, delivery partners and our hosting provider. We never sell your data or use it for advertising.'),
      h('6. Your rights'),
      p('You can ask for a copy of your data, its correction or deletion, object to its processing, or ask us to restrict it, by writing to [privacy contact e-mail]. You can also complain to your data protection authority.'),
      h('7. Cookies'),
      p('This website uses no tracking or advertising cookies. See the cookie policy for details.'),
      updated,
    ].join(''),
  },
  {
    slug: 'cookie-policy',
    title: 'COOKIE \nPOLICY',
    subtitle: null,
    metaTitle: 'Cookie policy — PIZZA',
    content: [
      p('Cookies are small files a website stores in your browser. We keep them to the minimum needed for the website to work.'),
      h('Cookies we use'),
      p('<strong>Country / currency:</strong> remembers the delivery country you selected so prices are shown in the right currency.'),
      p('<strong>Your order:</strong> the contents of your basket are kept in your browser’s local storage until you place the order.'),
      p('<strong>Bot check:</strong> on checkout and bookings, Cloudflare Turnstile may use technical data to tell people from bots. It does not track you across websites.'),
      p('These are technically necessary, so they do not require consent. We do not use analytics, advertising or social-media tracking cookies. If that changes, we will ask for your consent first.'),
      h('Managing cookies'),
      p('You can delete or block cookies in your browser settings. Blocking the necessary ones may stop ordering from working.'),
      updated,
    ].join(''),
  },
];
