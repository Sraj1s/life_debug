import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authConfigured, supabase } from './src/auth';
import { ActivityIndicator, Alert, AppState, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { addCheckin, addCommitment, Commitment, getCommitments, getInsights, getAIReflection, getCheckins, getPlanSuggestions, AIReflection, CheckIn, Insight, PlanSuggestions, Reason, Status } from './src/api';
import * as SecureStore from 'expo-secure-store';
import { cancelCommitmentReminder, cancelReminders, localDay, scheduleReminder } from './src/reminders';

const C = { bg:'#FAF9F6', ink:'#20231F', muted:'#62685F', sage:'#DCE8D4', green:'#52735B', line:'#DFE1DA', white:'#FFFFFF' };
type Tab = 'Today' | 'Check-in' | 'Reflect' | 'Routine';
const reasons: { label: string; value: Reason }[] = [
 { label:"I'm somewhere else", value:'outside' }, { label:"I'm tired", value:'tired' },
 { label:'I got distracted', value:'distracted' }, { label:'The task feels difficult', value:'too_difficult' }, { label:'Something else', value:'other' }
];

export default function App() {
 const [session,setSession] = useState<Session | null>(null);
 const [checking,setChecking] = useState(true);
 const [email,setEmail] = useState('');
 const [password,setPassword] = useState('');
 const [confirmationSent,setConfirmationSent] = useState(false);
 const [signing,setSigning] = useState(false);
 const [register,setRegister] = useState(false);

 useEffect(() => {
   if (!authConfigured) { setChecking(false); return; }
   let mounted = true;
   void supabase.auth.getSession().then(({data}) => { if (mounted) { setSession(data.session); setChecking(false); } })
     .catch(() => { if (mounted) setChecking(false); });
   const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, next) => {
     if (mounted) { setSession(next); setChecking(false); }
   });
   return () => { mounted = false; subscription.unsubscribe(); };
 }, []);

 const submitEmail = async () => {
   const address = email.trim().toLowerCase();
   if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(address)) return Alert.alert('Check email','Enter a valid email address.');
   if (!password) return Alert.alert('Password required','Enter your password.');
   if (register && password.length < 6) return Alert.alert('Password too short','Use at least six characters.');
   setSigning(true);
   try {
     if (register) {
       const {data,error} = await supabase.auth.signUp({email:address,password});
       if (error) throw error;
       if (data.session) {
         Alert.alert('Account created','You are now signed in.');
       } else {
         setConfirmationSent(true);
       }
     } else {
       const {error} = await supabase.auth.signInWithPassword({email:address,password});
       if (error) throw error;
     }
   } catch (error) {
     Alert.alert(register ? 'Could not sign up' : 'Could not sign in',error instanceof Error ? error.message : 'Try again.');
   } finally {setSigning(false);}
 };
 const resendConfirmation = async () => {
   setSigning(true);
   try {
     const {error} = await supabase.auth.resend({type:'signup',email:email.trim().toLowerCase()});
     if (error) throw error;
     Alert.alert('Email requested','Check your inbox and spam folder for the confirmation link.');
   } catch (error) {
     Alert.alert('Could not resend',error instanceof Error ? error.message : 'Try again later.');
   } finally {setSigning(false);}
 };
 if (checking) return <SafeAreaView style={s.root}><ActivityIndicator style={{flex:1}} color={C.green}/></SafeAreaView>;
 if (!authConfigured) return <SafeAreaView style={s.root}><View style={s.authWrap}>
   <Text style={s.hero}>life debug.</Text>
   <Text style={s.muted}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in mobile/.env, then restart Expo to enable sign-in.</Text>
 </View></SafeAreaView>;
 if (!session) return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled">
   <Text style={s.eyebrow}>NOTICE. ADJUST. BEGIN AGAIN.</Text>
   <Text style={s.hero}>{confirmationSent ? 'Check your email.' : register ? 'Create your space.' : 'Welcome back.'}</Text>
   <Text style={s.muted}>{confirmationSent ? 'We sent a confirmation link to '+email.trim()+'. Open the link in your email, then return here to sign in.' : 'Your routines and reflections belong to you.'}</Text>
   {!confirmationSent ? <>
     <TextInput accessibilityLabel="Email" textContentType="emailAddress" autoComplete="email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} placeholder="Email address" style={s.input}/>
     <TextInput accessibilityLabel="Password" textContentType={register ? 'newPassword' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" style={s.input}/>
     <Pressable accessibilityRole="button" disabled={signing} style={[s.button,signing && s.dimmed]} onPress={()=>void submitEmail()}>
       <Text style={s.buttonText}>{signing ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Text>
     </Pressable>
     <View style={s.switchRow}><Text style={s.muted}>{register ? 'Already have an account?' : 'New to Life Debug?'}</Text>
       <Pressable accessibilityRole="button" onPress={()=>{setRegister(!register);setPassword('');}}><Text style={s.switchLink}>{register ? 'Sign in' : 'Sign up'}</Text></Pressable></View>
   </> : <>
     <Pressable accessibilityRole="button" disabled={signing} style={[s.button,signing && s.dimmed]} onPress={()=>void resendConfirmation()}><Text style={s.buttonText}>{signing ? 'Sending…' : 'Resend confirmation email'}</Text></Pressable>
     <Pressable accessibilityRole="button" onPress={()=>{setConfirmationSent(false);setRegister(false);setPassword('');}}><Text style={s.switchLink}>I confirmed my email. Sign in</Text></Pressable>
   </>}
 </ScrollView></SafeAreaView>;
 return <SignedInApp key={session.user.id} owner={session.user.id}/>;
}

const basicSuggestions = ['Study for 20 minutes', 'Take a 10-minute walk', 'Plan tomorrow for 5 minutes'];

function SignedInApp({owner}:{owner:string}) {
 const [tab,setTab] = useState<Tab>('Today');
 const [items,setItems] = useState<Commitment[]>([]);
 const [insight,setInsight] = useState<Insight | null>(null);
 const [aiReflection,setAIReflection] = useState<string | null>(null);
 const [checkins,setCheckins] = useState<CheckIn[]>([]);
 const [today,setToday] = useState(localDay);
 const [dayOffset,setDayOffset] = useState(0);
 const [remind,setRemind] = useState(false);
 const [plan,setPlan] = useState<PlanSuggestions | null>(null);
 const [planning,setPlanning] = useState(false);
 const [dailyEnabled,setDailyEnabled] = useState(false);
 const [dailyResult,setDailyResult] = useState<AIReflection | null>(null);
 const [saving,setSaving] = useState(false);
 const writing = useRef(false);
 const refreshId = useRef(0);
 const prefKey = 'daily-reflections.' + owner;
 const cacheKey = 'daily-reflection-cache.' + owner;
 const plannedDate = localDay(new Date(), dayOffset);
 const doneToday = new Set(checkins.filter(event =>
   event.status === 'completed' && localDay(new Date(event.created_at)) === today
 ).map(event => event.commitment_id));
 const hasCheckins = Boolean(insight?.checkins);
 const activeItems = items.filter(item =>
   (!item.planned_date || item.planned_date <= today) && !doneToday.has(item.id)
 );
 const [aiSource,setAISource] = useState<'ai' | 'rules' | null>(null);
 const [aiLoading,setAILoading] = useState(false);
 const [selected,setSelected] = useState<number | null>(null);
 const currentSelection = activeItems.some(item => item.id === selected) ? selected : activeItems[0]?.id;
 const [reason,setReason] = useState<Reason | undefined>();
 const [title,setTitle] = useState('');
 const [time,setTime] = useState('07:00');
 const [loading,setLoading] = useState(true);
 const [error,setError] = useState('');
 const refresh = useCallback(async () => {
   const id = ++refreshId.current;
   try {
     const [commitments,insights,events] = await Promise.all([getCommitments(),getInsights(),getCheckins()]);
     if (id !== refreshId.current) return;
     setCheckins(events);
     void cancelReminders(owner, commitments.map(item => item.id)).catch(() => {});
     setItems(commitments); setInsight(insights); setAIReflection(null); setAISource(null);
     setSelected(old => old !== null && commitments.some(x=>x.id===old) ? old : commitments[0]?.id ?? null);
     setError('');
   } catch (cause) {
     if (id === refreshId.current) setError(cause instanceof Error ? cause.message : 'Cannot reach the backend. Check EXPO_PUBLIC_API_URL.');
   } finally { if (id === refreshId.current) setLoading(false); }
 },[owner]);
 useEffect(()=>{
   void refresh();
   const state = AppState.addEventListener('change', next => {
     if (next === 'active') { setToday(localDay()); void refresh(); }
   });
   const clock = setInterval(() => setToday(localDay()), 30_000);
   return () => { state.remove(); clearInterval(clock); };
 },[refresh]);
 useEffect(() => {
   let active = true;
   void SecureStore.getItemAsync(prefKey).then(value => {
     if (active) setDailyEnabled(value === 'on');
   }).catch(() => {});
   return () => { active = false; };
 }, [prefKey]);
 useEffect(() => {
   setDailyResult(null);
   if (!dailyEnabled || !hasCheckins) return;
   let active = true;
   void (async () => {
     const raw = await SecureStore.getItemAsync(cacheKey);
     if (!active) return;
     const cached = raw ? JSON.parse(raw) as { date: string; result: AIReflection } : null;
     if (cached?.date === today) {
       setDailyResult(cached.result);
       return;
     }
     const result = await getAIReflection();
     if (!active) return;
     setDailyResult(result);
     await SecureStore.setItemAsync(cacheKey, JSON.stringify({ date: today, result }));
   })().catch(() => {});
   return () => { active = false; };
 }, [cacheKey, dailyEnabled, hasCheckins, today]);
 const toggleDaily = async () => {
   try {
     await SecureStore.setItemAsync(prefKey, dailyEnabled ? 'off' : 'on');
     setDailyEnabled(!dailyEnabled);
   } catch {
     Alert.alert('Could not save preference', 'Try again on your phone.');
   }
 };
 const suggest = async () => {
   setPlanning(true);
   try { setPlan(await getPlanSuggestions()); }
   catch { Alert.alert('Suggestions unavailable', 'You can still choose a starter or write your own.'); }
   finally { setPlanning(false); }
 };
 const signOut = async () => {
   if (writing.current) return;
   try {
     await cancelReminders(owner);
     const {error} = await supabase.auth.signOut();
     if (error) throw error;
   } catch {
     Alert.alert('Could not sign out', 'Try again.');
   }
 };
 const create = async () => {
   if (!title.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return Alert.alert('Check details','Enter a title and HH:MM time.');
   if (writing.current) return;
   const reminderDate = new Date(plannedDate + 'T' + time + ':00');
   if (remind && reminderDate.getTime() <= Date.now()) {
     return Alert.alert('Choose a future time', 'The reminder time needs to be in the future.');
   }
   writing.current = true;
   setSaving(true);
   try {
     const item = await addCommitment(title,time,plannedDate);
     if (remind) {
       try {
         const copy = plan ?? await getPlanSuggestions().catch(() => null);
         await scheduleReminder(owner, item.id, reminderDate,
           copy?.reminder ?? 'Ready for your commitment? Start with one small step.');
       } catch (cause) {
         Alert.alert('Commitment saved', cause instanceof Error ? cause.message : 'The reminder could not be scheduled.');
       }
     }
     setTitle('');
     setRemind(false);
     await refresh();
     setTab('Today');
   } catch (cause) {
     Alert.alert('Could not save', cause instanceof Error ? cause.message : 'Check the API connection.');
   } finally {
     writing.current = false;
     setSaving(false);
   }
 };
 const check = async (status: Status) => {
   if (currentSelection == null || writing.current) return;
   writing.current = true;
   setSaving(true);
   try {
     await addCheckin(currentSelection,status,status === 'completed' ? undefined : reason);
     if (status === 'completed') {
       setCheckins(events => [{ commitment_id: currentSelection, status, created_at: new Date().toISOString() }, ...events]);
       await cancelCommitmentReminder(owner, currentSelection).catch(() => {
         Alert.alert('Check-in saved', 'The phone could not cancel the reminder.');
       });
     }
     setReason(undefined);
     await refresh();
     setTab('Reflect');
   } catch { Alert.alert('Could not save','Check the API connection.'); }
   finally { writing.current = false; setSaving(false); }
 };
 const askAI = async () => {
   setAILoading(true);
   try {
     const result = await getAIReflection();
     setAIReflection(result.reflection);
     setAISource(result.source);
   } catch (cause) {
     Alert.alert('Could not generate reflection',cause instanceof Error ? cause.message : 'Try again later.');
   } finally {setAILoading(false);}
 };
 const heading = (eyebrow:string,heading:string)=><View style={{marginBottom:12}}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.hero}>{heading}</Text></View>;
 const button = (label:string,onPress:()=>void,secondary=false)=><Pressable accessibilityRole="button" onPress={onPress} style={[s.button,secondary && s.secondary]}><Text style={[s.buttonText,secondary && {color:C.ink}]}>{label}</Text></Pressable>;

 return <SafeAreaView style={s.root}><StatusBar barStyle="dark-content" backgroundColor={C.bg}/>
 <ScrollView contentContainerStyle={s.content}>
   <View style={s.brand}><View style={s.mark}><Text style={{fontSize:24,color:C.sage,fontWeight:'700'}}>↻</Text><Text style={s.letter}>L</Text></View><Text style={s.wordmark}>life debug.</Text><Pressable accessibilityRole="button" onPress={()=>void signOut()}><Text style={s.muted}>Sign out</Text></Pressable></View>
   {loading ? <ActivityIndicator color={C.green}/> : <>
   {!!error && <Text style={{color:'#A03C3C'}}>{error}</Text>}
   {tab==='Today' && <>{heading('YOUR DAY, YOUR PACE','Today.')}
     <View style={s.highlight}><Text style={s.big}>{insight?.completed ?? 0} / {insight?.checkins ?? 0}</Text><Text style={s.muted}>Completed check-ins / total logged</Text></View>
     <Text style={s.section}>Your commitments</Text>
     {activeItems.length===0 && <Text style={s.muted}>No open commitments for today.</Text>}
     {activeItems.map(item=><Pressable key={item.id} style={s.task} onPress={()=>{setSelected(item.id);setTab('Check-in');}}><Text style={s.eyebrow}>{item.scheduled_time}</Text><Text style={s.taskTitle}>{item.title}</Text><Text style={s.muted}>Tap to check in →</Text></Pressable>)}
     {button('+ Add commitment',()=>setTab('Routine'))}
     {items.some(item => item.planned_date && item.planned_date > today) && <>
       <Text style={s.section}>Upcoming</Text>
       {items.filter(item => item.planned_date && item.planned_date > today).map(item=>
         <Text key={item.id} style={s.text}>{item.title} · {item.planned_date} · {item.scheduled_time}</Text>)}
     </>}
     {dailyResult && <View style={s.highlight}>
       <Text style={s.section}>Daily insight</Text><Text style={s.text}>{dailyResult.reflection}</Text>
       {button('Plan a next step',()=>{setDayOffset(0);setTab('Routine');},true)}
     </View>}
   </>}
   {tab==='Check-in' && <>{heading('A MOMENT TO RESET','How did it go?')}
     {activeItems.length===0 ? <Text style={s.muted}>No open commitments to check in.</Text> : <>
       <Text style={s.section}>Choose commitment</Text>
       {activeItems.map(item=><Pressable key={item.id} style={[s.choice,currentSelection===item.id && s.selected]} onPress={()=>setSelected(item.id)}><Text style={s.text}>{item.title} · {item.scheduled_time}</Text></Pressable>)}
       <Text style={s.section}>What got in the way? (optional)</Text>
       {reasons.map(r=><Pressable key={r.value} style={[s.choice,reason===r.value && s.selected]} onPress={()=>setReason(r.value)}><Text style={s.text}>{r.label}</Text></Pressable>)}
       {button('I completed it',()=>void check('completed'))}
       {button('I missed it',()=>void check('missed'),true)}
       {button('I rescheduled it',()=>void check('rescheduled'),true)}
     </>}
   </>}
   {tab==='Reflect' && <>{heading('YOUR DAILY REFLECTION','A day in review.')}
     <Text style={s.section}>{insight?.completion_rate == null ? 'Start your story.' : insight.completion_rate+'% completed'}</Text>
     <View style={s.highlight}><Text style={s.reflection}>{aiReflection ?? dailyResult?.reflection ?? insight?.reflection ?? 'Check in to get a reflection.'}</Text></View>
     {(aiSource ?? dailyResult?.source) && <Text style={s.muted}>{(aiSource ?? dailyResult?.source) === 'ai' ? 'AI-generated suggestion based on check-in totals.' : 'Rule-based reflection (AI not configured or unavailable).'}</Text>}
     <Text style={s.muted}>Optional: requesting an AI reflection sends aggregated check-in statistics and obstacle categories to the configured AI provider. No notes or identity details are sent.</Text>
     <Pressable accessibilityRole="button" disabled={aiLoading || !insight?.checkins} style={[s.button,(aiLoading || !insight?.checkins) && s.dimmed]} onPress={()=>void askAI()}><Text style={s.buttonText}>{aiLoading ? 'Generating…' : 'Generate AI reflection'}</Text></Pressable>
     <Text style={s.muted}>Based on logged events, not a diagnosis or proof of causes.</Text>
     {button(dailyEnabled ? 'Turn off daily AI insights' : 'Enable daily AI insights',()=>void toggleDaily(),true)}
     <Text style={s.muted}>When enabled, Life Debug generates an insight when you open the app each day using check-in totals and obstacle categories.</Text>
     {button('Back to today',()=>setTab('Today'))}
   </>}
   {tab==='Routine' && <>{heading('MAKE SPACE FOR WHAT MATTERS','Your rhythm.')}
     <Text style={s.muted}>One small commitment is enough to begin.</Text>
     <View style={s.switchRow}>{['Today','Tomorrow'].map((label,index)=>
       <Pressable key={label} accessibilityRole="button" accessibilityState={{selected:dayOffset===index}}
         style={[s.choice,dayOffset===index && s.selected]} onPress={()=>setDayOffset(index)}>
         <Text style={s.text}>{label}</Text>
       </Pressable>)}</View>
     <Text style={s.section}>What will you do {dayOffset ? 'tomorrow' : 'today'}?</Text>
     {(plan?.suggestions ?? basicSuggestions).map(option=>
       <Pressable key={option} accessibilityRole="button" style={s.choice} onPress={()=>setTitle(option)}>
         <Text style={s.text}>{option}</Text>
       </Pressable>)}
     {plan?.source === 'rules' && <Text style={s.muted}>Showing starter ideas.</Text>}
     <Pressable accessibilityRole="button" disabled={planning} style={s.secondary} onPress={()=>void suggest()}>
       <Text style={s.switchLink}>{planning ? 'Finding ideas…' : 'Suggest options with AI'}</Text>
     </Pressable>
     <Text style={s.muted}>AI ideas and reminder wording use check-in totals and obstacle categories.</Text>
     <TextInput accessibilityLabel="Commitment title"  style={s.input} placeholder="Study Python" placeholderTextColor={C.muted} value={title} onChangeText={setTitle} maxLength={120}/>
     <Text style={s.section}>At what time? (HH:MM)</Text><TextInput style={s.input} placeholder="07:00" placeholderTextColor={C.muted} value={time} onChangeText={setTime} maxLength={5}/>
     <Pressable accessibilityRole="checkbox" accessibilityState={{checked:remind}} style={[s.choice,remind && s.selected]} onPress={()=>setRemind(!remind)}>
       <Text style={s.text}>{remind ? '✓ ' : ''}Remind me at this time</Text>
     </Pressable>
     <Pressable accessibilityRole="button" disabled={saving} style={[s.button,saving && s.dimmed]} onPress={()=>void create()}>
       <Text style={s.buttonText}>{saving ? 'Saving…' : 'Save commitment'}</Text>
     </Pressable>
   </>}
   </>}
 </ScrollView><View style={s.nav}>{(['Today','Check-in','Reflect','Routine'] as Tab[]).map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:tab===t}} onPress={()=>setTab(t)}><Text style={[s.navText,tab===t && {color:C.green,fontWeight:'800'}]}>{t}</Text></Pressable>)}</View></SafeAreaView>;
}
const s=StyleSheet.create({
 authWrap:{flexGrow:1,justifyContent:'center',paddingHorizontal:28,gap:18,backgroundColor:C.bg},
 root:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:28,paddingTop:24,paddingBottom:40,gap:14,flexGrow:1},
 brand:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:15},mark:{height:38,width:38,backgroundColor:C.ink,borderRadius:12,alignItems:'center',justifyContent:'center'},letter:{position:'absolute',color:C.sage,fontSize:13,fontWeight:'900',top:12,left:15},wordmark:{color:C.ink,fontSize:20,fontWeight:'700'},
 eyebrow:{color:C.green,fontWeight:'700',fontSize:12,letterSpacing:1.2},hero:{fontSize:44,color:C.ink,fontWeight:'700',letterSpacing:-1.5,marginTop:10},
 highlight:{backgroundColor:C.sage,borderRadius:23,padding:22,gap:8},big:{fontSize:42,color:C.ink,fontWeight:'700'},muted:{fontSize:14,color:C.muted,lineHeight:21},
 section:{fontSize:20,fontWeight:'700',color:C.ink,marginTop:8},task:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.line,gap:5},taskTitle:{fontSize:19,fontWeight:'600',color:C.ink},
 button:{backgroundColor:C.ink,borderRadius:19,padding:17,alignItems:'center',marginTop:10},buttonText:{color:C.white,fontSize:15,fontWeight:'700'},secondary:{backgroundColor:C.sage},
 choice:{padding:16,borderRadius:14,backgroundColor:C.white,borderWidth:1,borderColor:C.line},selected:{backgroundColor:C.sage,borderColor:C.green},text:{fontSize:15,color:C.ink},
 reflection:{fontSize:19,fontWeight:'600',color:C.ink,lineHeight:28},input:{padding:16,borderRadius:14,backgroundColor:C.white,borderColor:C.line,borderWidth:1,color:C.ink,fontSize:16},
 switchRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:12},switchLink:{fontSize:15,fontWeight:'800',color:'#246D46',textDecorationLine:'underline'},orRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:6},orLine:{height:1,backgroundColor:C.line,flex:1},googleButton:{backgroundColor:C.white,borderColor:C.line,borderWidth:1,borderRadius:19,padding:15,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:12},googleMark:{fontSize:22,fontWeight:'800',color:'#4285F4'},googleText:{fontSize:16,fontWeight:'700',color:C.ink},dimmed:{opacity:0.55},
 nav:{flexDirection:'row',justifyContent:'space-around',paddingVertical:18,borderTopWidth:1,borderTopColor:C.line},navText:{fontSize:12,fontWeight:'600',color:C.muted}
});
