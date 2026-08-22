# Top Priority 
- Export database.
- Import bank/account statement (format TBD — CSV, XML or other): user uploads a statement file; system detects entries already registered to avoid duplicates; new entries are created as `DRAFT` transactions for the user to review, categorize, and approve.
- Personal note field on transactions: separate from the statement/imported description (which stays as-is from the bank), a free-text field for the user's own explanation of what the expense was, to help them remember it later. - notes ja existe precisa expor para edição e visualização. Verificar onde ja é usado e remover uso e necessário.
- Tela mês:
  - saldo exibido na tela Mês no fim da tabela, deveria ser saldo em conta. For ex, tem entrada de 1000 e um deposito em caixinha de 500, então saldo em conta é 500. Dinheiro na caixinha não conta como despesa, mas ao mesmo tempo deve ser subtraído do saldo em conta corrente. O oposto para resgate de caixinha, irá aumentar o saldo em conta corrente. Transferêcia entre caixinhas ou entre contas não afeta o saldo total em contas.
  - Resumo fim da tabela poderia exibir: Receitas, Despesas, Resgates de Caixinha, Depósitos em Caixinha. Soma de todos é o saldo em conta corrente.
- Toggle on the transactions screen to switch the displayed text between the personal note and the real transaction description; when a transaction has no personal note, keep showing the normal description.
- Tela mes - Reservar cores ambar para caixinha (#a85c1a) e verde para income (#1f6f54). Substituir essas no seletor de cores de categoria.
- "Saldo indisponível" em todas as linhas da tela Mês.


# Docs

- diagrama com endpoints existentes, para que servem e onde são usados
- diagram das estrutura do backend - mermaid?

# Feature Ideas

- Generic `config` JSON field on `User` (instead of a dedicated settings table) to hold all user settings (e.g. `locale`, and whatever future Settings screen options get added), avoiding a new table per setting.
- tela Mês.
  - Icones com cores para representar as transações.

# Improvements
- run impeccable audit ou outra skill para fazer check geral
- Assessibility improv with lighthouse in chrome
- improve path for "/month/{year}/{month}" feels wrong, should be query param? 
- Tag de Depósito, Retirada e Transfeência parecem chamar muita atenção para as transações de caixinhas. Precisa delas?
- tela Mês. 
  - Botões de ação não tem cor de hover
  - Saldo da conta após aplicar lançamento (valor abaixo do valor da transação) - sem ação - #157
  - Filtros de subcategoria, caixinha, cartão de crédito e intervalo de datas — a API já suporta todos, o protótipo não desenha nenhum.
  - Ordenação por descrição com collation por locale: o Postgres ordena pela collation do banco, não pelo `pt-BR`, então descrições acentuadas caem fora da ordem que o usuário espera. Exige índice collation-aware ou coluna de ordenação normalizada.
  - Persistir filtros e ordenação na URL ou entre navegações de mês (hoje ambos resetam ao trocar de mês).
  - For the each row. I don't know if I like the Edit and Remove icon always visible for all rows. What options do we have?
  - Button Month/Year and Today on the top of the screen, don't look like a button, they need some color or border.

- Uniformizar todos os info box nas janelas de criar/editar/remover/etc - todos azuis
- Revisar todos os placeholder, sem padrão, numa mesma tela tem campos com e outros sem

  
- Remove hint de valor de todas as telas: "Aceita 1.234,56 e 1234.56."
- Todas as hints de campos ficam em tooltip ao inves de ficar abaixo do campo
- operação caixinha - transferir
  - quando valor acima do disponivel, erro aparece em 2 locais, capturar imagem para issue.
# Bugs

- 