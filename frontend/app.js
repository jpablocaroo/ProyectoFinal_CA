const ZONA = "America/Bogota";
const OPCIONES_HORAS = [6, 12, 24, 48];
const estado = { horas: 12 };


const aFecha = (t) => new Date(/Z|[+-]\d\d:?\d\d$/.test(t) ? t : t + "Z");

const fmtCorto = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtHora = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
const fmtLargo = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtNum = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

const num = (v) => (v == null || Number.isNaN(Number(v))) ? "–" : fmtNum.format(Number(v));
const $ = (id) => document.getElementById(id);

function setEstado(tipo, texto) {
    $("estado").dataset.s = tipo;
    $("estadoTexto").textContent = texto;
}

function hace(fecha) {
    const min = Math.round((Date.now() - fecha.getTime()) / 60000);
    if (min < 1) return "justo ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} días`;
}

function pintarSegmentos() {
    $("segHoras").innerHTML = OPCIONES_HORAS.map(h =>
        `<button type="button" data-h="${h}" aria-pressed="${h === estado.horas}">${h} h</button>`).join("");
}
$("segHoras").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-h]");
    if (!b) return;
    estado.horas = Number(b.dataset.h);
    pintarSegmentos();
    cargar();
});
$("selHistoria").addEventListener("change", cargar);
$("selConfianza").addEventListener("change", cargar);
$("actualizar").addEventListener("click", cargar);
$("reintentar").addEventListener("click", cargar);

function textoError(detalle) {
    if (!detalle) return "La API no dio más detalles.";
    if (typeof detalle === "string") return detalle;
    if (Array.isArray(detalle)) return detalle.map(d => d.msg || JSON.stringify(d)).join(". ");
    return JSON.stringify(detalle);
}
function mostrarError(titulo, detalle) {
    $("errorTitulo").textContent = titulo;
    $("errorDetalle").textContent = detalle;
    $("error").classList.add("visible");
    setEstado("error", "Sin conexión con la API");
}
function ocultarError() { $("error").classList.remove("visible"); }

let grafico = null;
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) Chart.defaults.animation = false;

const marcaAhora = {
    id: "marcaAhora",
    afterDatasetsDraw(chart) {
        const i = chart.options.plugins.marcaAhora?.indice;
        if (i == null || i < 0) return;
        const { ctx, chartArea: a, scales: { x } } = chart;
        const px = x.getPixelForValue(i);
        ctx.save();
        ctx.strokeStyle = "#9aa9b6"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "#5d6e7e"; ctx.font = "12px Schibsted Grotesk, system-ui, sans-serif";
        ctx.textAlign = "right"; ctx.fillText("último dato real", px - 6, a.top + 12);
        ctx.restore();
    }
};

function dibujar(datos, confianza) {
    const hist = datos.historico || [];
    const pred = datos.prediccion || [];
    const nH = hist.length;

    const etiquetas = [...hist.map(h => aFecha(h.tiempo)), ...pred.map(p => aFecha(p.tiempo))];
    const vacioH = new Array(Math.max(nH - 1, 0)).fill(null);
    const ultimo = nH ? hist[nH - 1].valor : null;


    const dHist = [...hist.map(h => h.valor), ...pred.map(() => null)];

    const dFore = [...vacioH, ...(nH ? [ultimo] : []), ...pred.map(p => p.prediccion)];
    const dInf = [...vacioH, ...(nH ? [ultimo] : []), ...pred.map(p => p.limite_inferior)];
    const dSup = [...vacioH, ...(nH ? [ultimo] : []), ...pred.map(p => p.limite_superior)];


    let iMax = -1, vMax = -Infinity;
    pred.forEach((p, k) => { if (p.prediccion > vMax) { vMax = p.prediccion; iMax = nH + k; } });
    const radios = dFore.map((_, i) => i === iMax ? 6 : 0);
    const colores = dFore.map((_, i) => i === iMax ? "#e8a317" : "#0b6e99");

    const datasets = [
        { label: "Límite inferior", data: dInf, borderWidth: 0, pointRadius: 0, fill: false, order: 4 },
        { label: `Intervalo de confianza ${Math.round(confianza * 100)} %`, data: dSup, borderWidth: 0, pointRadius: 0, backgroundColor: "rgba(11,110,153,.16)", fill: "-1", order: 3 },
        { label: "Pronóstico", data: dFore, borderColor: "#0b6e99", borderWidth: 2.5, pointRadius: radios, pointBackgroundColor: colores, pointBorderColor: "#fff", pointBorderWidth: 2, pointHoverRadius: 5, tension: .25, order: 1 },
        { label: "Histórico", data: dHist, borderColor: "#6b7f92", borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .25, order: 2 },
    ];

    const opciones = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
            x: {
                grid: { display: false }, ticks: {
                    maxRotation: 0, autoSkip: true, maxTicksLimit: 8, color: "#5d6e7e",
                    callback: (v) => fmtCorto.format(etiquetas[v])
                }
            },
            y: { grid: { color: "#e6ecf0" }, ticks: { color: "#5d6e7e", callback: (v) => fmtNum.format(v) } }
        },
        plugins: {
            marcaAhora: { indice: nH ? nH - 1 : -1 },
            legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, filter: (i) => i.text !== "Límite inferior" } },
            tooltip: {
                filter: (c) => c.dataset.label !== "Límite inferior" && c.parsed.y != null,
                callbacks: {
                    title: (items) => fmtLargo.format(etiquetas[items[0].dataIndex]),
                    label: (c) => {
                        if (c.dataset.label.startsWith("Intervalo")) {
                            const lo = c.chart.data.datasets[0].data[c.dataIndex];
                            return ` Intervalo: ${num(lo)} a ${num(c.parsed.y)}`;
                        }
                        return ` ${c.dataset.label}: ${num(c.parsed.y)}`;
                    }
                }
            }
        }
    };

    if (grafico) grafico.destroy();
    grafico = new Chart($("lienzo"), { type: "line", data: { labels: etiquetas, datasets }, options: opciones, plugins: [marcaAhora] });
}

function pintarIndicadores(datos) {
    const pred = datos.prediccion || [];
    const hist = datos.historico || [];
    const ultimo = hist.length ? hist[hist.length - 1] : null;

    if (pred.length) {
        const p0 = pred[0];
        $("kpiProxima").textContent = num(p0.prediccion);
        $("kpiProximaNota").textContent = `${fmtHora.format(aFecha(p0.tiempo))} · entre ${num(p0.limite_inferior)} y ${num(p0.limite_superior)}`;

        const pico = pred.reduce((m, p) => p.prediccion > m.prediccion ? p : m, pred[0]);
        $("kpiMax").textContent = num(pico.prediccion);
        $("kpiMaxNota").textContent = `a las ${fmtHora.format(aFecha(pico.tiempo))} (${fmtCorto.format(aFecha(pico.tiempo)).split(",")[0]})`;
    }

    if (ultimo) {
        const f = aFecha(ultimo.tiempo);
        $("kpiUltimo").textContent = num(ultimo.valor);
        $("kpiUltimoNota").textContent = `${fmtHora.format(f)} · ${hace(f)}`;
        if (pred.length && ultimo.valor) {
            const pct = (pred[0].prediccion - ultimo.valor) / Math.abs(ultimo.valor) * 100;
            const el = $("kpiCambio");
            el.textContent = `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %`;
            el.className = "valor " + (pct > 0 ? "sube" : pct < 0 ? "baja" : "");
        }
    }
}

function pintarTabla(pred) {
    $("filas").innerHTML = pred.map(p =>
        `<tr><td>${fmtLargo.format(aFecha(p.tiempo))}</td><td>${num(p.prediccion)}</td><td>${num(p.limite_inferior)}</td><td>${num(p.limite_superior)}</td></tr>`
    ).join("");
}

let peticion = 0;
async function cargar() {
    const id = ++peticion;
    const historia = $("selHistoria").value;
    const confianza = Number($("selConfianza").value);
    const url = `/api/prediccion?horas=${estado.horas}&historia=${historia}&confianza=${confianza}`;

    ocultarError();
    setEstado("carga", "Consultando la API…");
    $("grafica").classList.add("cargando");

    try {
        let respuesta;
        try { respuesta = await fetch(url); }
        catch { throw new Error("No hay respuesta del servidor. ¿Está corriendo la API?"); }

        let datos = null;
        try { datos = await respuesta.json(); } catch { /* respuesta sin JSON */ }

        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}: ${textoError(datos && datos.detail)}`);
        }
        if (!datos || !Array.isArray(datos.prediccion)) {
            throw new Error("La API respondió con un formato inesperado.");
        }
        if (id !== peticion) return; // llegó una respuesta más nueva

        dibujar(datos, confianza);
        pintarIndicadores(datos);
        pintarTabla(datos.prediccion);
        const f = datos.ultima_observacion ? aFecha(datos.ultima_observacion) : null;
        setEstado("ok", f ? `Último dato real: ${fmtLargo.format(f)} (hora de Colombia)` : "Datos actualizados");
    } catch (e) {
        if (id !== peticion) return;
        mostrarError("No se pudo obtener el pronóstico", e.message);
    } finally {
        if (id === peticion) $("grafica").classList.remove("cargando");
    }
}

pintarSegmentos();
cargar();