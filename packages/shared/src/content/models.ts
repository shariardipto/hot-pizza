import type { ImageValue } from './fields';

/** Resolved (single-language, fallback-applied) content shapes delivered by the public API. */

export type Img = ImageValue | null;
export type Str = string | null;

export interface Seo {
  metaTitle: Str;
  metaDescription: Str;
  metaImage: Img;
}

export interface HomeContent extends Seo {
  heroImage: Img;
  heroTitleLarge: Str;
  heroTitleSmallLeft: Str;
  heroTitleSmallRight: Str;
  introTitle: Str;
  introParagraph: Str;
  imageLeft: Img;
  imageCenter: Img;
  imageRight: Img;
  descriptionTitleLarge: Str;
  descriptionTitleSmallLeft: Str;
  descriptionTitleSmallRight: Str;
  descriptionParagraph: Str;
  bigSectionTitleUp: Str;
  bigSectionTitleBottom: Str;
  bigSectionImage: Img;
  showLocations: boolean | null;
  awardTitle: Str;
  awardImage: Img;
  awardDescription: Str;
}

export interface AboutChapterBlock {
  _id: string;
  _type: 'chapter';
  titleSmallLeft: Str;
  title: Str;
  titleSmallRight: Str;
  description: Str;
  color: Str;
  optimizeLegibility: boolean | null;
  secondary: boolean | null;
}
export interface AboutImageBlock {
  _id: string;
  _type: 'image';
  image: Img;
}
export interface AboutContent extends Seo {
  heroImage: Img;
  heroTitleSmallLeft: Str;
  heroTitleLarge: Str;
  heroTitleSmallRight: Str;
  chapters: (AboutChapterBlock | AboutImageBlock)[];
  productsChapterTitleSmallLeft: Str;
  productsChapterTitle: Str;
  productsChapterTitleSmallRight: Str;
  productsChapterDescription: Str;
}

export interface ProductsPageContent extends Seo {
  image: Img;
  titleLarge: Str;
  titleSmallLeft: Str;
  titleSmallRight: Str;
  smallDescription: Str;
}

export interface ContactContent extends Seo {
  image: Img;
  contactTitle: Str;
  contactDescription: Str;
  followTitle: Str;
  followDescription: Str;
}

export interface LocationsPageContent extends Seo {
  image: Img;
  titleLarge: Str;
}

export interface SocialLink {
  _id: string;
  label: Str;
  value: Str;
  link: Str;
}

export interface GlobalsContent {
  productWordTop: Str;
  productWordBottom: Str;
  productPrefix: Str;
  discover: Str;
  weight: Str;
  units: Str;
  badge: Str;
  relatedProductsTitle: Str;
  locationsLabel: Str;
  sealTextTop: Str;
  sealTextBottom: Str;
  footerSmallTextTop: Str;
  footerTextMain: Str;
  footerSmallTextRight: Str;
  rightsLink: Str;
  email: SocialLink[];
  instagram: SocialLink[];
  youtube: SocialLink[];
  facebook: SocialLink[];
}

/** All interface strings (see `ui` content type). Every key resolves to a string (fallbacks applied). */
export type UiStrings = Record<string, string>;

export interface LegalContent extends Seo {
  title: Str;
  subtitle: Str;
  /** Sanitized HTML. */
  content: Str;
}

export interface ProductTypeContent {
  name: Str;
  titleSmallLeft: Str;
  titleSmallRight: Str;
  description: Str;
  image: Img;
}

export interface FlavorContent {
  name: Str;
  color: Str;
  pageColor: Str;
  optimizeLegibility: boolean | null;
}

export interface ProductContent extends Seo {
  /** Entry id of the product type / flavor. */
  type: string;
  flavor: string;
  image: Img;
  gallery: { _id: string; image: Img }[];
  introTitle: Str;
  introDescription: Str;
  title: Str;
  smallTitleLeft: Str;
  smallTitleRight: Str;
  description: Str;
  units: Str;
  weight: Str;
  readyToEat: boolean | null;
  titleSmallLeftTradition: Str;
  yearLeftTradition: Str;
  descriptionLeftTradition: Str;
  imageTradition: Img;
  titleSmallRightTradition: Str;
  yearRightTradition: Str;
  descriptionRightTradition: Str;
}

/** A collection entry as delivered publicly. */
export interface Entry<T> {
  id: string;
  slug: string;
  sortOrder: number;
  data: T;
}

/** Commerce info merged into catalog products for the visitor's market. */
export interface ProductOffer {
  orderable: boolean;
  inStock: boolean;
  /** Price in minor units of `currency`. Null when the product has no price in this market. */
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  maxQuantity: number;
}

export interface CatalogProduct extends Entry<ProductContent> {
  typeEntry: Entry<ProductTypeContent> | null;
  flavorEntry: Entry<FlavorContent> | null;
  offer: ProductOffer | null;
}

export interface Catalog {
  productTypes: Entry<ProductTypeContent>[];
  flavors: Entry<FlavorContent>[];
  products: CatalogProduct[];
}
