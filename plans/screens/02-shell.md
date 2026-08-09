# 02 — Shell (frame for every route)

**Ticket:** M3-T06

| Action | Result |
| --- | --- |
| Navigate | Route change; active item highlighted |
| Open menu (mobile) | Drawer; closes on selection |
| Logout | Clears the session, redirects to `/login` |

Navigation is split into everyday work (Mês, Caixinhas, Relatórios, Lançar por voz, Recorrências)
and a **Configurações** menu holding the two registries: Contas and Categorias. Caixinhas sits
second, directly below Mês, and Recorrências stays at the top level: both are visited while running
the month, not set up once. The user and the logout action sit at the foot of the sidebar; the top bar
belongs to the current task.
