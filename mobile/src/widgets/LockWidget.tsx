import { AccessoryWidgetBackground, Gauge, HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, gaugeStyle, lineLimit, minimumScaleFactor, monospacedDigit, privacySensitive } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { WidgetProps } from '../core/widgetData';

/**
 * Tidemark on the Lock Screen: a progress gauge (circular), the trend and this week (rectangular), or one line above
 * the clock (inline). iOS draws these in the wallpaper's tint, so they use no colours of their own, and every number is
 * marked private so iOS can hide it while the phone is locked.
 */
const LockWidget = (p: WidgetProps, env: WidgetEnvironment) => {
  'widget';
  const fam = env.widgetFamily;
  const ok = p.state === 'ok';
  const unit = p.unit ? ` ${p.unit}` : '';

  if (fam === 'accessoryCircular') {
    return (
      <ZStack>
        <AccessoryWidgetBackground />
        {ok
          ? <Gauge value={p.pct} modifiers={[gaugeStyle('circularCapacity'), privacySensitive()]}
              currentValueLabel={<Text modifiers={[font({ size: 12, weight: 'semibold', design: 'rounded' }), monospacedDigit()]}>{`${Math.round(p.pct * 100)}%`}</Text>}>
              <Text>Progress</Text>
            </Gauge>
          : <Image systemName={p.state === 'locked' ? 'lock.fill' : 'scalemass'} size={20} />}
      </ZStack>
    );
  }

  if (fam === 'accessoryInline') {
    return (
      <HStack>
        <Image systemName="gauge.with.needle" />
        <Text modifiers={[privacySensitive()]}>{ok ? `${p.trend}${unit}${p.status ? ` · ${p.status.toLowerCase()}` : ''}` : p.state === 'locked' ? 'Tidemark is locked' : 'Log a weigh-in'}</Text>
      </HStack>
    );
  }

  // Rectangular
  return (
    <VStack alignment="leading" spacing={1}>
      <HStack spacing={4}>
        <Image systemName="gauge.with.needle" size={11} />
        <Text modifiers={[font({ size: 11, weight: 'semibold' })]}>TREND</Text>
      </HStack>
      {ok ? (
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), monospacedDigit(), privacySensitive(), lineLimit(1), minimumScaleFactor(0.7)]}>{`${p.trend}${unit}`}</Text>
          <Text modifiers={[font({ size: 12 }), privacySensitive(), lineLimit(1), minimumScaleFactor(0.8)]}>{p.week || p.toGo}</Text>
        </VStack>
      ) : (
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(2)]}>{p.state === 'locked' ? 'Locked with Face ID' : 'No weigh-ins yet'}</Text>
      )}
    </VStack>
  );
};

export default createWidget<WidgetProps>('LockWidget', LockWidget);
