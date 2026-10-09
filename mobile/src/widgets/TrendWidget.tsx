import { Gauge, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground, font, foregroundStyle, frame, gaugeStyle, lineLimit, minimumScaleFactor, monospacedDigit, offset, opacity,
  padding, privacySensitive, tint
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { WidgetProps } from '../core/widgetData';

/**
 * Tidemark's Home Screen widget: the trend, this week's change and how far to go, with the last 30 days drawn as
 * dots (the trend in coral, each weigh-in faint) on the medium and large sizes. Everything comes in through props
 * (see core/widgetData.ts); this function runs in the widget's own runtime, so it can't reach anything outside itself.
 */
const TrendWidget = (p: WidgetProps, env: WidgetEnvironment) => {
  'widget';
  const PAPER = '#FBF7F3', SOFT = '#C9BFD6', CORAL = '#FF6B5E', AMBER = '#FFA24B', GOOD = '#7FF0C8', OVER = '#FFB0A6';
  const fam = env.widgetFamily;
  const tinted = env.widgetRenderingMode === 'accented';   // iOS tints the whole widget: keep to one colour
  const bg = containerBackground({ type: 'linearGradient', colors: ['#2A1E45', '#4B2E73'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }, 'widget');
  const soft = foregroundStyle(SOFT), paper = foregroundStyle(PAPER);
  const toneColor = p.weekTone === 'good' ? GOOD : p.weekTone === 'bad' ? OVER : SOFT;

  const brand = (
    <HStack spacing={5}>
      <Image systemName="gauge.with.needle" size={11} color={tinted ? PAPER : CORAL} />
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), soft]}>{fam === 'systemSmall' ? 'TREND' : 'TIDEMARK · TREND'}</Text>
    </HStack>
  );

  if (p.state !== 'ok') {
    const locked = p.state === 'locked';
    return (
      <VStack alignment="leading" spacing={6} modifiers={[bg, frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' })]}>
        {brand}
        <Spacer />
        <Image systemName={locked ? 'lock.fill' : 'scalemass'} size={22} color={PAPER} />
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), paper]}>{locked ? 'Locked' : 'No weigh-ins yet'}</Text>
        <Text modifiers={[font({ size: 12 }), soft, lineLimit(3)]}>
          {locked ? 'Tidemark is locked with Face ID, so your numbers stay in the app.' : 'Log your first weight in Tidemark and your trend appears here.'}
        </Text>
      </VStack>
    );
  }

  const big = (size: number) => (
    <HStack alignment="firstTextBaseline" spacing={3} modifiers={[privacySensitive()]}>
      <Text modifiers={[font({ size, weight: 'bold', design: 'rounded' }), paper, monospacedDigit(), minimumScaleFactor(0.6), lineLimit(1)]}>{p.trend}</Text>
      {p.unit ? <Text modifiers={[font({ size: Math.round(size * 0.38), weight: 'medium' }), soft]}>{p.unit}</Text> : null}
    </HStack>
  );
  const week = p.week
    ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(tinted ? PAPER : toneColor), privacySensitive(), lineLimit(1), minimumScaleFactor(0.8)]}>{p.week}</Text>
    : null;
  const gauge = (size: number) => (
    <Gauge value={p.pct} modifiers={[gaugeStyle('circularCapacity'), tint(tinted ? PAPER : AMBER), frame({ width: size, height: size }), privacySensitive()]}>
      <Text>Progress</Text>
    </Gauge>
  );

  // The 30-day chart: one column per day, the trend as a coral dot and that day's weigh-in as a faint one
  const chart = (w: number, h: number) => {
    const n = p.trendY.length, cw = w / Math.max(1, n), dot = 4;
    return (
      <HStack spacing={0} modifiers={[frame({ width: w, height: h }), privacySensitive()]}>
        {p.trendY.map((t, i) => (
          <ZStack key={i} alignment="top" modifiers={[frame({ width: cw, height: h, alignment: 'top' })]}>
            {p.dotY[i] >= 0 ? <Image systemName="circle.fill" size={3} color={PAPER} modifiers={[opacity(0.45), offset({ x: 0, y: (1 - p.dotY[i]) * (h - dot) })]} /> : null}
            {t >= 0 ? <Image systemName="circle.fill" size={i === n - 1 ? 7 : dot} color={tinted ? PAPER : i === n - 1 ? CORAL : AMBER}
              modifiers={[offset({ x: 0, y: (1 - t) * (h - dot) - (i === n - 1 ? 1.5 : 0) })]} /> : null}
          </ZStack>
        ))}
      </HStack>
    );
  };

  if (fam === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[bg, frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' })]}>
        {brand}
        {big(34)}
        {week}
        <Spacer />
        <HStack spacing={8}>
          {gauge(34)}
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), paper, privacySensitive(), lineLimit(1), minimumScaleFactor(0.8)]}>{p.toGo}</Text>
            {p.status ? <Text modifiers={[font({ size: 11 }), soft]}>{p.status}</Text> : null}
          </VStack>
        </HStack>
      </VStack>
    );
  }

  if (fam === 'systemMedium') {
    return (
      <HStack spacing={12} modifiers={[bg]}>
        <VStack alignment="leading" spacing={4} modifiers={[frame({ width: 116, maxHeight: 1000, alignment: 'topLeading' })]}>
          {brand}
          {big(32)}
          {week}
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), paper, privacySensitive(), lineLimit(1), minimumScaleFactor(0.8)]}>{p.toGo}</Text>
          {p.status ? <Text modifiers={[font({ size: 11 }), soft]}>{p.status}</Text> : null}
        </VStack>
        <VStack alignment="trailing" spacing={4}>
          {chart(168, 104)}
          <Text modifiers={[font({ size: 10 }), soft]}>Last 30 days</Text>
        </VStack>
      </HStack>
    );
  }

  // Large: the chart across the width, and the last seven days' weigh-ins underneath
  return (
    <VStack alignment="leading" spacing={8} modifiers={[bg]}>
      <HStack>
        <VStack alignment="leading" spacing={4}>
          {brand}
          {big(40)}
          {week}
        </VStack>
        <Spacer />
        <VStack alignment="center" spacing={3}>
          {gauge(52)}
          <Text modifiers={[font({ size: 11 }), soft, privacySensitive()]}>{p.toGo}</Text>
        </VStack>
      </HStack>
      {chart(296, 132)}
      <HStack spacing={0} modifiers={[padding({ top: 4 })]}>
        {p.week7.map((x, i) => (
          <VStack key={i} spacing={2} modifiers={[frame({ width: 296 / 7 })]}>
            <Text modifiers={[font({ size: 10 }), soft]}>{x.day}</Text>
            <Text modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), foregroundStyle(x.kg === '–' ? SOFT : PAPER), monospacedDigit(), privacySensitive()]}>{x.kg}</Text>
          </VStack>
        ))}
      </HStack>
      <Text modifiers={[font({ size: 10 }), soft]}>{p.status ? `${p.status} · ` : ''}Updated {p.updated}</Text>
    </VStack>
  );
};

export default createWidget<WidgetProps>('TrendWidget', TrendWidget);
