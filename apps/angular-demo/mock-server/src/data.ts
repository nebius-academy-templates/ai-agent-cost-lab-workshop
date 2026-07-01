/** Seed data for the Plata Burrito CRM mock backend. Deterministic — no wall-clock/random. */

export const CATEGORIES = ['Burritos', 'Bowls', 'Tacos', 'Sides', 'Drinks', 'Salsas'] as const;
export type Category = (typeof CATEGORIES)[number];

export const ORDER_STATUSES = ['paid', 'preparing', 'pending', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Location {
  id: string;
  name: string;
  kind: 'truck' | 'cafe' | 'kiosk';
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  description: string;
  available: boolean;
  spicyLevel: number;
  calories: number;
}

export interface OrderItem {
  productId: string;
  qty: number;
}

export interface Order {
  id: string;
  location: string;
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  customer: string;
}

export interface FinanceDay {
  date: string;
  location: string;
  revenue: number;
  orders: number;
  avgTicket: number;
}

export const LOCATIONS: Location[] = [
  { id: 'centro', name: 'Centro Truck', kind: 'truck' },
  { id: 'polanco', name: 'Polanco Café', kind: 'cafe' },
  { id: 'roma', name: 'Roma Norte Truck', kind: 'truck' },
  { id: 'condesa', name: 'Condesa Café', kind: 'cafe' },
  { id: 'reforma', name: 'Reforma Kiosk', kind: 'kiosk' },
];

interface ProductSeed {
  name: string;
  category: Category;
  price: number;
  description: string;
}

const PRODUCT_SEED: ProductSeed[] = [
  // Burritos
  { name: 'Carne Asada Burrito', category: 'Burritos', price: 145, description: 'Grilled steak, rice, beans, pico de gallo.' },
  { name: 'Al Pastor Burrito', category: 'Burritos', price: 139, description: 'Marinated pork, pineapple, onion, cilantro.' },
  { name: 'Pollo Adobado Burrito', category: 'Burritos', price: 129, description: 'Adobo-grilled chicken, rice, cheese.' },
  { name: 'Carnitas Burrito', category: 'Burritos', price: 135, description: 'Slow-cooked pork, salsa verde, beans.' },
  { name: 'Barbacoa Burrito', category: 'Burritos', price: 149, description: 'Tender barbacoa beef, consommé drizzle.' },
  { name: 'Chorizo Burrito', category: 'Burritos', price: 125, description: 'Spiced chorizo, potato, jack cheese.' },
  { name: 'Veggie Burrito', category: 'Burritos', price: 115, description: 'Grilled peppers, mushrooms, black beans.' },
  { name: 'Black Bean Burrito', category: 'Burritos', price: 109, description: 'Black beans, rice, queso fresco, avocado.' },
  { name: 'Breakfast Burrito', category: 'Burritos', price: 119, description: 'Egg, bacon, potato, cheese, salsa roja.' },
  { name: 'Camarón Burrito', category: 'Burritos', price: 159, description: 'Garlic shrimp, chipotle crema, slaw.' },
  { name: 'Birria Burrito', category: 'Burritos', price: 155, description: 'Stewed birria beef, melted cheese, dip.' },
  { name: 'Lengua Burrito', category: 'Burritos', price: 149, description: 'Braised beef tongue, onion, cilantro.' },
  { name: 'Chile Relleno Burrito', category: 'Burritos', price: 129, description: 'Battered poblano, cheese, ranchera sauce.' },
  { name: 'California Burrito', category: 'Burritos', price: 152, description: 'Carne asada, fries, cheese, guac.' },
  // Bowls
  { name: 'Carne Asada Bowl', category: 'Bowls', price: 139, description: 'Steak over rice and beans, no tortilla.' },
  { name: 'Pastor Bowl', category: 'Bowls', price: 133, description: 'Al pastor, pineapple, cilantro-lime rice.' },
  { name: 'Veggie Bowl', category: 'Bowls', price: 109, description: 'Roasted veg, black beans, avocado.' },
  { name: 'Pollo Bowl', category: 'Bowls', price: 123, description: 'Adobo chicken, rice, fresh salsa.' },
  { name: 'Carnitas Bowl', category: 'Bowls', price: 129, description: 'Carnitas, beans, pickled onion.' },
  { name: 'Burrito Bowl Supreme', category: 'Bowls', price: 165, description: 'Double protein, guac, queso, all toppings.' },
  // Tacos
  { name: 'Asada Taco', category: 'Tacos', price: 45, description: 'Single street taco, grilled steak.' },
  { name: 'Pastor Taco', category: 'Tacos', price: 42, description: 'Al pastor with pineapple.' },
  { name: 'Carnitas Taco', category: 'Tacos', price: 42, description: 'Crispy pork, onion, cilantro.' },
  { name: 'Pollo Taco', category: 'Tacos', price: 39, description: 'Adobo chicken street taco.' },
  { name: 'Birria Taco', category: 'Tacos', price: 55, description: 'Birria with consommé for dipping.' },
  { name: 'Pescado Taco', category: 'Tacos', price: 52, description: 'Beer-battered fish, baja slaw.' },
  { name: 'Veggie Taco', category: 'Tacos', price: 38, description: 'Grilled veg, avocado crema.' },
  { name: 'Lengua Taco', category: 'Tacos', price: 49, description: 'Braised tongue, salsa verde.' },
  // Sides
  { name: 'Chips & Guacamole', category: 'Sides', price: 69, description: 'House guac, warm tortilla chips.' },
  { name: 'Elote', category: 'Sides', price: 49, description: 'Grilled corn, crema, cotija, chili.' },
  { name: 'Rice & Beans', category: 'Sides', price: 45, description: 'Cilantro-lime rice, refried beans.' },
  { name: 'Queso Fundido', category: 'Sides', price: 89, description: 'Melted cheese with chorizo.' },
  { name: 'Nachos', category: 'Sides', price: 95, description: 'Loaded nachos, beans, jalapeño, queso.' },
  { name: 'Frijoles Charros', category: 'Sides', price: 55, description: 'Cowboy beans with bacon and chili.' },
  // Drinks
  { name: 'Horchata', category: 'Drinks', price: 39, description: 'Cinnamon rice horchata.' },
  { name: 'Agua de Jamaica', category: 'Drinks', price: 35, description: 'Hibiscus iced tea.' },
  { name: 'Agua de Tamarindo', category: 'Drinks', price: 35, description: 'Tamarind agua fresca.' },
  { name: 'Mexican Coke', category: 'Drinks', price: 32, description: 'Cane-sugar cola, glass bottle.' },
  { name: 'Agua de Limón', category: 'Drinks', price: 33, description: 'Fresh limeade.' },
  // Salsas
  { name: 'Salsa Verde', category: 'Salsas', price: 18, description: 'Tomatillo and serrano, 4oz.' },
  { name: 'Salsa Roja', category: 'Salsas', price: 18, description: 'Roasted tomato and árbol chili, 4oz.' },
  { name: 'Habanero Salsa', category: 'Salsas', price: 22, description: 'Fiery habanero and mango, 4oz.' },
];

export const PRODUCTS: Product[] = PRODUCT_SEED.map((seed, i) => ({
  id: `BRT-${String(i + 1).padStart(3, '0')}`,
  ...seed,
  available: i % 7 !== 0,
  spicyLevel: seed.category === 'Salsas' ? 4 + (i % 2) : i % 4,
  calories: 180 + ((i * 37) % 540),
}));

/** Deterministic PRNG (mulberry32) so generated orders/finance are stable across runs. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Most recent finance day; everything is generated relative to this fixed date. */
const ANCHOR_DATE = Date.parse('2026-06-24T00:00:00Z');
const DAY_MS = 86_400_000;

function dateAt(daysAgo: number): string {
  return new Date(ANCHOR_DATE - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

const CUSTOMERS = ['Ana', 'Luis', 'Sofía', 'Mateo', 'Valeria', 'Diego', 'Camila', 'Jorge', 'Lucía', 'Andrés'];

function buildOrders(count: number): Order[] {
  const orders: Order[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng(1000 + i);
    const location = LOCATIONS[Math.floor(r() * LOCATIONS.length)].id;
    const itemCount = 1 + Math.floor(r() * 3);
    const items: OrderItem[] = [];
    let total = 0;
    for (let j = 0; j < itemCount; j++) {
      const product = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      const qty = 1 + Math.floor(r() * 3);
      items.push({ productId: product.id, qty });
      total += product.price * qty;
    }
    const status = ORDER_STATUSES[Math.floor(r() * ORDER_STATUSES.length)];
    orders.push({
      id: `ORD-${1000 + i}`,
      location,
      createdAt: dateAt(Math.floor(r() * 30)),
      status,
      items,
      total,
      customer: CUSTOMERS[Math.floor(r() * CUSTOMERS.length)],
    });
  }
  // Newest first.
  return orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export const ORDERS: Order[] = buildOrders(140);

function buildFinance(days: number): FinanceDay[] {
  const rows: FinanceDay[] = [];
  for (const loc of LOCATIONS) {
    const base = 6000 + rng(loc.id.length * 97)() * 9000;
    for (let d = days - 1; d >= 0; d--) {
      const r = rng((loc.id.charCodeAt(0) << 8) + d);
      const weekend = new Date(ANCHOR_DATE - d * DAY_MS).getUTCDay() % 6 === 0;
      const revenue = Math.round(base * (0.7 + r() * 0.6) * (weekend ? 1.25 : 1));
      const orders = Math.max(8, Math.round(revenue / (110 + r() * 60)));
      rows.push({
        date: dateAt(d),
        location: loc.id,
        revenue,
        orders,
        avgTicket: Math.round(revenue / orders),
      });
    }
  }
  return rows;
}

export const FINANCE: FinanceDay[] = buildFinance(30);
