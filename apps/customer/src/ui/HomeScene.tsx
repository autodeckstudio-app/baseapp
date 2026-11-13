import { useState } from 'react';
import { Image, Platform, Pressable, Text, View, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { pickTopServices } from '../lib/top-services';
import { serviceImagery } from '../lib/imagery';
import { pickIdleNudge, type HomeViewProps } from './HomeView';
import { SideDrawer } from './SideDrawer';
import { CampaignSlot } from './CampaignSlot';
import { HomeShowroom } from './HomeShowroom';
import { textStyle } from './kit';
import{HomeOriginalTop}from './HomeOriginalTop';
import { raised } from '../lib/raised';
import { NavIcon } from './NavIcon';
import { StudioFooterMockup } from './StudioFooterMockup';

const gradient = (value: string): ViewStyle => Platform.OS === 'web' ? { backgroundImage: value } as ViewStyle : {};
const display = (size: number, color: string): TextStyle => ({ ...textStyle(size >= 25 ? 'title' : 'heading'), fontSize: size, lineHeight: Math.round(size * 1.3), color });
const label = (color: string): TextStyle => ({ ...textStyle('label'), color });
function Link({ title, onPress, color, underline = true }: { title: string; onPress: () => void; color: string; underline?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? .65 : 1 })}><Text style={{ ...textStyle('body'), color, fontSize: 12, lineHeight: 18, ...(underline ? { borderBottomWidth: 1, borderBottomColor: `${color}45`, paddingBottom: 4 } : {}) }}>{title}</Text></Pressable>;
}

/** One personal scene owns vehicle identity and its single priority action. No duplicate visit hero. */
export function HomeScene({ p }: { p: HomeViewProps }) {
  const { name, colors } = useExperienceTheme();
  const surfaces = raised(name);
  const dark = colors.surface;
  const white = colors.textPrimary;
  const mutedWhite = colors.textSecondary;
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 16 : 20;
  const bleed = { marginHorizontal: -gutter };
  const ink = colors.textPrimary;
  const muted = colors.textSecondary;
  const line = colors.borderSubtle;
  const accent = colors.accentStrong;
  const [menu, setMenu] = useState(false);
  // The adapter's first vehicle is the canonical active vehicle. Do not switch
  // the photo locally while leaving its reminders/jobs scoped to another car.
  const car = p.cars[0];
  const event = p.live && !p.live.idle ? p.live : null;
  const nudge = event ? null : pickIdleNudge({ reminder: p.reminders[0] ?? null, need: p.need, rebook: p.rebook, onReminder: p.onReminders });
  const kicker = event?.kicker ?? nudge?.kicker ?? 'Ready when you are';
  const title = event?.title ?? nudge?.title ?? (car ? `Care for ${car.title}` : 'Add your car to begin');
  const detail = event?.detail ?? nudge?.detail ?? p.live?.detail ?? '';
  const action = event ? (event.kicker === 'Needs your OK' ? 'Review' : event.kicker === 'Next visit' || event.kicker === 'Payment due' ? 'View' : 'Track') : nudge?.cta ?? (car ? 'Book a service' : 'Add your car');
  const press = event?.onPress ?? nudge?.onPress ?? (car ? p.live?.onPress ?? p.onBook : p.onAddCar);
  const top = pickTopServices(p.services);
  const wash = top.find(s => s.key === 'wash');
  const coat = top.find(s => s.key === 'coat');
  const entrances = top.filter(s => s.key === 'garage' || s.key === 'inspect');
  const servicePress = (s: typeof top[number]) => p.onService(s.service, s.key);
  return <View testID="home-scene" style={{ ...bleed, marginTop: -16 }}>
    {p.drawer?.length ? <SideDrawer open={menu} onClose={() => setMenu(false)} name={p.displayName ?? 'AutoDeck'} initial={p.initial} items={p.drawer} /> : null}
    <View style={{paddingHorizontal:gutter,paddingTop:16}}><HomeOriginalTop p={p} onMenu={()=>p.drawer?.length?setMenu(true):p.onAvatar()}/></View>
    {event || nudge ? <View testID="home-personal-stage" style={{paddingHorizontal:gutter}}>
      <View testID="home-state-dock" style={{ borderTopWidth: 1, borderColor: colors.borderSubtle, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}><Text style={label(accent)}>{kicker}</Text><Text style={display(20, white)}>{title}</Text>{detail ? <Text style={{ ...textStyle('body'),  color: mutedWhite, fontSize: 12, lineHeight: 18 }}>{detail}</Text> : null}{event?.ready ? <Text style={{ ...textStyle('body'),  color: mutedWhite, fontSize: 12 }}>Ready by {event.ready}</Text> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={press} style={({ pressed }) => ({ minHeight: 44, maxWidth: 112, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: colors.borderStrong, opacity: pressed ? .65 : 1 })}><Text style={{ ...textStyle('body'),  color: white, fontSize: 12 }}>{action}</Text></Pressable>
      </View>

    </View> : null}
    <View style={{ paddingHorizontal: gutter }}>
      {p.banner ? <View style={{ paddingTop: 16 }}>{p.banner}</View> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, paddingTop: 22, paddingBottom: 18 }}><Text accessibilityRole="header" style={{ ...display(width < 360 ? 22 : 25, ink), flex: 1 }}>Services for you</Text><Link title="All services" onPress={p.onAllServices} color={muted} /></View>
      {wash ? <Pressable accessibilityRole="button" accessibilityLabel="Wash & care" onPress={() => servicePress(wash)} style={{ ...bleed, height: 237, justifyContent: 'flex-end', backgroundColor: dark }}>
        <Image source={serviceImagery.washing} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} />
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#0b162038', ...gradient('linear-gradient(180deg,#0b162000,#0b162020 35%,#0b1620ed)') }} />
        <View style={{ padding: 20, gap: 6 }}><Text style={label('#FFFFFF')}>Washing</Text><Text style={display(24, '#FFFFFF')}>Wash & care</Text><Text style={{ ...textStyle('body'),  fontSize: 12, color: '#FFFFFF', textDecorationLine: 'underline', lineHeight: 22 }}>Choose your wash</Text></View>
      </Pressable> : null}
      {coat || entrances.length ? <View testID="home-service-triad" style={{ flexDirection: 'row', gap: 11, paddingTop: 23, paddingBottom: 26 }}>
        {coat ? <Pressable accessibilityRole="button" accessibilityLabel="Ceramic coating" onPress={() => servicePress(coat)} style={{ flex: 1, height: 214, borderRadius: 24, borderWidth: 1, borderColor: line, overflow: 'hidden', backgroundColor: dark, justifyContent: 'flex-end' }}><Image source={serviceImagery.ceramic} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} /><View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#111b2466', ...gradient('linear-gradient(180deg,#111b2430,#111b2440 33%,#111b24e0 68%,#111b24fa)') }} /><View style={{ paddingHorizontal: 14, paddingBottom: 17, gap: 8 }}><Text style={label('#FFFFFF')}>Protect</Text><Text style={display(width < 340 ? 18 : 20, '#FFFFFF')}>{'Ceramic\ncoating'}</Text><Text style={{ ...textStyle('body'),  fontSize: 12, color: '#FFFFFF' }}>Explore options</Text></View></Pressable> : null}
        {entrances.length ? <View style={{ flex: 1, gap: 11, minHeight: 214 }}>{entrances.map(s => <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.title} onPress={() => servicePress(s)} style={({ pressed }) => ({ flex: 1, ...surfaces.card, padding: 14, borderRadius: 24, opacity: pressed ? .65 : 1 })}><Text style={label(accent)}>{s.key === 'garage' ? 'Maintain' : 'Understand'}</Text><Text style={{ ...textStyle('body'),  ...display(13, ink), lineHeight: 19, marginTop: 11 }}>{s.title}</Text></Pressable>)}</View> : null}
      </View> : null}
      <View testID="home-club" style={{ ...bleed, paddingHorizontal: gutter, paddingVertical: 28, minHeight: 209, overflow: 'hidden', ...surfaces.card, borderRadius:0, borderWidth:0 }}>
        <View pointerEvents="none" style={{ position: 'absolute', width: 177, height: 164, right: width < 340 ? -50 : -22, top: 95, transform: [{ rotate: '-21deg' }] }}>{[0,1,2].map(i => <View key={i} style={{ position: 'absolute', width: 83, height: 151, left: 27*i, top: 7*i, borderRadius: 9999, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.accentHaze }} />)}</View>
        <Text style={label(accent)}>Autodeck Club</Text><Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.75} style={{ ...display(width < 340 ? 22 : 26, ink), marginTop: 10, marginBottom: 10 }}>Make care a habit</Text><Text style={{ ...textStyle('body'),  color: muted, fontSize: 12, lineHeight: 18, maxWidth: '70%' }}>{p.membership ? `${p.membership.title} ${p.membership.detail}` : 'Find your regular wash plan.'}</Text><View style={{ marginTop: 6 }}><Link title={p.membership ? 'View membership' : 'Explore the Club'} onPress={p.onMembership} color={ink} /></View>
      </View>
      <CampaignSlot campaign={p.campaign} />
      {p.carsList?.length && p.onOpenCar && p.onBuyCar && p.onSellCar ? <HomeShowroom cars={p.carsList} onOpen={p.onOpenCar} onBuy={p.onBuyCar} onSell={p.onSellCar} /> : null}
      <View style={{ borderTopWidth: 1, borderColor: line, paddingTop: 18, marginTop: 26, paddingBottom: 0 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`The studio, ${p.studio.hours}${p.studio.openText ? `, ${p.studio.openText}` : ''}. Open the studio page`} onPress={p.onStudio} style={{ minHeight: 64, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><Text style={display(18, ink)}>The studio</Text>{p.studio.openText ? <Text style={{ ...textStyle('body'),  color: muted, fontSize: 12, flexShrink: 1 }}>{p.studio.openText}</Text> : null}</View><Text style={{ ...textStyle('body'),  color: muted, fontSize: 12 }}>{p.studio.hours}</Text></Pressable>
        <View testID="home-studio-contacts" style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 12 }}>{p.quick?.map(q => <Pressable key={q.key} accessibilityRole="button" accessibilityLabel={q.label} onPress={q.onPress} style={({ pressed }) => ({ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .65 : 1 })}><NavIcon name={q.icon} color={ink} size={24} cut={colors.surface} /></Pressable>)}{p.social?.map(s => <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.icon === 'channel' ? 'Channel' : s.title} onPress={s.onPress} style={({ pressed }) => ({ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .65 : 1 })}><NavIcon name={s.icon} color={ink} size={24} cut={colors.surface} /></Pressable>)}</View>
        <StudioFooterMockup />
      </View>
    </View>
  </View>;
}
