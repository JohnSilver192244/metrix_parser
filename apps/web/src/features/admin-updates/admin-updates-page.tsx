import React from "react";

import { UpdateActionCard } from "./update-action-card";
import { updateScenarios } from "./update-scenarios";

export function AdminUpdatesPage() {
  return (
    <section className="admin-shell" aria-labelledby="admin-updates-title">
      <section className="admin-hero">
        <div>
          <p className="admin-hero__eyebrow">metrixParser admin</p>
          <h1 id="admin-updates-title">Ручной запуск обновлений данных</h1>
        </div>
        <p className="admin-hero__body">
          Выберите нужный сценарий, задайте период там, где он нужен, и отправьте
          команду через backend API. Интерфейс разделяет сценарии, чтобы ими было
          удобно управлять по отдельности.
        </p>
      </section>

      <section className="admin-grid" aria-label="Сценарии обновления">
        {updateScenarios.map((scenario) => {
          return <UpdateActionCard key={scenario.operation} scenario={scenario} />;
        })}
      </section>
    </section>
  );
}
