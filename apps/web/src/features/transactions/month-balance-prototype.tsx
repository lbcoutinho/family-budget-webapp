/* eslint-disable i18next/no-literal-string -- Throwaway prototype copy is intentionally fixed in pt-BR. */
import {
  ArrowDownLeftIcon,
  ArrowLeftRightIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  FilterIcon,
  LandmarkIcon,
  PiggyBankIcon,
  SearchIcon,
  WalletCardsIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PageContent, PageHeader } from '@/components/page-header';
import { PrototypeSwitcher } from '@/components/prototype-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCents } from '@/lib/money';

/** PROTOTYPE — Three Month compositions, switchable via `?variant=`, on the existing Month route. */
const VARIANTS = [
  { key: 'A', name: 'Fechamento no rodapé' },
  { key: 'B', name: 'Resumo antes da lista' },
  { key: 'C', name: 'Painel lateral' },
];

const STATES = [
  { key: 'full', label: 'Completo' },
  { key: 'filtered', label: 'Filtrado' },
  { key: 'empty', label: 'Mês vazio' },
];

type PrototypeState = 'full' | 'filtered' | 'empty';
type MoneyTone = 'income' | 'expense' | 'cashbox' | 'transfer';

interface Entry {
  day: string;
  description: string;
  detail: string;
  amount: number;
  tone: MoneyTone;
  draft?: boolean;
}

const ENTRIES: Entry[] = [
  { day: '31', description: 'Transferência para Revolut', detail: 'Millennium → Revolut', amount: 20000, tone: 'transfer' },
  { day: '29', description: 'Farmácia Central', detail: 'Saúde · Millennium', amount: -6500, tone: 'expense' },
  { day: '27', description: 'Levantamento da caixinha', detail: 'Emergências → Millennium', amount: 5000, tone: 'cashbox' },
  { day: '25', description: 'Supermercado Continente', detail: 'Alimentação · Revolut', amount: -23500, tone: 'expense' },
  { day: '22', description: 'Reserva para férias', detail: 'Millennium → Viagens', amount: -10000, tone: 'cashbox' },
  { day: '19', description: 'Energia e gás', detail: 'Casa · Millennium', amount: -11200, tone: 'expense' },
  { day: '16', description: 'Internet', detail: 'Casa · Revolut', amount: -4800, tone: 'expense' },
  { day: '14', description: 'Entre caixinhas', detail: 'Emergências → Viagens', amount: 3000, tone: 'transfer' },
  { day: '11', description: 'Restaurante', detail: 'Lazer · Revolut', amount: -9000, tone: 'expense' },
  { day: '08', description: 'Passe mensal', detail: 'Transporte · Millennium', amount: -4500, tone: 'expense' },
  { day: '05', description: 'Renda', detail: 'Casa · Millennium', amount: -30000, tone: 'expense' },
  { day: '03', description: 'Reserva de emergência', detail: 'Millennium → Emergências', amount: -5000, tone: 'cashbox' },
  { day: '01', description: 'Salário', detail: 'Receitas · Millennium', amount: 100000, tone: 'income' },
  { day: '01', description: 'Conta de água por confirmar', detail: 'Casa · Millennium · não entra nos totais', amount: -4200, tone: 'expense', draft: true },
];

const FILTERED_ENTRIES = ENTRIES.filter((entry) => entry.description.includes('Supermercado'));

const toneClasses: Record<MoneyTone, string> = {
  income: 'text-income',
  expense: 'text-destructive',
  cashbox: 'text-cashbox',
  transfer: 'text-transfer',
};

const strip = [8, 42, 18, 70, 28, 5, 55, 36, 82, 20, 62, 14, 48, 24, 94, 34, 58, 10, 76, 30, 66, 16, 88, 40, 72, 22, 52, 12, 64, 32, 46];

function StatePicker({ state }: { state: PrototypeState }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const select = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('state', next);
    void navigate({ search: params.toString() }, { replace: true });
  };

  return (
    <div className="flex rounded-md bg-muted p-[3px]" aria-label="Estado do protótipo">
      {STATES.map((option) => (
        <Button
          key={option.key}
          variant="ghost"
          size="sm"
          aria-pressed={state === option.key}
          className={state === option.key ? 'bg-card shadow-sm hover:bg-card' : ''}
          onClick={() => select(option.key)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function MonthStrip({ empty }: { empty: boolean }) {
  return (
    <section aria-labelledby="daily-strip-title" className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="daily-strip-title" className="text-sm font-semibold">
            Despesas por dia
          </h2>
          <p className="text-xs text-muted-foreground">Selecione um dia para filtrar os lançamentos</p>
        </div>
        <span className="num text-xs text-muted-foreground">Jul · 31 dias</span>
      </div>
      <div className="flex h-20 items-end gap-[3px]" aria-label={empty ? 'Nenhuma despesa em agosto' : 'Distribuição das despesas de julho'}>
        {strip.map((height, index) => (
          <span
            key={index}
            className={`min-w-0 flex-1 rounded-t-[3px] ${empty ? 'h-0.5 bg-border' : index % 5 === 0 ? 'bg-category-2' : index % 3 === 0 ? 'bg-category-3' : 'bg-category-1'}`}
            style={empty ? undefined : { height: `${height}%` }}
          />
        ))}
      </div>
    </section>
  );
}

function AssetCards({ empty, sidePanel = false }: { empty: boolean; sidePanel?: boolean }) {
  const cards = [
    { label: 'Millennium', value: 25000, icon: LandmarkIcon },
    { label: 'Revolut', value: 2000, icon: WalletCardsIcon },
    { label: 'Dinheiro · inativa', value: -7000, icon: WalletCardsIcon, inactive: true },
    { label: 'Caixinhas · 2', value: 185000, icon: PiggyBankIcon },
    { label: 'Patrimônio total', value: 205000, icon: CircleDollarSignIcon, total: true },
  ];

  return (
    <section
      aria-label={`Posição no fechamento de ${empty ? 'agosto' : 'julho'} de 2026`}
      className={`grid grid-cols-2 gap-2 ${sidePanel ? 'lg:grid-cols-1' : 'lg:grid-cols-5'}`}
    >
      {cards.map(({ label, value, icon: Icon, inactive, total }) => (
        <Card key={label} className={`gap-2 p-4 ${total ? 'border-foreground/20 bg-muted' : ''} ${inactive ? 'border-dashed' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className={`num font-display text-xl font-bold ${value < 0 ? 'text-destructive' : ''}`}>{formatCents(value)}</p>
        </Card>
      ))}
    </section>
  );
}

function Filters({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="relative min-w-52 flex-1 sm:max-w-72">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input readOnly value={filtered ? 'supermercado' : ''} placeholder="Buscar lançamentos" aria-label="Buscar lançamentos" className="pl-8" />
      </div>
      <Button variant="outline" size="sm">
        <FilterIcon />
        Filtros{filtered ? ' (2)' : ''}
      </Button>
      {filtered ? (
        <Badge variant="outline" className="border-transfer/30 bg-muted text-foreground">
          Alimentação · Revolut
        </Badge>
      ) : null}
    </div>
  );
}

function Entries({ state, footer }: { state: PrototypeState; footer?: ReactNode }) {
  const entries = state === 'filtered' ? FILTERED_ENTRIES : state === 'empty' ? [] : ENTRIES;

  return (
    <section aria-labelledby="prototype-entries" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="prototype-entries" className="text-sm font-semibold">
          Lançamentos
        </h2>
        <p className="num text-xs text-muted-foreground">
          {entries.length} exibidos{state === 'filtered' ? ' de 14' : ''}
        </p>
      </div>
      {entries.length ? (
        <div>
          {entries.map((entry, index) => (
            <article
              key={`${entry.day}-${entry.description}`}
              className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2.5 ${entry.draft ? 'bg-muted/60 opacity-70' : ''}`}
            >
              <span className="num text-xs text-muted-foreground">{entry.day}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{entry.description}</p>
                  {entry.draft ? (
                    <Badge variant="outline" className="border-dashed">
                      Rascunho
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">{entry.detail}</p>
              </div>
              <span className={`num text-sm font-semibold ${toneClasses[entry.tone]}`}>
                {entry.tone === 'transfer' ? formatCents(Math.abs(entry.amount)) : formatCents(entry.amount, { sign: true })}
              </span>
              {index === entries.length - 1 ? <span className="sr-only">Fim dos lançamentos</span> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-52 place-items-center px-6 text-center">
          <div>
            <CalendarDaysIcon className="mx-auto mb-3 size-7 text-muted-foreground" />
            <h3 className="text-base font-semibold">Nenhum lançamento em agosto</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">O mês está vazio, mas o saldo de julho continua disponível.</p>
          </div>
        </div>
      )}
      {footer}
    </section>
  );
}

function MovementSummary({ state, compact = false }: { state: PrototypeState; compact?: boolean }) {
  const filtered = state === 'filtered';
  const empty = state === 'empty';
  const values = empty ? [0, 0, 0, 0] : filtered ? [0, -23500, 0, 0] : [100000, -80000, -15000, 5000];
  const rows = [
    { label: 'Receitas', value: values[0] ?? 0, icon: ArrowDownLeftIcon, tone: 'text-income' },
    { label: 'Despesas', value: values[1] ?? 0, icon: ArrowUpRightIcon, tone: 'text-destructive' },
    { label: 'Depósitos em caixinhas', value: values[2] ?? 0, icon: PiggyBankIcon, tone: 'text-cashbox' },
    { label: 'Retiradas de caixinhas', value: values[3] ?? 0, icon: PiggyBankIcon, tone: 'text-cashbox' },
  ];

  return (
    <section aria-labelledby="movement-summary-title" className={compact ? '' : 'rounded-xl border bg-card p-4'}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="movement-summary-title" className="text-sm font-semibold">
            Movimentos {filtered ? 'filtrados' : 'do mês'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {filtered ? 'Só estes quatro valores seguem os filtros ativos.' : 'Transferências internas não alteram o saldo consolidado.'}
          </p>
        </div>
        {filtered ? <Badge variant="outline">2 filtros ativos</Badge> : null}
      </div>
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {rows.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            <span className={`num whitespace-nowrap font-semibold ${tone}`}>{formatCents(value, { sign: value !== 0 })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CloseSummary({ empty, equation = false }: { empty: boolean; equation?: boolean }) {
  const previous = empty ? 20000 : 10000;
  const close = 20000;

  return (
    <section aria-labelledby="close-summary-title" className={`border-foreground/15 ${equation ? 'rounded-xl border bg-muted p-4' : ''}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="close-summary-title" className="text-sm font-semibold">
            Fechamento mensal
          </h2>
          <p className="text-xs text-muted-foreground">Não muda com os filtros</p>
        </div>
        {empty ? <Badge variant="outline">Saldo carregado</Badge> : <CheckIcon className="size-4 text-muted-foreground" aria-label="Fechamento reconciliado" />}
      </div>
      <div className={`mt-3 grid gap-3 ${equation ? 'sm:grid-cols-[1fr_auto_1fr]' : ''}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Saldo anterior</span>
          <strong className="num">{formatCents(previous)}</strong>
        </div>
        {equation ? <ArrowLeftRightIcon className="hidden size-4 self-center text-muted-foreground sm:block" /> : null}
        <div className={`${equation ? '' : 'mt-2 border-t pt-2'} flex items-baseline justify-between gap-3`}>
          <span className="font-display text-base font-bold">Saldo</span>
          <strong className="num font-display text-xl">{formatCents(close)}</strong>
        </div>
      </div>
      {!empty && equation ? (
        <p className="num mt-3 border-t pt-3 text-center text-xs text-muted-foreground">100,00 € + 1.000,00 € − 800,00 € + 50,00 € − 150,00 € = 200,00 €</p>
      ) : null}
    </section>
  );
}

function VariantA({ state }: { state: PrototypeState }) {
  const empty = state === 'empty';
  return (
    <div className="space-y-4">
      <MonthStrip empty={empty} />
      <AssetCards empty={empty} />
      <Filters filtered={state === 'filtered'} />
      <Entries
        state={state}
        footer={
          <footer className="space-y-4 bg-muted/70 px-4 py-4">
            <MovementSummary state={state} compact />
            <div className="border-t border-foreground/15 pt-4">
              <CloseSummary empty={empty} />
            </div>
          </footer>
        }
      />
    </div>
  );
}

function VariantB({ state }: { state: PrototypeState }) {
  const empty = state === 'empty';
  return (
    <div className="space-y-4">
      <MonthStrip empty={empty} />
      <AssetCards empty={empty} />
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <CloseSummary empty={empty} equation />
        <MovementSummary state={state} />
      </div>
      <Filters filtered={state === 'filtered'} />
      <Entries state={state} />
    </div>
  );
}

function VariantC({ state }: { state: PrototypeState }) {
  const empty = state === 'empty';
  return (
    <div className="space-y-4">
      <MonthStrip empty={empty} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="order-3 space-y-3 lg:order-1">
          <Filters filtered={state === 'filtered'} />
          <Entries state={state} />
          <MovementSummary state={state} />
        </main>
        <aside className="order-2 space-y-3 lg:sticky lg:top-20 lg:order-2">
          <AssetCards empty={empty} sidePanel />
          <CloseSummary empty={empty} equation />
        </aside>
      </div>
    </div>
  );
}

export function MonthBalancePrototype({ variant }: { variant: string }) {
  const [searchParams] = useSearchParams();
  const stateParam = searchParams.get('state');
  const state: PrototypeState = stateParam === 'filtered' || stateParam === 'empty' ? stateParam : 'full';
  const current = VARIANTS.some((option) => option.key === variant) ? variant : 'A';
  const empty = state === 'empty';

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Mês anterior">
              <ChevronLeftIcon />
            </Button>
            <span className="min-w-36 text-center font-display text-headline font-bold capitalize">{empty ? 'agosto de 2026' : 'julho de 2026'}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Próximo mês">
              <ChevronRightIcon />
            </Button>
          </span>
        }
        actions={<StatePicker state={state} />}
      />
      <PageContent className="space-y-4 pb-24">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>Protótipo somente leitura · posição histórica e fechamento mensal</span>
          <Badge variant="outline">Variante {current}</Badge>
        </div>
        {current === 'A' ? <VariantA state={state} /> : current === 'B' ? <VariantB state={state} /> : <VariantC state={state} />}
      </PageContent>
      <PrototypeSwitcher variants={VARIANTS} current={current} />
    </>
  );
}
