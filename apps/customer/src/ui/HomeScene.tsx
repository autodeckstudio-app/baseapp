import { useState } from 'react';
import { Image, Platform, Pressable, Text, View, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { pickTopServices } from '../lib/top-services';
import { serviceImagery } from '../lib/imagery';
import { pickIdleNudge, type HomeViewProps } from './HomeView';
import { CarThumb } from './CarThumb';
import { CategoryCarImage } from './CategoryCarImage';
import { SideDrawer } from './SideDrawer';
import { NavIcon } from './NavIcon';
import { CampaignSlot } from './CampaignSlot';
import { HomeShowroom } from './HomeShowroom';
import { textStyle } from './kit';

const dark = '#141d25';
const white = '#f3f0eb';
const mutedWhite = '#b7c2c9';
const gradient = (value: string): ViewStyle => Platform.OS === 'web' ? { backgroundImage: value } as ViewStyle : {};
const display = (size: number, color: string): TextStyle => ({ ...textStyle('display'), fontSize: size, lineHeight: Math.round(size * 1.25), fontWeight: '500', letterSpacing: -.6, color });
const label = (color: string): TextStyle => ({ ...textStyle('body'), fontSize: 9, lineHeight: 14, letterSpacing: 1, color, textTransform: 'uppercase' });
function Link({ title, onPress, color, underline = true }: { title: string; onPress: () => void; color: string; underline?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? .65 : 1 })}><Text style={{ ...textStyle('body'), color, fontSize: 11, lineHeight: 17, ...(underline ? { borderBottomWidth: 1, borderBottomColor: `${color}45`, paddingBottom: 4 } : {}) }}>{title}</Text></Pressable>;
}

/** One personal scene owns vehicle identity and its single priority action. No duplicate visit hero. */
export function HomeScene({ p }: { p: HomeViewProps }) {
  const { name } = useExperienceTheme();
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 16 : 20;
  const bleed = { marginHorizontal: -gutter };
  const day = name === 'light';
  const ink = day ? '#22282d' : white;
  const muted = day ? '#626e78' : '#acb7be';
  const line = day ? '#233f5525' : '#d7e6ef24';
  const accent = day ? '#9a480d' : '#f7ad73';
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
  return <View testID="home-scene" style={{ ...bleed, marginTop: -16, backgroundColor: day ? '#f3f4f1' : '#1c252c' }}>
    {p.drawer?.length ? <SideDrawer open={menu} onClose={() => setMenu(false)} name={p.displayName ?? 'AutoDeck'} initial={p.initial} items={p.drawer} /> : null}
    <View testID="home-personal-stage" style={{ backgroundColor: dark, paddingHorizontal: gutter, paddingTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => p.drawer?.length ? setMenu(true) : p.onAvatar()} style={{ width: 44, height: 44, borderRadius: 24, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: white, fontSize: 13 }}>{p.initial}</Text></Pressable>
        <Text style={{ ...textStyle('body'), fontSize: 12, letterSpacing: 2.5, color: white }}>AUTODECK</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={p.unread ? `Notifications, ${p.unread} unread` : 'Notifications'} onPress={p.onBell} style={{ width: 44, height: 44, borderRadius: 24, borderWidth: 1, borderColor: '#d7e6ef24', alignItems: 'center', justifyContent: 'center' }}><NavIcon name="bell" color={white} size={18} cut={dark} />{p.unread > 0 ? <View style={{ position: 'absolute', right: 8, top: 8, height: 6, width: 6, borderRadius: 4, backgroundColor: '#f7ad73' }} /> : null}</Pressable>
      </View>
      <Text testID="home-greeting" style={{ color: mutedWhite, fontSize: 11, marginTop: 24 }}>{p.greeting}</Text>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
        <Text numberOfLines={2} style={{ ...display(width < 360 ? 23 : 27, white), flex: 1 }}>{car?.title ?? 'Your garage'}</Text>
        {car ? <Link title="Switch car" onPress={p.onGarage} color={mutedWhite} underline={false} /> : null}
      </View>
      {car ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${car.title}`} onPress={() => p.onCar(car)} style={{ marginHorizontal: -gutter, marginTop: 8 }}>
        {car.vehicle?.photoUrl ? <CarThumb car={car.vehicle} height={195} radius={0} /> : <CategoryCarImage category={car.category ?? car.vehicle?.category ?? null} height={195} />}
      </Pressable> : null}
      {car?.plate || car?.story ? <View style={{ paddingVertical: 12, gap: 4 }}>{car.plate ? <Text style={{ color: mutedWhite, fontSize: 11, letterSpacing: .8 }}>{car.plate}</Text> : null}{car.story ? <Text style={{ color: mutedWhite, fontSize: 11 }}>{car.story}</Text> : null}</View> : null}
      <View testID="home-state-dock" style={{ borderTopWidth: 1, borderColor: '#c4d9e929', paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}><Text style={label('#efa66f')}>{kicker}</Text><Text style={display(20, white)}>{title}</Text>{detail ? <Text style={{ color: mutedWhite, fontSize: 11, lineHeight: 17 }}>{detail}</Text> : null}{event?.ready ? <Text style={{ color: mutedWhite, fontSize: 11 }}>Ready by {event.ready}</Text> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={press} style={({ pressed }) => ({ minHeight: 44, maxWidth: 112, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: '#e7b58a45', opacity: pressed ? .65 : 1 })}><Text style={{ color: white, fontSize: 12 }}>{action}</Text></Pressable>
      </View>
      {car ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#c4d9e91c', paddingVertical: 2 }}><Link title="Garage & papers" onPress={() => p.onCar(car)} color={mutedWhite} underline={false} /><Link title="Open car" onPress={() => p.onCar(car)} color={mutedWhite} underline={false} /></View> : null}
    </View>
    <View style={{ paddingHorizontal: gutter }}>
      {p.stories ? <View style={{ paddingTop: 18, paddingBottom: 12 }}>{p.stories}</View> : null}
      {p.banner ? <View style={{ paddingTop: 16 }}>{p.banner}</View> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, paddingTop: 22, paddingBottom: 18 }}><Text accessibilityRole="header" style={{ ...display(width < 360 ? 22 : 25, ink), flex: 1 }}>{'Complete car care.\nAll under one roof.'}</Text><Link title="All services" onPress={p.onAllServices} color={muted} /></View>
      {wash ? <Pressable accessibilityRole="button" accessibilityLabel="Wash & care" onPress={() => servicePress(wash)} style={{ ...bleed, height: 237, justifyContent: 'flex-end', backgroundColor: dark }}>
        <Image source={serviceImagery.washing} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} />
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#0b162038', ...gradient('linear-gradient(180deg,#0b162000,#0b162020 35%,#0b1620ed)') }} />
        <View style={{ padding: 20, gap: 6 }}><Text style={label('#eab991')}>Washing</Text><Text style={display(24, white)}>Wash & care</Text><Text style={{ fontSize: 11, color: '#d5dce1', textDecorationLine: 'underline', lineHeight: 22 }}>Choose your wash</Text></View>
      </Pressable> : null}
      {coat || entrances.length ? <View testID="home-service-triad" style={{ flexDirection: 'row', gap: 11, paddingTop: 23, paddingBottom: 26 }}>
        {coat ? <Pressable accessibilityRole="button" accessibilityLabel="Ceramic coating" onPress={() => servicePress(coat)} style={{ flex: 1, height: 214, borderRadius: 24, borderWidth: 1, borderColor: line, overflow: 'hidden', backgroundColor: dark, justifyContent: 'flex-end' }}><Image source={serviceImagery.ceramic} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} /><View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#111b2466', ...gradient('linear-gradient(180deg,#111b2430,#111b2440 33%,#111b24e0 68%,#111b24fa)') }} /><View style={{ paddingHorizontal: 14, paddingBottom: 17, gap: 8 }}><Text style={label('#e5c4a2')}>Protect</Text><Text style={display(width < 340 ? 18 : 20, white)}>{'Ceramic\ncoating'}</Text><Text style={{ fontSize: 10, color: '#c5cdd2' }}>Explore options</Text></View></Pressable> : null}
        {entrances.length ? <View style={{ flex: 1, gap: 11, minHeight: 214 }}>{entrances.map(s => <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.title} onPress={() => servicePress(s)} style={({ pressed }) => ({ flex: 1, padding: 14, borderRadius: 24, borderWidth: 1, borderColor: line, backgroundColor: day ? '#ffffff66' : '#ffffff03', opacity: pressed ? .65 : 1, ...gradient(day ? 'linear-gradient(125deg,#ffffffaa,#ffffff30)' : 'linear-gradient(125deg,#ffffff09,#ffffff02)') })}><Text style={label(accent)}>{s.key === 'garage' ? 'Maintain' : 'Understand'}</Text><Text style={{ ...display(13, ink), lineHeight: 19, marginTop: 11 }}>{s.title}</Text></Pressable>)}</View> : null}
      </View> : null}
      <View testID="home-club" style={{ ...bleed, paddingHorizontal: gutter, paddingVertical: 28, minHeight: 209, overflow: 'hidden', backgroundColor: day ? '#edece5' : '#ffffff04' }}>
        <View pointerEvents="none" style={{ position: 'absolute', width: 177, height: 164, right: width < 340 ? -50 : -22, top: 95, transform: [{ rotate: '-21deg' }] }}>{[0,1,2].map(i => <View key={i} style={{ position: 'absolute', width: 83, height: 151, left: 27*i, top: 7*i, borderRadius: 9999, borderWidth: 1, borderColor: '#bc95675c', backgroundColor: '#d9ad7509' }} />)}</View>
        <Text style={label(accent)}>Autodeck Club</Text><Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.75} style={{ ...display(width < 340 ? 22 : 26, ink), marginTop: 10, marginBottom: 10 }}>Make care a habit</Text><Text style={{ color: muted, fontSize: 11, lineHeight: 18, maxWidth: '70%' }}>{p.membership ? `${p.membership.title} ${p.membership.detail}` : 'Find your regular wash plan.'}</Text><View style={{ marginTop: 6 }}><Link title={p.membership ? 'View membership' : 'Explore the Club'} onPress={p.onMembership} color={ink} /></View>
      </View>
      <CampaignSlot campaign={p.campaign} />
      {p.carsList?.length && p.onOpenCar && p.onBuyCar && p.onSellCar ? <HomeShowroom cars={p.carsList} onOpen={p.onOpenCar} onBuy={p.onBuyCar} onSell={p.onSellCar} /> : null}
      <View style={{ borderTopWidth: 1, borderColor: line, paddingTop: 18, marginTop: 26, paddingBottom: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`The studio, ${p.studio.hours}${p.studio.openText ? `, ${p.studio.openText}` : ''}. Open the studio page`} onPress={p.onStudio} style={{ minHeight: 64, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><Text style={display(18, ink)}>The studio</Text>{p.studio.openText ? <Text style={{ color: muted, fontSize: 10, flexShrink: 1 }}>{p.studio.openText}</Text> : null}</View><Text style={{ color: muted, fontSize: 11 }}>{p.studio.hours}</Text></Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 12 }}>{p.quick?.map(q => <Link key={q.key} title={q.label} onPress={q.onPress} color={muted} underline={false} />)}{p.social?.map(s => <Link key={s.key} title={s.icon === 'channel' ? 'Channel' : s.title} onPress={s.onPress} color={muted} underline={false} />)}</View>
      </View>
    </View>
  </View>;
}
