/**
 * Demo content for the default "PIZZA" restaurant (English). Images are file names in ./assets/media
 * (see SOURCES.md there). Texts follow the line structure of the original design so every title wraps the same way.
 */

export type Img = { file: string; alt: string };
const img = (file: string, alt: string): Img => ({ file, alt });

export const HOME = {
  heroImage: img('gallery-black', 'Margherita pizza slices with fresh basil on a dark table'),
  heroTitleLarge: 'pizza\nis the heart\nof the table',
  heroTitleSmallLeft: 'wood\nfired',
  heroTitleSmallRight: 'slow\ndough',
  introTitle: 'wood-fired pizza',
  introParagraph:
    'PIZZA STARTED WITH A SIMPLE IDEA: GREAT DOUGH, A HOT OVEN AND INGREDIENTS WORTH SHARING. OUR DOUGH RISES FOR 48 HOURS, OUR TOMATOES ARE CRUSHED BY HAND AND EVERY PIZZA MEETS THE FLAMES FOR NINETY SECONDS. COME HUNGRY, LEAVE HAPPY.',
  imageLeft: img('home-card-left', 'Hands stretching pizza dough'),
  imageCenter: img('home-card-center', 'Margherita pizza straight from the oven'),
  imageRight: img('home-card-right', 'Pizzaiolo tossing dough'),
  descriptionTitleLarge: 'made\nwith fire\nand patience',
  descriptionTitleSmallLeft: '48 hour\ndough',
  descriptionTitleSmallRight: 'hand\nstretched',
  descriptionParagraph:
    'WE KEEP IT SIMPLE ON PURPOSE. FLOUR, WATER, SALT AND TIME FOR THE DOUGH. RIPE TOMATOES, FRESH MOZZARELLA AND BASIL FROM THE MARKET. WHAT CHANGES EVERY DAY IS THE FIRE: WE LIGHT IT AT DAWN SO THE OVEN IS READY WHEN YOU ARE.',
  bigSectionTitleUp: 'STRAIGHT\nFROM THE',
  bigSectionTitleBottom: 'WOOD\nOVEN',
  bigSectionImage: img('home-sticky', 'Fire burning in the wood oven'),
  showLocations: true,
  awardTitle: 'MADE BY HAND, EVERY SINGLE DAY',
  awardImage: img('home-award', 'A freshly baked pizza held up by hand'),
  awardDescription:
    'Good pizza takes time. Our dough rises slowly for 48 hours before it ever meets the oven.\nEvery base is stretched by hand, never rolled, so the crust stays light and airy, with the dark spots only real fire can give.\nWe top each pizza with ingredients we would put on our own table, then bake it at 450 °C for about ninety seconds.\nSimple, honest food, made to be shared.',
  metaTitle: 'PIZZA | Wood-fired pizza',
  metaDescription: 'Wood-fired pizza with slow-rising dough and fresh ingredients. Order for delivery or pick-up, or book a table.',
};

export const ABOUT = {
  heroImage: img('about-hero', 'Pizzaiolo sliding a pizza into the brick oven'),
  heroTitleSmallLeft: '2016',
  heroTitleLarge: 'FIRE\nAT THE HEART\nOF EVERY PIZZA',
  heroTitleSmallRight: '2026',
  chapters: [
    {
      _type: 'chapter',
      titleSmallLeft: 'chapter\none',
      title: 'HOW\nIT ALL BEGAN',
      titleSmallRight: 'chapter\none',
      description:
        'PIZZA STARTED IN 2016 WITH ONE USED WOOD OVEN, A FEW TABLES AND A RECIPE FOR DOUGH THAT TOOK A YEAR TO GET RIGHT. FRIENDS CAME FOR THE MARGHERITA AND CAME BACK WITH THEIR FRIENDS. THE ROOM WAS SMALL, THE QUEUE WAS LONG AND THE OVEN NEVER WENT COLD.',
      color: '#D70321',
      optimizeLegibility: true,
      secondary: false,
    },
    { _type: 'image', image: img('about-dough', 'Dough being stretched by hand') },
    {
      _type: 'chapter',
      titleSmallLeft: 'chapter\ntwo',
      title: 'THE DOUGH\nTHAT CHANGED US',
      titleSmallRight: 'chapter\ntwo',
      description:
        'EVERYTHING STARTS WITH THE DOUGH. WE MIX IT EVERY MORNING WITH JUST FLOUR, WATER, SALT AND A PINCH OF YEAST, THEN LET IT REST FOR 48 HOURS SO IT BECOMES LIGHT, AIRY AND EASY TO DIGEST.\n\nTHE OVEN DOES THE REST. AT 450 °C A PIZZA BAKES IN ABOUT NINETY SECONDS: THE CRUST PUFFS UP, THE CHEESE MELTS AND THE TOMATO STAYS FRESH.\n\nWE CHOOSE INGREDIENTS THE SAME WAY WE WOULD FOR OUR OWN TABLE: TOMATOES THAT TASTE OF SUMMER, MOZZARELLA DELIVERED FRESH, OLIVE OIL WE ARE PROUD OF.\n\nNO SHORTCUTS, NO FROZEN BASES, NO HURRY.\nJUST GOOD PIZZA, MADE TO BE SHARED.',
      color: '#F6D9A8',
      optimizeLegibility: false,
      secondary: true,
    },
    { _type: 'image', image: img('about-pizzeria', 'Inside a pizzeria') },
    {
      _type: 'chapter',
      titleSmallLeft: 'chapter\nthree',
      title: 'FROM ONE OVEN\nTO MANY TABLES',
      titleSmallRight: 'chapter\nthree',
      description:
        'TODAY PIZZA BAKES IN SEVERAL NEIGHBOURHOODS, EACH WITH ITS OWN WOOD OVEN AND THE SAME DOUGH. YOU CAN SIT DOWN WITH US, PICK UP ON YOUR WAY HOME OR HAVE IT DELIVERED STILL HOT. THE RECIPE HAS NOT CHANGED — ONLY THE NUMBER OF TABLES.',
      color: '#1F5C3A',
      optimizeLegibility: true,
      secondary: false,
    },
  ],
  productsChapterTitleSmallLeft: 'Chapter\nfour',
  productsChapterTitle: 'THE PIZZAS \nWE BAKE TODAY',
  productsChapterTitleSmallRight: 'Chapter\nfour',
  productsChapterDescription:
    'FROM THE CLASSIC MARGHERITA TO THE CHEF’S MONTHLY SPECIAL, EVERY PIZZA ON OUR MENU STARTS WITH THE SAME DOUGH AND THE SAME FIRE. PICK YOUR FAVOURITE — OR LET US SURPRISE YOU.',
  metaTitle: 'Our story | PIZZA',
  metaDescription: 'How a single wood oven and a 48-hour dough became PIZZA.',
};

export const PRODUCTS_PAGE = {
  image: img('products-hero', 'Pizza with peppers and olives'),
  titleLarge: 'PICK\nYOUR\nPIZZA',
  titleSmallLeft: 'SINCE \n2016',
  titleSmallRight: 'WOOD\nFIRED',
  smallDescription: 'EIGHT PIZZAS, ONE OVEN\nAND A LOT OF FIRE',
  metaTitle: 'Our pizzas | PIZZA',
  metaDescription: 'Classic, signature, veggie and chef’s specials — wood-fired pizza for delivery, pick-up or at the table.',
};

export const CONTACT = {
  image: img('contact', 'Friends raising a toast over pizza'),
  contactTitle: 'SAY HELLO',
  contactDescription:
    'WRITE TO US — FOR EVENTS, LARGE ORDERS OR JUST TO TELL US ABOUT YOUR FAVOURITE PIZZA. WE READ EVERY MESSAGE AND REPLY WITHIN A DAY.',
  followTitle: 'FOLLOW \nTHE FIRE',
  followDescription: 'FOLLOW US FOR NEW PIZZAS, STORIES FROM BEHIND THE OVEN AND THE ODD SECRET RECIPE.',
  metaTitle: 'Contact | PIZZA',
  metaDescription: 'Questions, events or large orders? Get in touch with PIZZA.',
};

export const LOCATIONS_PAGE = {
  image: img('locations-hero', 'Pizzeria counter with stacked pizza boxes'),
  titleLarge: 'FIND\nUS',
  metaTitle: 'Our locations | PIZZA',
  metaDescription: 'Addresses, opening hours and phone numbers of every PIZZA restaurant.',
};

export const GLOBALS = {
  productWordTop: 'Wood-fired',
  productWordBottom: 'Pizza',
  productPrefix: '',
  discover: 'Discover',
  weight: 'Size',
  units: 'Slices',
  badge: 'Hot & \nFresh',
  relatedProductsTitle: 'More pizza',
  locationsLabel: 'Our locations',
  sealTextTop: 'Wood-fired pizza',
  sealTextBottom: 'Since 2016',
  footerSmallTextTop: '#WOODFIRED',
  footerTextMain: 'PIZZA Centro\nCalle del Horno 12 • 28013 Madrid, Spain',
  footerSmallTextRight: '#PIZZA',
  rightsLink: 'mailto:privacy@pizza.example',
  email: [{ label: 'hello@pizza.example', value: 'hello@pizza.example', link: 'mailto:hello@pizza.example' }],
  instagram: [{ label: 'Instagram', value: '@pizza', link: 'https://www.instagram.com/' }],
  youtube: [{ label: 'YouTube', value: 'PIZZA', link: 'https://www.youtube.com/' }],
  facebook: [{ label: 'Facebook', value: 'PIZZA', link: 'https://www.facebook.com/' }],
};

export const CATEGORIES = [
  {
    slug: 'classic',
    name: 'Classic',
    titleSmallLeft: 'THE \nORIGINALS',
    titleSmallRight: 'NEVER\nGO OUT',
    description:
      'THE PIZZAS THAT STARTED IT ALL. A FEW INGREDIENTS, CHOSEN WITH CARE, ON OUR 48 HOUR DOUGH. SIMPLE ENOUGH TO EAT EVERY WEEK, GOOD ENOUGH TO CRAVE EVERY DAY.',
    image: img('category-classic', 'Classic pizza on a plate'),
  },
  {
    slug: 'signature',
    name: 'Signature',
    titleSmallLeft: 'THE \nHOUSE',
    titleSmallRight: 'OUR\nFAVOURITES',
    description:
      'THE RECIPES WE ARE KNOWN FOR. BOLDER TOPPINGS, A LITTLE HEAT AND THE COMBINATIONS OUR REGULARS ORDER WITHOUT LOOKING AT THE MENU. IF IT IS YOUR FIRST TIME, START HERE.',
    image: img('category-signature', 'Loaded pizza on a wooden board'),
  },
  {
    slug: 'veggie',
    name: 'Veggie',
    titleSmallLeft: 'THE\nGARDEN',
    titleSmallRight: 'NO MEAT\nALL FLAVOR',
    description:
      'VEGETABLES FROM THE MARKET, ROASTED IN THE SAME FIRE AS EVERYTHING ELSE. COLOURFUL, GENEROUS AND SO GOOD THAT NOBODY ASKS WHERE THE MEAT WENT.',
    image: img('category-veggie', 'Vegetable pizza with olives and peppers'),
  },
  {
    slug: 'specials',
    name: 'Specials',
    titleSmallLeft: 'THE\nCHEF’S',
    titleSmallRight: 'FOR\nSHARING',
    description:
      'WHAT THE KITCHEN IS EXCITED ABOUT RIGHT NOW. SEASONAL INGREDIENTS, PLAYFUL COMBINATIONS AND PIZZAS MADE FOR THE MIDDLE OF THE TABLE. ASK US WHAT IS NEW THIS MONTH.',
    image: img('category-specials', 'Pizza going into the wood oven'),
  },
];

export const FLAVORS = [
  { slug: 'margherita', name: 'Margherita', color: '#F0949B', pageColor: '#FFC0C5', optimizeLegibility: false },
  { slug: 'pepperoni', name: 'Pepperoni', color: '#FEAE02', pageColor: '#FFB82E', optimizeLegibility: false },
  { slug: 'diavola', name: 'Diavola', color: '#E8735A', pageColor: '#F4A592', optimizeLegibility: false },
  { slug: 'capricciosa', name: 'Capricciosa', color: '#9CCDFB', pageColor: '#B5D9FB', optimizeLegibility: false },
  { slug: 'garden', name: 'Garden', color: '#5A6420', pageColor: '#CED893', optimizeLegibility: false },
  { slug: 'funghi', name: 'Funghi', color: '#665936', pageColor: '#665936', optimizeLegibility: true },
  { slug: 'pomodorini', name: 'Pomodorini', color: '#BDC5E9', pageColor: '#BDC5E9', optimizeLegibility: false },
  { slug: 'half-and-half', name: 'Half & Half', color: '#6E5D5C', pageColor: '#6E5D5C', optimizeLegibility: true },
];

/** Shared "tradition" block of every product page. */
const TRADITION = {
  titleSmallLeftTradition: 'FROM NAPLES',
  yearLeftTradition: '1889',
  descriptionLeftTradition: 'PIZZA AS WE KNOW IT WAS BORN IN THE OVENS OF NAPLES: SIMPLE DOUGH, RIPE TOMATOES, FRESH CHEESE AND A FIRE HOT ENOUGH TO BAKE IT IN A MINUTE.',
  titleSmallRightTradition: 'TO YOUR TABLE',
  yearRightTradition: '2026',
  descriptionRightTradition: 'WE KEEP THAT IDEA ALIVE EVERY DAY, WITH A SLOW DOUGH, A REAL WOOD FIRE AND INGREDIENTS WE CHOOSE OURSELVES. SAME SPIRIT, NEW NEIGHBOURHOOD.',
  imageTradition: null,
};

export const PRODUCTS = [
  {
    slug: 'margherita',
    category: 'classic',
    flavor: 'margherita',
    image: img('pizza-margherita', 'Margherita pizza'),
    gallery: ['gallery-crust', 'gallery-hands', 'gallery-oven-glow'],
    price: 9.5,
    introTitle: 'THE CLASSIC',
    introDescription: 'Tomato, mozzarella, basil and a drizzle of olive oil. The pizza every pizzeria is judged by — and the one we bake most.',
    title: 'SIMPLE \nAND PERFECT',
    description: 'OUR 48 HOUR DOUGH, HAND CRUSHED TOMATOES, FRESH MOZZARELLA AND BASIL, FINISHED WITH EXTRA VIRGIN OLIVE OIL.\nBAKED FOR NINETY SECONDS IN THE WOOD OVEN.\nINGREDIENTS: TOMATO / MOZZARELLA / BASIL / OLIVE OIL.',
  },
  {
    slug: 'pepperoni',
    category: 'classic',
    flavor: 'pepperoni',
    image: img('pizza-pepperoni', 'Pepperoni pizza'),
    gallery: ['gallery-pepperoni', 'gallery-sharing', 'gallery-flames'],
    price: 11.5,
    introTitle: 'THE FAVOURITE',
    introDescription: 'Plenty of spicy pepperoni that crisps at the edges in the oven, on tomato and melted mozzarella. Impossible to share — but try.',
    title: 'CRISPY \nAT THE EDGES',
    description: 'TOMATO SAUCE, MOZZARELLA AND A GENEROUS LAYER OF PEPPERONI THAT CURLS AND CRISPS IN THE FIRE.\nA LITTLE OREGANO TO FINISH.\nINGREDIENTS: TOMATO / MOZZARELLA / PEPPERONI / OREGANO.',
  },
  {
    slug: 'diavola',
    category: 'signature',
    flavor: 'diavola',
    image: img('pizza-diavola', 'Diavola pizza with salami, olives and rocket'),
    gallery: ['gallery-slice-pull', 'gallery-cafe', 'gallery-fire'],
    price: 13.5,
    introTitle: 'THE SPICY ONE',
    introDescription: 'Spicy salami, black olives and a handful of fresh rocket after the oven. Hot in every sense of the word.',
    title: 'A LITTLE \nBIT OF HEAT',
    description: 'TOMATO, MOZZARELLA, SPICY SALAMI AND BLACK OLIVES, TOPPED WITH FRESH ROCKET AS IT LEAVES THE OVEN.\nASK FOR EXTRA CHILLI OIL IF YOU DARE.\nINGREDIENTS: TOMATO / MOZZARELLA / SPICY SALAMI / OLIVES / ROCKET.',
  },
  {
    slug: 'capricciosa',
    category: 'signature',
    flavor: 'capricciosa',
    image: img('pizza-capricciosa', 'Capricciosa pizza'),
    gallery: ['gallery-plate', 'gallery-friends', 'gallery-oven'],
    price: 13.5,
    introTitle: 'THE GENEROUS ONE',
    introDescription: 'Ham, mushrooms, artichokes and olives. A little of everything, the way it has been made in Italy for generations.',
    title: 'A LITTLE \nOF EVERYTHING',
    description: 'TOMATO, MOZZARELLA, COOKED HAM, MUSHROOMS, ARTICHOKES AND OLIVES.\nA PIZZA FOR PEOPLE WHO CANNOT DECIDE.\nINGREDIENTS: TOMATO / MOZZARELLA / HAM / MUSHROOMS / ARTICHOKES / OLIVES.',
  },
  {
    slug: 'garden',
    category: 'veggie',
    flavor: 'garden',
    image: img('pizza-garden', 'Garden vegetable pizza'),
    gallery: ['gallery-veggie', 'gallery-basil', 'gallery-dough-toss'],
    price: 11.9,
    introTitle: 'THE GREEN ONE',
    introDescription: 'Peppers, red onion, olives and seasonal vegetables, roasted in the wood fire on a tomato and mozzarella base.',
    title: 'STRAIGHT \nFROM THE MARKET',
    description: 'TOMATO, MOZZARELLA, ROASTED PEPPERS, RED ONION, OLIVES AND THE VEGETABLES OF THE SEASON.\nVEGETARIAN.\nINGREDIENTS: TOMATO / MOZZARELLA / PEPPERS / ONION / OLIVES / SEASONAL VEGETABLES.',
  },
  {
    slug: 'funghi',
    category: 'veggie',
    flavor: 'funghi',
    image: img('pizza-funghi', 'Mushroom pizza'),
    gallery: ['gallery-mushroom-slice', 'gallery-white', 'gallery-oven-glow'],
    price: 11.9,
    introTitle: 'THE EARTHY ONE',
    introDescription: 'Sliced mushrooms, mozzarella and a touch of garlic and thyme. Rich, earthy and deeply comforting.',
    title: 'EARTHY \nAND COMFORTING',
    description: 'MOZZARELLA, SLICED MUSHROOMS, GARLIC AND THYME ON OUR 48 HOUR DOUGH, WITH A DRIZZLE OF OLIVE OIL.\nVEGETARIAN.\nINGREDIENTS: MOZZARELLA / MUSHROOMS / GARLIC / THYME / OLIVE OIL.',
  },
  {
    slug: 'pomodorini',
    category: 'specials',
    flavor: 'pomodorini',
    image: img('pizza-pomodorini', 'Pizza with red and yellow cherry tomatoes and basil'),
    gallery: ['gallery-tomatoes', 'gallery-burrata', 'gallery-cutter'],
    price: 14.5,
    introTitle: 'THE SUMMER ONE',
    introDescription: 'Red and yellow cherry tomatoes, creamy mozzarella and lots of fresh basil. Summer on a pizza, all year round.',
    title: 'SUMMER \nON A PIZZA',
    description: 'FIOR DI LATTE MOZZARELLA, RED AND YELLOW CHERRY TOMATOES AND FRESH BASIL ON A LEOPARD SPOTTED CRUST.\nVEGETARIAN.\nINGREDIENTS: MOZZARELLA / CHERRY TOMATOES / BASIL / OLIVE OIL.',
  },
  {
    slug: 'half-and-half',
    category: 'specials',
    flavor: 'half-and-half',
    image: img('pizza-half-and-half', 'Half pepperoni, half mushroom pizza'),
    gallery: ['gallery-slices', 'gallery-black', 'gallery-board'],
    price: 14.5,
    introTitle: 'THE PEACEMAKER',
    introDescription: 'Can’t agree? Half pepperoni, half mushrooms and cheese — one pizza, two favourites, no arguments.',
    title: 'TWO PIZZAS \nIN ONE',
    description: 'ONE HALF PEPPERONI, ONE HALF MUSHROOMS WITH A BLEND OF CHEESES, ON TOMATO AND MOZZARELLA.\nMADE FOR SHARING.\nINGREDIENTS: TOMATO / MOZZARELLA / PEPPERONI / MUSHROOMS / CHEESE BLEND.',
  },
].map((p) => ({
  ...p,
  smallTitleLeft: 'SINCE\n2016',
  smallTitleRight: 'WOOD FIRED',
  units: '8',
  weight: '30 cm',
  readyToEat: true,
  ...TRADITION,
  metaTitle: `${FLAVORS.find((f) => f.slug === p.flavor)!.name} | PIZZA`,
  metaDescription: p.introDescription,
}));

const lunch = { open: '13:00', close: '16:00' };
const dinner = { open: '19:30', close: '23:30' };
const allDay = { open: '12:30', close: '23:30' };

export const LOCATIONS = [
  {
    slug: 'centro',
    name: 'PIZZA Centro',
    addressLine1: 'Calle del Horno 12',
    postalCode: '28013',
    city: 'Madrid',
    region: 'Madrid',
    phone: '+34910000001',
    email: 'centro@pizza.example',
    latitude: 40.4168,
    longitude: -3.7038,
    maxCovers: 60,
    openingHours: { '0': [allDay], '1': [lunch, dinner], '2': [lunch, dinner], '3': [lunch, dinner], '4': [lunch, dinner], '5': [allDay], '6': [allDay] },
  },
  {
    slug: 'malasana',
    name: 'PIZZA Malasaña',
    addressLine1: 'Calle de la Masa 8',
    postalCode: '28004',
    city: 'Madrid',
    region: 'Madrid',
    phone: '+34910000002',
    email: 'malasana@pizza.example',
    latitude: 40.4262,
    longitude: -3.7047,
    maxCovers: 40,
    openingHours: { '0': [allDay], '1': [], '2': [dinner], '3': [dinner], '4': [dinner], '5': [lunch, dinner], '6': [lunch, dinner] },
  },
  {
    slug: 'gracia',
    name: 'PIZZA Gràcia',
    addressLine1: 'Carrer del Forn 21',
    postalCode: '08012',
    city: 'Barcelona',
    region: 'Barcelona',
    phone: '+34930000003',
    email: 'gracia@pizza.example',
    latitude: 41.4036,
    longitude: 2.1561,
    maxCovers: 45,
    openingHours: { '0': [lunch], '1': [lunch, dinner], '2': [lunch, dinner], '3': [lunch, dinner], '4': [lunch, dinner], '5': [lunch, dinner], '6': [lunch, dinner] },
  },
];
