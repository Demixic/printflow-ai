import { addDays, parseOrderNumber, type OrderStatus, type PrintMethod, type ProductionStage } from "./orders";
import type { OrderInput } from "./order-validation";

interface DemoOrder {
  orderNumber: string;
  customer: string;
  product: string;
  method: PrintMethod;
  quantity: number;
  /** Days relative to the seed date (negative = in the past). */
  createdOffset: number;
  dueOffset: number;
  status: OrderStatus;
  stage: ProductionStage;
  rush: boolean;
  artworkApproved: boolean;
}

const active = (stage: ProductionStage) =>
  ({ status: "ACTIVE", stage, artworkApproved: stage !== "ARTWORK" }) as const;
const completed = { status: "COMPLETED", stage: "READY_TO_SHIP", artworkApproved: true } as const;

/**
 * The 18 fictional orders from the original dashboard. Dates are stored as
 * offsets so a freshly seeded database always shows a realistic mix of
 * overdue, due-today and upcoming work.
 */
export const DEMO_ORDERS: DemoOrder[] = [
  { orderNumber: "PF-10498", customer: "Harbor Lane Coffee", product: "Comfort Colors 1717 tees, 3-colour front", method: "SCREEN_PRINT", quantity: 180, createdOffset: -1, dueOffset: 9, rush: false, ...active("ARTWORK") },
  { orderNumber: "PF-10497", customer: "Riverbend Half Marathon", product: "Finisher tech tees, full-colour back", method: "DTF_TRANSFER", quantity: 1200, createdOffset: -2, dueOffset: 2, rush: true, ...active("PRODUCTION") },
  { orderNumber: "PF-10496", customer: "Kestrel Robotics", product: "Structured caps, 3D puff logo", method: "EMBROIDERY", quantity: 96, createdOffset: -2, dueOffset: 1, rush: false, ...active("ARTWORK") },
  { orderNumber: "PF-10495", customer: "Oak & Ember Bakery", product: "Canvas aprons, left-chest logo", method: "EMBROIDERY", quantity: 40, createdOffset: -3, dueOffset: 0, rush: false, ...active("QUALITY_CHECK") },
  { orderNumber: "PF-10494", customer: "Northwind Brewing Co.", product: "Oktoberfest staff hoodies, front + sleeve", method: "SCREEN_PRINT", quantity: 64, createdOffset: -5, dueOffset: -1, rush: true, ...active("PRODUCTION") },
  { orderNumber: "PF-10493", customer: "Maple Street Elementary PTA", product: "Fun-run youth tees, 1-colour", method: "SCREEN_PRINT", quantity: 420, createdOffset: -6, dueOffset: 0, rush: false, ...active("PRODUCTION") },
  { orderNumber: "PF-10492", customer: "Bluebird Events", product: "Vinyl step-and-repeat banner, 8×10 ft", method: "LARGE_FORMAT", quantity: 2, createdOffset: -6, dueOffset: 0, rush: false, ...active("READY_TO_SHIP") },
  { orderNumber: "PF-10491", customer: "Copperline Fitness", product: "Tri-blend tanks, photo-real print", method: "DTG", quantity: 75, createdOffset: -7, dueOffset: -2, rush: false, status: "ON_HOLD", stage: "ARTWORK", artworkApproved: false },
  { orderNumber: "PF-10490", customer: "Westfield Youth Soccer", product: "Jerseys with player names & numbers", method: "DTF_TRANSFER", quantity: 260, createdOffset: -8, dueOffset: 3, rush: false, ...active("PRODUCTION") },
  { orderNumber: "PF-10489", customer: "Lumen Labs", product: "Quarter-zip pullovers, tonal logo", method: "EMBROIDERY", quantity: 55, createdOffset: -9, dueOffset: 6, rush: false, ...active("QUALITY_CHECK") },
  { orderNumber: "PF-10488", customer: "Brightside Dental", product: "Scrub tops, left-chest logo", method: "EMBROIDERY", quantity: 30, createdOffset: -9, dueOffset: 0, rush: false, ...completed },
  { orderNumber: "PF-10487", customer: "Summit Trail Running Club", product: "Long-sleeve club tees, 2-colour", method: "SCREEN_PRINT", quantity: 150, createdOffset: -12, dueOffset: -2, rush: false, ...active("QUALITY_CHECK") },
  { orderNumber: "PF-10486", customer: "Pinecrest Realty", product: "Retractable trade-show banners", method: "LARGE_FORMAT", quantity: 4, createdOffset: -13, dueOffset: -5, rush: false, ...completed },
  { orderNumber: "PF-10485", customer: "Northwind Brewing Co.", product: "Tote bags, 1-colour", method: "SCREEN_PRINT", quantity: 500, createdOffset: -15, dueOffset: -6, rush: false, ...completed },
  { orderNumber: "PF-10484", customer: "Fable & Fern Books", product: "Author-event tees, full-colour", method: "DTG", quantity: 48, createdOffset: -16, dueOffset: 7, rush: false, ...active("READY_TO_SHIP") },
  { orderNumber: "PF-10483", customer: "Kestrel Robotics", product: "Team polos, embroidered chest + sleeve", method: "EMBROIDERY", quantity: 36, createdOffset: -19, dueOffset: -8, rush: false, ...completed },
  { orderNumber: "PF-10482", customer: "Harbor Lane Coffee", product: "Barista caps, flat embroidery", method: "EMBROIDERY", quantity: 60, createdOffset: -20, dueOffset: -12, rush: false, ...completed },
  { orderNumber: "PF-10481", customer: "Riverbend Half Marathon", product: "Volunteer tees, 1-colour", method: "SCREEN_PRINT", quantity: 300, createdOffset: -22, dueOffset: -13, rush: false, ...completed },
];

export type DemoOrderRecord = OrderInput & { orderNumber: string; sequence: number; createdAt: Date };

function demoSequence(orderNumber: string): number {
  const sequence = parseOrderNumber(orderNumber);
  if (sequence === null) throw new Error(`Invalid demo order number: ${orderNumber}`);
  return sequence;
}

/** Resolve the demo orders against a concrete date (YYYY-MM-DD). */
export function buildDemoOrders(today: string): DemoOrderRecord[] {
  return DEMO_ORDERS.map(({ createdOffset, dueOffset, ...order }) => ({
    ...order,
    sequence: demoSequence(order.orderNumber),
    dueDate: addDays(today, dueOffset),
    createdAt: new Date(`${addDays(today, createdOffset)}T09:00:00.000Z`),
  }));
}
