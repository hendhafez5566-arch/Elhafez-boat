export type Action =
  | { id: string; type: "OPEN_MENU"; target: string }
  | { id: string; type: "LIST_PROGRAMS"; category: ProgramCategory }
  | { id: string; type: "SHOW_PROGRAM"; programId: string }
  | { id: string; type: "START_BOOKING"; programId: string }
  | { id: string; type: "HANDOFF" }
  | { id: string; type: "HOME" };
export type ProgramCategory = "UMRAH" | "HAJJ" | "DOMESTIC" | "INTERNATIONAL";
export interface Program {
  id: string;
  tenantId: string;
  category: ProgramCategory;
  title: string;
  priceMinor: number;
  currency: string;
  published: boolean;
  availableSeats: number;
}
export interface MenuOption { label: string; action: Action }
export interface Menu { id: string; title: string; options: MenuOption[] }
export interface BookingRequest {
  id: string;
  tenantId: string;
  programId: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  priceMinorSnapshot: number;
  currencySnapshot: string;
  status: "PENDING_REVIEW";
}
export function publishedPrograms(programs: readonly Program[], tenantId: string, category: ProgramCategory): Program[] {
  return programs.filter(p => p.tenantId === tenantId && p.category === category && p.published && p.availableSeats > 0);
}
export function validateMenu(menu: Menu): string[] {
  const errors: string[] = [];
  if (!menu.id.trim() || !menu.title.trim()) errors.push("Missing menu identity");
  if (menu.options.length > 10) errors.push("WhatsApp classic list supports at most 10 rows");
  const ids = new Set<string>();
  for (const option of menu.options) {
    if (!option.label.trim()) errors.push("Empty label");
    if (!option.action.id.trim()) errors.push("Empty action ID");
    if (ids.has(option.action.id)) errors.push("Duplicate action ID");
    ids.add(option.action.id);
  }
  return errors;
}
export function createProvisionalBooking(input: {
  id: string; tenantId: string; programId: string; customerName: string; customerPhone: string; partySize: number
}, programs: readonly Program[]): BookingRequest {
  const program = programs.find(p => p.id === input.programId && p.tenantId === input.tenantId && p.published);
  if (!program) throw new Error("Program unavailable");
  if (!Number.isSafeInteger(input.partySize) || input.partySize < 1 || input.partySize > program.availableSeats) throw new Error("Invalid party size or insufficient capacity");
  if (!input.customerName.trim() || !input.customerPhone.trim()) throw new Error("Missing customer contact");
  if (!Number.isSafeInteger(program.priceMinor) || program.priceMinor < 0) throw new Error("Invalid program price");
  return { ...input, priceMinorSnapshot: program.priceMinor, currencySnapshot: program.currency, status: "PENDING_REVIEW" };
}
