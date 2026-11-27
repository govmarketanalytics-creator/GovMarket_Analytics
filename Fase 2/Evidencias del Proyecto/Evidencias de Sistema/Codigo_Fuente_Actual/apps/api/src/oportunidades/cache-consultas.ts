/** Cache acotada de trabajo, nunca de autorizacion. Une peticiones simultaneas.
 * Una carga fallida no se guarda. Cambiar la revision implica una clave nueva. */
export class CacheConsultas<T> {
  private entradas = new Map<string, { valor: T; vence: number; peso: number }>();
  private pendientes = new Map<string, Promise<T>>();
  constructor(private readonly maximo = 8, private readonly pesoMaximo = 8000) {}

  async obtener(clave: string, vence: number, cargar: () => Promise<T>, peso: (v: T) => number = () => 1): Promise<T> {
    const ahora = Date.now();
    for (const [k, v] of this.entradas) if (v.vence <= ahora) this.entradas.delete(k);
    const anterior = this.entradas.get(clave);
    if (anterior) {
      this.entradas.delete(clave);
      this.entradas.set(clave, anterior);
      return anterior.valor;
    }
    const pendiente = this.pendientes.get(clave);
    if (pendiente) return pendiente;
    const promesa = Promise.resolve().then(cargar).then((valor) => {
      const unidades = peso(valor);
      if (vence > Date.now() && unidades <= this.pesoMaximo) {
        this.entradas.set(clave, { valor, vence, peso: unidades });
        const suma = () => [...this.entradas.values()].reduce((n, e) => n + e.peso, 0);
        while (this.entradas.size > this.maximo || suma() > this.pesoMaximo) {
          this.entradas.delete(this.entradas.keys().next().value!);
        }
      }
      return valor;
    }).finally(() => { if (this.pendientes.get(clave) === promesa) this.pendientes.delete(clave); });
    // Si hay muchas claves distintas en curso no retenemos mas promesas.
    if (this.pendientes.size < this.maximo * 2) this.pendientes.set(clave, promesa);
    return promesa;
  }
}

export class MedicionOportunidades {
  private fases: Array<{ nombre: string; ms: number }> = [];
  async medir<T>(nombre: string, accion: () => Promise<T>): Promise<T> {
    const inicio = performance.now();
    try { return await accion(); }
    finally { this.fases.push({ nombre, ms: performance.now() - inicio }); }
  }
  cabecera(): string {
    return this.fases.map((v) => `${v.nombre};dur=${v.ms.toFixed(1)}`).join(', ');
  }
}
