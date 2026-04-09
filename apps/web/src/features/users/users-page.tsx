import React, { useEffect, useState } from "react";

import type { AppUser } from "@metrix-parser/shared-types";

import { PageHeader } from "../../shared/page-header";
import {
  listUsers,
  resolveUsersErrorMessage,
  resolveUsersTotal,
} from "../../shared/api/users";

type UsersPageState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      users: AppUser[];
      total: number;
    };

function formatCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function UsersPageView({ state }: { state: UsersPageState }) {
  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="users-page-title">
        <PageHeader
          titleId="users-page-title"
          title="Пользователи"
          description="Подтягиваем список логинов, которым разрешён административный доступ."
        />

        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Загружаем пользователей</h2>
          <p>Список формируется из таблицы app_public.app_users.</p>
        </section>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="users-page-title">
        <PageHeader
          titleId="users-page-title"
          title="Пользователи"
          description="Страница показывает только логины и дату создания, без отображения паролей."
        />

        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить список пользователей</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  const { users, total } = state;

  return (
    <section className="data-page-shell" aria-labelledby="users-page-title">
      <PageHeader
        titleId="users-page-title"
        title="Пользователи"
        description={
          total > 0
            ? `В системе настроено ${total} пользователя для входа в административные разделы.`
            : "Пользователи появятся здесь после ручного добавления записей в app_public.app_users."
        }
      />

      {users.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет пользователей</h2>
          <p>Добавьте логин и пароль вручную в app_public.app_users, затем обновите страницу.</p>
        </section>
      ) : (
        <section className="data-table-panel" aria-label="Пользователи приложения">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Логин</th>
                  <th scope="col">Создан</th>
                </tr>
              </thead>
              <tbody>
                {users.map((appUser) => (
                  <tr key={appUser.login}>
                    <td className="data-table__cell-primary">{appUser.login}</td>
                    <td>{formatCreatedAt(appUser.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

export function UsersPage() {
  const [state, setState] = useState<UsersPageState>({
    status: "loading",
  });

  useEffect(() => {
    let isActive = true;

    async function loadUsers() {
      try {
        const envelope = await listUsers();

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          users: envelope.data,
          total: resolveUsersTotal(envelope.data, envelope.meta),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: resolveUsersErrorMessage(error),
        });
      }
    }

    void loadUsers();

    return () => {
      isActive = false;
    };
  }, []);

  return <UsersPageView state={state} />;
}
