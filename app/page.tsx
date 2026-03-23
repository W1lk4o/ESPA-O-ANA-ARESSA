"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabase } from "../lib/supabase";

type Client = { id: string; name: string; phone: string | null; notes: string | null; created_at: string };
type Supply = {
  id: string;
  name: string;
  purchase_price: number;
  quantity_in_package: number;
  unit_label: string;
  cost_per_unit: number;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: string;
};
type Procedure = { id: string; name: string; price: number; description: string | null; created_at: string };
type ProcedureSupply = { id: string; procedure_id: string; supply_id: string; quantity_used: number };
type Appointment = {
  id: string;
  client_id: string;
  attended_at: string;
  payment_method: string | null;
  discount: number;
  gross_amount: number;
  cost_amount: number;
  net_amount: number;
  notes: string | null;
  created_at: string;
};
type AppointmentProcedure = { id: string; appointment_id: string; procedure_id: string; price_charged: number };
type AppointmentSupply = { id: string; appointment_id: string; supply_id: string; quantity_used: number; unit_cost: number; total_cost: number };
type Booking = { id: string; client_id: string; scheduled_for: string; status: string; notes: string | null; created_at: string };
type Settings = { id: string; salon_name: string; inactive_days_threshold: number; whatsapp_message_template: string };
type Tab = "dashboard"|"agenda"|"atendimentos"|"clientes"|"procedimentos"|"insumos"|"configuracoes";

type ProcedureChoice = { procedure_id: string };
type SupplyChoice = { supply_id: string; quantity_used: string };

const ADMIN_EMAIL = "anaressa07@gmail.com";
const ADMIN_PASSWORD = "98616191ANA";
const SESSION_KEY = "ana_aressa_admin_ok";

const tabs: {key: Tab; label: string}[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "agenda", label: "Agenda" },
  { key: "atendimentos", label: "Atendimentos" },
  { key: "clientes", label: "Clientes" },
  { key: "procedimentos", label: "Procedimentos" },
  { key: "insumos", label: "Insumos" },
  { key: "configuracoes", label: "Configurações" }
];

const defaultSettings = {
  salon_name: "ESPAÇO ANA ARESSA",
  inactive_days_threshold: 30,
  whatsapp_message_template:
    "Oi {nome}, tudo bem? 😊\n\nAqui é do ESPAÇO ANA ARESSA.\nVi que seu último atendimento foi {procedimento} e já faz um tempinho.\n\nVamos agendar seu próximo horário? 💅✨"
};

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}
function date(v: string) {
  return v ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(v)) : "-";
}
function dateTime(v: string) {
  return v ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)) : "-";
}
function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}
function toLocalInputValue(v?: string) {
  const d = v ? new Date(v) : new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
function replaceVars(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [key, value]) => acc.split(`{${key}}`).join(value), template);
}

export default function Page() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState(ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState(ADMIN_PASSWORD);

  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [procedureSupplies, setProcedureSupplies] = useState<ProcedureSupply[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentProcedures, setAppointmentProcedures] = useState<AppointmentProcedure[]>([]);
  const [appointmentSupplies, setAppointmentSupplies] = useState<AppointmentSupply[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [clientForm, setClientForm] = useState({ id: "", name: "", phone: "", notes: "" });
  const [supplyForm, setSupplyForm] = useState({ id: "", name: "", purchase_price: "", quantity_in_package: "", unit_label: "un", stock_quantity: "", low_stock_threshold: "5" });
  const [procedureForm, setProcedureForm] = useState({ id: "", name: "", price: "", description: "", supplies: [{ supply_id: "", quantity_used: "" }] as SupplyChoice[] });
  const [settingsForm, setSettingsForm] = useState(defaultSettings);
  const [appointmentForm, setAppointmentForm] = useState({ id: "", client_id: "", attended_at: toLocalInputValue(), payment_method: "pix", discount: "0", notes: "", procedures: [{ procedure_id: "" }] as ProcedureChoice[], extra_supplies: [{ supply_id: "", quantity_used: "" }] as SupplyChoice[] });
  const [bookingForm, setBookingForm] = useState({ id: "", client_id: "", scheduled_for: toLocalInputValue(), status: "agendada", notes: "" });

  useEffect(() => {
    const session = typeof window !== "undefined" ? window.localStorage.getItem(SESSION_KEY) : null;
    setIsAuthed(session === "1");
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (isAuthed) void loadAll();
  }, [isAuthed]);

  async function loadAll() {
    setLoading(true); setError("");
    try {
      const supabase = getSupabase();
      const [a,b,c,d,e,f,g,h,i] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("supplies").select("*").order("name"),
        supabase.from("procedures").select("*").order("name"),
        supabase.from("procedure_supplies").select("*"),
        supabase.from("appointments").select("*").order("attended_at", {ascending:false}),
        supabase.from("appointment_procedures").select("*"),
        supabase.from("appointment_supplies").select("*"),
        supabase.from("bookings").select("*").order("scheduled_for"),
        supabase.from("settings").select("*").limit(1).maybeSingle()
      ]);
      const err = a.error || b.error || c.error || d.error || e.error || f.error || g.error || h.error || i.error;
      if (err) throw err;
      setClients(a.data || []);
      setSupplies(b.data || []);
      setProcedures(c.data || []);
      setProcedureSupplies(d.data || []);
      setAppointments(e.data || []);
      setAppointmentProcedures(f.data || []);
      setAppointmentSupplies(g.data || []);
      setBookings(h.data || []);
      setSettings(i.data || null);
      setSettingsForm({
        salon_name: i.data?.salon_name || defaultSettings.salon_name,
        inactive_days_threshold: i.data?.inactive_days_threshold || defaultSettings.inactive_days_threshold,
        whatsapp_message_template: i.data?.whatsapp_message_template || defaultSettings.whatsapp_message_template
      });
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  function clearFlags(){ setError(""); setOk(""); }
  function resetClientForm(){ setClientForm({ id: "", name: "", phone: "", notes: "" }); }
  function resetSupplyForm(){ setSupplyForm({ id: "", name: "", purchase_price: "", quantity_in_package: "", unit_label: "un", stock_quantity: "", low_stock_threshold: "5" }); }
  function resetProcedureForm(){ setProcedureForm({ id: "", name: "", price: "", description: "", supplies: [{ supply_id: "", quantity_used: "" }] }); }
  function resetAppointmentForm(){ setAppointmentForm({ id: "", client_id: "", attended_at: toLocalInputValue(), payment_method: "pix", discount: "0", notes: "", procedures: [{ procedure_id: "" }], extra_supplies: [{ supply_id: "", quantity_used: "" }] }); }
  function resetBookingForm(){ setBookingForm({ id: "", client_id: "", scheduled_for: toLocalInputValue(), status: "agendada", notes: "" }); }

  const lastProcedureByAppointment = useMemo(() => {
    const procMap = new Map<string, string>(procedures.map(p => [p.id, p.name]));
    const map = new Map<string, string[]>();
    for (const row of appointmentProcedures) {
      const list = map.get(row.appointment_id) || [];
      const name = procMap.get(row.procedure_id);
      if (name) list.push(name);
      map.set(row.appointment_id, list);
    }
    return map;
  }, [appointmentProcedures, procedures]);

  const clientsSummary = useMemo(() => clients.map(client => {
    const apps = appointments.filter(a => a.client_id === client.id).sort((x,y) => +new Date(y.attended_at) - +new Date(x.attended_at));
    const last = apps[0];
    const lastProcedure = last ? (lastProcedureByAppointment.get(last.id) || []).join(", ") : "";
    const totalSpent = apps.reduce((s,a) => s + Number(a.gross_amount || 0), 0);
    return { client, apps, last, lastProcedure, totalSpent };
  }), [clients, appointments, lastProcedureByAppointment]);

  const lowStock = useMemo(() => supplies.filter(s => Number(s.stock_quantity) <= Number(s.low_stock_threshold)).sort((a,b) => a.stock_quantity - b.stock_quantity), [supplies]);
  const dormantClients = useMemo(() => {
    const threshold = Number(settingsForm.inactive_days_threshold || 30);
    const now = Date.now();
    return clientsSummary.filter(item => {
      if (!item.last) return false;
      const days = Math.floor((now - +new Date(item.last.attended_at)) / 86400000);
      return days >= threshold;
    });
  }, [clientsSummary, settingsForm.inactive_days_threshold]);

  const proceduresWithCost = useMemo(() => procedures.map(proc => {
    const links = procedureSupplies.filter(x => x.procedure_id === proc.id);
    const estimatedCost = links.reduce((sum, link) => {
      const s = supplies.find(i => i.id === link.supply_id);
      return sum + Number(s?.cost_per_unit || 0) * Number(link.quantity_used || 0);
    }, 0);
    return { ...proc, estimatedCost, margin: Number(proc.price || 0) - estimatedCost };
  }), [procedures, procedureSupplies, supplies]);

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthApps = appointments.filter(a => +new Date(a.attended_at) >= +monthStart);
  const grossMonth = monthApps.reduce((s,a) => s + Number(a.gross_amount || 0), 0);
  const costMonth = monthApps.reduce((s,a) => s + Number(a.cost_amount || 0), 0);
  const netMonth = monthApps.reduce((s,a) => s + Number(a.net_amount || 0), 0);

  const chartRows = useMemo(() => {
    const labels = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    return Array.from({length:7}, (_,i) => {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-i));
      const key = d.toISOString().slice(0,10);
      const dayApps = appointments.filter(a => new Date(a.attended_at).toISOString().slice(0,10) === key);
      return { day: labels[d.getDay()], gross: dayApps.reduce((s,a)=>s+Number(a.gross_amount||0),0), net: dayApps.reduce((s,a)=>s+Number(a.net_amount||0),0) };
    });
  }, [appointments]);
  const chartMax = Math.max(1, ...chartRows.flatMap(r => [r.gross, r.net]));

  const todayBookings = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    return bookings.filter(b => b.scheduled_for.slice(0,10) === today);
  }, [bookings]);

  const upcomingBookings = useMemo(() => bookings
    .filter(b => ["agendada", "confirmada"].includes(b.status))
    .sort((a,b) => +new Date(a.scheduled_for) - +new Date(b.scheduled_for)), [bookings]);

  function getClientName(clientId: string) {
    return clients.find(c => c.id === clientId)?.name || "Cliente";
  }

  function buildWhatsappLink(clientId: string, lastProcedure: string) {
    const client = clients.find(c => c.id === clientId);
    const phone = onlyDigits(client?.phone);
    if (!phone) return "#";
    const template = settingsForm.whatsapp_message_template || defaultSettings.whatsapp_message_template;
    const text = replaceVars(template, {
      nome: client?.name || "cliente",
      procedimento: lastProcedure || "atendimento"
    });
    return `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
  }

  async function saveClient(e: FormEvent){
    e.preventDefault(); clearFlags();
    if (!clientForm.name.trim()) return setError("Preencha o nome da cliente.");
    try {
      setBusy(true);
      const supabase = getSupabase();
      const payload = { name: clientForm.name.trim(), phone: clientForm.phone.trim() || null, notes: clientForm.notes.trim() || null };
      const query = clientForm.id
        ? supabase.from("clients").update(payload).eq("id", clientForm.id)
        : supabase.from("clients").insert(payload);
      const { error } = await query;
      if (error) throw error;
      resetClientForm();
      setOk(clientForm.id ? "Cliente atualizada." : "Cliente cadastrada.");
      await loadAll();
      setTab("clientes");
    } catch (e:any) { setError(e?.message || "Erro ao salvar cliente."); } finally { setBusy(false); }
  }

  async function saveSupply(e: FormEvent){
    e.preventDefault(); clearFlags();
    const purchase = Number(supplyForm.purchase_price); const qty = Number(supplyForm.quantity_in_package);
    if (!supplyForm.name.trim()) return setError("Preencha o nome do insumo.");
    if (!purchase || !qty) return setError("Preço e quantidade precisam ser maiores que zero.");
    try {
      setBusy(true);
      const supabase = getSupabase();
      const payload = {
        name: supplyForm.name.trim(), purchase_price: purchase, quantity_in_package: qty, unit_label: supplyForm.unit_label || "un",
        cost_per_unit: purchase / qty, stock_quantity: Number(supplyForm.stock_quantity || 0), low_stock_threshold: Number(supplyForm.low_stock_threshold || 0)
      };
      const query = supplyForm.id
        ? supabase.from("supplies").update(payload).eq("id", supplyForm.id)
        : supabase.from("supplies").insert(payload);
      const { error } = await query;
      if (error) throw error;
      resetSupplyForm();
      setOk(supplyForm.id ? "Insumo atualizado." : "Insumo cadastrado.");
      await loadAll();
      setTab("insumos");
    } catch (e:any) { setError(e?.message || "Erro ao salvar insumo."); } finally { setBusy(false); }
  }

  async function saveProcedure(e: FormEvent){
    e.preventDefault(); clearFlags();
    if (!procedureForm.name.trim()) return setError("Preencha o nome do procedimento.");
    if (!Number(procedureForm.price)) return setError("Informe um valor válido para o procedimento.");
    const rows = procedureForm.supplies.filter(x => x.supply_id && Number(x.quantity_used) > 0);
    try {
      setBusy(true);
      const supabase = getSupabase();
      let procedureId = procedureForm.id;
      if (procedureForm.id) {
        const { error } = await supabase.from("procedures").update({ name: procedureForm.name.trim(), price: Number(procedureForm.price), description: procedureForm.description.trim() || null }).eq("id", procedureForm.id);
        if (error) throw error;
        const { error: delError } = await supabase.from("procedure_supplies").delete().eq("procedure_id", procedureForm.id);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase.from("procedures").insert({ name: procedureForm.name.trim(), price: Number(procedureForm.price), description: procedureForm.description.trim() || null }).select("id").single();
        if (error) throw error;
        procedureId = data.id;
      }
      if (rows.length) {
        const { error } = await supabase.from("procedure_supplies").insert(rows.map(r => ({ procedure_id: procedureId, supply_id: r.supply_id, quantity_used: Number(r.quantity_used) })));
        if (error) throw error;
      }
      resetProcedureForm();
      setOk(procedureForm.id ? "Procedimento atualizado." : "Procedimento cadastrado.");
      await loadAll();
      setTab("procedimentos");
    } catch (e:any) { setError(e?.message || "Erro ao salvar procedimento."); } finally { setBusy(false); }
  }

  function computeAppointmentRows() {
    const selectedProcedures = appointmentForm.procedures.filter(p => p.procedure_id);
    if (!appointmentForm.client_id) throw new Error("Selecione a cliente.");
    if (!selectedProcedures.length) throw new Error("Adicione pelo menos um procedimento.");
    const appointmentProcedureRows = selectedProcedures.map(item => {
      const proc = procedures.find(p => p.id === item.procedure_id);
      if (!proc) throw new Error("Procedimento inválido.");
      return { procedure_id: proc.id, price_charged: Number(proc.price || 0) };
    });
    const standardSupplyRows: { supply_id: string; quantity_used: number; unit_cost: number; total_cost: number }[] = [];
    for (const item of selectedProcedures) {
      const links = procedureSupplies.filter(ps => ps.procedure_id === item.procedure_id);
      for (const link of links) {
        const supply = supplies.find(s => s.id === link.supply_id);
        if (!supply) continue;
        const qty = Number(link.quantity_used || 0);
        standardSupplyRows.push({ supply_id: link.supply_id, quantity_used: qty, unit_cost: Number(supply.cost_per_unit || 0), total_cost: Number(supply.cost_per_unit || 0) * qty });
      }
    }
    const extraSupplyRows = appointmentForm.extra_supplies
      .filter(item => item.supply_id && Number(item.quantity_used) > 0)
      .map(item => {
        const supply = supplies.find(s => s.id === item.supply_id);
        if (!supply) throw new Error("Insumo extra inválido.");
        const qty = Number(item.quantity_used);
        return { supply_id: item.supply_id, quantity_used: qty, unit_cost: Number(supply.cost_per_unit || 0), total_cost: Number(supply.cost_per_unit || 0) * qty };
      });
    const appointmentSupplyRows = [...standardSupplyRows, ...extraSupplyRows];
    const gross = appointmentProcedureRows.reduce((s, p) => s + Number(p.price_charged || 0), 0);
    const cost = appointmentSupplyRows.reduce((s, p) => s + Number(p.total_cost || 0), 0);
    const discount = Number(appointmentForm.discount || 0);
    const net = gross - cost - discount;
    return { appointmentProcedureRows, appointmentSupplyRows, gross, cost, discount, net };
  }

  async function adjustStock(rows: { supply_id: string; quantity_used: number }[], direction: 1 | -1) {
    const supabase = getSupabase();
    for (const row of rows) {
      const current = supplies.find(s => s.id === row.supply_id);
      if (!current) continue;
      const nextQty = Number(current.stock_quantity || 0) - direction * Number(row.quantity_used || 0);
      const { error } = await supabase.from("supplies").update({ stock_quantity: nextQty }).eq("id", row.supply_id);
      if (error) throw error;
      current.stock_quantity = nextQty;
    }
  }

  async function saveAppointment(e: FormEvent){
    e.preventDefault(); clearFlags();
    try {
      setBusy(true);
      const supabase = getSupabase();
      const calc = computeAppointmentRows();
      let appointmentId = appointmentForm.id;

      if (appointmentForm.id) {
        const previousSupplies = appointmentSupplies.filter(x => x.appointment_id === appointmentForm.id).map(x => ({ supply_id: x.supply_id, quantity_used: Number(x.quantity_used) }));
        await adjustStock(previousSupplies, -1);
        const { error: del1 } = await supabase.from("appointment_procedures").delete().eq("appointment_id", appointmentForm.id);
        if (del1) throw del1;
        const { error: del2 } = await supabase.from("appointment_supplies").delete().eq("appointment_id", appointmentForm.id);
        if (del2) throw del2;
        const { error } = await supabase.from("appointments").update({
          client_id: appointmentForm.client_id,
          attended_at: new Date(appointmentForm.attended_at).toISOString(),
          payment_method: appointmentForm.payment_method || null,
          discount: calc.discount,
          gross_amount: calc.gross,
          cost_amount: calc.cost,
          net_amount: calc.net,
          notes: appointmentForm.notes.trim() || null
        }).eq("id", appointmentForm.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("appointments").insert({
          client_id: appointmentForm.client_id,
          attended_at: new Date(appointmentForm.attended_at).toISOString(),
          payment_method: appointmentForm.payment_method || null,
          discount: calc.discount,
          gross_amount: calc.gross,
          cost_amount: calc.cost,
          net_amount: calc.net,
          notes: appointmentForm.notes.trim() || null
        }).select("id").single();
        if (error) throw error;
        appointmentId = data.id;
      }

      const procedureRows = calc.appointmentProcedureRows.map(r => ({ appointment_id: appointmentId, ...r }));
      const supplyRows = calc.appointmentSupplyRows.map(r => ({ appointment_id: appointmentId, ...r }));
      if (procedureRows.length) {
        const { error } = await supabase.from("appointment_procedures").insert(procedureRows);
        if (error) throw error;
      }
      if (supplyRows.length) {
        const { error } = await supabase.from("appointment_supplies").insert(supplyRows);
        if (error) throw error;
        await adjustStock(supplyRows.map(r => ({ supply_id: r.supply_id, quantity_used: r.quantity_used })), 1);
      }
      resetAppointmentForm();
      setOk(appointmentForm.id ? "Atendimento atualizado." : "Atendimento lançado.");
      await loadAll();
      setTab("atendimentos");
    } catch (e:any) { setError(e?.message || "Erro ao salvar atendimento."); } finally { setBusy(false); }
  }

  async function saveBooking(e: FormEvent) {
    e.preventDefault(); clearFlags();
    if (!bookingForm.client_id) return setError("Selecione a cliente do agendamento.");
    try {
      setBusy(true);
      const supabase = getSupabase();
      const payload = {
        client_id: bookingForm.client_id,
        scheduled_for: new Date(bookingForm.scheduled_for).toISOString(),
        status: bookingForm.status,
        notes: bookingForm.notes.trim() || null
      };
      const query = bookingForm.id
        ? supabase.from("bookings").update(payload).eq("id", bookingForm.id)
        : supabase.from("bookings").insert(payload);
      const { error } = await query;
      if (error) throw error;
      resetBookingForm();
      setOk(bookingForm.id ? "Agendamento atualizado." : "Agendamento criado.");
      await loadAll();
      setTab("agenda");
    } catch (e:any) { setError(e?.message || "Erro ao salvar agendamento."); } finally { setBusy(false); }
  }

  async function removeItem(table: string, id: string, label: string) {
    clearFlags();
    if (!confirm(`Deseja excluir ${label}?`)) return;
    try {
      setBusy(true);
      const supabase = getSupabase();
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      setOk(`${label} excluído(a).`);
      await loadAll();
    } catch (e:any) {
      setError(e?.message || `Erro ao excluir ${label}.`);
    } finally { setBusy(false); }
  }

  async function removeAppointment(id: string) {
    clearFlags();
    if (!confirm("Deseja excluir este atendimento? O estoque será devolvido.")) return;
    try {
      setBusy(true);
      const supabase = getSupabase();
      const rows = appointmentSupplies.filter(x => x.appointment_id === id).map(x => ({ supply_id: x.supply_id, quantity_used: Number(x.quantity_used) }));
      await adjustStock(rows, -1);
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      setOk("Atendimento excluído.");
      await loadAll();
    } catch (e:any) {
      setError(e?.message || "Erro ao excluir atendimento.");
    } finally { setBusy(false); }
  }

  function editClient(item: Client) {
    setClientForm({ id: item.id, name: item.name, phone: item.phone || "", notes: item.notes || "" });
    setTab("clientes");
    clearFlags();
  }
  function editSupply(item: Supply) {
    setSupplyForm({ id: item.id, name: item.name, purchase_price: String(item.purchase_price), quantity_in_package: String(item.quantity_in_package), unit_label: item.unit_label, stock_quantity: String(item.stock_quantity), low_stock_threshold: String(item.low_stock_threshold) });
    setTab("insumos");
    clearFlags();
  }
  function editProcedure(item: Procedure) {
    const links = procedureSupplies.filter(ps => ps.procedure_id === item.id).map(ps => ({ supply_id: ps.supply_id, quantity_used: String(ps.quantity_used) }));
    setProcedureForm({ id: item.id, name: item.name, price: String(item.price), description: item.description || "", supplies: links.length ? links : [{ supply_id: "", quantity_used: "" }] });
    setTab("procedimentos");
    clearFlags();
  }
  function editBooking(item: Booking) {
    setBookingForm({ id: item.id, client_id: item.client_id, scheduled_for: toLocalInputValue(item.scheduled_for), status: item.status, notes: item.notes || "" });
    setTab("agenda");
    clearFlags();
  }
  function convertBookingToAppointment(item: Booking) {
    setAppointmentForm(v => ({ ...v, client_id: item.client_id, attended_at: toLocalInputValue(item.scheduled_for), notes: item.notes || v.notes }));
    setTab("atendimentos");
    clearFlags();
  }
  function editAppointment(item: Appointment) {
    const procedureRows = appointmentProcedures.filter(ap => ap.appointment_id === item.id).map(ap => ({ procedure_id: ap.procedure_id }));
    const standardSupplyIds = new Set(
      procedureRows.flatMap(pr => procedureSupplies.filter(ps => ps.procedure_id === pr.procedure_id).map(ps => ps.supply_id))
    );
    const extraRows = appointmentSupplies
      .filter(as => as.appointment_id === item.id && !standardSupplyIds.has(as.supply_id))
      .map(as => ({ supply_id: as.supply_id, quantity_used: String(as.quantity_used) }));
    setAppointmentForm({
      id: item.id,
      client_id: item.client_id,
      attended_at: toLocalInputValue(item.attended_at),
      payment_method: item.payment_method || "pix",
      discount: String(item.discount || 0),
      notes: item.notes || "",
      procedures: procedureRows.length ? procedureRows : [{ procedure_id: "" }],
      extra_supplies: extraRows.length ? extraRows : [{ supply_id: "", quantity_used: "" }]
    });
    setTab("atendimentos");
    clearFlags();
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault(); clearFlags();
    try {
      setBusy(true);
      const supabase = getSupabase();
      const payload = {
        id: settings?.id || "00000000-0000-0000-0000-000000000001",
        salon_name: settingsForm.salon_name.trim() || defaultSettings.salon_name,
        inactive_days_threshold: Number(settingsForm.inactive_days_threshold || 30),
        whatsapp_message_template: settingsForm.whatsapp_message_template.trim() || defaultSettings.whatsapp_message_template
      };
      const { error } = await supabase.from("settings").upsert(payload);
      if (error) throw error;
      setOk("Configurações salvas.");
      await loadAll();
    } catch (e:any) {
      setError(e?.message || "Erro ao salvar configurações.");
    } finally {
      setBusy(false);
    }
  }

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    clearFlags();
    if (loginEmail.trim().toLowerCase() !== ADMIN_EMAIL || loginPassword !== ADMIN_PASSWORD) {
      setError("Email ou senha inválidos.");
      return;
    }
    window.localStorage.setItem(SESSION_KEY, "1");
    setIsAuthed(true);
    setOk("Acesso liberado.");
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    setIsAuthed(false);
    setLoading(false);
    clearFlags();
  }

  if (!authReady) return null;

  if (!isAuthed) {
    return (
      <main className="shell" style={{minHeight:"100vh", display:"grid", placeItems:"center"}}>
        <section className="card" style={{maxWidth:460, width:"100%"}}>
          <div className="hero" style={{marginBottom:16}}>
            <span className="badge">Acesso administrador</span>
            <h1>ESPAÇO ANA ARESSA</h1>
            <p>Entre com o email e senha do administrador para abrir o sistema.</p>
          </div>
          {error ? <div className="notice err" style={{marginBottom:12}}>{error}</div> : null}
          <form onSubmit={handleLogin} className="grid">
            <div className="field"><label>Email</label><input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
            <div className="field"><label>Senha</label><input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} /></div>
            <button className="btn primary" type="submit">Entrar</button>
            <div className="help">Proteção simples de app. Se quiser depois, eu posso trocar isso por autenticação real do Supabase.</div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="top">
        <div className="shell">
          <div className="hero" style={{marginTop:12}}>
            <div className="row space center">
              <div>
                <span className="badge">Gestão completa do salão</span>
                <h1>{settingsForm.salon_name || defaultSettings.salon_name}</h1>
                <p>Controle financeiro, agenda, estoque, clientes sumidas e histórico de atendimentos.</p>
              </div>
              <div className="row center">
                <span className="badge ok">Admin</span>
                <button className="btn ghost" type="button" onClick={logout}>Sair</button>
              </div>
            </div>
          </div>
          <div className="tabbar">
            {tabs.map(item => <button key={item.key} className={`tab ${tab === item.key ? "active" : ""}`} onClick={() => setTab(item.key)}>{item.label}</button>)}
          </div>
        </div>
      </div>

      <div className="shell">
        {loading ? <div className="notice">Carregando dados...</div> : null}
        {error ? <div className="notice err" style={{marginBottom:12}}>{error}</div> : null}
        {ok ? <div className="notice ok" style={{marginBottom:12}}>{ok}</div> : null}

        {tab === "dashboard" && <div className="grid">
          <div className="grid stats">
            <section className="card"><div className="label">Faturamento do mês</div><div className="big">{brl(grossMonth)}</div></section>
            <section className="card"><div className="label">Gastos com insumos</div><div className="big">{brl(costMonth)}</div></section>
            <section className="card"><div className="label">Líquido do mês</div><div className="big">{brl(netMonth)}</div></section>
            <section className="card"><div className="label">Agendamentos de hoje</div><div className="big">{todayBookings.length}</div></section>
          </div>

          <section className="card">
            <div className="row space center"><h2 style={{marginTop:0}}>Alerta de insumos acabando</h2><span className={`badge ${lowStock.length ? "danger" : "ok"}`}>{lowStock.length ? `${lowStock.length} item(ns)` : "Tudo ok"}</span></div>
            {!lowStock.length ? <div className="empty">Nenhum insumo abaixo do nível mínimo.</div> : <div className="list">{lowStock.map(s => <div className="item" key={s.id}><div className="row space center"><div><div className="item-title">{s.name}</div><div className="item-sub">Estoque: {s.stock_quantity} {s.unit_label}</div></div><button className="btn ghost" type="button" onClick={() => editSupply(s)}>Editar</button></div></div>)}</div>}
          </section>

          <div className="grid split">
            <section className="card">
              <div className="row space center"><h2 style={{marginTop:0}}>Últimos 7 dias</h2><span className="muted">Bruto x líquido</span></div>
              <div className="chart">
                {chartRows.map(row => <div className="col" key={row.day}><div className="bars"><div className="bar gross" style={{height:`${(row.gross/chartMax)*190}px`}} /><div className="bar net" style={{height:`${(row.net/chartMax)*190}px`}} /></div><div className="chart-label">{row.day}</div></div>)}
              </div>
            </section>
            <section className="card">
              <div className="row space center"><h2 style={{marginTop:0}}>Agenda próxima</h2><button className="btn ghost" type="button" onClick={() => setTab("agenda")}>Abrir agenda</button></div>
              {!upcomingBookings.length ? <div className="empty">Nenhum agendamento próximo.</div> : <div className="list">{upcomingBookings.slice(0,5).map(item => <div className="item" key={item.id}><div className="row space center"><div><div className="item-title">{getClientName(item.client_id)}</div><div className="item-sub">{dateTime(item.scheduled_for)} • {item.status}</div></div><button className="btn ghost" type="button" onClick={() => editBooking(item)}>Editar</button></div></div>)}</div>}
            </section>
          </div>

          <div className="grid split">
            <section className="card">
              <div className="row space center"><h2 style={{marginTop:0}}>Clientes sumidas</h2><span className={`badge ${dormantClients.length ? "danger" : "ok"}`}>{dormantClients.length ? `${dormantClients.length} cliente(s)` : "Em dia"}</span></div>
              {!dormantClients.length ? <div className="empty">Nenhuma cliente acima do limite configurado.</div> : <div className="list">{dormantClients.map(item => <div className="item" key={item.client.id}><div className="row space center"><div><div className="item-title">{item.client.name}</div><div className="item-sub">Último atendimento: {item.last ? date(item.last.attended_at) : "-"}</div><div className="item-sub">Último procedimento: {item.lastProcedure || "-"}</div></div>{item.client.phone ? <a className="btn primary" target="_blank" rel="noreferrer" href={buildWhatsappLink(item.client.id, item.lastProcedure)}>WhatsApp</a> : <button className="btn ghost" type="button" onClick={() => editClient(item.client)}>Editar</button>}</div></div>)}</div>}
            </section>
            <section className="card">
              <div className="row space center"><h2 style={{marginTop:0}}>Atendimentos recentes</h2><button className="btn ghost" type="button" onClick={() => setTab("atendimentos")}>Ver tudo</button></div>
              {!appointments.length ? <div className="empty">Nenhum atendimento lançado.</div> : <div className="list">{appointments.slice(0,5).map(app => <div className="item" key={app.id}><div className="row space center"><div><div className="item-title">{getClientName(app.client_id)}</div><div className="item-sub">{dateTime(app.attended_at)} • {brl(Number(app.gross_amount || 0))}</div></div><button className="btn ghost" type="button" onClick={() => editAppointment(app)}>Editar</button></div></div>)}</div>}
            </section>
          </div>
        </div>}

        {tab === "agenda" && <div className="grid split">
          <section className="card">
            <div className="row space center"><h2 style={{marginTop:0}}>{bookingForm.id ? "Editar agendamento" : "Novo agendamento"}</h2>{bookingForm.id ? <button className="btn ghost" type="button" onClick={resetBookingForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveBooking} className="grid">
              <div className="field"><label>Cliente</label><select value={bookingForm.client_id} onChange={e => setBookingForm(v => ({...v, client_id:e.target.value}))}><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="row"><div className="field"><label>Data e hora</label><input type="datetime-local" value={bookingForm.scheduled_for} onChange={e => setBookingForm(v => ({...v, scheduled_for:e.target.value}))} /></div><div className="field small"><label>Status</label><select value={bookingForm.status} onChange={e => setBookingForm(v => ({...v, status:e.target.value}))}><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option><option value="faltou">Faltou</option></select></div></div>
              <div className="field"><label>Observações</label><textarea value={bookingForm.notes} onChange={e => setBookingForm(v => ({...v, notes:e.target.value}))} placeholder="Ex.: design + buço, preferir tarde..." /></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : bookingForm.id ? "Atualizar agendamento" : "Salvar agendamento"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Lista da agenda</h2>
            {!bookings.length ? <div className="empty">Nenhum agendamento cadastrado.</div> : <div className="list">{bookings.map(item => <div className="item" key={item.id}><div className="row space center"><div><div className="item-title">{getClientName(item.client_id)}</div><div className="item-sub">{dateTime(item.scheduled_for)} • {item.status}</div>{item.notes ? <div className="item-sub">{item.notes}</div> : null}</div><div className="row"><button className="btn ghost" type="button" onClick={() => convertBookingToAppointment(item)}>Virar atendimento</button><button className="btn ghost" type="button" onClick={() => editBooking(item)}>Editar</button><button className="btn danger" type="button" onClick={() => removeItem("bookings", item.id, "agendamento")}>Excluir</button></div></div></div>)}</div>}
          </section>
        </div>}

        {tab === "atendimentos" && <div className="grid">
          <section className="card">
            <div className="row space center"><h2 style={{marginTop:0}}>{appointmentForm.id ? "Editar atendimento" : "Lançar atendimento"}</h2>{appointmentForm.id ? <button className="btn ghost" type="button" onClick={resetAppointmentForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveAppointment} className="grid">
              <div className="row">
                <div className="field"><label>Cliente</label><select value={appointmentForm.client_id} onChange={e => setAppointmentForm(v => ({...v, client_id:e.target.value}))}><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="field"><label>Data e hora</label><input type="datetime-local" value={appointmentForm.attended_at} onChange={e => setAppointmentForm(v => ({...v, attended_at:e.target.value}))} /></div>
                <div className="field small"><label>Pagamento</label><select value={appointmentForm.payment_method} onChange={e => setAppointmentForm(v => ({...v, payment_method:e.target.value}))}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option></select></div>
                <div className="field small"><label>Desconto</label><input type="number" step="0.01" value={appointmentForm.discount} onChange={e => setAppointmentForm(v => ({...v, discount:e.target.value}))} /></div>
              </div>

              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Procedimentos realizados</h3><button className="btn ghost" type="button" onClick={() => setAppointmentForm(v => ({...v, procedures:[...v.procedures, {procedure_id:""}]}))}>+ Adicionar</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {appointmentForm.procedures.map((item, index) => <div className="row center" key={index}><div className="field"><label>Procedimento</label><select value={item.procedure_id} onChange={e => { const next=[...appointmentForm.procedures]; next[index].procedure_id=e.target.value; setAppointmentForm(v => ({...v, procedures: next})); }}><option value="">Selecione</option>{procedures.map(p => <option key={p.id} value={p.id}>{p.name} — {brl(Number(p.price || 0))}</option>)}</select></div><button className="btn danger" type="button" onClick={() => { const next=appointmentForm.procedures.filter((_,i)=>i!==index); setAppointmentForm(v => ({...v, procedures: next.length?next:[{procedure_id:""}]})); }}>Remover</button></div>)}
                </div>
              </div>

              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Insumos extras</h3><button className="btn ghost" type="button" onClick={() => setAppointmentForm(v => ({...v, extra_supplies:[...v.extra_supplies, {supply_id:"", quantity_used:""}]}))}>+ Adicionar</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {appointmentForm.extra_supplies.map((item, index) => <div className="row center" key={index}><div className="field"><label>Insumo</label><select value={item.supply_id} onChange={e => { const next=[...appointmentForm.extra_supplies]; next[index].supply_id=e.target.value; setAppointmentForm(v => ({...v, extra_supplies: next})); }}><option value="">Selecione</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name} — {brl(Number(s.cost_per_unit || 0))} por {s.unit_label}</option>)}</select></div><div className="field small"><label>Qtd. usada</label><input type="number" step="0.01" value={item.quantity_used} onChange={e => { const next=[...appointmentForm.extra_supplies]; next[index].quantity_used=e.target.value; setAppointmentForm(v => ({...v, extra_supplies: next})); }}/></div><button className="btn danger" type="button" onClick={() => { const next=appointmentForm.extra_supplies.filter((_,i)=>i!==index); setAppointmentForm(v => ({...v, extra_supplies: next.length?next:[{supply_id:"", quantity_used:""}]})); }}>Remover</button></div>)}
                </div>
              </div>

              <div className="field"><label>Observações</label><textarea value={appointmentForm.notes} onChange={e => setAppointmentForm(v => ({...v, notes:e.target.value}))} placeholder="Anotações do atendimento" /></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : appointmentForm.id ? "Atualizar atendimento" : "Salvar atendimento"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Histórico de atendimentos</h2>
            <div className="table"><table><thead><tr><th>Cliente</th><th>Data</th><th>Procedimentos</th><th>Bruto</th><th>Gasto</th><th>Líquido</th><th></th></tr></thead><tbody>
              {!appointments.length ? <tr><td colSpan={7}><div className="empty">Nenhum atendimento lançado.</div></td></tr> : appointments.map(item => {
                const client = clients.find(c => c.id === item.client_id);
                const names = (lastProcedureByAppointment.get(item.id) || []).join(", ");
                return <tr key={item.id}><td>{client?.name || "-"}</td><td>{dateTime(item.attended_at)}</td><td>{names || "-"}</td><td>{brl(Number(item.gross_amount || 0))}</td><td>{brl(Number(item.cost_amount || 0))}</td><td>{brl(Number(item.net_amount || 0))}</td><td><div className="row"><button className="btn ghost" type="button" onClick={() => editAppointment(item)}>Editar</button><button className="btn danger" type="button" onClick={() => removeAppointment(item.id)}>Excluir</button></div></td></tr>;
              })}
            </tbody></table></div>
          </section>
        </div>}

        {tab === "clientes" && <div className="grid split">
          <section className="card">
            <div className="row space center"><h2 style={{marginTop:0}}>{clientForm.id ? "Editar cliente" : "Cadastrar cliente"}</h2>{clientForm.id ? <button className="btn ghost" type="button" onClick={resetClientForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveClient} className="grid">
              <div className="row"><div className="field"><label>Nome</label><input value={clientForm.name} onChange={e => setClientForm(v => ({...v, name:e.target.value}))} placeholder="Nome da cliente" /></div><div className="field"><label>Telefone</label><input value={clientForm.phone} onChange={e => setClientForm(v => ({...v, phone:e.target.value}))} placeholder="(31) 99999-9999" /></div></div>
              <div className="field"><label>Observações</label><textarea value={clientForm.notes} onChange={e => setClientForm(v => ({...v, notes:e.target.value}))} placeholder="Ex.: alergias, preferências..." /></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : clientForm.id ? "Atualizar cliente" : "Salvar cliente"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Lista de clientes</h2>
            <div className="list">
              {!clientsSummary.length ? <div className="empty">Nenhuma cliente cadastrada.</div> : clientsSummary.map(item => <div className="item" key={item.client.id}><div className="row space center"><div><div className="item-title">{item.client.name}</div><div className="item-sub">{item.client.phone || "Sem telefone"}</div><div className="item-sub">Último atendimento: {item.last ? date(item.last.attended_at) : "Nunca"}</div><div className="item-sub">Total faturado com ela: {brl(item.totalSpent)}</div></div><div className="row">{item.last && item.client.phone ? <a className="btn primary" target="_blank" rel="noreferrer" href={buildWhatsappLink(item.client.id, item.lastProcedure)}>WhatsApp</a> : null}<button className="btn ghost" type="button" onClick={() => editClient(item.client)}>Editar</button><button className="btn danger" type="button" onClick={() => removeItem("clients", item.client.id, "cliente")}>Excluir</button></div></div></div>)}
            </div>
          </section>
        </div>}

        {tab === "procedimentos" && <div className="grid split">
          <section className="card">
            <div className="row space center"><h2 style={{marginTop:0}}>{procedureForm.id ? "Editar procedimento" : "Cadastrar procedimento"}</h2>{procedureForm.id ? <button className="btn ghost" type="button" onClick={resetProcedureForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveProcedure} className="grid">
              <div className="row"><div className="field"><label>Nome do procedimento</label><input value={procedureForm.name} onChange={e => setProcedureForm(v => ({...v, name:e.target.value}))} placeholder="Ex.: Design de sobrancelha" /></div><div className="field small"><label>Valor cobrado</label><input type="number" step="0.01" value={procedureForm.price} onChange={e => setProcedureForm(v => ({...v, price:e.target.value}))} /></div></div>
              <div className="field"><label>Descrição</label><textarea value={procedureForm.description} onChange={e => setProcedureForm(v => ({...v, description:e.target.value}))} placeholder="Observações do procedimento" /></div>
              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Insumos padrão desse procedimento</h3><button className="btn ghost" type="button" onClick={() => setProcedureForm(v => ({...v, supplies:[...v.supplies, {supply_id:"", quantity_used:""}]}))}>+ Adicionar insumo</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {procedureForm.supplies.map((item, index) => <div className="row center" key={index}><div className="field"><label>Insumo</label><select value={item.supply_id} onChange={e => { const next=[...procedureForm.supplies]; next[index].supply_id=e.target.value; setProcedureForm(v => ({...v, supplies: next})); }}><option value="">Selecione</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name} — {brl(Number(s.cost_per_unit || 0))} por {s.unit_label}</option>)}</select></div><div className="field small"><label>Qtd. usada</label><input type="number" step="0.01" value={item.quantity_used} onChange={e => { const next=[...procedureForm.supplies]; next[index].quantity_used=e.target.value; setProcedureForm(v => ({...v, supplies: next})); }}/></div><button className="btn danger" type="button" onClick={() => { const next=procedureForm.supplies.filter((_,i)=>i!==index); setProcedureForm(v => ({...v, supplies: next.length?next:[{supply_id:"", quantity_used:""}]})); }}>Remover</button></div>)}
                </div>
              </div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : procedureForm.id ? "Atualizar procedimento" : "Salvar procedimento"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Procedimentos cadastrados</h2>
            <div className="list">
              {!proceduresWithCost.length ? <div className="empty">Nenhum procedimento cadastrado.</div> : proceduresWithCost.map(proc => <div className="item" key={proc.id}><div className="row space center"><div><div className="item-title">{proc.name} — {brl(Number(proc.price || 0))}</div><div className="item-sub">Custo estimado de insumos: {brl(proc.estimatedCost)}</div><div className="item-sub">Margem estimada: {brl(proc.margin)}</div>{proc.description ? <div className="item-sub">{proc.description}</div> : null}</div><div className="row"><button className="btn ghost" type="button" onClick={() => editProcedure(proc)}>Editar</button><button className="btn danger" type="button" onClick={() => removeItem("procedures", proc.id, "procedimento")}>Excluir</button></div></div></div>)}
            </div>
          </section>
        </div>}

        {tab === "insumos" && <div className="grid split">
          <section className="card">
            <div className="row space center"><h2 style={{marginTop:0}}>{supplyForm.id ? "Editar insumo" : "Cadastrar insumo"}</h2>{supplyForm.id ? <button className="btn ghost" type="button" onClick={resetSupplyForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveSupply} className="grid">
              <div className="row"><div className="field"><label>Nome do insumo</label><input value={supplyForm.name} onChange={e => setSupplyForm(v => ({...v, name:e.target.value}))} placeholder="Ex.: Espátula descartável" /></div><div className="field small"><label>Valor pago</label><input type="number" step="0.01" value={supplyForm.purchase_price} onChange={e => setSupplyForm(v => ({...v, purchase_price:e.target.value}))} /></div><div className="field small"><label>Qtd. na embalagem</label><input type="number" step="0.01" value={supplyForm.quantity_in_package} onChange={e => setSupplyForm(v => ({...v, quantity_in_package:e.target.value}))} /></div><div className="field small"><label>Unidade</label><input value={supplyForm.unit_label} onChange={e => setSupplyForm(v => ({...v, unit_label:e.target.value}))} /></div></div>
              <div className="row"><div className="field small"><label>Estoque atual</label><input type="number" step="0.01" value={supplyForm.stock_quantity} onChange={e => setSupplyForm(v => ({...v, stock_quantity:e.target.value}))} /></div><div className="field small"><label>Avisar quando chegar em</label><input type="number" step="0.01" value={supplyForm.low_stock_threshold} onChange={e => setSupplyForm(v => ({...v, low_stock_threshold:e.target.value}))} /></div></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : supplyForm.id ? "Atualizar insumo" : "Salvar insumo"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Estoque e custo por unidade</h2>
            <div className="table"><table><thead><tr><th>Insumo</th><th>Custo por unidade</th><th>Estoque</th><th>Alerta</th><th></th></tr></thead><tbody>
              {!supplies.length ? <tr><td colSpan={5}><div className="empty">Nenhum insumo cadastrado.</div></td></tr> : supplies.map(s => <tr key={s.id}><td><div style={{fontWeight:700}}>{s.name}</div><div className="muted">Pago: {brl(Number(s.purchase_price || 0))} / {s.quantity_in_package} {s.unit_label}</div></td><td>{brl(Number(s.cost_per_unit || 0))}</td><td>{s.stock_quantity} {s.unit_label}</td><td>{s.low_stock_threshold} {s.unit_label}</td><td><div className="row"><button className="btn ghost" type="button" onClick={() => editSupply(s)}>Editar</button><button className="btn danger" type="button" onClick={() => removeItem("supplies", s.id, "insumo")}>Excluir</button></div></td></tr>)}
            </tbody></table></div>
          </section>
        </div>}

        {tab === "configuracoes" && <div className="grid split">
          <section className="card">
            <h2 style={{marginTop:0}}>Configurações gerais</h2>
            <form onSubmit={saveSettings} className="grid">
              <div className="row"><div className="field"><label>Nome do salão</label><input value={settingsForm.salon_name} onChange={e => setSettingsForm(v => ({...v, salon_name:e.target.value}))} /></div><div className="field small"><label>Dias para cliente sumida</label><input type="number" value={settingsForm.inactive_days_threshold} onChange={e => setSettingsForm(v => ({...v, inactive_days_threshold:Number(e.target.value || 30)}))} /></div></div>
              <div className="field"><label>Mensagem padrão do WhatsApp</label><textarea value={settingsForm.whatsapp_message_template} onChange={e => setSettingsForm(v => ({...v, whatsapp_message_template:e.target.value}))} /></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : "Salvar configurações"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Acesso administrador</h2>
            <div className="list">
              <div className="item"><div className="item-title">Email admin</div><div className="item-sub">{ADMIN_EMAIL}</div></div>
              <div className="item"><div className="item-title">Senha admin</div><div className="item-sub">{ADMIN_PASSWORD}</div></div>
              <div className="item"><div className="item-title">Importante</div><div className="item-sub">Esse login é uma trava simples de aplicativo. Depois eu posso trocar por autenticação real via Supabase Auth.</div></div>
            </div>
          </section>
        </div>}
      </div>
    </main>
  );
}
