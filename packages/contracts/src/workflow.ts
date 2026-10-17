import { publishedPrograms, type Program, type ProgramCategory } from "./menu.js";
export type MenuView = { title: string; rows: Array<{ id: string; title: string; description: string }> };
export const categories: ReadonlyArray<{ id: ProgramCategory; title: string }> = [
  { id: "UMRAH", title: "برامج العمرة" },
  { id: "HAJJ", title: "برامج الحج" },
  { id: "DOMESTIC", title: "رحلات داخلية" },
  { id: "INTERNATIONAL", title: "رحلات خارجية" }
];
export function homeMenu(): MenuView {
  return { title: "أهلًا بك! اختار الخدمة", rows: [
    ...categories.map(c => ({ id: "category:"+c.id, title: c.title, description: "عرض البرامج المتاحة" })),
    { id: "handoff", title: "التحدث مع موظف", description: "تحويل المحادثة لفريق المبيعات" }
  ] };
}
export function categoryMenu(tenantId: string, category: ProgramCategory, programs: readonly Program[]): MenuView {
  const matches = publishedPrograms(programs,tenantId,category);
  return { title: "البرامج المتاحة", rows: matches.slice(0,9).map(p => ({
    id: "program:"+p.id, title: p.title.slice(0,24), description: p.priceMinor / 100 + " " + p.currency
  })).concat(matches.length > 9 ? [{id:"more:"+category,title:"المزيد",description:"عرض المزيد من البرامج"}] : []) };
}
export type ConversationState = { tenantId: string; status: "BOT" | "HUMAN"; currentMenu: "HOME" | ProgramCategory };
export function transition(state: ConversationState, actionId: string, programs: readonly Program[]): { state: ConversationState; view?: MenuView; program?: Program; handoff?: boolean } {
  if (state.status === "HUMAN") return {state};
  if (actionId === "handoff") return {state:{...state,status:"HUMAN"},handoff:true};
  if (actionId === "home") return {state:{...state,currentMenu:"HOME"},view:homeMenu()};
  if (actionId.startsWith("category:")) {
    const category=actionId.slice(9) as ProgramCategory;
    if (!categories.some(c=>c.id===category)) return {state,view:homeMenu()};
    return {state:{...state,currentMenu:category},view:categoryMenu(state.tenantId,category,programs)};
  }
  if (actionId.startsWith("program:")) {
    const id=actionId.slice(8);
    const program=programs.find(p=>p.id===id && p.tenantId===state.tenantId && p.published && p.availableSeats>0);
    if (program) return {state,program};
  }
  return {state,view:state.currentMenu==="HOME" ? homeMenu() : categoryMenu(state.tenantId,state.currentMenu,programs)};
}
