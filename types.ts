
/** Configuración de la integración B2B con el almacén central ARAW */
export interface ARAWIntegrationConfig {
  enabled: boolean;
  arawBaseUrl: string;
  apiKey: string;
  lastValidatedAt?: string;
}

export interface SystemConfig {
  seoTitle: string;
  seoDescription: string;
  enableAbandonedCart: boolean;
  enableOrderUpdates: boolean;
  priceDisplayMode: 'usd' | 'ves' | 'both';
  currencyRateMode: 'bcv' | 'paralelo' | 'euro_bcv';
  adminPassword?: string;
  sellerPassword?: string;
  masterPassword?: string;
  paymentMethods?: PaymentMethod[];
  users?: UserAccount[];
  logs?: ActivityLog[];
  planTier?: 'single' | 'multi';
  arawIntegration?: ARAWIntegrationConfig; // Integración B2B con almacén central
}

export interface AnnouncementBarConfig {
  announcementBarEnabled?: boolean;
  announcementBarText?: string;
  announcementBarBgColor?: string;
  announcementBarTextColor?: string;
  announcementBarLink?: string;
  announcementBarDismissible?: boolean;
}

export interface StoreSettings extends GeneralConfig, ThemeConfig, HeroConfig, PromoConfig, GiftBannerConfig, SystemConfig, AnnouncementBarConfig { }

// ... resto del archivo igual (VariantOption, ProductVariant, etc.)
export interface VariantOption {
  name: string;
  values: string[];
  type: 'text' | 'color';
  colorValues?: Record<string, string>;
}

export interface ProductVariant {
  id: string;
  sku: string;
  /**
   * Clave de combinación única derivada de `selections`.
   * Ej: "Talla:S|Color:Rojo"  →  usada para hacer merge sin depender del id.
   */
  combinationKey?: string;
  selections: Record<string, string>;
  price: number;
  salePrice?: number;
  /**
   * Stock de la sede activa (vista local).
   * Al guardar, este valor se escribe SÓLO en la entrada correspondiente de branchStock.
   */
  stock: number;
  /**
   * Inventario distribuido por sede.
   * Clave: branchId (number)  →  Valor: unidades en esa sede.
   * Ejemplo: { 1: 5, 2: 10 }
   * Al actualizar una sede, sólo se modifica su entrada; las demás permanecen intactas.
   */
  branchStock?: Record<number, number>;
  image?: string;
}

export interface Product {
  id: string;
  code: string;
  title: string;
  description: string;
  cost: number;
  price: number;
  salePrice?: number;
  discountPrice?: number;
  stock: number;
  globalStock?: number;
  minStock?: number;
  trackStock?: boolean;
  images: string[];
  category: string;
  isVisible: boolean;
  isFeatured: boolean;
  variantOptions: VariantOption[];
  variants: ProductVariant[];
  createdAt: number;
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'fiat' | 'crypto' | 'bank' | 'other';
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  branchId?: number;
  userId: string;
  userName: string;
  type: 'entry' | 'exit' | 'sale' | 'adjustment' | 'return' | 'transfer_in' | 'transfer_out';
  amount: number;
  stockAfter: number;
  reference: string;
  date: number;
}

export interface Category {
  id: string;
  name: string;
  image?: string;
}

export interface CartItem {
  cartId: string;
  productId: string;
  productTitle: string;
  variantSku?: string;
  variantId?: string;
  price: number;
  originalPrice?: number;
  itemDiscountValue?: number;
  itemDiscountType?: 'percent' | 'fixed';
  image: string;
  selectedOptions: Record<string, string>;
  quantity: number;
}

export interface Order {
  id: string;
  branchId?: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  subtotal?: number;
  discount?: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  date: number;
  paymentMethod: string;
  sellerId?: string;
  sellerName?: string;
  deliveryMethod?: 'delivery' | 'pickup' | 'pos';
  pickupBranchId?: number;
}

export interface Customer {
  phone: string;
  name: string;
  address: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: number;
  orderIds: string[];
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  active: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'seller';
  branchId?: number;
  assignedBranchId?: number;
  permissions?: string[];
  active: boolean;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'login' | 'sale' | 'create_product' | 'update_product' | 'delete_product' | 'create_user' | 'update_settings' | 'other';
  details: string;
  timestamp: number;
}

export interface GeneralConfig {
  storeName: string;
  logoUrl: string;
  appIconUrl?: string;
  whatsappNumber: string;
  aboutUsText?: string;
  footerDescription?: string;
  contactEmail?: string;
  contactAddress?: string;
  contactGoogleMaps?: string;
  socialInstagram?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialTiktok?: string;
  hideStoreName?: boolean;
  hideOutOfStock?: boolean;
  additionalAddresses?: { id: string, address: string, mapUrl: string }[];
  /** Mostrar botón flotante de WhatsApp en todas las páginas públicas */
  showWhatsappFloat?: boolean;
  /** Mensaje predeterminado al abrir el chat flotante de WhatsApp */
  whatsappFloatMessage?: string;
  /** Horario de atención visible en el footer */
  businessHours?: string;
  /** Ocultar el logo y nombre de la tienda en el footer */
  hideFooterBrand?: boolean;
}

export interface ThemeConfig {
  primaryColor: string;
  navbarColor: string;
  navbarTextColor: string;
  darkMode: boolean;
  forceGlobalDarkMode?: boolean;
  fontFamily?: string;
}

export interface HeroSlide {
  id: string;
  image: string;
  mobileImage?: string;
  title: string;
  subtitle: string;
  buttonText?: string;
  link?: string;
  align: 'left' | 'center' | 'right';
  badgeText?: string;
  hideText?: boolean;
  hideButton?: boolean;
  glassEffect?: boolean;
}

export interface HeroConfig {
  homeHeroTitle?: string;
  homeHeroSubtitle?: string;
  homeHeroImage?: string;
  homeHeroAlign?: 'left' | 'center' | 'right';
  heroSlides?: HeroSlide[];
  homeHeroHeight?: 'compact' | 'medium' | 'full';
  homeHeroOverlayOpacity?: number;
  homeHeroGlassEffect?: boolean;
  homeFeature1Title?: string;
  homeFeature1Text?: string;
  homeFeature1Icon?: string;
  homeFeature2Title?: string;
  homeFeature2Text?: string;
  homeFeature2Icon?: string;
  homeFeature3Title?: string;
  homeFeature3Text?: string;
  homeFeature3Icon?: string;
  /** Modo solo imagen: oculta texto y botones en TODOS los slides del hero */
  heroSliderOnlyImages?: boolean;
  /** Visibilidad de secciones en la Home */
  showBestSellers?: boolean;
  showNewArrivals?: boolean;
  showSaleSection?: boolean;
  showCategoriesSection?: boolean;
  showFeaturesSection?: boolean;
}

export interface PromoConfig {
  homeBannerTitle?: string;
  homeBannerText?: string;
  homeBannerImage?: string;
  homeBannerButtonText?: string;
  homeBannerBadgeText?: string;
  homeBannerLink?: string;
}

export interface GiftBannerConfig {
  giftBannerTitle?: string;
  giftBannerDescription?: string;
  giftBannerImage?: string;
  giftBannerButtonText?: string;
  giftBannerWhatsApp?: string;
}

export type UserRole = 'admin' | 'seller' | null;

export interface StoreContextType {
  loading: boolean;
  isOffline: boolean;

  branches: Branch[];
  currentBranch: Branch | null;
  switchBranch: (branchId: number) => Promise<void>;
  saveBranch: (branch: Partial<Branch>) => Promise<void>;
  deleteBranch: (id: number) => Promise<void>;

  products: Product[];
  categories: Category[];
  cart: CartItem[];
  orders: Order[];
  customers: Customer[];
  settings: StoreSettings;
  coupons: Coupon[];
  wishlist: string[];
  userRole: UserRole;
  currentUser: UserAccount | null;
  exchangeRate: number;
  exchangeRateParalelo: number;
  exchangeRateEuro: number;
  activeExchangeRate: number;
  activeCurrencySymbol: string;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addProduct: (product: Product) => Promise<any>;
  updateProduct: (product: Product) => Promise<any>;
  updateMultipleProducts: (products: Product[], onProgress?: (percent: number) => void) => Promise<void>;
  deleteProduct: (id: string) => void;
  addCategory: (category: Category) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  addToCart: (product: Product, selectedOptions: Record<string, string>, quantity: number) => void;
  removeFromCart: (cartId: string) => void;
  updateCartQuantity: (cartId: string, delta: number) => void;
  clearCart: () => void;
  createOrder: (customerName: string, customerPhone: string, customerAddress: string, items?: CartItem[], total?: number, paymentMethod?: string, status?: 'pending' | 'completed' | 'cancelled', discount?: number, deliveryMethod?: 'delivery' | 'pickup' | 'pos', pickupBranchId?: number) => Promise<string>;
  updateOrder: (order: Order) => Promise<void>;
  deleteOrder: (id: string) => void;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (phone: string) => void;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
  localDarkMode: boolean;
  toggleLocalDarkMode: () => void;
  resetStore: (options: string[], onProgress?: (msg: string) => void) => Promise<void>;
  addCoupon: (coupon: Coupon) => void;
  toggleCoupon: (code: string) => void;
  deleteCoupon: (code: string) => void;
  toggleWishlist: (productId: string) => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (isOpen: boolean) => void;

  addUser: (user: UserAccount) => Promise<void>;
  updateUser: (user: UserAccount) => Promise<void>;
  deleteUser: (id: string) => void;
  logs: ActivityLog[];
  clearLogs: () => void;

  getProductHistory: (productId: string) => Promise<StockMovement[]>;
  adjustStock: (productId: string, type: 'entry' | 'exit' | 'adjustment' | 'sale', amount: number, reference: string, targetBranchId?: number) => Promise<void>;
  transferStock: (productId: string, toBranchId: number, amount: number, variantSku?: string, variantName?: string) => Promise<void>;
  getStockBreakdown: (productId: string) => Promise<{ branchId: number, branchName: string, stock: number }[]>;

  refreshStoreData: () => Promise<void>;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  image?: string;
  type: 'info' | 'success' | 'warning' | 'promo';
  timestamp: number;
}

export interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  deferredPrompt: any;
  isIOS: boolean;
  isStandalone: boolean;
  installApp: () => void;
  showInstallModal: boolean;
  setShowInstallModal: (show: boolean) => void;
}
