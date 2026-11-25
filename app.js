// =====================================================================
// CONEXIÓN A FIREBASE FIRESTORE
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCyTbxaNq_dMEU-D6sKWRjHxLjjuLTKY6M",
    authDomain: "fitzone-gym-4197b.firebaseapp.com",
    projectId: "fitzone-gym-4197b",
    storageBucket: "fitzone-gym-4197b.firebasestorage.app",
    messagingSenderId: "79650504547",
    appId: "1:79650504547:web:f79af37631a48d0ea59d56",
    measurementId: "G-1XHXMMSQKS",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const foliosRef = collection(db, "folios");

// =====================================================================
// PRECIOS DE PLANES, EXTRAS Y STOCK INICIAL (+30 PARA PRUEBAS)
// =====================================================================

const PRECIOS_PLANES = {
    ninguno: { nombre: "Sin membresía (solo productos)", precio: 0 },
    semanal: { nombre: "Pase por 7 días", precio: 150 },
    mensual: { nombre: "Membresía Mensual", precio: 450 },
    anual: { nombre: "Membresía Anual", precio: 4200 },
};

const PRECIOS_EXTRAS = {
    proteina: { nombre: "Proteína Whey 2 lb", precio: 850, stockInicial: 40 },
    creatina: { nombre: "Creatina Monohidratada", precio: 480, stockInicial: 45 },
    entrenador: { nombre: "Entrenador Personalizado", precio: 800, stockInicial: 38 },
};

// =====================================================================
// ELEMENTOS DEL DOM Y ESTADO
// =====================================================================

const btnMenu = document.getElementById("btn-menu");
const menuPrincipal = document.getElementById("menu-principal");

const formRegistro = document.getElementById("form-registro");
const btnGenerar = document.getElementById("btn-generar");
const selectPlan = document.getElementById("plan");
const checkEstudiante = document.getElementById("estudiante");
const checkboxesExtras = document.querySelectorAll('input[name="extra"]');
const comprobante = document.getElementById("comprobante");

const formConsultar = document.getElementById("form-consultar");
const resultadoConsulta = document.getElementById("resultado-consulta");
const btnImprimirConsulta = document.getElementById("btn-imprimir-consulta");
const btnCancelarFolio = document.getElementById("btn-cancelar-folio");
const btnCerrarConsulta = document.getElementById("btn-cerrar-consulta");

let folioConsultadoActual = null;
let stockActual = {};

// =====================================================================
// CÓDIGO DE BARRAS
// =====================================================================

function dibujarCodigoBarras(selectorId, valorCodigo) {
    const el = document.getElementById(selectorId);
    if (!el || typeof window.JsBarcode !== "function") return;

    window.JsBarcode(el, valorCodigo, {
        format: "CODE128",
        lineColor: "#111827",
        background: "#ffffff",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 8,
    });
}

// =====================================================================
// MENÚ MÓVIL Y ESTILO DE BOTONES
// =====================================================================

btnMenu?.addEventListener("click", () => {
    btnMenu.classList.toggle("activo");
    menuPrincipal?.classList.toggle("abierto");
});

menuPrincipal?.querySelectorAll("a").forEach((enlace) => {
    enlace.addEventListener("click", () => {
        btnMenu?.classList.remove("activo");
        menuPrincipal.classList.remove("abierto");
    });
});

btnGenerar?.addEventListener("pointerdown", () => {
    btnGenerar.classList.add("btn-verde");
});

document.querySelectorAll("button, .btn, .btn-primario").forEach((boton) => {
    boton.addEventListener("pointerdown", () => {
        boton.classList.add("presionado");
        boton.classList.add("btn-verde");
    });

    const quitarEstado = () => {
        boton.classList.remove("presionado");
    };

    boton.addEventListener("pointerup", quitarEstado);
    boton.addEventListener("pointercancel", quitarEstado);
    boton.addEventListener("mouseleave", quitarEstado);
});

// =====================================================================
// SELECCIÓN DIRECTA DESDE PRODUCTOS / PLANES A REGISTRO.HTML
// =====================================================================

document.querySelectorAll("[data-ir-plan], [data-ir-extra]").forEach((el) => {
    el.addEventListener("click", (e) => {
        if (el.tagName === "A") e.preventDefault();
        const plan = el.dataset.irPlan || "";
        const extra = el.dataset.irExtra || "";
        localStorage.setItem("fitzone_seleccion", JSON.stringify({ plan, extra }));
        window.location.href = "registro.html";
    });
});

function aplicarSeleccionGuardada() {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get("plan");
    const extraParam = params.get("extra");

    let guardada = null;
    try {
        guardada = JSON.parse(localStorage.getItem("fitzone_seleccion") || "null");
    } catch {
        guardada = null;
    }

    const planElegido = planParam || guardada?.plan || "";
    const extraElegido = extraParam || guardada?.extra || "";

    if (planElegido && selectPlan && PRECIOS_PLANES[planElegido]) {
        selectPlan.value = planElegido;
    }

    if (extraElegido && PRECIOS_EXTRAS[extraElegido]) {
        checkboxesExtras.forEach((chk) => {
            if (chk.value === extraElegido) {
                chk.checked = true;
            }
        });
    }

    if (guardada) {
        localStorage.removeItem("fitzone_seleccion");
    }
}

// =====================================================================
// INVENTARIO / STOCK EN FIRESTORE
// =====================================================================

async function cargarYMostrarStock() {
    const mapa = {};

    for (const [clave, info] of Object.entries(PRECIOS_EXTRAS)) {
        const ref = doc(db, "inventario", clave);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            await setDoc(ref, {
                nombre: info.nombre,
                stock: info.stockInicial,
                sumadoPrueba30: true,
            });
            mapa[clave] = info.stockInicial;
        } else {
            const data = snap.data();
            let cant = Number(data.stock ?? info.stockInicial);

            if (!data.sumadoPrueba30) {
                cant += 30;
                await updateDoc(ref, {
                    stock: cant,
                    sumadoPrueba30: true,
                });
            }
            mapa[clave] = cant;
        }
    }

    stockActual = mapa;

    document.querySelectorAll("[data-stock]").forEach((el) => {
        const clave = el.dataset.stock;
        const cant = stockActual[clave] ?? 0;
        el.textContent = cant > 0 ? `Stock disponible: ${cant}` : "Agotado";
        el.classList.toggle("agotado", cant <= 0);
    });

    checkboxesExtras.forEach((chk) => {
        const cant = stockActual[chk.value];
        if (typeof cant === "number") {
            chk.disabled = cant <= 0;
            const badge = document.getElementById(`stock-${chk.value}`);
            if (badge) {
                badge.textContent = cant > 0 ? ` (${cant} disp.)` : " (Agotado)";
            }
        }
    });
}

// =====================================================================
// VALIDACIÓN DE CAMPOS (VERDE SI BIEN, ROJO SI MAL)
// =====================================================================

function obtenerElementoMensaje(input) {
    const contenedorCampo = input.closest(".campo");
    if (!contenedorCampo) return null;

    let msg = contenedorCampo.querySelector(".mensaje-campo");
    if (!msg) {
        msg = document.createElement("span");
        msg.className = "mensaje-campo";
        contenedorCampo.appendChild(msg);
    }
    return msg;
}

function marcarCampo(input, esValido, mensajeTexto = "") {
    const label = document.querySelector(`label[for="${input.id}"]`);
    const msg = obtenerElementoMensaje(input);

    if (label) {
        label.classList.remove("label-bien", "label-mal", "label-error");
        label.classList.add(esValido ? "label-bien" : "label-mal");
    }

    if (msg) {
        msg.textContent = mensajeTexto;
        msg.classList.remove("ok", "error");
        if (mensajeTexto) {
            msg.classList.add(esValido ? "ok" : "error");
        }
    }
}

function validarCampo(input) {
    const valor = input.value.trim();

    if (input.id === "nombre") {
        if (valor.length < 3) {
            marcarCampo(input, false, "Mal: escribe tu nombre completo (mínimo 3 letras).");
            return false;
        }
        marcarCampo(input, true, "Bien: nombre completo válido.");
        return true;
    }

    if (input.id === "telefono") {
        const soloDigitos = valor.replace(/\D/g, "");
        if (soloDigitos.length !== 10) {
            marcarCampo(input, false, "Mal: ingresa un teléfono de 10 dígitos (ej. 4772345465).");
            return false;
        }
        marcarCampo(input, true, "Bien: teléfono de 10 dígitos correcto.");
        return true;
    }

    if (input.id === "reg-usuario") {
        if (valor.length < 4 || /\s/.test(valor)) {
            marcarCampo(input, false, "Mal: el usuario debe tener al menos 4 caracteres y sin espacios.");
            return false;
        }
        marcarCampo(input, true, "Bien: usuario válido.");
        return true;
    }

    if (input.id === "reg-clave") {
        if (input.value.length < 4) {
            marcarCampo(input, false, "Mal: la contraseña debe tener al menos 4 caracteres.");
            return false;
        }
        marcarCampo(input, true, "Bien: contraseña válida.");
        return true;
    }

    if (input.id === "consulta-usuario") {
        if (valor.length < 1) {
            marcarCampo(input, false, "Mal: ingresa tu usuario registrado.");
            return false;
        }
        marcarCampo(input, true, "Bien: usuario ingresado.");
        return true;
    }

    if (input.id === "consulta-clave") {
        if (input.value.length < 1) {
            marcarCampo(input, false, "Mal: ingresa tu contraseña.");
            return false;
        }
        marcarCampo(input, true, "Bien: contraseña ingresada.");
        return true;
    }

    return true;
}

const camposRegistro = ["nombre", "telefono", "reg-usuario", "reg-clave"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

camposRegistro.forEach((input) => {
    input.addEventListener("input", () => validarCampo(input));
    input.addEventListener("blur", () => validarCampo(input));
});

const camposConsulta = ["consulta-usuario", "consulta-clave"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

camposConsulta.forEach((input) => {
    input.addEventListener("input", () => validarCampo(input));
    input.addEventListener("blur", () => validarCampo(input));
});

// =====================================================================
// CÁLCULO DE TOTALES
// =====================================================================

function formatoMXN(cantidad) {
    return `$${cantidad.toLocaleString("es-MX")} MXN`;
}

function calcularTotales() {
    const planSeleccionado = PRECIOS_PLANES[selectPlan?.value] || PRECIOS_PLANES.ninguno;
    let totalExtras = 0;

    checkboxesExtras.forEach((chk) => {
        if (chk.checked && PRECIOS_EXTRAS[chk.value]) {
            totalExtras += PRECIOS_EXTRAS[chk.value].precio;
        }
    });

    const subtotal = planSeleccionado.precio + totalExtras;
    const descuento = checkEstudiante?.checked ? Math.round(planSeleccionado.precio * 0.2) : 0;
    const total = subtotal - descuento;

    const elSubtotal = document.getElementById("resumen-subtotal");
    const elDescuento = document.getElementById("resumen-descuento");
    const elTotal = document.getElementById("resumen-total");

    if (elSubtotal) elSubtotal.textContent = formatoMXN(subtotal);
    if (elDescuento) elDescuento.textContent = `-${formatoMXN(descuento)}`;
    if (elTotal) elTotal.textContent = formatoMXN(total);

    return { planSeleccionado, totalExtras, subtotal, descuento, total };
}

[selectPlan, checkEstudiante, ...checkboxesExtras].forEach((el) => {
    el?.addEventListener("change", calcularTotales);
});

aplicarSeleccionGuardada();
calcularTotales();
cargarYMostrarStock();

// =====================================================================
// GUARDAR, CONSULTAR, VER HISTORIAL Y CANCELAR TICKETS EN FIRESTORE
// =====================================================================

function renderizarHistorialUsuario(docsUsuario) {
    const tbody = document.getElementById("tabla-historial-usuario");
    if (!tbody) return;

    if (!docsUsuario || docsUsuario.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="fila-vacia">No hay compras ni movimientos registrados para este usuario.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = docsUsuario
        .map((item) => {
            const fechaTexto = item.fechaRegistro
                ? new Date(item.fechaRegistro).toLocaleDateString("es-MX")
                : "Registrado en sistema";
            const detalle = `${item.plan || "Sin plan"}${
                item.extras && item.extras !== "Ninguno" ? ` • Extras: ${item.extras}` : ""
            }`;
            const esCancelado = item.estado === "Cancelado";
            const claseEstado = esCancelado ? "estado vencida" : "estado vigente";

            return `
                <tr>
                    <td><strong>${item.folio || "Sin folio"}</strong><br><small>${fechaTexto}</small></td>
                    <td>${detalle}</td>
                    <td>${item.total || "$0 MXN"}</td>
                    <td><span class="${claseEstado}">${item.estado || "Activo"}</span></td>
                </tr>
            `;
        })
        .join("");
}

async function generarCodigoFolio() {
    const snapshot = await getDocs(foliosRef);
    const anio = new Date().getFullYear();
    const consecutivo = String(snapshot.size + 1).padStart(3, "0");
    return `FZ-${anio}-${consecutivo}`;
}

formRegistro?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const todoBien = camposRegistro.map((input) => validarCampo(input)).every(Boolean);
    if (!todoBien) {
        const primerError = camposRegistro.find((input) => !validarCampo(input));
        primerError?.focus();
        return;
    }

    const extrasClaves = Array.from(checkboxesExtras)
        .filter((chk) => chk.checked && PRECIOS_EXTRAS[chk.value])
        .map((chk) => chk.value);

    for (const claveExtra of extrasClaves) {
        const disponible = stockActual[claveExtra] ?? 0;
        if (disponible <= 0) {
            window.alert(`No hay stock disponible para: ${PRECIOS_EXTRAS[claveExtra].nombre}`);
            return;
        }
    }

    const nombre = document.getElementById("nombre").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const usuario = document.getElementById("reg-usuario").value.trim().toLowerCase();
    const clave = document.getElementById("reg-clave").value;
    const { planSeleccionado, total } = calcularTotales();

    const extrasSeleccionados = extrasClaves.map((clave) => PRECIOS_EXTRAS[clave].nombre);
    const textoPlan = `${planSeleccionado.nombre} (${formatoMXN(planSeleccionado.precio)})`;
    const textoExtras = extrasSeleccionados.length ? extrasSeleccionados.join(", ") : "Ninguno";
    const textoTotal = formatoMXN(total);

    const seguroCompra = window.confirm(
        `¿Estás seguro de hacer la compra?\n\n` +
        `Cliente: ${nombre}\n` +
        `Plan: ${textoPlan}\n` +
        `Extras: ${textoExtras}\n` +
        `Total a pagar en efectivo: ${textoTotal}\n\n` +
        `Nota: Las devoluciones NO están permitidas.`
    );

    if (!seguroCompra) {
        return;
    }

    if (extrasClaves.length > 0) {
        try {
            await runTransaction(db, async (transaction) => {
                const refsYDatos = [];
                for (const claveExtra of extrasClaves) {
                    const ref = doc(db, "inventario", claveExtra);
                    const snap = await transaction.get(ref);
                    const actual = snap.exists()
                        ? Number(snap.data().stock ?? 0)
                        : PRECIOS_EXTRAS[claveExtra].stockInicial;

                    if (actual <= 0) {
                        throw new Error(`Sin stock para ${PRECIOS_EXTRAS[claveExtra].nombre}`);
                    }
                    refsYDatos.push({ ref, nuevoStock: actual - 1 });
                }

                for (const item of refsYDatos) {
                    transaction.update(item.ref, { stock: item.nuevoStock });
                }
            });
        } catch (err) {
            window.alert(err.message || "No se pudo descontar el stock. Intenta de nuevo.");
            await cargarYMostrarStock();
            return;
        }
    }

    const codigoFolio = await generarCodigoFolio();

    const nuevoFolio = {
        folio: codigoFolio,
        nombre,
        telefono,
        usuario,
        clave,
        plan: textoPlan,
        extras: textoExtras,
        extrasClaves,
        total: textoTotal,
        estado: "Pendiente de pago en efectivo",
        fechaRegistro: new Date().toISOString(),
    };

    await addDoc(foliosRef, nuevoFolio);
    await cargarYMostrarStock();

    document.getElementById("cliente-folio").textContent = nombre;
    document.getElementById("folio-generado").textContent = nuevoFolio.folio;
    document.getElementById("ticket-usuario").textContent = usuario;
    document.getElementById("ticket-plan").textContent = nuevoFolio.plan;
    document.getElementById("ticket-extras").textContent = nuevoFolio.extras;
    document.getElementById("ticket-total").textContent = nuevoFolio.total;

    dibujarCodigoBarras("codigo-barras-ticket", nuevoFolio.folio);

    comprobante?.classList.remove("oculto");
    comprobante?.scrollIntoView({ behavior: "smooth" });
});

formConsultar?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const inputUsuario = document.getElementById("consulta-usuario");
    const inputClave = document.getElementById("consulta-clave");
    const usuario = inputUsuario.value.trim().toLowerCase();
    const clave = inputClave.value;

    const consulta = query(
        foliosRef,
        where("usuario", "==", usuario),
        where("clave", "==", clave)
    );
    const snapshot = await getDocs(consulta);

    if (snapshot.empty) {
        marcarCampo(inputUsuario, false, "Mal: verifica tu usuario.");
        marcarCampo(inputClave, false, "Mal: usuario o contraseña incorrectos.");
        resultadoConsulta?.classList.add("oculto");
        folioConsultadoActual = null;
        renderizarHistorialUsuario([]);
        return;
    }

    const todosLosFolios = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const encontrado = todosLosFolios[0];

    marcarCampo(inputUsuario, true, "Bien: usuario verificado.");
    marcarCampo(inputClave, true, "Bien: acceso correcto.");

    folioConsultadoActual = encontrado;

    document.getElementById("cons-folio").textContent = encontrado.folio;
    document.getElementById("cons-nombre").textContent = encontrado.nombre;
    document.getElementById("cons-plan").textContent = encontrado.plan;
    document.getElementById("cons-extras").textContent = encontrado.extras;
    document.getElementById("cons-total").textContent = encontrado.total;

    dibujarCodigoBarras("codigo-barras-consulta", encontrado.folio);

    const elEstado = document.getElementById("cons-estado");
    elEstado.textContent = encontrado.estado;
    elEstado.style.color = encontrado.estado === "Cancelado" ? "#991b1b" : "#166534";
    elEstado.style.fontWeight = "bold";

    if (btnCancelarFolio) {
        btnCancelarFolio.disabled = encontrado.estado === "Cancelado";
    }

    renderizarHistorialUsuario(todosLosFolios);

    resultadoConsulta?.classList.remove("oculto");
    resultadoConsulta?.scrollIntoView({ behavior: "smooth" });
});

btnImprimirConsulta?.addEventListener("click", () => {
    if (!folioConsultadoActual) return;
    window.print();
});

btnCancelarFolio?.addEventListener("click", async () => {
    if (!folioConsultadoActual?.id || folioConsultadoActual.estado === "Cancelado") return;

    const confirmarCancelacion = window.confirm(
        `Aviso: Las devoluciones NO están permitidas en FitZone Gym.\n\n` +
        `¿Deseas cancelar el folio ${folioConsultadoActual.folio}?`
    );

    if (!confirmarCancelacion) {
        return;
    }

    const docRef = doc(db, "folios", folioConsultadoActual.id);
    await updateDoc(docRef, { estado: "Cancelado" });

    if (Array.isArray(folioConsultadoActual.extrasClaves)) {
        for (const claveExtra of folioConsultadoActual.extrasClaves) {
            if (!PRECIOS_EXTRAS[claveExtra]) continue;
            const invRef = doc(db, "inventario", claveExtra);
            const snap = await getDoc(invRef);
            const actual = snap.exists() ? Number(snap.data().stock ?? 0) : 0;
            await updateDoc(invRef, { stock: actual + 1 });
        }
        await cargarYMostrarStock();
    }

    folioConsultadoActual.estado = "Cancelado";

    const elEstado = document.getElementById("cons-estado");
    elEstado.textContent = "Cancelado";
    elEstado.style.color = "#991b1b";
    elEstado.style.fontWeight = "bold";

    if (btnCancelarFolio) {
        btnCancelarFolio.disabled = true;
    }

    window.alert("Folio cancelado. Recuerda que en FitZone Gym no se realizan devoluciones.");
});

btnCerrarConsulta?.addEventListener("click", () => {
    resultadoConsulta?.classList.add("oculto");
    folioConsultadoActual = null;
    formConsultar?.reset();
    renderizarHistorialUsuario([]);

    camposConsulta.forEach((input) => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const msg = obtenerElementoMensaje(input);
        label?.classList.remove("label-bien", "label-mal", "label-error");
        if (msg) {
            msg.textContent = "";
            msg.classList.remove("ok", "error");
        }
    });
});
function parsearMontoMXN(textoTotal) {
    const limpio = String(textoTotal || "0").replace(/[^\d.-]/g, "");
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
}

function actualizarResumenGanancias(lista) {
    let pagado = 0;
    let pendiente = 0;
    let cancelado = 0;

    for (const f of lista) {
        const monto = parsearMontoMXN(f.total);
        const estado = String(f.estado || "").toLowerCase();

        if (estado === "cancelado") {
            cancelado += monto;
        } else if (estado.includes("pagado")) {
            pagado += monto;
        } else {
            pendiente += monto;
        }
    }

    const fmt = (n) => `$${n.toLocaleString("es-MX")} MXN`;
    const elPagado = document.getElementById("panel-ganancias-pagado");
    const elPendiente = document.getElementById("panel-ganancias-pendiente");
    const elCancelado = document.getElementById("panel-ganancias-cancelado");

    if (elPagado) elPagado.textContent = fmt(pagado);
    if (elPendiente) elPendiente.textContent = fmt(pendiente);
    if (elCancelado) elCancelado.textContent = fmt(cancelado);
}