let hubMutex = Promise.resolve();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withHubMutex(id, fn) {
  console.log(`[${id}] Esperando candado...`);
  
  const previous = hubMutex;
  let release;
  
  // Cerramos la puerta para la siguiente tarea que llegue
  hubMutex = new Promise((resolve) => {
    release = resolve;
  });

  // Nos formamos en la cadena de quien está ANTES que nosotros
  await previous;
  console.log(`[${id}] 🔑 Candado ADQUIRIDO.`);
  
  try {
    return await fn();
  } finally {
    console.log(`[${id}] 🔓 Tarea lista. Liberando candado.`);
    release(); // ¡Aquí sucede la magia que libera a la siguiente Promesa!
  }
}


// --- LÓGICA PRINCIPAL ---
console.log("--- INICIO ---"); // 1 

// TAREA ROJA: Pide la llave, simula trabajo lento (usa setTimeout)
withHubMutex("Rojo", async () => { // 2
  console.log("-> Rojo: Trabajando (usa Web APIs)...");
  await delay(0); 
  console.log("-> Rojo: Trabajo terminado.");
});

// TAREA AZUL: Entra al instante siguiente en el stack, pide la llave, 
// pero su 'previous' apunta a la Tarea Roja. ¡Se quedará paralizada!
withHubMutex("Azul", async () => { // 3
  console.log("-> Azul: Trabajando rapidísimo...");
});

console.log("--- AMBAS TAREAS REGISTRADAS ---");
