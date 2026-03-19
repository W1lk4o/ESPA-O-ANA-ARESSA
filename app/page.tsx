"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../lib/supabase";

type Client = { id: string; name: string; phone: string | null; notes: string | null; created_at: string };
type Supply = { id: string; name: string; purchase_price: number; quantity_in_package: number; unit_label: string; cost_per_unit: number; stock_quantity: number; low_stock_threshold: number; created_at: string };
type Procedure = { id: string; name: string; price: number; description: string | null; created_at: string };
type ProcedureSupply = { id: string; procedure_id: string; supply_id: string; quantity_used: number };
type Appointment = { id: string; client_id: string; attended_at: string; payment_method: string | null; discount: number; gross_amount: number; cost_amount: number; net_amount: number; notes: string | null; created_at: string };
type AppointmentProcedure = { id: string; appointment_id: string; procedure_id: string; price_charged: number };
type Settings = { id: string; salon_name: string; inactive_days_threshold: number; whatsapp_message_template: string };
type Tab = "dashboard"|"atendimentos"|"clientes"|"procedimentos"|"insumos"|"configuracoes";

const tabs: {key: Tab; label: string}[] = [
  { key: "dashboard", label: "Dashboard" },
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

export default function Page() {
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
  const [settings, setSettings] = useState<Settings | null>(null);

  const [clientForm, setClientForm] = useState({ name: "", phone: "", notes: "" });
  const [supplyForm, setSupplyForm] = useState({ name: "", purchase_price: "", quantity_in_package: "", unit_label: "un", stock_quantity: "", low_stock_threshold: "5" });
  const [procedureForm, setProcedureForm] = useState({ name: "", price: "", description: "", supplies: [{ supply_id: "", quantity_used: "" }] });
  const [settingsForm, setSettingsForm] = useState(defaultSettings);
  const [appointmentForm, setAppointmentForm] = useState({ client_id: "", attended_at: new Date().toISOString().slice(0,16), payment_method: "pix", discount: "0", notes: "", procedures: [{ procedure_id: "" }], extra_supplies: [{ supply_id: "", quantity_used: "" }] });

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true); setError("");
    try {
      const supabase = getSupabase();
      const [a,b,c,d,e,f,g] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("supplies").select("*").order("name"),
        supabase.from("procedures").select("*").order("name"),
        supabase.from("procedure_supplies").select("*"),
        supabase.from("appointments").select("*").order("attended_at", {ascending:false}),
        supabase.from("appointment_procedures").select("*"),
        supabase.from("settings").select("*").limit(1).maybeSingle()
      ]);
      const err = a.error || b.error || c.error || d.error || e.error || f.error || g.error;
      if (err) throw err;
      setClients(a.data || []); setSupplies(b.data || []); setProcedures(c.data || []); setProcedureSupplies(d.data || []); setAppointments(e.data || []); setAppointmentProcedures(f.data || []); setSettings(g.data || null);
      setSettingsForm({
        salon_name: g.data?.salon_name || defaultSettings.salon_name,
        inactive_days_threshold: g.data?.inactive_days_threshold || defaultSettings.inactive_days_threshold,
        whatsapp_message_template: g.data?.whatsapp_message_template || defaultSettings.whatsapp_message_template
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

  function clearFlags(){ setError(""); setOk(""); }

  async function saveClient(e: React.FormEvent){
    e.preventDefault(); clearFlags();
    if (!clientForm.name.trim()) return setError("Preencha o nome da cliente.");
    try {
      setBusy(true);
      const supabase = getSupabase();
      const { error } = await supabase.from("clients").insert({ name: clientForm.name.trim(), phone: clientForm.phone.trim() || null, notes: clientForm.notes.trim() || null });
      if (error) throw error;
      setClientForm({ name: "", phone: "", notes: "" });
      setOk("Cliente cadastrada.");
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
      const { error } = await supabase.from("supplies").insert({
        name: supplyForm.name.trim(), purchase_price: purchase, quantity_in_package: qty, unit_label: supplyForm.unit_label || "un",
        cost_per_unit: purchase / qty, stock_quantity: Number(supplyForm.stock_quantity || 0), low_stock_threshold: Number(supplyForm.low_stock_threshold || 0)
      });
      if (error) throw error;
      setSupplyForm({ name: "", purchase_price: "", quantity_in_package: "", unit_label: "un", stock_quantity: "", low_stock_threshold: "5" });
      setOk("Insumo cadastrado.");
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
      const { data, error } = await supabase.from("procedures").insert({ name: procedureForm.name.trim(), price, description: procedureForm.description.trim() || null }).select("*").single();
      if (error) throw error;
      const links = procedureForm.supplies.filter(x => x.supply_id && Number(x.quantity_used) > 0).map(x => ({ procedure_id: data.id, supply_id: x.supply_id, quantity_used: Number(x.quantity_used) }));
      if (links.length) {
        const res = await supabase.from("procedure_supplies").insert(links);
        if (res.error) throw res.error;
      }
      setProcedureForm({ name: "", price: "", description: "", supplies: [{ supply_id: "", quantity_used: "" }] });
      setOk("Procedimento cadastrado.");
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
    const selectedProcedures = procedures.filter(p => selectedIds.includes(p.id));
    const gross = selectedProcedures.reduce((s,p)=>s+Number(p.price||0),0);
    const grouped = new Map<string, number>();
    for (const procId of selectedIds) {
      for (const link of procedureSupplies.filter(x => x.procedure_id === procId)) {
        grouped.set(link.supply_id, (grouped.get(link.supply_id) || 0) + Number(link.quantity_used));
      }
    }
    for (const extra of appointmentForm.extra_supplies) {
      if (extra.supply_id && Number(extra.quantity_used) > 0) grouped.set(extra.supply_id, (grouped.get(extra.supply_id) || 0) + Number(extra.quantity_used));
    }
    const usage = Array.from(grouped.entries()).map(([supply_id, quantity_used]) => {
      const supply = supplies.find(s => s.id === supply_id);
      return { supply_id, quantity_used, unit_cost: Number(supply?.cost_per_unit || 0), total_cost: Number(supply?.cost_per_unit || 0) * quantity_used, stock: Number(supply?.stock_quantity || 0), name: supply?.name || "Insumo" };
    });
    for (const item of usage) if (item.stock < item.quantity_used) return setError(`Estoque insuficiente para ${item.name}.`);
    const cost = usage.reduce((s,u)=>s+u.total_cost,0); const discount = Number(appointmentForm.discount||0); const net = gross - discount - cost;
    try {
      setBusy(true);
      const supabase = getSupabase();
      const ap = await supabase.from("appointments").insert({ client_id: appointmentForm.client_id, attended_at: new Date(appointmentForm.attended_at).toISOString(), payment_method: appointmentForm.payment_method, discount, gross_amount: gross, cost_amount: cost, net_amount: net, notes: appointmentForm.notes || null }).select("*").single();
      if (ap.error) throw ap.error;
      const rowsProc = selectedProcedures.map(p => ({ appointment_id: ap.data.id, procedure_id: p.id, price_charged: p.price }));
      const rowsSup = usage.map(u => ({ appointment_id: ap.data.id, supply_id: u.supply_id, quantity_used: u.quantity_used, unit_cost: u.unit_cost, total_cost: u.total_cost }));
      const rp = await supabase.from("appointment_procedures").insert(rowsProc); if (rp.error) throw rp.error;
      if (rowsSup.length) { const rs = await supabase.from("appointment_supplies").insert(rowsSup); if (rs.error) throw rs.error; }
      for (const u of usage) {
        const current = supplies.find(s => s.id === u.supply_id);
        const update = await supabase.from("supplies").update({ stock_quantity: Number(current?.stock_quantity || 0) - u.quantity_used }).eq("id", u.supply_id);
        if (update.error) throw update.error;
      }
      setAppointmentForm({ client_id: "", attended_at: new Date().toISOString().slice(0,16), payment_method: "pix", discount: "0", notes: "", procedures: [{ procedure_id: "" }], extra_supplies: [{ supply_id: "", quantity_used: "" }] });
      setOk("Atendimento salvo.");
      await loadAll(); setTab("dashboard");
    } catch (e:any) { setError(e?.message || "Erro ao salvar atendimento."); } finally { setBusy(false); }
  }

  async function removeItem(table: string, id: string, label: string) {
    if (!confirm(`Excluir ${label}?`)) return;
    clearFlags();
    try {
      setBusy(true);
      const supabase = getSupabase();
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      setOk(`${label} excluído.`);
      await loadAll();
    } catch (e:any) { setError(e?.message || `Erro ao excluir ${label}.`); } finally { setBusy(false); }
  }

  function whatsappLink(item: {client: Client; lastProcedure: string}) {
    const phone = onlyDigits(item.client.phone);
    if (!phone) return "#";
    const text = (settingsForm.whatsapp_message_template || defaultSettings.whatsapp_message_template)
      .split("{nome}").join(item.client.name)
      .split("{procedimento}").join(item.lastProcedure || "atendimento");
    return `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
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
              <p>Sistema simples, rápido e funcional para controlar clientes, insumos, procedimentos e lucro real.</p>
            </div>
            <div className="badge">{appointments.length} atendimentos lançados</div>
          </div>
          <div className="grid stats">
            <div className="card"><div className="label">Bruto no mês</div><div className="big">{brl(grossMonth)}</div><div className="help">{monthApps.length} atendimentos</div></div>
            <div className="card"><div className="label">Gastos no mês</div><div className="big">{brl(costMonth)}</div><div className="help">Custo dos materiais</div></div>
            <div className="card"><div className="label">Líquido no mês</div><div className="big">{brl(netMonth)}</div><div className="help">Bruto - desconto - insumos</div></div>
            <div className="card"><div className="label">Alertas de estoque</div><div className="big">{lowStock.length}</div><div className="help">Itens no limite</div></div>
          </div>
          {error ? <div className="notice err">{error}</div> : null}
          {ok ? <div className="notice ok">{ok}</div> : null}
        </section>

        {tab === "dashboard" && <div className="grid">
          <section className="card">
            <div className="row space center"><h2 style={{margin:0}}>Alerta de insumos acabando</h2>{lowStock.length ? <span className="badge danger">{lowStock.length} itens</span> : <span className="badge ok">Tudo em ordem</span>}</div>
            <div className="list" style={{marginTop:12}}>
              {!lowStock.length ? <div className="empty">Nenhum item abaixo do limite configurado.</div> : lowStock.map(item => <div className="item" key={item.id}><div className="row space center"><div><div className="item-title">{item.name}</div><div className="item-sub">Estoque atual: {item.stock_quantity} {item.unit_label} • Avisar ao chegar em {item.low_stock_threshold} {item.unit_label}</div></div><span className="badge danger">Repor</span></div></div>)}
            </div>
          </section>

          <section className="grid split">
            <div className="card">
              <div className="row space center"><h2 style={{margin:0}}>Últimos 7 dias</h2><span className="badge">Bruto x líquido</span></div>
              <div className="chart">
                {chartRows.map(r => <div className="col" key={r.day}><div className="bars"><div className="bar gross" title={`Bruto ${brl(r.gross)}`} style={{height:`${(r.gross/chartMax)*190}px`}}/><div className="bar net" title={`Líquido ${brl(r.net)}`} style={{height:`${(r.net/chartMax)*190}px`}}/></div><div className="chart-label">{r.day}</div></div>)}
              </div>
            </div>
            <div className="card">
              <div className="row space center"><h2 style={{margin:0}}>Clientes sumidas</h2><span className="badge">{settingsForm.inactive_days_threshold} dias</span></div>
              <div className="list" style={{marginTop:12}}>
                {!dormantClients.length ? <div className="empty">Nenhuma cliente acima do prazo configurado.</div> : dormantClients.slice(0,5).map(item => <div className="item" key={item.client.id}><div className="item-title">{item.client.name}</div><div className="item-sub">Último atendimento: {date(item.last?.attended_at || "")}</div><div className="item-sub">Último procedimento: {item.lastProcedure || "Não encontrado"}</div><div className="row" style={{marginTop:10}}><a className="btn primary" target="_blank" rel="noreferrer" href={whatsappLink(item)}>Chamar no WhatsApp</a></div></div>)}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="row space center"><h2 style={{margin:0}}>Últimos atendimentos</h2><button className="btn primary" onClick={() => setTab("atendimentos")}>Novo atendimento</button></div>
            <div className="table">
              <table><thead><tr><th>Cliente</th><th>Data</th><th>Bruto</th><th>Gastos</th><th>Líquido</th></tr></thead><tbody>
                {!appointments.length ? <tr><td colSpan={5}><div className="empty">Nenhum atendimento lançado ainda.</div></td></tr> : appointments.slice(0,8).map(a => { const client = clients.find(c => c.id === a.client_id); return <tr key={a.id}><td>{client?.name || "Cliente"}</td><td>{dateTime(a.attended_at)}</td><td>{brl(a.gross_amount)}</td><td>{brl(a.cost_amount)}</td><td>{brl(a.net_amount)}</td></tr>; })}
              </tbody></table>
            </div>
          </section>
        </div>}

        {tab === "atendimentos" && <div className="grid">
          <section className="card">
            <div className="row space center"><h2 style={{margin:0}}>Lançar atendimento</h2><span className="badge">Calcula lucro real</span></div>
            <form onSubmit={saveAppointment} className="grid" style={{marginTop:12}}>
              <div className="row">
                <div className="field"><label>Cliente</label><select value={appointmentForm.client_id} onChange={e => setAppointmentForm(v => ({...v, client_id: e.target.value}))}><option value="">Selecione</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="field"><label>Data e hora</label><input type="datetime-local" value={appointmentForm.attended_at} onChange={e => setAppointmentForm(v => ({...v, attended_at: e.target.value}))}/></div>
                <div className="field"><label>Pagamento</label><select value={appointmentForm.payment_method} onChange={e => setAppointmentForm(v => ({...v, payment_method: e.target.value}))}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option></select></div>
                <div className="field small"><label>Desconto</label><input type="number" step="0.01" value={appointmentForm.discount} onChange={e => setAppointmentForm(v => ({...v, discount: e.target.value}))}/></div>
              </div>

              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Procedimentos realizados</h3><button className="btn ghost" type="button" onClick={() => setAppointmentForm(v => ({...v, procedures:[...v.procedures, {procedure_id:""}]}))}>+ Adicionar procedimento</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {appointmentForm.procedures.map((item, index) => <div className="row center" key={index}><div className="field"><label>Procedimento {index+1}</label><select value={item.procedure_id} onChange={e => { const next=[...appointmentForm.procedures]; next[index].procedure_id=e.target.value; setAppointmentForm(v => ({...v, procedures: next})); }}><option value="">Selecione</option>{procedures.map(p => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}</select></div><button type="button" className="btn danger" onClick={() => { const next=appointmentForm.procedures.filter((_,i)=>i!==index); setAppointmentForm(v => ({...v, procedures: next.length?next:[{procedure_id:""}]})); }}>Remover</button></div>)}
                </div>
              </div>

              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Insumos extras do atendimento</h3><button className="btn ghost" type="button" onClick={() => setAppointmentForm(v => ({...v, extra_supplies:[...v.extra_supplies, {supply_id:"", quantity_used:""}]}))}>+ Adicionar insumo</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {appointmentForm.extra_supplies.map((item, index) => <div className="row center" key={index}><div className="field"><label>Insumo</label><select value={item.supply_id} onChange={e => { const next=[...appointmentForm.extra_supplies]; next[index].supply_id=e.target.value; setAppointmentForm(v => ({...v, extra_supplies: next})); }}><option value="">Selecione</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name} — estoque {s.stock_quantity} {s.unit_label}</option>)}</select></div><div className="field small"><label>Qtd. usada</label><input type="number" step="0.01" value={item.quantity_used} onChange={e => { const next=[...appointmentForm.extra_supplies]; next[index].quantity_used=e.target.value; setAppointmentForm(v => ({...v, extra_supplies: next})); }}/></div><button type="button" className="btn danger" onClick={() => { const next=appointmentForm.extra_supplies.filter((_,i)=>i!==index); setAppointmentForm(v => ({...v, extra_supplies: next.length?next:[{supply_id:"", quantity_used:""}]})); }}>Remover</button></div>)}
                </div>
              </div>

              <div className="field"><label>Observações</label><textarea value={appointmentForm.notes} onChange={e => setAppointmentForm(v => ({...v, notes: e.target.value}))} placeholder="Ex.: cliente pediu retorno na próxima semana..." /></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : "Salvar atendimento"}</button><button className="btn" type="button" onClick={() => setTab("dashboard")}>Voltar</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Histórico de atendimentos</h2>
            <div className="table"><table><thead><tr><th>Cliente</th><th>Data</th><th>Procedimentos</th><th>Bruto</th><th>Gastos</th><th>Líquido</th></tr></thead><tbody>
              {!appointments.length ? <tr><td colSpan={6}><div className="empty">Nenhum atendimento encontrado.</div></td></tr> : appointments.map(a => { const client = clients.find(c => c.id === a.client_id); const names = (lastProcedureByAppointment.get(a.id) || []).join(", "); return <tr key={a.id}><td>{client?.name || "-"}</td><td>{dateTime(a.attended_at)}</td><td>{names || "-"}</td><td>{brl(a.gross_amount)}</td><td>{brl(a.cost_amount)}</td><td>{brl(a.net_amount)}</td></tr>; })}
            </tbody></table></div>
          </section>
        </div>}

        {tab === "clientes" && <div className="grid">
          <section className="card">
            <h2 style={{marginTop:0}}>Cadastrar cliente</h2>
            <form onSubmit={saveClient} className="grid">
              <div className="row"><div className="field"><label>Nome</label><input value={clientForm.name} onChange={e => setClientForm(v => ({...v, name:e.target.value}))} placeholder="Nome da cliente" /></div><div className="field"><label>Telefone</label><input value={clientForm.phone} onChange={e => setClientForm(v => ({...v, phone:e.target.value}))} placeholder="(31) 99999-9999" /></div></div>
              <div className="field"><label>Observações</label><textarea value={clientForm.notes} onChange={e => setClientForm(v => ({...v, notes:e.target.value}))} placeholder="Ex.: alergias, preferências..." /></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : "Salvar cliente"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Lista de clientes</h2>
            <div className="list">
              {!clientsSummary.length ? <div className="empty">Nenhuma cliente cadastrada.</div> : clientsSummary.map(item => <div className="item" key={item.client.id}><div className="row space center"><div><div className="item-title">{item.client.name}</div><div className="item-sub">{item.client.phone || "Sem telefone"}</div><div className="item-sub">Último atendimento: {item.last ? date(item.last.attended_at) : "Nunca"}</div><div className="item-sub">Total faturado com ela: {brl(item.totalSpent)}</div></div><div className="row">{item.last && item.client.phone ? <a className="btn primary" target="_blank" rel="noreferrer" href={whatsappLink(item)}>WhatsApp</a> : null}<button className="btn danger" type="button" onClick={() => removeItem("clients", item.client.id, "cliente")}>Excluir</button></div></div></div>)}
            </div>
          </section>
        </div>}

        {tab === "procedimentos" && <div className="grid">
          <section className="card">
            <h2 style={{marginTop:0}}>Cadastrar procedimento</h2>
            <form onSubmit={saveProcedure} className="grid">
              <div className="row"><div className="field"><label>Nome do procedimento</label><input value={procedureForm.name} onChange={e => setProcedureForm(v => ({...v, name:e.target.value}))} placeholder="Ex.: Design de sobrancelha" /></div><div className="field small"><label>Valor cobrado</label><input type="number" step="0.01" value={procedureForm.price} onChange={e => setProcedureForm(v => ({...v, price:e.target.value}))} /></div></div>
              <div className="field"><label>Descrição</label><textarea value={procedureForm.description} onChange={e => setProcedureForm(v => ({...v, description:e.target.value}))} placeholder="Observações do procedimento" /></div>
              <div className="card" style={{padding:12}}>
                <div className="row space center"><h3 style={{margin:0}}>Insumos padrão desse procedimento</h3><button className="btn ghost" type="button" onClick={() => setProcedureForm(v => ({...v, supplies:[...v.supplies, {supply_id:"", quantity_used:""}]}))}>+ Adicionar insumo</button></div>
                <div className="grid" style={{marginTop:10}}>
                  {procedureForm.supplies.map((item, index) => <div className="row center" key={index}><div className="field"><label>Insumo</label><select value={item.supply_id} onChange={e => { const next=[...procedureForm.supplies]; next[index].supply_id=e.target.value; setProcedureForm(v => ({...v, supplies: next})); }}><option value="">Selecione</option>{supplies.map(s => <option key={s.id} value={s.id}>{s.name} — {brl(s.cost_per_unit)} por {s.unit_label}</option>)}</select></div><div className="field small"><label>Qtd. usada</label><input type="number" step="0.01" value={item.quantity_used} onChange={e => { const next=[...procedureForm.supplies]; next[index].quantity_used=e.target.value; setProcedureForm(v => ({...v, supplies: next})); }}/></div><button className="btn danger" type="button" onClick={() => { const next=procedureForm.supplies.filter((_,i)=>i!==index); setProcedureForm(v => ({...v, supplies: next.length?next:[{supply_id:"", quantity_used:""}]})); }}>Remover</button></div>)}
                </div>
              </div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : "Salvar procedimento"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Procedimentos cadastrados</h2>
            <div className="list">
              {!proceduresWithCost.length ? <div className="empty">Nenhum procedimento cadastrado.</div> : proceduresWithCost.map(proc => <div className="item" key={proc.id}><div className="row space center"><div><div className="item-title">{proc.name} — {brl(proc.price)}</div><div className="item-sub">Custo estimado de insumos: {brl(proc.estimatedCost)}</div><div className="item-sub">Margem estimada: {brl(proc.margin)}</div>{proc.description ? <div className="item-sub">{proc.description}</div> : null}</div><button className="btn danger" type="button" onClick={() => removeItem("procedures", proc.id, "procedimento")}>Excluir</button></div></div>)}
            </div>
          </section>
        </div>}

        {tab === "insumos" && <div className="grid">
          <section className="card">
            <h2 style={{marginTop:0}}>Cadastrar insumo</h2>
            <form onSubmit={saveSupply} className="grid">
              <div className="row"><div className="field"><label>Nome do insumo</label><input value={supplyForm.name} onChange={e => setSupplyForm(v => ({...v, name:e.target.value}))} placeholder="Ex.: Espátula descartável" /></div><div className="field small"><label>Valor pago</label><input type="number" step="0.01" value={supplyForm.purchase_price} onChange={e => setSupplyForm(v => ({...v, purchase_price:e.target.value}))} /></div><div className="field small"><label>Qtd. na embalagem</label><input type="number" step="0.01" value={supplyForm.quantity_in_package} onChange={e => setSupplyForm(v => ({...v, quantity_in_package:e.target.value}))} /></div><div className="field small"><label>Unidade</label><input value={supplyForm.unit_label} onChange={e => setSupplyForm(v => ({...v, unit_label:e.target.value}))} /></div></div>
              <div className="row"><div className="field small"><label>Estoque atual</label><input type="number" step="0.01" value={supplyForm.stock_quantity} onChange={e => setSupplyForm(v => ({...v, stock_quantity:e.target.value}))} /></div><div className="field small"><label>Avisar quando chegar em</label><input type="number" step="0.01" value={supplyForm.low_stock_threshold} onChange={e => setSupplyForm(v => ({...v, low_stock_threshold:e.target.value}))} /></div></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : "Salvar insumo"}</button></div>
            </form>
          </section>

          <section className="card">
            <h2 style={{marginTop:0}}>Estoque e custo por unidade</h2>
            <div className="table"><table><thead><tr><th>Insumo</th><th>Custo por unidade</th><th>Estoque</th><th>Alerta</th><th></th></tr></thead><tbody>
              {!supplies.length ? <tr><td colSpan={5}><div className="empty">Nenhum insumo cadastrado.</div></td></tr> : supplies.map(s => <tr key={s.id}><td><div style={{fontWeight:700}}>{s.name}</div><div className="muted">Pago: {brl(s.purchase_price)} / {s.quantity_in_package} {s.unit_label}</div></td><td>{brl(s.cost_per_unit)}</td><td>{s.stock_quantity} {s.unit_label}</td><td>{s.low_stock_threshold} {s.unit_label}</td><td><button className="btn danger" type="button" onClick={() => removeItem("supplies", s.id, "insumo")}>Excluir</button></td></tr>)}
            </tbody></table></div>
          </section>
        </div>}

        {tab === "configuracoes" && <div className="grid">
          <section className="card">
            <h2 style={{marginTop:0}}>Configurações gerais</h2>
            <form onSubmit={saveSettings} className="grid">
              <div className="row"><div className="field"><label>Nome do salão</label><input value={settingsForm.salon_name} onChange={e => setSettingsForm(v => ({...v, salon_name:e.target.value}))} /></div><div className="field small"><label>Dias para cliente sumida</label><input type="number" value={settingsForm.inactive_days_threshold} onChange={e => setSettingsForm(v => ({...v, inactive_days_threshold:Number(e.target.value || 30)}))} /></div></div>
              <div className="field"><label>Mensagem padrão do WhatsApp</label><textarea value={settingsForm.whatsapp_message_template} onChange={e => setSettingsForm(v => ({...v, whatsapp_message_template:e.target.value}))} /></div>
              <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Salvando..." : "Salvar configurações"}</button></div>
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
