// =====================================================================
// CONEXIÓN A FIREBASE FIRESTORE
// =====================================================================

// Importamos Firebase desde el CDN oficial para no depender de npm
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Datos del proyecto fitzone-gym-4197b en Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCyTbxaNq_dMEU-D6sKWRjHxLjjuLTKY6M",
    authDomain: "fitzone-gym-4197b.firebaseapp.com",
    projectId: "fitzone-gym-4197b",
    storageBucket: "fitzone-gym-4197b.firebasestorage.app",
    messagingSenderId: "79650504547",
    appId: "1:79650504547:web:f79af37631a48d0ea59d56",
    measurementId: "G-1XHXMMSQKS",
};

// Arrancamos la app de Firebase, conectamos Firestore y apuntamos a la colección "folios"
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const foliosRef = collection(db, "folios");

// =====================================================================
// PRECIOS DE PLANES Y EXTRAS
// =====================================================================

// Planes y pases disponibles
const PRECIOS_PLANES = {
    ninguno: { nombre: "Sin membresía (solo productos)", precio: 0 },
    semanal: { nombre: "Pase por 7 días", precio: 150 },
    mensual: { nombre: "Membresía Mensual", precio: 450 },
    anual: { nombre: "Membresía Anual", precio: 4200 },
};

// Suplementos y entrenador
const PRECIOS_EXTRAS = {
    proteina: { nombre: "Proteína Whey 2 lb", precio: 850 },
    creatina: { nombre: "Creatina Monohidratada", precio: 480 },
    entrenador: { nombre: "Entrenador Personalizado", precio: 800 },
};

// =====================================================================
// ELEMENTOS DEL DOM Y ESTADO
// =====================================================================

// Menú y navegación
const btnMenu = document.getElementById("btn-menu");
const menuPrincipal = document.getElementById("menu-principal");

// Formulario y controles de registro (registro.html)
const formRegistro = document.getElementById("form-registro");
const btnGenerar = document.getElementById("btn-generar");
const selectPlan = document.getElementById("plan");
const checkEstudiante = document.getElementById("estudiante");
const checkboxesExtras = document.querySelectorAll('input[name="extra"]');
const comprobante = document.getElementById("comprobante");

// Formulario y controles de consulta (consulta.html)
const formConsultar = document.getElementById("form-consultar");
const resultadoConsulta = document.getElementById("resultado-consulta");
const btnImprimirConsulta = document.getElementById("btn-imprimir-consulta");
const btnCancelarFolio = document.getElementById("btn-cancelar-folio");
const btnCerrarConsulta = document.getElementById("btn-cerrar-consulta");

// Guarda el ticket que se está viendo en consulta.html
let folioConsultadoActual = null;

// =====================================================================
// CÓDIGO DE BARRAS
// =====================================================================

// Pinta un código de barras CODE128 en el <svg> que le pasemos
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

// Abre o cierra el menú hamburguesa en celular
btnMenu?.addEventListener("click", () => {
    btnMenu.classList.toggle("activo");
    menuPrincipal?.classList.toggle("abierto");
});

// Cierra el menú en móvil al tocar un enlace
menuPrincipal?.querySelectorAll("a").forEach((enlace) => {
    enlace.addEventListener("click", () => {
        btnMenu?.classList.remove("activo");
        menuPrincipal.classList.remove("abierto");
    });
});

// Cambia el botón de generar ticket a verde al presionarlo
btnGenerar?.addEventListener("pointerdown", () => {
    btnGenerar.classList.add("btn-verde");
});

// Efecto verde al presionar botones con clase .btn
document.querySelectorAll(".btn").forEach((boton) => {
    boton.addEventListener("pointerdown", () => {
        boton.classList.add("btn-verde");
    });
});

// =====================================================================
// VALIDACIÓN DE CAMPOS
// =====================================================================

// Busca o crea el <span> de mensaje debajo del campo
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

// Colorea el label (azul si está bien, rojo si está mal) y muestra el mensaje
function marcarCampo(input, esValido, mensajeTexto = "") {
    const label = document.querySelector(`label[for="${input.id}"]`);
    const msg = obtenerElementoMensaje(input);

    if (label) {
        label.classList.remove("label-bien", "label-mal");
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

// Valida cada campo según su regla
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

// Validación en vivo al escribir o salir de cada input de registro
const camposRegistro = ["nombre", "telefono", "reg-usuario", "reg-clave"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

camposRegistro.forEach((input) => {
    input.addEventListener("input", () => validarCampo(input));
    input.addEventListener("blur", () => validarCampo(input));
});

// Validación en vivo para los inputs de consulta
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

// Formatea números en pesos mexicanos
function formatoMXN(cantidad) {
    return `$${cantidad.toLocaleString("es-MX")} MXN`;
}

// Suma plan + extras y aplica 20% de descuento al plan si es estudiante
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

// Recalcula cada vez que cambia el plan, extras o descuento estudiantil
[selectPlan, checkEstudiante, ...checkboxesExtras].forEach((el) => {
    el?.addEventListener("change", calcularTotales);
});

calcularTotales();

// =====================================================================
// GUARDAR, CONSULTAR Y CANCELAR TICKETS EN FIRESTORE
// =====================================================================

// Arma el siguiente folio tipo FZ-2026-001 según cuántos documentos hay en Firestore
async function generarCodigoFolio() {
    const snapshot = await getDocs(foliosRef);
    const anio = new Date().getFullYear();
    const consecutivo = String(snapshot.size + 1).padStart(3, "0");
    return `FZ-${anio}-${consecutivo}`;
}

// Al enviar el formulario: valida, pregunta si está seguro de comprar, guarda y muestra el ticket
formRegistro?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Revisa que todos los campos estén correctos antes de preguntar o guardar
    const todoBien = camposRegistro.map((input) => validarCampo(input)).every(Boolean);
    if (!todoBien) {
        const primerError = camposRegistro.find((input) => !validarCampo(input));
        primerError?.focus();
        return;
    }

    const nombre = document.getElementById("nombre").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const usuario = document.getElementById("reg-usuario").value.trim().toLowerCase();
    const clave = document.getElementById("reg-clave").value;
    const { planSeleccionado, total } = calcularTotales();

    const extrasSeleccionados = Array.from(checkboxesExtras)
        .filter((chk) => chk.checked && PRECIOS_EXTRAS[chk.value])
        .map((chk) => PRECIOS_EXTRAS[chk.value].nombre);

    const textoPlan = `${planSeleccionado.nombre} (${formatoMXN(planSeleccionado.precio)})`;
    const textoExtras = extrasSeleccionados.length ? extrasSeleccionados.join(", ") : "Ninguno";
    const textoTotal = formatoMXN(total);

    // Mensaje de confirmación una vez que los datos ya pasaron la validación
    const seguroCompra = window.confirm(
        `¿Estás seguro de hacer la compra?\n\n` +
        `Cliente: ${nombre}\n` +
        `Plan: ${textoPlan}\n` +
        `Extras: ${textoExtras}\n` +
        `Total a pagar en efectivo: ${textoTotal}`
    );

    if (!seguroCompra) {
        return;
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
        total: textoTotal,
        estado: "Pendiente de pago en efectivo",
    };

    // Guarda en Firestore
    await addDoc(foliosRef, nuevoFolio);

    // Llena el ticket en pantalla y dibuja su código de barras
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

// Busca el ticket en Firestore por usuario y contraseña
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
        return;
    }

    const primerDoc = snapshot.docs[0];
    const encontrado = { id: primerDoc.id, ...primerDoc.data() };

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

    resultadoConsulta?.classList.remove("oculto");
    resultadoConsulta?.scrollIntoView({ behavior: "smooth" });
});

// Imprime el ticket consultado
btnImprimirConsulta?.addEventListener("click", () => {
    if (!folioConsultadoActual) return;
    window.print();
});

// Marca el ticket como "Cancelado" en Firestore
btnCancelarFolio?.addEventListener("click", async () => {
    if (!folioConsultadoActual?.id) return;

    const docRef = doc(db, "folios", folioConsultadoActual.id);
    await updateDoc(docRef, { estado: "Cancelado" });
    folioConsultadoActual.estado = "Cancelado";

    const elEstado = document.getElementById("cons-estado");
    elEstado.textContent = "Cancelado";
    elEstado.style.color = "#991b1b";
    elEstado.style.fontWeight = "bold";

    if (btnCancelarFolio) {
        btnCancelarFolio.disabled = true;
    }
});

// Limpia y oculta el resultado de consulta
btnCerrarConsulta?.addEventListener("click", () => {
    resultadoConsulta?.classList.add("oculto");
    folioConsultadoActual = null;
    formConsultar?.reset();

    camposConsulta.forEach((input) => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const msg = obtenerElementoMensaje(input);
        label?.classList.remove("label-bien", "label-mal");
        if (msg) {
            msg.textContent = "";
            msg.classList.remove("ok", "error");
        }
    });
});