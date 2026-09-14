export async function responseJson(response: Response) {
  try { return await response.json(); }
  catch { throw new Error(response.ok ? 'La respuesta no se pudo leer. Pulsa Actualizar para reintentar.' : `El servidor no pudo completar la operación (${response.status}). Pulsa Actualizar antes de repetir el cambio.`); }
}
