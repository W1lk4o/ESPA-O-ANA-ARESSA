"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../lib/supabase";

type Client = { id: string; name: string; phone: string | null; notes: string | null; created_at: string };
type Supply = { id: string; name: string; purchase_price: number; quantity_in_package: number; unit_label: string; cost_per_unit: number; stock_quantity: number; low_stock_threshold: number; created_at: string };
type Procedure = { id: string; name: string; price: number; description: string | null; created_at: string };
type ProcedureSupply = { id: string; procedure_id: string; supply_id: string; quantity_used: number };
type Appointment = { id: string; client_id: string; attended_at: string; payment_method: string | null; discount: number; gross_amount: number; cost_amount: number; net_amount: number; notes: string | null; created_at: string };
type AppointmentProcedure = { id: string; appointment_id: string; procedure_id: string; price_charged: number };
type AppointmentSupply = { id: string; appointment_id: string; supply_id: string; quantity_used: number; unit_cost: number; total_cost: number };
type Booking = { id: string; client_id: string; scheduled_at: string; service_summary: string | null; notes: string | null; status: string; created_at: string };
type Settings = { id: string; salon_name: string; inactive_days_threshold: number; whatsapp_message_template: string };
type Tab = "dashboard"|"agenda"|"atendimentos"|"clientes"|"procedimentos"|"insumos"|"configuracoes";

type PendingDelete = null | { kind: "simple"|"appointment"|"booking"; id: string; table?: string; label: string; message: string };

type AppointmentFormState = {
  id: string;
  client_id: string;
  attended_at: string;
  payment_method: string;
  discount: string;
  notes: string;
  procedures: { procedure_id: string }[];
  extra_supplies: { supply_id: string; quantity_used: string }[];
};

type BookingFormState = {
  id: string;
  client_id: string;
  scheduled_at: string;
  service_summary: string;
  notes: string;
  status: string;
};

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "anaressa07@gmail.com";
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "98616191ANA";

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
function inputDateTimeValue(v?: string | null) {
  const d = v ? new Date(v) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function emptyAppointmentForm(): AppointmentFormState {
  return {
    id: "",
    client_id: "",
    attended_at: inputDateTimeValue(),
    payment_method: "pix",
    discount: "0",
    notes: "",
    procedures: [{ procedure_id: "" }],
    extra_supplies: [{ supply_id: "", quantity_used: "" }]
  };
}
function emptyBookingForm(): BookingFormState {
  return {
    id: "",
    client_id: "",
    scheduled_at: inputDateTimeValue(),
    service_summary: "",
    notes: "",
    status: "agendado"
  };
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

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
  const [procedureForm, setProcedureForm] = useState({ id: "", name: "", price: "", description: "", supplies: [{ supply_id: "", quantity_used: "" }] });
  const [settingsForm, setSettingsForm] = useState(defaultSettings);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFormState>(emptyAppointmentForm());
  const [bookingForm, setBookingForm] = useState<BookingFormState>(emptyBookingForm());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const clientsFormRef = useRef<HTMLElement | null>(null);
  const proceduresFormRef = useRef<HTMLElement | null>(null);
  const suppliesFormRef = useRef<HTMLElement | null>(null);
  const appointmentsFormRef = useRef<HTMLElement | null>(null);
  const bookingsFormRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("espaco-ana-aressa-admin") : null;
    if (saved === "ok") {
      setIsLoggedIn(true);
      void loadAll();
    } else {
      setLoading(false);
    }
  }, []);

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
        supabase.from("bookings").select("*").order("scheduled_at"),
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

  const lastProcedureByAppointment = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of appointmentProcedures) {
      const proc = procedures.find(p => p.id === row.procedure_id);
      const list = map.get(row.appointment_id) || [];
      if (proc?.name) list.push(proc.name);
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

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(b => b.status === "agendado" && +new Date(b.scheduled_at) >= now)
      .sort((a,b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  }, [bookings]);

  function clearFlags(){ setError(""); setOk(""); }

  function scrollToForm(ref: React.RefObject<HTMLElement | null>) {
    if (typeof window === "undefined") return;
    window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  function resetClientForm(){ setClientForm({ id: "", name: "", phone: "", notes: "" }); }
  function resetSupplyForm(){ setSupplyForm({ id: "", name: "", purchase_price: "", quantity_in_package: "", unit_label: "un", stock_quantity: "", low_stock_threshold: "5" }); }
  function resetProcedureForm(){ setProcedureForm({ id: "", name: "", price: "", description: "", supplies: [{ supply_id: "", quantity_used: "" }] }); }
  function resetAppointmentForm(){ setAppointmentForm(emptyAppointmentForm()); }
  function resetBookingForm(){ setBookingForm(emptyBookingForm()); }

  function editClient(item: Client) {
    clearFlags();
    setPendingDelete(null);
    setClientForm({ id: item.id, name: item.name || "", phone: item.phone || "", notes: item.notes || "" });
    setTab("clientes");
    scrollToForm(clientsFormRef);
  }
  function editSupply(item: Supply) {
    clearFlags();
    setPendingDelete(null);
    setSupplyForm({ id: item.id, name: item.name || "", purchase_price: String(item.purchase_price ?? ""), quantity_in_package: String(item.quantity_in_package ?? ""), unit_label: item.unit_label || "un", stock_quantity: String(item.stock_quantity ?? ""), low_stock_threshold: String(item.low_stock_threshold ?? "5") });
    setTab("insumos");
    scrollToForm(suppliesFormRef);
  }
  function editProcedure(item: Procedure) {
    clearFlags();
    setPendingDelete(null);
    const links = procedureSupplies.filter(link => link.procedure_id === item.id).map(link => ({ supply_id: link.supply_id, quantity_used: String(link.quantity_used ?? "") }));
    setProcedureForm({ id: item.id, name: item.name || "", price: String(item.price ?? ""), description: item.description || "", supplies: links.length ? links : [{ supply_id: "", quantity_used: "" }] });
    setTab("procedimentos");
    scrollToForm(proceduresFormRef);
  }

  function buildUsageFromForm(form: AppointmentFormState) {
    const selectedIds = form.procedures.map(x => x.procedure_id).filter(Boolean);
    const selectedProcedures = procedures.filter(p => selectedIds.includes(p.id));
    const gross = selectedProcedures.reduce((s,p)=>s+Number(p.price||0),0);
    const grouped = new Map<string, number>();
    for (const procId of selectedIds) {
      for (const link of procedureSupplies.filter(x => x.procedure_id === procId)) {
        grouped.set(link.supply_id, (grouped.get(link.supply_id) || 0) + Number(link.quantity_used));
      }
    }
    for (const extra of form.extra_supplies) {
      if (extra.supply_id && Number(extra.quantity_used) > 0) {
        grouped.set(extra.supply_id, (grouped.get(extra.supply_id) || 0) + Number(extra.quantity_used));
      }
    }
    const usage = Array.from(grouped.entries()).map(([supply_id, quantity_used]) => {
      const supply = supplies.find(s => s.id === supply_id);
      return {
        supply_id,
        quantity_used,
        unit_cost: Number(supply?.cost_per_unit || 0),
        total_cost: Number(supply?.cost_per_unit || 0) * quantity_used,
        stock: Number(supply?.stock_quantity || 0),
        name: supply?.name || "Insumo"
      };
    });
    const discount = Number(form.discount || 0);
    const cost = usage.reduce((s,u)=>s+u.total_cost,0);
    const net = gross - discount - cost;
    return { selectedProcedures, usage, gross, discount, cost, net };
  }

  function editAppointment(item: Appointment) {
    clearFlags();
    setPendingDelete(null);
    const procRows = appointmentProcedures.filter(row => row.appointment_id === item.id);
    const supplyRows = appointmentSupplies.filter(row => row.appointment_id === item.id);
    const standard = new Map<string, number>();
    for (const row of procRows) {
      for (const link of procedureSupplies.filter(link => link.procedure_id === row.procedure_id)) {
        standard.set(link.supply_id, (standard.get(link.supply_id) || 0) + Number(link.quantity_used || 0));
      }
    }
    const extras = supplyRows
      .map(row => ({
        supply_id: row.supply_id,
        quantity_used: Math.max(0, Number(row.quantity_used || 0) - Number(standard.get(row.supply_id) || 0))
      }))
      .filter(row => row.quantity_used > 0)
      .map(row => ({ supply_id: row.supply_id, quantity_used: String(row.quantity_used) }));

    setAppointmentForm({
      id: item.id,
      client_id: item.client_id,
      attended_at: inputDateTimeValue(item.attended_at),
      payment_method: item.payment_method || "pix",
      discount: String(item.discount ?? 0),
      notes: item.notes || "",
      procedures: procRows.length ? procRows.map(row => ({ procedure_id: row.procedure_id })) : [{ procedure_id: "" }],
      extra_supplies: extras.length ? extras : [{ supply_id: "", quantity_used: "" }]
    });
    setTab("atendimentos");
    scrollToForm(appointmentsFormRef);
  }

  function editBooking(item: Booking) {
    clearFlags();
    setPendingDelete(null);
    setBookingForm({ id: item.id, client_id: item.client_id, scheduled_at: inputDateTimeValue(item.scheduled_at), service_summary: item.service_summary || "", notes: item.notes || "", status: item.status || "agendado" });
    setTab("agenda");
    scrollToForm(bookingsFormRef);
  }

  function fillFromBooking(item: Booking) {
    clearFlags();
    setPendingDelete(null);
    setAppointmentForm({
      id: "",
      client_id: item.client_id,
      attended_at: inputDateTimeValue(item.scheduled_at),
      payment_method: "pix",
      discount: "0",
      notes: [item.service_summary, item.notes].filter(Boolean).join(" | "),
      procedures: [{ procedure_id: "" }],
      extra_supplies: [{ supply_id: "", quantity_used: "" }]
    });
    setTab("atendimentos");
    scrollToForm(appointmentsFormRef);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    clearFlags();
    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password.trim();
    if (email !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
      setError("Email ou senha inválidos.");
      return;
    }
    if (typeof window !== "undefined") window.localStorage.setItem("espaco-ana-aressa-admin", "ok");
    setIsLoggedIn(true);
    await loadAll();
    setOk("Login realizado.");
  }

  function logout() {
    if (typeof window !== "undefined") window.localStorage.removeItem("espaco-ana-aressa-admin");
    setIsLoggedIn(false);
    setLoginForm({ email: "", password: "" });
    setOk("");
    setError("");
  }

  async function saveClient(e: React.FormEvent){
    e.preventDefault(); clearFlags();
    if (!clientForm.name.trim()) return setError("Preencha o nome da cliente.");
    try {
      setBusy(true);
      const supabase = getSupabase();
      const payload = { name: clientForm.name.trim(), phone: clientForm.phone.trim() || null, notes: clientForm.notes.trim() || null };
      const response = clientForm.id ? await supabase.from("clients").update(payload).eq("id", clientForm.id) : await supabase.from("clients").insert(payload);
      if (response.error) throw response.error;
      resetClientForm();
      setOk(clientForm.id ? "Cliente atualizada." : "Cliente cadastrada.");
      await loadAll(); setTab("clientes");
    } catch (e:any) { setError(e?.message || "Erro ao salvar cliente."); } finally { setBusy(false); }
  }

  async function saveSupply(e: React.FormEvent){
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
      const response = supplyForm.id ? await supabase.from("supplies").update(payload).eq("id", supplyForm.id) : await supabase.from("supplies").insert(payload);
      if (response.error) throw response.error;
      resetSupplyForm();
      setOk(supplyForm.id ? "Insumo atualizado." : "Insumo cadastrado.");
      await loadAll(); setTab("insumos");
    } catch (e:any) { setError(e?.message || "Erro ao salvar insumo."); } finally { setBusy(false); }
  }

  async function saveProcedure(e: React.FormEvent){
    e.preventDefault(); clearFlags();
    const price = Number(procedureForm.price);
    if (!procedureForm.name.trim() || !price) return setError("Preencha nome e valor do procedimento.");
    try {
      setBusy(true);
      const supabase = getSupabase();
      let procedureId = procedureForm.id;
      if (procedureForm.id) {
        const upd = await supabase.from("procedures").update({ name: procedureForm.name.trim(), price, description: procedureForm.description.trim() || null }).eq("id", procedureForm.id).select("id").single();
        if (upd.error) throw upd.error;
        procedureId = upd.data.id;
        const delLinks = await supabase.from("procedure_supplies").delete().eq("procedure_id", procedureId);
        if (delLinks.error) throw delLinks.error;
      } else {
        const created = await supabase.from("procedures").insert({ name: procedureForm.name.trim(), price, description: procedureForm.description.trim() || null }).select("id").single();
        if (created.error) throw created.error;
        procedureId = created.data.id;
      }
      const links = procedureForm.supplies.filter(x => x.supply_id && Number(x.quantity_used) > 0).map(x => ({ procedure_id: procedureId, supply_id: x.supply_id, quantity_used: Number(x.quantity_used) }));
      if (links.length) {
        const res = await supabase.from("procedure_supplies").insert(links);
        if (res.error) throw res.error;
      }
      resetProcedureForm();
      setOk(procedureForm.id ? "Procedimento atualizado." : "Procedimento cadastrado.");
      await loadAll(); setTab("procedimentos");
    } catch (e:any) { setError(e?.message || "Erro ao salvar procedimento."); } finally { setBusy(false); }
  }

  async function saveSettings(e: React.FormEvent){
    e.preventDefault(); clearFlags();
    try {
      setBusy(true);
      const supabase = getSupabase();
      const { error } = await supabase.from("settings").upsert({
        id: settings?.id || "00000000-0000-0000-0000-000000000001",
        salon_name: settingsForm.salon_name || defaultSettings.salon_name,
        inactive_days_threshold: Number(settingsForm.inactive_days_threshold || 30),
        whatsapp_message_template: settingsForm.whatsapp_message_template || defaultSettings.whatsapp_message_template
      });
      if (error) throw error;
      setOk("Configurações salvas.");
      await loadAll(); setTab("dashboard");
    } catch (e:any) { setError(e?.message || "Erro ao salvar configurações."); } finally { setBusy(false); }
  }

  async function saveAppointment(e: React.FormEvent){
    e.preventDefault(); clearFlags();
    if (!appointmentForm.client_id) return setError("Selecione a cliente.");
    const selectedIds = appointmentForm.procedures.map(x => x.procedure_id).filter(Boolean);
    if (!selectedIds.length) return setError("Adicione pelo menos um procedimento.");
    const { selectedProcedures, usage, gross, discount, cost, net } = buildUsageFromForm(appointmentForm);

    try {
      setBusy(true);
      const supabase = getSupabase();

      if (appointmentForm.id) {
        const oldUsage = appointmentSupplies.filter(row => row.appointment_id === appointmentForm.id);
        for (const old of oldUsage) {
          const current = supplies.find(s => s.id === old.supply_id);
          const restore = await supabase.from("supplies").update({ stock_quantity: Number(current?.stock_quantity || 0) + Number(old.quantity_used || 0) }).eq("id", old.supply_id);
          if (restore.error) throw restore.error;
        }
      }

      const refreshedSupplies = appointmentForm.id
        ? supplies.map(s => {
            const restored = appointmentSupplies.filter(row => row.appointment_id === appointmentForm.id && row.supply_id === s.id).reduce((sum, row) => sum + Number(row.quantity_used || 0), 0);
            return { ...s, stock_quantity: Number(s.stock_quantity || 0) + restored };
          })
        : supplies;

      for (const item of usage) {
        const current = refreshedSupplies.find(s => s.id === item.supply_id);
        if (Number(current?.stock_quantity || 0) < item.quantity_used) return setError(`Estoque insuficiente para ${item.name}.`);
      }

      let appointmentId = appointmentForm.id;
      if (appointmentForm.id) {
        const upd = await supabase.from("appointments").update({ client_id: appointmentForm.client_id, attended_at: new Date(appointmentForm.attended_at).toISOString(), payment_method: appointmentForm.payment_method, discount, gross_amount: gross, cost_amount: cost, net_amount: net, notes: appointmentForm.notes || null }).eq("id", appointmentForm.id).select("id").single();
        if (upd.error) throw upd.error;
        appointmentId = upd.data.id;
        const delProc = await supabase.from("appointment_procedures").delete().eq("appointment_id", appointmentId);
        if (delProc.error) throw delProc.error;
        const delSup = await supabase.from("appointment_supplies").delete().eq("appointment_id", appointmentId);
        if (delSup.error) throw delSup.error;
      } else {
        const created = await supabase.from("appointments").insert({ client_id: appointmentForm.client_id, attended_at: new Date(appointmentForm.attended_at).toISOString(), payment_method: appointmentForm.payment_method, discount, gross_amount: gross, cost_amount: cost, net_amount: net, notes: appointmentForm.notes || null }).select("id").single();
        if (created.error) throw created.error;
        appointmentId = created.data.id;
      }

      const rowsProc = selectedProcedures.map(p => ({ appointment_id: appointmentId, procedure_id: p.id, price_charged: p.price }));
      const rowsSup = usage.map(u => ({ appointment_id: appointmentId, supply_id: u.supply_id, quantity_used: u.quantity_used, unit_cost: u.unit_cost, total_cost: u.total_cost }));
      const rp = await supabase.from("appointment_procedures").insert(rowsProc); if (rp.error) throw rp.error;
      if (rowsSup.length) { const rs = await supabase.from("appointment_supplies").insert(rowsSup); if (rs.error) throw rs.error; }
      for (const u of usage) {
        const current = refreshedSupplies.find(s => s.id === u.supply_id);
        const update = await supabase.from("supplies").update({ stock_quantity: Number(current?.stock_quantity || 0) - u.quantity_used }).eq("id", u.supply_id);
        if (update.error) throw update.error;
      }
      resetAppointmentForm();
      setOk(appointmentForm.id ? "Atendimento atualizado." : "Atendimento salvo.");
      await loadAll(); setTab("atendimentos");
    } catch (e:any) { setError(e?.message || "Erro ao salvar atendimento."); } finally { setBusy(false); }
  }

  function askRemoveAppointment(id: string) {
    clearFlags();
    setPendingDelete({ kind: "appointment", id, label: "atendimento", message: "Excluir atendimento? O estoque desse atendimento vai ser devolvido." });
  }

  async function removeAppointment(id: string) {
    clearFlags();
    try {
      setBusy(true);
      const supabase = getSupabase();
      const usage = appointmentSupplies.filter(row => row.appointment_id === id);
      for (const row of usage) {
        const current = supplies.find(s => s.id === row.supply_id);
        const restore = await supabase.from("supplies").update({ stock_quantity: Number(current?.stock_quantity || 0) + Number(row.quantity_used || 0) }).eq("id", row.supply_id);
        if (restore.error) throw restore.error;
      }
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      if (appointmentForm.id === id) resetAppointmentForm();
      setOk("Atendimento excluído.");
      await loadAll();
    } catch (e:any) { setError(e?.message || "Erro ao excluir atendimento."); } finally { setBusy(false); }
  }

  async function saveBooking(e: React.FormEvent) {
    e.preventDefault(); clearFlags();
    if (!bookingForm.client_id) return setError("Selecione a cliente.");
    if (!bookingForm.scheduled_at) return setError("Informe a data e hora.");
    try {
      setBusy(true);
      const supabase = getSupabase();
      const payload = { client_id: bookingForm.client_id, scheduled_at: new Date(bookingForm.scheduled_at).toISOString(), service_summary: bookingForm.service_summary.trim() || null, notes: bookingForm.notes.trim() || null, status: bookingForm.status || "agendado" };
      const res = bookingForm.id ? await supabase.from("bookings").update(payload).eq("id", bookingForm.id) : await supabase.from("bookings").insert(payload);
      if (res.error) throw res.error;
      resetBookingForm();
      setOk(bookingForm.id ? "Agendamento atualizado." : "Agendamento salvo.");
      await loadAll(); setTab("agenda");
    } catch (e:any) { setError(e?.message || "Erro ao salvar agendamento."); } finally { setBusy(false); }
  }

  function askRemoveBooking(id: string) {
    clearFlags();
    setPendingDelete({ kind: "booking", id, label: "agendamento", message: "Excluir agendamento?" });
  }

  async function removeBooking(id: string) {
    clearFlags();
    try {
      setBusy(true);
      const supabase = getSupabase();
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
      if (bookingForm.id === id) resetBookingForm();
      setOk("Agendamento excluído.");
      await loadAll();
    } catch (e:any) { setError(e?.message || "Erro ao excluir agendamento."); } finally { setBusy(false); }
  }

  function askRemoveItem(table: string, id: string, label: string) {
    clearFlags();
    const extras: Record<string, string> = {
      clients: " Se essa cliente tiver atendimento ou agendamento ligado, o Supabase pode bloquear a exclusão.",
      procedures: " Se esse procedimento já foi usado em atendimento, o banco pode bloquear a exclusão.",
      supplies: " Se esse insumo já foi usado em procedimento ou atendimento, o banco pode bloquear a exclusão."
    };
    setPendingDelete({ kind: "simple", id, table, label, message: `Excluir ${label}?${extras[table] || ""}` });
  }

  async function removeItem(table: string, id: string, label: string) {
    clearFlags();
    try {
      setBusy(true);
      const supabase = getSupabase();
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      if (table === "clients" && clientForm.id === id) resetClientForm();
      if (table === "supplies" && supplyForm.id === id) resetSupplyForm();
      if (table === "procedures" && procedureForm.id === id) resetProcedureForm();
      setOk(`${label} excluído.`);
      await loadAll();
    } catch (e:any) { setError(e?.message || `Erro ao excluir ${label}.`); } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const action = pendingDelete;
    setPendingDelete(null);
    if (action.kind === "appointment") return removeAppointment(action.id);
    if (action.kind === "booking") return removeBooking(action.id);
    if (action.kind === "simple" && action.table) return removeItem(action.table, action.id, action.label);
  }

  function whatsappLink(item: {client: Client; lastProcedure: string}) {
    const phone = onlyDigits(item.client.phone);
    if (!phone) return "#";
    const text = (settingsForm.whatsapp_message_template || defaultSettings.whatsapp_message_template)
      .split("{nome}").join(item.client.name)
      .split("{procedimento}").join(item.lastProcedure || "atendimento");
    return `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
  }

  if (!isLoggedIn && !loading) {
    return (
      <main className="shell auth-shell">
        <section className="hero auth-card">
          <h1>ESPAÇO ANA ARESSA</h1>
          <p>Entre com o login de administradora para abrir o sistema.</p>
          {error ? <div className="notice err" style={{marginTop:12}}>{error}</div> : null}
          <form onSubmit={handleLogin} className="grid" style={{marginTop:14}}>
            <div className="field"><label>Email</label><input type="email" value={loginForm.email} onChange={e => setLoginForm(v => ({...v, email:e.target.value}))} placeholder="anaressa07@gmail.com" autoComplete="username" /></div>
            <div className="field"><label>Senha</label><input type="password" value={loginForm.password} onChange={e => setLoginForm(v => ({...v, password:e.target.value}))} placeholder="Digite a senha" autoComplete="current-password" /></div>
            <button className="btn primary" type="submit">Entrar</button>
          </form>
          <div className="help" style={{marginTop:12}}>Esse login é uma trava simples dentro do app. Depois dá para trocar por autenticação forte com Supabase Auth.</div>
        </section>
      </main>
    );
  }

  if (loading) return <main className="shell"><section className="hero"><h1>ESPAÇO ANA ARESSA</h1><p>Carregando sistema...</p></section></main>;

  return (
    <main>
      <div className="top">
        <div className="shell" style={{paddingBottom:0}}>
          <div className="tabbar">
            {tabs.map(t => <button key={t.key} className={`tab ${tab===t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
          </div>
        </div>
      </div>

      <div className="shell">
        <section className="hero">
          <div className="row space center">
            <div>
              <h1>{settingsForm.salon_name}</h1>
              <p>Sistema simples, rápido e funcional para controlar clientes, agenda, insumos, procedimentos e lucro real.</p>
            </div>
            <div className="row center">
              <span className="badge ok">{upcomingBookings.length} agendamentos futuros</span>
              <button className="btn ghost" type="button" onClick={logout}>Sair</button>
            </div>
          </div>
        </section>

        {error ? <div className="notice err">{error}</div> : null}
        {ok ? <div className="notice ok">{ok}</div> : null}
        {pendingDelete ? (
          <section className="notice warn">
            <div className="row space center">
              <div>
                <div style={{fontWeight:800}}>Confirmação</div>
                <div className="muted" style={{marginTop:4}}>{pendingDelete.message}</div>
              </div>
              <div className="row">
                <button className="btn ghost" type="button" onClick={() => setPendingDelete(null)} disabled={busy}>Cancelar</button>
                <button className="btn danger" type="button" onClick={confirmDelete} disabled={busy}>{busy ? "Excluindo..." : "Confirmar exclusão"}</button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "dashboard" && <>
          <section className="grid stats">
            <div className="card"><div className="label">Faturamento do mês</div><div className="big">{brl(grossMonth)}</div></div>
            <div className="card"><div className="label">Gastos com insumos</div><div className="big">{brl(costMonth)}</div></div>
            <div className="card"><div className="label">Lucro líquido</div><div className="big">{brl(netMonth)}</div></div>
            <div className="card"><div className="label">Clientes cadastradas</div><div className="big">{clients.length}</div></div>
          </section>

          <section className="grid split">
            <div className="card">
              <div className="row space center"><h2 style={{marginTop:0}}>Últimos 7 dias</h2><span className="badge">Bruto x Líquido</span></div>
              <div className="chart">
                {chartRows.map(row => <div key={row.day} className="col"><div className="bars"><div className="bar gross" style={{height: `${(row.gross/chartMax)*100}%`}} /><div className="bar net" style={{height: `${(row.net/chartMax)*100}%`}} /></div><div className="chart-label">{row.day}</div></div>)}
              </div>
            </div>

            <div className="grid">
              <div className="card">
                <div className="row space center"><h2 style={{marginTop:0}}>Insumos acabando</h2><span className={`badge ${lowStock.length ? "danger" : "ok"}`}>{lowStock.length} alerta(s)</span></div>
                <div className="list">
                  {!lowStock.length ? <div className="empty">Nenhum insumo em alerta.</div> : lowStock.map(item => <div key={item.id} className="item"><div className="item-title">{item.name}</div><div className="item-sub">Estoque: {item.stock_quantity} {item.unit_label}</div><div className="item-sub">Avisar em: {item.low_stock_threshold} {item.unit_label}</div></div>)}
                </div>
              </div>

              <div className="card">
                <div className="row space center"><h2 style={{marginTop:0}}>Clientes sumidas</h2><span className="badge">{dormantClients.length}</span></div>
                <div className="list">
                  {!dormantClients.length ? <div className="empty">Nenhuma cliente acima do prazo definido.</div> : dormantClients.slice(0,5).map(item => <div key={item.client.id} className="item"><div className="row space center"><div><div className="item-title">{item.client.name}</div><div className="item-sub">Último atendimento: {date(item.last!.attended_at)}</div><div className="item-sub">Último procedimento: {item.lastProcedure || "-"}</div></div>{item.client.phone ? <a className="btn primary" target="_blank" rel="noreferrer" href={whatsappLink(item)}>WhatsApp</a> : null}</div></div>)}
                </div>
              </div>
            </div>
          </section>

          <section className="grid split">
            <div className="card">
              <div className="row space center"><h2 style={{marginTop:0}}>Próximos agendamentos</h2><button className="btn ghost" type="button" onClick={() => setTab("agenda")}>Abrir agenda</button></div>
              <div className="list">
                {!upcomingBookings.length ? <div className="empty">Nenhum agendamento futuro.</div> : upcomingBookings.slice(0,5).map(item => {
                  const client = clients.find(c => c.id === item.client_id);
                  return <div className="item" key={item.id}><div className="item-title">{client?.name || "Cliente"} — {dateTime(item.scheduled_at)}</div><div className="item-sub">{item.service_summary || "Sem procedimento informado"}</div><div className="item-sub">Status: {item.status}</div></div>;
                })}
              </div>
            </div>

            <div className="card">
              <div className="row space center"><h2 style={{marginTop:0}}>Procedimentos com melhor margem</h2><button className="btn ghost" type="button" onClick={() => setTab("procedimentos")}>Ver tudo</button></div>
              <div className="list">
                {!proceduresWithCost.length ? <div className="empty">Cadastre procedimentos para ver a margem.</div> : [...proceduresWithCost].sort((a,b)=>b.margin-a.margin).slice(0,5).map(proc => <div className="item" key={proc.id}><div className="item-title">{proc.name}</div><div className="item-sub">Preço: {brl(proc.price)} • Custo: {brl(proc.estimatedCost)} • Margem: {brl(proc.margin)}</div></div>)}
              </div>
            </div>
          </section>
        </>}

        {tab === "agenda" && <div className="grid">
          <section className="card" ref={bookingsFormRef}>
            <div className="row space center"><h2 style={{marginTop:0}}>{bookingForm.id ? "Editar agendamento" : "Novo agendamento"}</h2>{bookingForm.id ? <button className="btn ghost" type="button" onClick={resetBookingForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveBooking} className="grid">
              <div className="row"><div className="field"><label>Cliente</label><select value={bookingForm.client_id} onChange={e => setBookingForm(v => ({...v, client_id:e.target.value}))}><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="field"><label>Data e hora</label><input type="datetime-local" value={bookingForm.scheduled_at} onChange={e => setBookingForm(v => ({...v, scheduled_at:e.target.value}))} /></div></div>
              <div className="row"><div className="field"><label>Serviço combinado</label><input value={bookingForm.service_summary} onChange={e => setBookingForm(v => ({...v, service_summary:e.target.value}))} placeholder="Ex.: sobrancelha + henna" /></div><div className="field small"><label>Status</label><select value={bookingForm.status} onChange={e => setBookingForm(v => ({...v, status:e.target.value}))}><option value="agendado">Agendado</option><option value="confirmado">Confirmado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option></select></div></div>
              <div className="field"><label>Observações</label><textarea value={bookingForm.notes} onChange={e => setBookingForm(v => ({...v, notes:e.target.value}))} placeholder="Horário preferido, detalhes do serviço..." /></div>
              <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? "Salvando..." : bookingForm.id ? "Atualizar agendamento" : "Salvar agendamento"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Agenda</h2>
            <div className="list">
              {!bookings.length ? <div className="empty">Nenhum agendamento cadastrado.</div> : bookings.map(item => {
                const client = clients.find(c => c.id === item.client_id);
                return <div className="item" key={item.id}><div className="row space center"><div><div className="item-title">{client?.name || "Cliente"} — {dateTime(item.scheduled_at)}</div><div className="item-sub">{item.service_summary || "Sem procedimento informado"}</div><div className="item-sub">Status: {item.status}</div>{item.notes ? <div className="item-sub">{item.notes}</div> : null}</div><div className="row"><button className="btn ghost" type="button" onClick={() => editBooking(item)}>Editar</button><button className="btn ghost" type="button" onClick={() => fillFromBooking(item)}>Virar atendimento</button><button className="btn danger" type="button" onClick={() => askRemoveBooking(item.id)}>Excluir</button></div></div></div>;
              })}
            </div>
          </section>
        </div>}

        {tab === "atendimentos" && <div className="grid">
          <section className="card" ref={appointmentsFormRef}>
            <div className="row space center"><h2 style={{marginTop:0}}>{appointmentForm.id ? "Editar atendimento" : "Novo atendimento"}</h2>{appointmentForm.id ? <button className="btn ghost" type="button" onClick={resetAppointmentForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveAppointment} className="grid">
              <div className="row">
                <div className="field"><label>Cliente</label><select value={appointmentForm.client_id} onChange={e => setAppointmentForm(v => ({...v, client_id:e.target.value}))}><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="field"><label>Data e hora</label><input type="datetime-local" value={appointmentForm.attended_at} onChange={e => setAppointmentForm(v => ({...v, attended_at:e.target.value}))} /></div>
                <div className="field small"><label>Pagamento</label><select value={appointmentForm.payment_method} onChange={e => setAppointmentForm(v => ({...v, payment_method:e.target.value}))}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="fiado">Fiado</option></select></div>
                <div className="field small"><label>Desconto</label><input type="number" step="0.01" value={appointmentForm.discount} onChange={e => setAppointmentForm(v => ({...v, discount:e.target.value}))} /></div>
              </div>

              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Procedimentos realizados</h3><button className="btn ghost" type="button" onClick={() => setAppointmentForm(v => ({...v, procedures:[...v.procedures, {procedure_id:""}]}))}>+ Adicionar procedimento</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {appointmentForm.procedures.map((item, index) => <div className="row center" key={index}><div className="field"><label>Procedimento</label><select value={item.procedure_id} onChange={e => { const next=[...appointmentForm.procedures]; next[index].procedure_id=e.target.value; setAppointmentForm(v => ({...v, procedures: next})); }}><option value="">Selecione</option>{procedures.map(p => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}</select></div><button className="btn danger" type="button" onClick={() => { const next=appointmentForm.procedures.filter((_,i)=>i!==index); setAppointmentForm(v => ({...v, procedures: next.length?next:[{procedure_id:""}]})); }}>Remover</button></div>)}
                </div>
              </div>

              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Insumos extras usados</h3><button className="btn ghost" type="button" onClick={() => setAppointmentForm(v => ({...v, extra_supplies:[...v.extra_supplies, {supply_id:"", quantity_used:""}]}))}>+ Adicionar insumo</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {appointmentForm.extra_supplies.map((item, index) => <div className="row center" key={index}><div className="field"><label>Insumo</label><select value={item.supply_id} onChange={e => { const next=[...appointmentForm.extra_supplies]; next[index].supply_id=e.target.value; setAppointmentForm(v => ({...v, extra_supplies: next})); }}><option value="">Selecione</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name} — estoque {s.stock_quantity} {s.unit_label}</option>)}</select></div><div className="field small"><label>Qtd. usada</label><input type="number" step="0.01" value={item.quantity_used} onChange={e => { const next=[...appointmentForm.extra_supplies]; next[index].quantity_used=e.target.value; setAppointmentForm(v => ({...v, extra_supplies: next})); }}/></div><button className="btn danger" type="button" onClick={() => { const next=appointmentForm.extra_supplies.filter((_,i)=>i!==index); setAppointmentForm(v => ({...v, extra_supplies: next.length?next:[{supply_id:"", quantity_used:""}]})); }}>Remover</button></div>)}
                </div>
              </div>

              <div className="field"><label>Observações</label><textarea value={appointmentForm.notes} onChange={e => setAppointmentForm(v => ({...v, notes:e.target.value}))} placeholder="Ex.: retoque, observações da pele, etc." /></div>
              <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? "Salvando..." : appointmentForm.id ? "Atualizar atendimento" : "Salvar atendimento"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Histórico de atendimentos</h2>
            <div className="list">
              {!appointments.length ? <div className="empty">Nenhum atendimento lançado.</div> : appointments.map(item => {
                const client = clients.find(c => c.id === item.client_id);
                const procNames = (lastProcedureByAppointment.get(item.id) || []).join(", ");
                return <div className="item" key={item.id}><div className="row space center"><div><div className="item-title">{client?.name || "Cliente"} — {dateTime(item.attended_at)}</div><div className="item-sub">Procedimentos: {procNames || "-"}</div><div className="item-sub">Bruto: {brl(Number(item.gross_amount || 0))} • Gastos: {brl(Number(item.cost_amount || 0))} • Líquido: {brl(Number(item.net_amount || 0))}</div>{item.notes ? <div className="item-sub">{item.notes}</div> : null}</div><div className="row"><button className="btn ghost" type="button" onClick={() => editAppointment(item)}>Editar</button><button className="btn danger" type="button" onClick={() => askRemoveAppointment(item.id)}>Excluir</button></div></div></div>;
              })}
            </div>
          </section>
        </div>}

        {tab === "clientes" && <div className="grid">
          <section className="card" ref={clientsFormRef}>
            <div className="row space center"><h2 style={{marginTop:0}}>{clientForm.id ? "Editar cliente" : "Cadastrar cliente"}</h2>{clientForm.id ? <button className="btn ghost" type="button" onClick={resetClientForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveClient} className="grid">
              <div className="row"><div className="field"><label>Nome da cliente</label><input value={clientForm.name} onChange={e => setClientForm(v => ({...v, name:e.target.value}))} placeholder="Ex.: Maria Souza" /></div><div className="field"><label>Telefone / WhatsApp</label><input value={clientForm.phone} onChange={e => setClientForm(v => ({...v, phone:e.target.value}))} placeholder="(31) 99999-9999" /></div></div>
              <div className="field"><label>Observações</label><textarea value={clientForm.notes} onChange={e => setClientForm(v => ({...v, notes:e.target.value}))} placeholder="Ex.: alergias, preferências..." /></div>
              <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? "Salvando..." : clientForm.id ? "Atualizar cliente" : "Salvar cliente"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Lista de clientes</h2>
            <div className="list">
              {!clientsSummary.length ? <div className="empty">Nenhuma cliente cadastrada.</div> : clientsSummary.map(item => <div className="item" key={item.client.id}><div className="row space center"><div><div className="item-title">{item.client.name}</div><div className="item-sub">{item.client.phone || "Sem telefone"}</div><div className="item-sub">Último atendimento: {item.last ? date(item.last.attended_at) : "Nunca"}</div><div className="item-sub">Total faturado com ela: {brl(item.totalSpent)}</div></div><div className="row"><button className="btn ghost" type="button" onClick={() => editClient(item.client)}>Editar</button>{item.last && item.client.phone ? <a className="btn primary" target="_blank" rel="noreferrer" href={whatsappLink(item)}>WhatsApp</a> : null}<button className="btn danger" type="button" onClick={() => askRemoveItem("clients", item.client.id, "cliente")}>Excluir</button></div></div></div>)}
            </div>
          </section>
        </div>}

        {tab === "procedimentos" && <div className="grid">
          <section className="card" ref={proceduresFormRef}>
            <div className="row space center"><h2 style={{marginTop:0}}>{procedureForm.id ? "Editar procedimento" : "Cadastrar procedimento"}</h2>{procedureForm.id ? <button className="btn ghost" type="button" onClick={resetProcedureForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveProcedure} className="grid">
              <div className="row"><div className="field"><label>Nome do procedimento</label><input value={procedureForm.name} onChange={e => setProcedureForm(v => ({...v, name:e.target.value}))} placeholder="Ex.: Design de sobrancelha" /></div><div className="field small"><label>Valor cobrado</label><input type="number" step="0.01" value={procedureForm.price} onChange={e => setProcedureForm(v => ({...v, price:e.target.value}))} /></div></div>
              <div className="field"><label>Descrição</label><textarea value={procedureForm.description} onChange={e => setProcedureForm(v => ({...v, description:e.target.value}))} placeholder="Observações do procedimento" /></div>
              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Insumos padrão desse procedimento</h3><button className="btn ghost" type="button" onClick={() => setProcedureForm(v => ({...v, supplies:[...v.supplies, {supply_id:"", quantity_used:""}]}))}>+ Adicionar insumo</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {procedureForm.supplies.map((item, index) => <div className="row center" key={index}><div className="field"><label>Insumo</label><select value={item.supply_id} onChange={e => { const next=[...procedureForm.supplies]; next[index].supply_id=e.target.value; setProcedureForm(v => ({...v, supplies: next})); }}><option value="">Selecione</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name} — {brl(s.cost_per_unit)} por {s.unit_label}</option>)}</select></div><div className="field small"><label>Qtd. usada</label><input type="number" step="0.01" value={item.quantity_used} onChange={e => { const next=[...procedureForm.supplies]; next[index].quantity_used=e.target.value; setProcedureForm(v => ({...v, supplies: next})); }}/></div><button className="btn danger" type="button" onClick={() => { const next=procedureForm.supplies.filter((_,i)=>i!==index); setProcedureForm(v => ({...v, supplies: next.length?next:[{supply_id:"", quantity_used:""}]})); }}>Remover</button></div>)}
                </div>
              </div>
              <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? "Salvando..." : procedureForm.id ? "Atualizar procedimento" : "Salvar procedimento"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Procedimentos cadastrados</h2>
            <div className="list">
              {!proceduresWithCost.length ? <div className="empty">Nenhum procedimento cadastrado.</div> : proceduresWithCost.map(proc => <div className="item" key={proc.id}><div className="row space center"><div><div className="item-title">{proc.name} — {brl(proc.price)}</div><div className="item-sub">Custo estimado de insumos: {brl(proc.estimatedCost)}</div><div className="item-sub">Margem estimada: {brl(proc.margin)}</div>{proc.description ? <div className="item-sub">{proc.description}</div> : null}</div><div className="row"><button className="btn ghost" type="button" onClick={() => editProcedure(proc)}>Editar</button><button className="btn danger" type="button" onClick={() => askRemoveItem("procedures", proc.id, "procedimento")}>Excluir</button></div></div></div>)}
            </div>
          </section>
        </div>}

        {tab === "insumos" && <div className="grid">
          <section className="card" ref={suppliesFormRef}>
            <div className="row space center"><h2 style={{marginTop:0}}>{supplyForm.id ? "Editar insumo" : "Cadastrar insumo"}</h2>{supplyForm.id ? <button className="btn ghost" type="button" onClick={resetSupplyForm}>Cancelar edição</button> : null}</div>
            <form onSubmit={saveSupply} className="grid">
              <div className="row"><div className="field"><label>Nome do insumo</label><input value={supplyForm.name} onChange={e => setSupplyForm(v => ({...v, name:e.target.value}))} placeholder="Ex.: Espátula descartável" /></div><div className="field small"><label>Valor pago</label><input type="number" step="0.01" value={supplyForm.purchase_price} onChange={e => setSupplyForm(v => ({...v, purchase_price:e.target.value}))} /></div><div className="field small"><label>Qtd. na embalagem</label><input type="number" step="0.01" value={supplyForm.quantity_in_package} onChange={e => setSupplyForm(v => ({...v, quantity_in_package:e.target.value}))} /></div><div className="field small"><label>Unidade</label><input value={supplyForm.unit_label} onChange={e => setSupplyForm(v => ({...v, unit_label:e.target.value}))} /></div></div>
              <div className="row"><div className="field small"><label>Estoque atual</label><input type="number" step="0.01" value={supplyForm.stock_quantity} onChange={e => setSupplyForm(v => ({...v, stock_quantity:e.target.value}))} /></div><div className="field small"><label>Avisar quando chegar em</label><input type="number" step="0.01" value={supplyForm.low_stock_threshold} onChange={e => setSupplyForm(v => ({...v, low_stock_threshold:e.target.value}))} /></div></div>
              <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? "Salvando..." : supplyForm.id ? "Atualizar insumo" : "Salvar insumo"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Estoque e custo por unidade</h2>
            <div className="table"><table><thead><tr><th>Insumo</th><th>Custo por unidade</th><th>Estoque</th><th>Alerta</th><th></th></tr></thead><tbody>
              {!supplies.length ? <tr><td colSpan={5}><div className="empty">Nenhum insumo cadastrado.</div></td></tr> : supplies.map(s => <tr key={s.id}><td><div style={{fontWeight:700}}>{s.name}</div><div className="muted">Pago: {brl(s.purchase_price)} / {s.quantity_in_package} {s.unit_label}</div></td><td>{brl(s.cost_per_unit)}</td><td>{s.stock_quantity} {s.unit_label}</td><td>{s.low_stock_threshold} {s.unit_label}</td><td><div className="row"><button className="btn ghost" type="button" onClick={() => editSupply(s)}>Editar</button><button className="btn danger" type="button" onClick={() => askRemoveItem("supplies", s.id, "insumo")}>Excluir</button></div></td></tr>)}
            </tbody></table></div>
          </section>
        </div>}

        {tab === "configuracoes" && <div className="grid">
          <section className="card">
            <h2 style={{marginTop:0}}>Configurações gerais</h2>
            <form onSubmit={saveSettings} className="grid">
              <div className="row"><div className="field"><label>Nome do salão</label><input value={settingsForm.salon_name} onChange={e => setSettingsForm(v => ({...v, salon_name:e.target.value}))} /></div><div className="field small"><label>Dias para cliente sumida</label><input type="number" value={settingsForm.inactive_days_threshold} onChange={e => setSettingsForm(v => ({...v, inactive_days_threshold:Number(e.target.value || 30)}))} /></div></div>
              <div className="field"><label>Mensagem padrão do WhatsApp</label><textarea value={settingsForm.whatsapp_message_template} onChange={e => setSettingsForm(v => ({...v, whatsapp_message_template:e.target.value}))} /></div>
              <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar configurações"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Como instalar no iPhone</h2>
            <div className="list">
              <div className="item"><div className="item-title">1. Abra o site no Safari</div><div className="item-sub">Use o Safari para a instalação funcionar direito.</div></div>
              <div className="item"><div className="item-title">2. Toque em compartilhar</div><div className="item-sub">Depois toque em “Adicionar à Tela de Início”.</div></div>
              <div className="item"><div className="item-title">3. Abra como app</div><div className="item-sub">O sistema vai abrir com cara de aplicativo na tela inicial.</div></div>
            </div>
          </section>
        </div>}
      </div>
    </main>
  );
}
