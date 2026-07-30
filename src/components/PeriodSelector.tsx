import { useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodMode = "month" | "range";

interface PeriodSelectorProps {
  mode: PeriodMode;
  month: string;
  start: string;
  end: string;
  onModeChange: (mode: PeriodMode) => void;
  onMonthChange: (month: string) => void;
  onRangeChange: (start: string, end: string) => void;
}

export function PeriodSelector({ mode, month, start, end, onModeChange, onMonthChange, onRangeChange }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const monthDate = parseISO(`${month}-01`);
  const label = mode === "month"
    ? format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(parseISO(start), "dd/MM/yy")} – ${format(parseISO(end), "dd/MM/yy")}`;

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function moveMonth(amount: number) {
    onMonthChange(format(addMonths(monthDate, amount), "yyyy-MM"));
  }

  function selectPreset(days?: number) {
    const today = new Date();
    if (days) {
      const initial = new Date(today);
      initial.setDate(today.getDate() - days + 1);
      onRangeChange(format(initial, "yyyy-MM-dd"), format(today, "yyyy-MM-dd"));
      return;
    }
    onRangeChange(format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd"), format(today, "yyyy-MM-dd"));
  }

  return <div className="period-selector" ref={root}>
    <button className={`period-trigger ${open ? "active" : ""}`} onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="dialog">
      <span className="period-trigger-icon">{mode === "month" ? <CalendarDays size={18} /> : <CalendarRange size={18} />}</span>
      <span><small>Período</small><strong>{label}</strong></span>
      <ChevronDown className={open ? "rotate" : ""} size={16} />
    </button>
    {open && <div className="period-popover" role="dialog" aria-label="Selecionar período">
      <div className="period-popover-head"><div><strong>Selecionar período</strong><small>Escolha um mês ou intervalo personalizado.</small></div></div>
      <div className="period-mode-tabs">
        <button className={mode === "month" ? "active" : ""} onClick={() => onModeChange("month")}>Mês</button>
        <button className={mode === "range" ? "active" : ""} onClick={() => onModeChange("range")}>Intervalo</button>
      </div>
      {mode === "month" ? <div className="period-month-control">
        <button className="icon-btn" title="Mês anterior" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
        <label><span>Mês de referência</span><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
        <button className="icon-btn" title="Próximo mês" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
        <button className="period-today" onClick={() => onMonthChange(format(new Date(), "yyyy-MM"))}>Ir para este mês</button>
      </div> : <div className="period-range-control">
        <div className="period-date-grid">
          <label><span>Data inicial</span><input type="date" value={start} max={end} onChange={(event) => onRangeChange(event.target.value, event.target.value > end ? event.target.value : end)} /></label>
          <span>até</span>
          <label><span>Data final</span><input type="date" value={end} min={start} onChange={(event) => onRangeChange(event.target.value < start ? event.target.value : start, event.target.value)} /></label>
        </div>
        <div className="period-presets"><button onClick={() => selectPreset(7)}>7 dias</button><button onClick={() => selectPreset(30)}>30 dias</button><button onClick={() => selectPreset()}>Este mês</button></div>
      </div>}
    </div>}
  </div>;
}
