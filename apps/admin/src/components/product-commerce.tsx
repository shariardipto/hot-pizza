'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { convertMinor, type PriceRounding } from '@app/shared/commerce';
import { errorMessage, get, put } from '@/lib/api';
import { fromMinorInput, money, toMinorInput } from '@/lib/utils';
import { Badge, Button, Card, Field, Input, Loading, Switch } from './ui';

interface MarketRow {
  id: string;
  name: string;
  currency: string;
  isDefault: boolean;
  enabled: boolean;
  exchangeRate: number;
  rounding: PriceRounding;
}

/** SKU, stock and per-market prices of a product. Empty market price = converted from the default market. */
export function ProductCommerce({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['commerce', productId],
    queryFn: () =>
      get<{ commerce: { sku: string | null; orderable: boolean; trackStock: boolean; stock: number; maxPerOrder: number }; prices: { marketId: string; amount: number; compareAtAmount: number | null }[]; markets: MarketRow[] }>(
        `/products/${productId}/commerce`,
      ),
  });
  const [form, setForm] = useState({ sku: '', orderable: true, trackStock: false, stock: 0, maxPerOrder: 24 });
  const [prices, setPrices] = useState<Record<string, { amount: string; compare: string }>>({});

  useEffect(() => {
    if (!data) return;
    setForm({ sku: data.commerce.sku ?? '', orderable: data.commerce.orderable, trackStock: data.commerce.trackStock, stock: data.commerce.stock, maxPerOrder: data.commerce.maxPerOrder });
    const p: Record<string, { amount: string; compare: string }> = {};
    for (const m of data.markets) {
      const row = data.prices.find((x) => x.marketId === m.id);
      p[m.id] = { amount: row ? fromMinorInput(row.amount, m.currency) : '', compare: row?.compareAtAmount ? fromMinorInput(row.compareAtAmount, m.currency) : '' };
    }
    setPrices(p);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      put(`/products/${productId}/commerce`, {
        sku: form.sku || null,
        orderable: form.orderable,
        trackStock: form.trackStock,
        stock: Number(form.stock) || 0,
        maxPerOrder: Number(form.maxPerOrder) || 1,
        prices: data!.markets
          .filter((m) => prices[m.id]?.amount)
          .map((m) => ({ marketId: m.id, amount: toMinorInput(prices[m.id]!.amount, m.currency), compareAtAmount: prices[m.id]!.compare ? toMinorInput(prices[m.id]!.compare, m.currency) : null })),
      }),
    onSuccess: () => {
      toast.success('Prices & stock saved');
      qc.invalidateQueries({ queryKey: ['commerce', productId] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || !data) return <Loading />;
  const def = data.markets.find((m) => m.isDefault);
  const defPrice = def && prices[def.id]?.amount ? toMinorInput(prices[def.id]!.amount, def.currency) : null;

  return (
    <div className="space-y-5">
      <Card title="Availability">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="PZ-MARGHERITA" />
          </Field>
          <Field label="Max. quantity per order">
            <Input type="number" min={1} value={form.maxPerOrder} onChange={(e) => setForm({ ...form, maxPerOrder: Number(e.target.value) })} />
          </Field>
          <Switch checked={form.orderable} onChange={(v) => setForm({ ...form, orderable: v })} label="Can be ordered online" description="Shows the “Add to order” block on the product page." />
          <div className="space-y-3">
            <Switch checked={form.trackStock} onChange={(v) => setForm({ ...form, trackStock: v })} label="Track stock" description="Stock is reserved when an order is placed and returned if it is cancelled." />
            {form.trackStock ? (
              <Field label="In stock">
                <Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
              </Field>
            ) : null}
          </div>
        </div>
      </Card>
      <Card title="Prices by market" description="Leave a market empty to convert automatically from the default market (exchange rate + rounding are set per market).">
        <div className="divide-y divide-zinc-100">
          {data.markets.map((m) => {
            const auto = !prices[m.id]?.amount && defPrice !== null && def && m.id !== def.id ? convertMinor(defPrice, def.currency, m.currency, m.exchangeRate, m.rounding) : null;
            return (
              <div key={m.id} className="grid items-end gap-3 py-3 md:grid-cols-[1fr_10rem_10rem]">
                <div>
                  <p className="font-medium">
                    {m.name} {m.isDefault ? <Badge color="blue">default</Badge> : null} {!m.enabled ? <Badge>disabled</Badge> : null}
                  </p>
                  <p className="text-xs text-zinc-500">{auto !== null ? `Automatic: ${money(auto, m.currency)}` : m.currency}</p>
                </div>
                <Field label={`Price (${m.currency})`}>
                  <Input inputMode="decimal" value={prices[m.id]?.amount ?? ''} placeholder={auto !== null ? fromMinorInput(auto, m.currency) : ''} onChange={(e) => setPrices({ ...prices, [m.id]: { ...prices[m.id]!, amount: e.target.value } })} />
                </Field>
                <Field label="Compare-at (optional)">
                  <Input inputMode="decimal" value={prices[m.id]?.compare ?? ''} onChange={(e) => setPrices({ ...prices, [m.id]: { ...prices[m.id]!, compare: e.target.value } })} />
                </Field>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          <Save className="size-4" /> Save prices & stock
        </Button>
      </div>
    </div>
  );
}
