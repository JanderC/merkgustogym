import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Gráfico de barras de UNA serie (sin doble eje: cada medida va en su propio gráfico). */
export function BarSerie<T extends Record<string, unknown>>({
  data,
  x,
  y,
  color = '#FF8A10',
  height = 220,
  formatY = (v: number) => String(v),
  formatX = (v: string) => v,
  nombre,
  horizontal,
  allowDecimals = true,
}: {
  data: T[];
  x: keyof T & string;
  y: keyof T & string;
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
  formatX?: (v: string) => string;
  nombre: string;
  horizontal?: boolean;
  allowDecimals?: boolean;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 8 : -8, bottom: 0 }} barCategoryGap={horizontal ? 6 : '22%'}>
          <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={!!horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={formatY} stroke="#4A525D" tick={{ fill: '#7B8390', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={x} width={130} tickFormatter={formatX} stroke="#4A525D" tick={{ fill: '#BABFC8', fontSize: 12 }} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tickFormatter={formatX} stroke="#4A525D" tick={{ fill: '#7B8390', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
              <YAxis allowDecimals={allowDecimals} tickFormatter={formatY} stroke="#4A525D" tick={{ fill: '#7B8390', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            </>
          )}
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,.04)' }}
            contentStyle={{ background: '#1C2025', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 13 }}
            labelStyle={{ color: '#EEF0F3', fontWeight: 700 }}
            itemStyle={{ color: '#BABFC8' }}
            labelFormatter={(l) => formatX(String(l))}
            formatter={(v) => [formatY(Number(v)), nombre]}
          />
          <Bar isAnimationActive={false} dataKey={y} fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 18 : 28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Línea de UNA serie (evolución de una medida en el tiempo). */
export function LineaSerie<T extends Record<string, unknown>>({ data, x, y, color = '#FF8A10', height = 160, formatY = (v: number) => String(v), formatX = (v: string) => v, nombre }: { data: T[]; x: keyof T & string; y: keyof T & string; color?: string; height?: number; formatY?: (v: number) => string; formatX?: (v: string) => string; nombre: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
          <XAxis dataKey={x} tickFormatter={formatX} stroke="#4A525D" tick={{ fill: '#7B8390', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis domain={['auto', 'auto']} tickFormatter={formatY} stroke="#4A525D" tick={{ fill: '#7B8390', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,.15)' }}
            contentStyle={{ background: '#14171C', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: '#BABFC8' }}
            labelFormatter={(v) => formatX(String(v))}
            formatter={(v) => [formatY(Number(v)), nombre]}
          />
          <Line type="monotone" dataKey={y} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
