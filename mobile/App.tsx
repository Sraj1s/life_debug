import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { addCheckin, addCommitment, Commitment, getCommitments, getInsights, Insight, Reason, Status } from './src/api';

const C = { bg:'#FAF9F6', ink:'#20231F', muted:'#62685F', sage:'#DCE8D4', green:'#52735B', line:'#DFE1DA', white:'#FFFFFF' };
type Tab = 'Today' | 'Check-in' | 'Reflect' | 'Routine';
const reasons: { label: string; value: Reason }[] = [
 { label:"I'm somewhere else", value:'outside' }, { label:"I'm tired", value:'tired' },
 { label:'I got distracted', value:'distracted' }, { label:'The task feels difficult', value:'too_difficult' }, { label:'Something else', value:'other' }
];

export default function App() {
 const [tab,setTab] = useState<Tab>('Today');
 const [items,setItems] = useState<Commitment[]>([]);
 const [insight,setInsight] = useState<Insight | null>(null);
 const [selected,setSelected] = useState<number | null>(null);
 const [reason,setReason] = useState<Reason | undefined>();
 const [title,setTitle] = useState('');
 const [time,setTime] = useState('07:00');
 const [loading,setLoading] = useState(true);
 const [error,setError] = useState('');
 const refresh = useCallback(async () => {
   try {
     const [commitments,insights] = await Promise.all([getCommitments(),getInsights()]);
     setItems(commitments); setInsight(insights);
     setSelected(old => old !== null && commitments.some(x=>x.id===old) ? old : commitments[0]?.id ?? null);
     setError('');
   } catch { setError('Cannot reach the local backend. Start FastAPI and check EXPO_PUBLIC_API_URL.'); }
   finally { setLoading(false); }
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const create = async () => {
   if (!title.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return Alert.alert('Check details','Enter a title and HH:MM time.');
   try { await addCommitment(title,time); setTitle(''); await refresh(); setTab('Today'); }
   catch { Alert.alert('Could not save','Check the API connection.'); }
 };
 const check = async (status: Status) => {
   if (selected === null) return;
   try { await addCheckin(selected,status,reason); setReason(undefined); await refresh(); setTab('Reflect'); }
   catch { Alert.alert('Could not save','Check the API connection.'); }
 };
 const heading = (eyebrow:string,heading:string)=><View style={{marginBottom:12}}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.hero}>{heading}</Text></View>;
 const button = (label:string,onPress:()=>void,secondary=false)=><Pressable accessibilityRole="button" onPress={onPress} style={[s.button,secondary && s.secondary]}><Text style={[s.buttonText,secondary && {color:C.ink}]}>{label}</Text></Pressable>;

 return <SafeAreaView style={s.root}><StatusBar barStyle="dark-content" backgroundColor={C.bg}/>
 <ScrollView contentContainerStyle={s.content}>
   <View style={s.brand}><View style={s.mark}><Text style={{fontSize:24,color:C.sage,fontWeight:'700'}}>↻</Text><Text style={s.letter}>L</Text></View><Text style={s.wordmark}>life debug.</Text></View>
   {loading ? <ActivityIndicator color={C.green}/> : <>
   {!!error && <Text style={{color:'#A03C3C'}}>{error}</Text>}
   {tab==='Today' && <>{heading('YOUR DAY, YOUR PACE','Today.')}
     <View style={s.highlight}><Text style={s.big}>{insight?.completed ?? 0} / {insight?.checkins ?? 0}</Text><Text style={s.muted}>Completed check-ins / total logged</Text></View>
     <Text style={s.section}>Your commitments</Text>
     {items.length===0 && <Text style={s.muted}>Start with one small commitment.</Text>}
     {items.map(item=><Pressable key={item.id} style={s.task} onPress={()=>{setSelected(item.id);setTab('Check-in');}}><Text style={s.eyebrow}>{item.scheduled_time}</Text><Text style={s.taskTitle}>{item.title}</Text><Text style={s.muted}>Tap to check in →</Text></Pressable>)}
     {button('+ Add commitment',()=>setTab('Routine'))}
   </>}
   {tab==='Check-in' && <>{heading('A MOMENT TO RESET','How did it go?')}
     {items.length===0 ? <Text style={s.muted}>Add a commitment first.</Text> : <>
       <Text style={s.section}>Choose commitment</Text>
       {items.map(item=><Pressable key={item.id} style={[s.choice,selected===item.id && s.selected]} onPress={()=>setSelected(item.id)}><Text style={s.text}>{item.title} · {item.scheduled_time}</Text></Pressable>)}
       <Text style={s.section}>What got in the way? (optional)</Text>
       {reasons.map(r=><Pressable key={r.value} style={[s.choice,reason===r.value && s.selected]} onPress={()=>setReason(r.value)}><Text style={s.text}>{r.label}</Text></Pressable>)}
       {button('I completed it',()=>void check('completed'))}
       {button('I missed it',()=>void check('missed'),true)}
       {button('I rescheduled it',()=>void check('rescheduled'),true)}
     </>}
   </>}
   {tab==='Reflect' && <>{heading('YOUR DAILY REFLECTION','A day in review.')}
     <Text style={s.section}>{insight?.completion_rate == null ? 'Start your story.' : insight.completion_rate+'% completed'}</Text>
     <View style={s.highlight}><Text style={s.reflection}>{insight?.reflection ?? 'Check in to get a reflection.'}</Text></View>
     <Text style={s.muted}>Based on logged events, not a diagnosis or proof of causes.</Text>
     {button('Back to today',()=>setTab('Today'))}
   </>}
   {tab==='Routine' && <>{heading('MAKE SPACE FOR WHAT MATTERS','Your rhythm.')}
     <Text style={s.muted}>One small commitment is enough to begin.</Text>
     <Text style={s.section}>What will you do?</Text><TextInput style={s.input} placeholder="Study Python" placeholderTextColor={C.muted} value={title} onChangeText={setTitle} maxLength={120}/>
     <Text style={s.section}>At what time? (HH:MM)</Text><TextInput style={s.input} placeholder="07:00" placeholderTextColor={C.muted} value={time} onChangeText={setTime} maxLength={5}/>
     {button('Save commitment',()=>void create())}
   </>}
   </>}
 </ScrollView><View style={s.nav}>{(['Today','Check-in','Reflect','Routine'] as Tab[]).map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:tab===t}} onPress={()=>setTab(t)}><Text style={[s.navText,tab===t && {color:C.green,fontWeight:'800'}]}>{t}</Text></Pressable>)}</View></SafeAreaView>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg},content:{paddingHorizontal:28,paddingTop:24,paddingBottom:40,gap:14,flexGrow:1},
 brand:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:15},mark:{height:38,width:38,backgroundColor:C.ink,borderRadius:12,alignItems:'center',justifyContent:'center'},letter:{position:'absolute',color:C.sage,fontSize:13,fontWeight:'900',top:12,left:15},wordmark:{color:C.ink,fontSize:20,fontWeight:'700'},
 eyebrow:{color:C.green,fontWeight:'700',fontSize:12,letterSpacing:1.2},hero:{fontSize:44,color:C.ink,fontWeight:'700',letterSpacing:-1.5,marginTop:10},
 highlight:{backgroundColor:C.sage,borderRadius:23,padding:22,gap:8},big:{fontSize:42,color:C.ink,fontWeight:'700'},muted:{fontSize:14,color:C.muted,lineHeight:21},
 section:{fontSize:20,fontWeight:'700',color:C.ink,marginTop:8},task:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.line,gap:5},taskTitle:{fontSize:19,fontWeight:'600',color:C.ink},
 button:{backgroundColor:C.ink,borderRadius:19,padding:17,alignItems:'center',marginTop:10},buttonText:{color:C.white,fontSize:15,fontWeight:'700'},secondary:{backgroundColor:C.sage},
 choice:{padding:16,borderRadius:14,backgroundColor:C.white,borderWidth:1,borderColor:C.line},selected:{backgroundColor:C.sage,borderColor:C.green},text:{fontSize:15,color:C.ink},
 reflection:{fontSize:19,fontWeight:'600',color:C.ink,lineHeight:28},input:{padding:16,borderRadius:14,backgroundColor:C.white,borderColor:C.line,borderWidth:1,color:C.ink,fontSize:16},
 nav:{flexDirection:'row',justifyContent:'space-around',paddingVertical:18,borderTopWidth:1,borderTopColor:C.line},navText:{fontSize:12,fontWeight:'600',color:C.muted}
});
