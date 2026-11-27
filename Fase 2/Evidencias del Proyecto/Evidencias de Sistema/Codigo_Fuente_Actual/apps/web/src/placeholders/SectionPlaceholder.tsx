import "./SectionPlaceholder.css";

interface SectionPlaceholderProps {
  tipo: "usuarios" | "ayuda";
}

export function SectionPlaceholder({ tipo }: SectionPlaceholderProps) {
  const esUsuarios = tipo === "usuarios";
  return (
    <div className="section-placeholder">
      <article>
        <span aria-hidden="true">{esUsuarios ? "♙" : "?"}</span>
        <small>{esUsuarios ? "ADMINISTRACIÓN" : "SOPORTE"}</small>
        <h1>{esUsuarios ? "Usuarios y permisos" : "Centro de ayuda"}</h1>
        <p>{esUsuarios ? "Esta sección está contemplada para administrar integrantes, roles y permisos de la empresa." : "Esta sección reunirá preguntas frecuentes, guías de uso y canales de contacto de GovMarket."}</p>
        <div><strong>Sección demostrativa</strong><span>No requiere funciones adicionales para la versión actual del proyecto.</span></div>
      </article>
    </div>
  );
}
